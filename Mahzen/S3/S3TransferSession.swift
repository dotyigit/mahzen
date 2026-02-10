//
//  S3TransferSession.swift
//  Mahzen
//

import Foundation
import CryptoKit

/// Delegate-based URLSession wrapper providing byte-level progress callbacks for S3 transfers.
final class S3TransferSession: NSObject, @unchecked Sendable {

    private var session: URLSession!
    private let lock = NSLock()

    // Per-task tracking keyed by URLSessionTask.taskIdentifier.
    // All access guarded by `lock` — safe to opt out of actor isolation.
    nonisolated(unsafe) private var downloadContinuations: [Int: CheckedContinuation<URL, any Error>] = [:]
    nonisolated(unsafe) private var uploadContinuations: [Int: CheckedContinuation<Void, any Error>] = [:]
    nonisolated(unsafe) private var progressHandlers: [Int: @Sendable (Double) -> Void] = [:]
    nonisolated(unsafe) private var downloadedFileURLs: [Int: URL] = [:]

    // Map transferId → URLSessionTask for cancellation.
    nonisolated(unsafe) private var transferIdToTask: [UUID: URLSessionTask] = [:]

    override init() {
        super.init()
        let config = URLSessionConfiguration.default
        config.httpMaximumConnectionsPerHost = 4
        config.timeoutIntervalForResource = 3600
        session = URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }

    // MARK: - Public API

    func downloadObject(
        target: StorageTarget,
        credentials: S3Credentials,
        bucket: String,
        key: String,
        transferId: UUID,
        onProgress: @escaping @Sendable (Double) -> Void
    ) async throws -> URL {
        let url = try S3URLBuilder.build(target: target, bucket: bucket, key: key, queryItems: [])
        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        try AWSSigV4Signer.sign(request: &req, credentials: credentials, region: target.effectiveRegion, service: "s3")

        return try await withCheckedThrowingContinuation { continuation in
            let task = session.downloadTask(with: req)
            lock.lock()
            downloadContinuations[task.taskIdentifier] = continuation
            progressHandlers[task.taskIdentifier] = onProgress
            transferIdToTask[transferId] = task
            lock.unlock()
            task.resume()
        }
    }

    func uploadObject(
        target: StorageTarget,
        credentials: S3Credentials,
        bucket: String,
        key: String,
        fromFile fileURL: URL,
        contentType: String?,
        transferId: UUID,
        onProgress: @escaping @Sendable (Double) -> Void
    ) async throws {
        let url = try S3URLBuilder.build(target: target, bucket: bucket, key: key, queryItems: [])
        var req = URLRequest(url: url)
        req.httpMethod = "PUT"

        if let contentType, !contentType.isEmpty {
            req.setValue(contentType, forHTTPHeaderField: "Content-Type")
        }

        // Pre-compute payload hash for SigV4.
        let payloadHash = try Self.sha256Hex(ofFileAt: fileURL)
        req.setValue(payloadHash, forHTTPHeaderField: "x-amz-content-sha256")

        // Set Content-Length so the delegate gets proper totalBytesSent callbacks.
        let fileSize = try FileManager.default.attributesOfItem(atPath: fileURL.path)[.size] as? Int64 ?? 0
        req.setValue(String(fileSize), forHTTPHeaderField: "Content-Length")

        try AWSSigV4Signer.sign(request: &req, credentials: credentials, region: target.effectiveRegion, service: "s3")

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, any Error>) in
            let task = session.uploadTask(with: req, fromFile: fileURL)
            lock.lock()
            uploadContinuations[task.taskIdentifier] = continuation
            progressHandlers[task.taskIdentifier] = onProgress
            transferIdToTask[transferId] = task
            lock.unlock()
            task.resume()
        }
    }

    func cancelTask(transferId: UUID) {
        lock.lock()
        let task = transferIdToTask.removeValue(forKey: transferId)
        lock.unlock()
        task?.cancel()
    }

    // MARK: - SHA256

    nonisolated private static func sha256Hex(ofFileAt url: URL) throws -> String {
        var hasher = SHA256()
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        while true {
            let chunk = try handle.read(upToCount: 1024 * 1024) ?? Data()
            if chunk.isEmpty { break }
            hasher.update(data: chunk)
        }
        return hasher.finalize().map { String(format: "%02x", $0) }.joined()
    }
}

