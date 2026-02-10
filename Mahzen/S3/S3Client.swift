//
//  S3Client.swift
//  Mahzen
//
//  Created by Codex on 2026-02-08.
//

import Foundation
import CryptoKit

struct S3ServiceError: Error, LocalizedError {
    var message: String
    var statusCode: Int?

    var errorDescription: String? {
        if let statusCode {
            return "S3 Error (\(statusCode)): \(message)"
        }
        return "S3 Error: \(message)"
    }
}

struct S3ObjectHead: Sendable {
    var sizeBytes: Int64?
    var lastModified: Date?
    var eTag: String?
    var contentType: String?
}

struct S3Client {
    let target: StorageTarget
    let credentials: S3Credentials
    var urlSession: URLSession = .shared

    func listBuckets() async throws -> [S3Bucket] {
        let url = try S3URLBuilder.build(target: target, bucket: nil, key: nil, queryItems: [])
        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        try sign(&req)

        let (data, resp) = try await urlSession.data(for: req)
        try Self.validateHTTP(resp, data: data)

        let parser = S3ListBucketsParser()
        let xml = XMLParser(data: data)
        xml.delegate = parser
        guard xml.parse() else {
            throw S3ServiceError(message: "Failed to parse ListBuckets response.", statusCode: (resp as? HTTPURLResponse)?.statusCode)
        }
        return parser.buckets.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    func listObjectsV2(
        bucket: String,
        prefix: String,
        delimiter: String? = "/",
        continuationToken: String? = nil,
        maxKeys: Int = 1000
    ) async throws -> S3ListObjectsPage {
        var query: [URLQueryItem] = [
            URLQueryItem(name: "list-type", value: "2"),
            URLQueryItem(name: "max-keys", value: String(maxKeys))
        ]
        if let delimiter, !delimiter.isEmpty {
            query.append(URLQueryItem(name: "delimiter", value: delimiter))
        }
        if !prefix.isEmpty {
            query.append(URLQueryItem(name: "prefix", value: prefix))
        }
        if let continuationToken, !continuationToken.isEmpty {
            query.append(URLQueryItem(name: "continuation-token", value: continuationToken))
        }

        let url = try S3URLBuilder.build(target: target, bucket: bucket, key: nil, queryItems: query)
        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        try sign(&req)

        let (data, resp) = try await urlSession.data(for: req)
        try Self.validateHTTP(resp, data: data)

        let parser = S3ListObjectsV2Parser()
        let xml = XMLParser(data: data)
        xml.delegate = parser
        guard xml.parse() else {
            throw S3ServiceError(message: "Failed to parse ListObjectsV2 response.", statusCode: (resp as? HTTPURLResponse)?.statusCode)
        }

        return S3ListObjectsPage(
            objects: parser.objects,
            commonPrefixes: parser.commonPrefixes,
            isTruncated: parser.isTruncated,
            nextContinuationToken: parser.nextContinuationToken
        )
    }

    func headObject(bucket: String, key: String) async throws -> S3ObjectHead {
        let url = try S3URLBuilder.build(target: target, bucket: bucket, key: key, queryItems: [])
        var req = URLRequest(url: url)
        req.httpMethod = "HEAD"
        try sign(&req)

        let (data, resp) = try await urlSession.data(for: req)
        try Self.validateHTTP(resp, data: data)

        guard let http = resp as? HTTPURLResponse else {
            return S3ObjectHead(sizeBytes: nil, lastModified: nil, eTag: nil, contentType: nil)
        }

        let sizeBytes: Int64? = http.value(forHTTPHeaderField: "Content-Length").flatMap { Int64($0) }
        let lastModified: Date? = http.value(forHTTPHeaderField: "Last-Modified").flatMap(Self.parseHTTPDate)
        let eTag: String? = http.value(forHTTPHeaderField: "ETag")?.trimmingCharacters(in: CharacterSet(charactersIn: "\""))
        let contentType: String? = http.value(forHTTPHeaderField: "Content-Type")

        return S3ObjectHead(sizeBytes: sizeBytes, lastModified: lastModified, eTag: eTag, contentType: contentType)
    }

    /// Downloads an object to a temporary file location and returns that URL.
    /// The caller is responsible for moving the file to a suitable location and deleting it when done.
    func downloadObject(bucket: String, key: String) async throws -> URL {
        let url = try S3URLBuilder.build(target: target, bucket: bucket, key: key, queryItems: [])
        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        try sign(&req)

        let (tempURL, resp) = try await urlSession.download(for: req)
        try Self.validateHTTP(resp, data: Data())
        return tempURL
    }

    func putObject(bucket: String, key: String, body: Data, contentType: String? = nil) async throws {
        let url = try S3URLBuilder.build(target: target, bucket: bucket, key: key, queryItems: [])
        var req = URLRequest(url: url)
        req.httpMethod = "PUT"
        req.httpBody = body
        if let contentType, !contentType.isEmpty {
            req.setValue(contentType, forHTTPHeaderField: "Content-Type")
        }
        try sign(&req)

        let (data, resp) = try await urlSession.data(for: req)
        try Self.validateHTTP(resp, data: data)
    }

    func putObject(bucket: String, key: String, fromFile fileURL: URL, contentType: String? = nil) async throws {
        let url = try S3URLBuilder.build(target: target, bucket: bucket, key: key, queryItems: [])
        var req = URLRequest(url: url)
        req.httpMethod = "PUT"
        if let contentType, !contentType.isEmpty {
            req.setValue(contentType, forHTTPHeaderField: "Content-Type")
        }

        // Pre-compute the payload hash so we can stream the file without loading it into memory.
        let payloadHash = try Self.sha256Hex(ofFileAt: fileURL)
        req.setValue(payloadHash, forHTTPHeaderField: "x-amz-content-sha256")

        try sign(&req)

        let (data, resp) = try await urlSession.upload(for: req, fromFile: fileURL)
        try Self.validateHTTP(resp, data: data)
    }

    func deleteObject(bucket: String, key: String) async throws {
        let url = try S3URLBuilder.build(target: target, bucket: bucket, key: key, queryItems: [])
        var req = URLRequest(url: url)
        req.httpMethod = "DELETE"
        try sign(&req)

        let (data, resp) = try await urlSession.data(for: req)
        try Self.validateHTTP(resp, data: data)
    }

    func copyObject(bucket: String, sourceKey: String, destinationKey: String) async throws {
        let url = try S3URLBuilder.build(target: target, bucket: bucket, key: destinationKey, queryItems: [])
        var req = URLRequest(url: url)
        req.httpMethod = "PUT"
        req.setValue(AWSPercentEncoding.encodePath("/\(bucket)/\(sourceKey)"), forHTTPHeaderField: "x-amz-copy-source")
        try sign(&req)

        let (data, resp) = try await urlSession.data(for: req)
        try Self.validateHTTP(resp, data: data)
    }

    private func sign(_ request: inout URLRequest) throws {
        try AWSSigV4Signer.sign(
            request: &request,
            credentials: credentials,
            region: target.effectiveRegion,
            service: "s3"
        )
    }

    private static func validateHTTP(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else { return }
        guard (200..<300).contains(http.statusCode) else {
            let body = String(data: data, encoding: .utf8) ?? ""
            let msg = body.isEmpty ? "HTTP \(http.statusCode)" : body
            throw S3ServiceError(message: msg, statusCode: http.statusCode)
        }
    }

    private static func parseHTTPDate(_ value: String) -> Date? {
        // RFC 7231 / RFC 1123: "EEE',' dd MMM yyyy HH':'mm':'ss z"
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = TimeZone(secondsFromGMT: 0)
        fmt.dateFormat = "EEE',' dd MMM yyyy HH':'mm':'ss zzz"
        return fmt.date(from: value)
    }

    private static func sha256Hex(ofFileAt url: URL) throws -> String {
        var hasher = SHA256()
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }

        while true {
            let chunk = try handle.read(upToCount: 1024 * 1024) ?? Data()
            if chunk.isEmpty { break }
            hasher.update(data: chunk)
        }

        let digest = hasher.finalize()
        return digest.map { String(format: "%02x", $0) }.joined()
    }
}

enum S3URLBuilder {
    static func build(
        target: StorageTarget,
        bucket: String?,
        key: String?,
        queryItems: [URLQueryItem]
    ) throws -> URL {
        guard var comps = URLComponents(url: target.endpoint, resolvingAgainstBaseURL: false) else {
            throw S3ServiceError(message: "Invalid endpoint URL.", statusCode: nil)
        }

        let baseHost = comps.host ?? ""
        if let bucket, !bucket.isEmpty, !target.forcePathStyle {
            comps.host = "\(bucket).\(baseHost)"
        } else {
            comps.host = baseHost
        }

        var path = comps.path
        if path.isEmpty { path = "/" }

        if let bucket, !bucket.isEmpty, target.forcePathStyle {
            if path.hasSuffix("/") { path += bucket } else { path += "/\(bucket)" }
        }

        if let key, !key.isEmpty {
            if path.hasSuffix("/") { path += key } else { path += "/\(key)" }
        }

        comps.percentEncodedPath = AWSPercentEncoding.encodePath(path)
        comps.queryItems = queryItems.isEmpty ? nil : queryItems

        guard let url = comps.url else {
            throw S3ServiceError(message: "Failed to build request URL.", statusCode: nil)
        }
        return url
    }
}
