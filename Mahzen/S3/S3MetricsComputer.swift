//
//  S3MetricsComputer.swift
//  Mahzen
//
//  Created by Codex on 2026-02-08.
//

import Foundation

/// Aggregated stats for a bucket or prefix. Note: S3 has no "folder"; prefixes are client-side conventions.
struct S3PrefixMetrics: Hashable {
    var totalBytes: Int64
    var objectCount: Int
    var lastUpdated: Date
}

actor S3MetricsComputer {
    func computePrefixMetrics(
        target: StorageTarget,
        credentials: S3Credentials,
        bucket: String,
        prefix: String
    ) async throws -> S3PrefixMetrics {
        let client = S3Client(target: target, credentials: credentials)

        var continuation: String?
        var totalBytes: Int64 = 0
        var objectCount = 0

        while true {
            try Task.checkCancellation()

            let page = try await client.listObjectsV2(
                bucket: bucket,
                prefix: prefix,
                delimiter: nil,
                continuationToken: continuation,
                maxKeys: 1000
            )

            for obj in page.objects {
                objectCount += 1
                if let size = obj.sizeBytes {
                    totalBytes += size
                }
            }

            if page.isTruncated,
               let token = page.nextContinuationToken,
               !token.isEmpty
            {
                continuation = token
            } else {
                break
            }
        }

        return S3PrefixMetrics(
            totalBytes: totalBytes,
            objectCount: objectCount,
            lastUpdated: Date()
        )
    }
}

