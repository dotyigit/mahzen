//
//  S3Models.swift
//  Mahzen
//
//  Created by Codex on 2026-02-08.
//

import Foundation

struct S3Bucket: Identifiable, Hashable {
    var id: String { name }
    var name: String
    var creationDate: Date?
}

struct S3Object: Identifiable, Hashable {
    var id: String { key }
    var key: String
    var lastModified: Date?
    var eTag: String?
    var sizeBytes: Int64?
    var storageClass: String?
}

struct S3ListObjectsPage: Hashable {
    var objects: [S3Object]
    var commonPrefixes: [String]
    var isTruncated: Bool
    var nextContinuationToken: String?
}

enum S3BrowserEntry: Identifiable, Hashable {
    case folder(prefix: String)
    case object(S3Object)

    var id: String {
        switch self {
        case .folder(let prefix):
            return "folder:\(prefix)"
        case .object(let obj):
            return "object:\(obj.key)"
        }
    }

    var keyOrPrefix: String {
        switch self {
        case .folder(let prefix):
            return prefix
        case .object(let obj):
            return obj.key
        }
    }

    var isFolder: Bool {
        switch self {
        case .folder:
            return true
        case .object:
            return false
        }
    }
}

