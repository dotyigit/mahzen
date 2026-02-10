//
//  TransferManager.swift
//  Mahzen
//

import Foundation
import Combine

@MainActor
final class TransferManager: ObservableObject {

    @Published private(set) var transfers: [TransferItem] = []
    @Published private(set) var isTransferring: Bool = false

    var onUploadCompleted: (() -> Void)?

    private let transferSession = S3TransferSession()
    private var activeTasks: [UUID: Task<Void, Never>] = [:]
    private let maxConcurrent = 4

    // MARK: - Computed Properties

    var activeCount: Int { transfers.count(where: { !$0.status.isTerminal && $0.status.fractionCompleted >= 0 && !isQueued($0) }) }
    var completedCount: Int { transfers.count(where: { if case .completed = $0.status { return true }; return false }) }
    var hasVisibleTransfers: Bool { !transfers.isEmpty }

    /// Overall batch progress across all queued (0%), active (fraction), and completed (100%) transfers.
    var aggregateProgress: Double {
        let relevant = transfers.filter {
            switch $0.status {
            case .queued, .active, .completed: return true
            default: return false
            }
        }
        guard !relevant.isEmpty else { return 0 }
        let totalWeight = relevant.compactMap(\.totalBytes).reduce(Int64(0), +)
        if totalWeight > 0 {
            let weighted = relevant.reduce(0.0) { sum, item in
                sum + item.fractionCompleted * Double(item.totalBytes ?? 0)
            }
            return weighted / Double(totalWeight)
        }
        // Equal weight fallback when sizes are unknown.
        return relevant.reduce(0.0) { $0 + $1.fractionCompleted } / Double(relevant.count)
    }

    private func isQueued(_ item: TransferItem) -> Bool {
        if case .queued = item.status { return true }
        return false
    }

    private var runningCount: Int {
        transfers.count(where: { if case .active = $0.status { return true }; return false })
    }

    // MARK: - Download

    func downloadObject(
        target: StorageTarget,
        credentials: S3Credentials,
        bucket: String,
        key: String,
        to destinationURL: URL
    ) {
        let sizeBytes = (try? FileManager.default.attributesOfItem(atPath: destinationURL.path)[.size] as? Int64) ?? nil
        let item = TransferItem(direction: .download, bucket: bucket, key: key, totalBytes: sizeBytes)
        transfers.append(item)
        updateIsTransferring()
        processQueue(target: target, credentials: credentials, destinationForDownload: [item.id: destinationURL])
    }

    func downloadObjects(
        target: StorageTarget,
        credentials: S3Credentials,
        bucket: String,
        keys: [String],
        to directoryURL: URL
    ) {
        var destinations: [UUID: URL] = [:]
        for key in keys {
            let fileName = (key as NSString).lastPathComponent
            let dest = directoryURL.appendingPathComponent(fileName)
            let item = TransferItem(direction: .download, bucket: bucket, key: key)
            transfers.append(item)
            destinations[item.id] = dest
        }
        updateIsTransferring()
        processQueue(target: target, credentials: credentials, destinationForDownload: destinations)
    }

    // MARK: - Upload

    func uploadFile(
        target: StorageTarget,
        credentials: S3Credentials,
        bucket: String,
        prefix: String,
        fileURL: URL
    ) {
        let fileName = fileURL.lastPathComponent
        let key = prefix.isEmpty ? fileName : (prefix.hasSuffix("/") ? prefix + fileName : prefix + "/" + fileName)
        let fileSize = (try? FileManager.default.attributesOfItem(atPath: fileURL.path)[.size] as? Int64) ?? nil
        let item = TransferItem(direction: .upload, bucket: bucket, key: key, totalBytes: fileSize)
        transfers.append(item)
        updateIsTransferring()
        processQueue(target: target, credentials: credentials, uploadSources: [item.id: fileURL])
    }