// MARK: - URLSessionDownloadDelegate

extension S3TransferSession: URLSessionDownloadDelegate {

    nonisolated func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didWriteData bytesWritten: Int64,
        totalBytesWritten: Int64,
        totalBytesExpectedToWrite: Int64
    ) {
        let fraction: Double
        if totalBytesExpectedToWrite > 0 {
            fraction = Double(totalBytesWritten) / Double(totalBytesExpectedToWrite)
        } else {
            fraction = 0
        }
        lock.lock()
        let handler = progressHandlers[downloadTask.taskIdentifier]
        lock.unlock()
        handler?(min(fraction, 1.0))
    }

    nonisolated func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didFinishDownloadingTo location: URL
    ) {
        // Move the temp file to a stable temp location before the system cleans it up.
        let stableURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension(location.pathExtension)
        do {
            try FileManager.default.moveItem(at: location, to: stableURL)
            lock.lock()
            downloadedFileURLs[downloadTask.taskIdentifier] = stableURL
            lock.unlock()
        } catch {
            lock.lock()
            downloadedFileURLs[downloadTask.taskIdentifier] = nil
            lock.unlock()
        }
    }
}

// MARK: - URLSessionTaskDelegate

extension S3TransferSession: URLSessionTaskDelegate {

    nonisolated func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didSendBodyData bytesSent: Int64,
        totalBytesSent: Int64,
        totalBytesExpectedToSend: Int64
    ) {
        let fraction: Double
        if totalBytesExpectedToSend > 0 {
            fraction = Double(totalBytesSent) / Double(totalBytesExpectedToSend)
        } else {
            fraction = 0
        }
        lock.lock()
        let handler = progressHandlers[task.taskIdentifier]
        lock.unlock()
        handler?(min(fraction, 1.0))
    }

    nonisolated func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didCompleteWithError error: (any Error)?
    ) {
        lock.lock()
        let downloadCont = downloadContinuations.removeValue(forKey: task.taskIdentifier)
        let uploadCont = uploadContinuations.removeValue(forKey: task.taskIdentifier)
        let fileURL = downloadedFileURLs.removeValue(forKey: task.taskIdentifier)
        progressHandlers.removeValue(forKey: task.taskIdentifier)
        transferIdToTask = transferIdToTask.filter { $0.value.taskIdentifier != task.taskIdentifier }
        lock.unlock()

        if let downloadCont {
            if let error {
                downloadCont.resume(throwing: error)
            } else if let fileURL {
                if let httpResponse = task.response as? HTTPURLResponse,
                   !(200..<300).contains(httpResponse.statusCode) {
                    let msg = "HTTP \(httpResponse.statusCode)"
                    downloadCont.resume(throwing: S3ServiceError(message: msg, statusCode: httpResponse.statusCode))
                    try? FileManager.default.removeItem(at: fileURL)
                } else {
                    downloadCont.resume(returning: fileURL)
                }
            } else {
                downloadCont.resume(throwing: S3ServiceError(message: "Download completed but no file was produced.", statusCode: nil))
            }
        }

        if let uploadCont {
            if let error {
                uploadCont.resume(throwing: error)
            } else if let httpResponse = task.response as? HTTPURLResponse,
                      !(200..<300).contains(httpResponse.statusCode) {
                let msg = "HTTP \(httpResponse.statusCode)"
                uploadCont.resume(throwing: S3ServiceError(message: msg, statusCode: httpResponse.statusCode))
            } else {
                uploadCont.resume()
            }
        }
    }
}
