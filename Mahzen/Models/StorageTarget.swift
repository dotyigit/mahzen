//
//  StorageTarget.swift
//  Mahzen
//
//  Created by Codex on 2026-02-08.
//

import Foundation

struct StorageTarget: Identifiable, Codable, Hashable {
    enum Provider: String, Codable, CaseIterable, Hashable, Identifiable {
        case aws = "AWS S3"
        case cloudflareR2 = "Cloudflare R2"
        case digitalOcean = "DigitalOcean Spaces"
        case hetzner = "Hetzner Object Storage"
        case minio = "MinIO"
        case other = "Other (S3 Compatible)"

        var id: String { rawValue }
    }

    var id: UUID
    var name: String
    var provider: Provider
    var endpoint: URL
    /// SigV4 signing region. Optional for UX; if nil/empty we infer a sensible default per provider/endpoint.
    var region: String?
    var forcePathStyle: Bool
    /// Optional, user-provided buckets (useful when ListBuckets is not permitted).
    var pinnedBuckets: [String]

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case provider
        case endpoint
        case region
        case forcePathStyle
        case pinnedBuckets
    }

    init(
        id: UUID = UUID(),
        name: String,
        provider: Provider,
        endpoint: URL,
        region: String? = nil,
        forcePathStyle: Bool,
        pinnedBuckets: [String] = []
    ) {
        self.id = id
        self.name = name
        self.provider = provider
        self.endpoint = endpoint
        self.region = region
        self.forcePathStyle = forcePathStyle
        self.pinnedBuckets = pinnedBuckets
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try c.decode(UUID.self, forKey: .id)
        self.name = try c.decode(String.self, forKey: .name)
        self.provider = try c.decode(Provider.self, forKey: .provider)
        self.endpoint = try c.decode(URL.self, forKey: .endpoint)
        self.region = try c.decodeIfPresent(String.self, forKey: .region)
        self.forcePathStyle = try c.decode(Bool.self, forKey: .forcePathStyle)
        self.pinnedBuckets = try c.decodeIfPresent([String].self, forKey: .pinnedBuckets) ?? []
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(name, forKey: .name)
        try c.encode(provider, forKey: .provider)
        try c.encode(endpoint, forKey: .endpoint)
        try c.encodeIfPresent(region, forKey: .region)
        try c.encode(forcePathStyle, forKey: .forcePathStyle)
        try c.encode(pinnedBuckets, forKey: .pinnedBuckets)
    }
}

struct S3Credentials: Codable, Equatable {
    var accessKeyId: String
    var secretAccessKey: String
    var sessionToken: String?
}

extension StorageTarget {
    var effectiveRegion: String {
        let trimmed = region?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !trimmed.isEmpty {
            return trimmed
        }

        // Provider defaults. SigV4 requires a region string even when a provider ignores it.
        switch provider {
        case .cloudflareR2:
            return "auto"
        case .minio:
            return "us-east-1"
        case .digitalOcean:
            if let inferred = inferRegionFromFirstHostLabel() { return inferred }
            return "us-east-1"
        case .hetzner:
            if let inferred = inferRegionFromFirstHostLabel() { return inferred }
            return "us-east-1"
        case .aws:
            if let inferred = inferAWSRegion() { return inferred }
            return "us-east-1"
        case .other:
            // Best-effort: try AWS-style patterns, then fall back.
            if let inferred = inferAWSRegion() { return inferred }
            return "us-east-1"
        }
    }

    private func inferRegionFromFirstHostLabel() -> String? {
        guard let host = endpoint.host else { return nil }
        let first = host.split(separator: ".").first.map(String.init) ?? ""
        let trimmed = first.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private func inferAWSRegion() -> String? {
        guard let host = endpoint.host?.lowercased() else { return nil }

        // Examples:
        // - s3.us-east-1.amazonaws.com -> us-east-1
        // - bucket.s3.us-west-2.amazonaws.com -> us-west-2
        // - s3-eu-west-1.amazonaws.com -> eu-west-1
        // - s3.amazonaws.com -> (none) -> default us-east-1
        let labels = host.split(separator: ".").map(String.init)
        if let s3Index = labels.firstIndex(of: "s3"), s3Index + 1 < labels.count {
            let candidate = labels[s3Index + 1]
            if candidate != "amazonaws" {
                return candidate
            }
        }

        if host.hasPrefix("s3-") {
            let rest = host.dropFirst("s3-".count)
            if let end = rest.firstIndex(of: ".") {
                let candidate = String(rest[..<end])
                if !candidate.isEmpty { return candidate }
            }
        }

        // Handle "s3.<region>.amazonaws.com" patterns (already covered), and dualstack like "s3.dualstack.<region>.amazonaws.com".
        if labels.count >= 4, labels[0] == "s3", labels[1] == "dualstack" {
            let candidate = labels[2]
            if candidate != "amazonaws" { return candidate }
        }

        // Common non-regional endpoint.
        if host == "s3.amazonaws.com" {
            return "us-east-1"
        }

        return nil
    }
}