    func uploadFiles(
        target: StorageTarget,
        credentials: S3Credentials,
        bucket: String,
        prefix: String,
        fileURLs: [URL]
    ) {
        var sources: [UUID: URL] = [:]
        for url in fileURLs {
            let fileName = url.lastPathComponent
            let key = prefix.isEmpty ? fileName : (prefix.hasSuffix("/") ? prefix + fileName : prefix + "/" + fileName)
            let fileSize = (try? FileManager.default.attributesOfItem(atPath: url.path)[.size] as? Int64) ?? nil
            let item = TransferItem(direction: .upload, bucket: bucket, key: key, totalBytes: fileSize)
            transfers.append(item)
            sources[item.id] = url
        }
        updateIsTransferring()
        processQueue(target: target, credentials: credentials, uploadSources: sources)
    }

    func uploadDirectory(
        target: StorageTarget,
        credentials: S3Credentials,
        bucket: String,
        prefix: String,
        directoryURL: URL
    ) {
        let dirName = directoryURL.lastPathComponent
        let basePrefix = prefix.isEmpty ? dirName + "/" : (prefix.hasSuffix("/") ? prefix + dirName + "/" : prefix + "/" + dirName + "/")

        guard let enumerator = FileManager.default.enumerator(at: directoryURL, includingPropertiesForKeys: [.isRegularFileKey], options: [.skipsHiddenFiles]) else { return }

        var sources: [UUID: URL] = [:]
        for case let fileURL as URL in enumerator {
            guard (try? fileURL.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile) == true else { continue }
            let relativePath = fileURL.path.replacingOccurrences(of: directoryURL.path + "/", with: "")
            let key = basePrefix + relativePath
            let fileSize = (try? FileManager.default.attributesOfItem(atPath: fileURL.path)[.size] as? Int64) ?? nil
            let item = TransferItem(direction: .upload, bucket: bucket, key: key, totalBytes: fileSize)
            transfers.append(item)
            sources[item.id] = fileURL
        }

        updateIsTransferring()
        processQueue(target: target, credentials: credentials, uploadSources: sources)
    }

    // MARK: - Cancel / Clear / Retry

    func cancelTransfer(id: UUID) {
        activeTasks[id]?.cancel()
        activeTasks[id] = nil
        transferSession.cancelTask(transferId: id)
        if let idx = transfers.firstIndex(where: { $0.id == id }), !transfers[idx].isTerminal {
            transfers[idx].status = .cancelled
        }
        updateIsTransferring()
    }

    func cancelAll() {
        for id in activeTasks.keys {
            activeTasks[id]?.cancel()
            transferSession.cancelTask(transferId: id)
        }
        activeTasks.removeAll()
        for i in transfers.indices where !transfers[i].isTerminal {
            transfers[i].status = .cancelled
        }
        updateIsTransferring()
    }

    func clearCompleted() {
        transfers.removeAll(where: \.isTerminal)
        updateIsTransferring()
    }

    // MARK: - Queue Processing

    /// Stores per-transfer context so the queue processor can find destination/source URLs.
    private var downloadDestinations: [UUID: URL] = [:]
    private var uploadSourceFiles: [UUID: URL] = [:]
    /// Stores per-transfer context for target/credentials.
    private var transferContexts: [UUID: (target: StorageTarget, credentials: S3Credentials)] = [:]

    private func processQueue(
        target: StorageTarget,
        credentials: S3Credentials,
        destinationForDownload: [UUID: URL] = [:],
        uploadSources: [UUID: URL] = [:]
    ) {
        // Store context for new items.
        for (id, url) in destinationForDownload {
            downloadDestinations[id] = url
            transferContexts[id] = (target, credentials)
        }
        for (id, url) in uploadSources {
            uploadSourceFiles[id] = url
            transferContexts[id] = (target, credentials)
        }
        drainQueue()
    }

