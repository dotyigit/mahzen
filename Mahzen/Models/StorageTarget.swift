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
    /// Fixes known-bad defaults on existing targets. Returns `true` if anything changed.
    mutating func migrateIfNeeded() -> Bool {
        var changed = false

        // DO Spaces and Hetzner require path-style addressing.
        if (provider == .digitalOcean || provider == .hetzner) && !forcePathStyle {
            forcePathStyle = true
            changed = true
        }

        // Strip accidental bucket prefix from DO/Hetzner endpoints.
        // e.g. "farcale-backups.fra1.digitaloceanspaces.com" → "fra1.digitaloceanspaces.com"
        if let normalized = normalizedEndpoint(), normalized != endpoint {
            endpoint = normalized
            changed = true
        }

        return changed
    }

    /// If the endpoint contains a bucket prefix before the provider domain, strip it and return the base endpoint.
    private func normalizedEndpoint() -> URL? {
        guard let host = endpoint.host?.lowercased() else { return nil }

        let domainSuffix: String?
        switch provider {
        case .digitalOcean:
            domainSuffix = "digitaloceanspaces.com"
        case .hetzner:
            domainSuffix = "your-objectstorage.com"
        default:
            return nil
        }

        guard let suffix = domainSuffix, host.hasSuffix(suffix) else { return nil }

        let labels = host.split(separator: ".").map(String.init)
        let suffixLabels = suffix.split(separator: ".").count
        // Expected: {region}.{domain} — any extra labels are a bucket prefix.
        let expectedCount = suffixLabels + 1
        guard labels.count > expectedCount else { return nil }

        // Keep only {region}.{domain}.
        let baseHost = labels.suffix(expectedCount).joined(separator: ".")
        var comps = URLComponents(url: endpoint, resolvingAgainstBaseURL: false)!
        comps.host = baseHost
        return comps.url
    }

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
            if let inferred = inferRegionBeforeDomain("digitaloceanspaces.com") { return inferred }
            return "us-east-1"
        case .hetzner:
            if let inferred = inferRegionBeforeDomain("your-objectstorage.com") { return inferred }
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

    /// For hosts like "{region}.digitaloceanspaces.com" or "{bucket}.{region}.digitaloceanspaces.com",
    /// returns the region label (the one right before the domain suffix).
    private func inferRegionBeforeDomain(_ domainSuffix: String) -> String? {
        guard let host = endpoint.host?.lowercased(), host.hasSuffix(domainSuffix) else { return nil }
        let labels = host.split(separator: ".").map(String.init)
        let suffixLabels = domainSuffix.split(separator: ".").count
        // The region label is immediately before the domain suffix.
        let regionIndex = labels.count - suffixLabels - 1
        guard regionIndex >= 0 else { return nil }
        let region = labels[regionIndex]
        return region.isEmpty ? nil : region
    }

    private func inferAWSRegion() -> String? {
        guard let host = endpoint.host?.lowercased() else { return nil }

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

        if labels.count >= 4, labels[0] == "s3", labels[1] == "dualstack" {
            let candidate = labels[2]
            if candidate != "amazonaws" { return candidate }
        }

        if host == "s3.amazonaws.com" {
            return "us-east-1"
        }

        return nil
    }
}