    private func drainQueue() {
        while runningCount < maxConcurrent {
            guard let idx = transfers.firstIndex(where: { if case .queued = $0.status { return true }; return false }) else { break }
            let item = transfers[idx]
            guard let context = transferContexts[item.id] else { break }

            transfers[idx].status = .active(fractionCompleted: 0)

            let transferId = item.id
            let task = Task { [weak self] in
                guard let self else { return }
                do {
                    if item.direction == .download {
                        try await self.performDownload(item: item, target: context.target, credentials: context.credentials)
                    } else {
                        try await self.performUpload(item: item, target: context.target, credentials: context.credentials)
                    }
                } catch is CancellationError {
                    self.markStatus(id: transferId, status: .cancelled)
                } catch {
                    self.markStatus(id: transferId, status: .failed(message: error.localizedDescription))
                }
                self.activeTasks.removeValue(forKey: transferId)
                self.transferContexts.removeValue(forKey: transferId)
                self.downloadDestinations.removeValue(forKey: transferId)
                self.uploadSourceFiles.removeValue(forKey: transferId)
                self.lastProgressUpdate.removeValue(forKey: transferId)
                self.updateIsTransferring()
                self.drainQueue()

                // Fire the upload-completed callback once when the entire batch finishes.
                if !self.isTransferring {
                    let hadUploads = self.transfers.contains {
                        if case .completed = $0.status, $0.direction == .upload { return true }
                        return false
                    }
                    if hadUploads {
                        self.onUploadCompleted?()
                    }
                }
            }
            activeTasks[transferId] = task
        }
    }

    private func performDownload(item: TransferItem, target: StorageTarget, credentials: S3Credentials) async throws {
        let tempURL = try await transferSession.downloadObject(
            target: target,
            credentials: credentials,
            bucket: item.bucket,
            key: item.key,
            transferId: item.id
        ) { [weak self] fraction in
            Task { @MainActor [weak self] in
                self?.updateProgress(id: item.id, fraction: fraction)
            }
        }

        try Task.checkCancellation()

        // Move to final destination.
        if let dest = downloadDestinations[item.id] {
            let dir = dest.deletingLastPathComponent()
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            if FileManager.default.fileExists(atPath: dest.path) {
                try FileManager.default.removeItem(at: dest)
            }
            try FileManager.default.moveItem(at: tempURL, to: dest)
        } else {
            // Clean up if no destination specified (shouldn't happen).
            try? FileManager.default.removeItem(at: tempURL)
        }

        markStatus(id: item.id, status: .completed)
    }

    private func performUpload(item: TransferItem, target: StorageTarget, credentials: S3Credentials) async throws {
        guard let sourceURL = uploadSourceFiles[item.id] else {
            throw S3ServiceError(message: "Source file not found for upload.", statusCode: nil)
        }

        let contentType = ContentTypeResolver.mimeType(for: sourceURL)

        try await transferSession.uploadObject(
            target: target,
            credentials: credentials,
            bucket: item.bucket,
            key: item.key,
            fromFile: sourceURL,
            contentType: contentType,
            transferId: item.id
        ) { [weak self] fraction in
            Task { @MainActor [weak self] in
                self?.updateProgress(id: item.id, fraction: fraction)
            }
        }

        try Task.checkCancellation()
        markStatus(id: item.id, status: .completed)
    }

    // MARK: - State Helpers

    /// Throttle progress updates to ~10/sec per transfer to avoid flooding SwiftUI.
    private var lastProgressUpdate: [UUID: CFAbsoluteTime] = [:]
    private let progressUpdateInterval: CFAbsoluteTime = 0.1 // 100ms

    private func updateProgress(id: UUID, fraction: Double) {
        guard let idx = transfers.firstIndex(where: { $0.id == id }) else { return }
        guard case .active = transfers[idx].status else { return }

        // Always publish the final value (>=0.99), otherwise throttle.
        let now = CFAbsoluteTimeGetCurrent()
        if fraction < 0.99, let last = lastProgressUpdate[id], (now - last) < progressUpdateInterval {
            return
        }
        lastProgressUpdate[id] = now
        transfers[idx].status = .active(fractionCompleted: fraction)
    }

    private func markStatus(id: UUID, status: TransferStatus) {
        guard let idx = transfers.firstIndex(where: { $0.id == id }) else { return }
        transfers[idx].status = status
        updateIsTransferring()
    }

    private func updateIsTransferring() {
        isTransferring = transfers.contains(where: { !$0.isTerminal })
    }
}
