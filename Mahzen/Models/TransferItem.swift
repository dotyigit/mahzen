//
//  TransferItem.swift
//  Mahzen
//

import Foundation

enum TransferDirection: Sendable {
    case download
    case upload
}

enum TransferStatus: Sendable {
    case queued
    case active(fractionCompleted: Double)
    case completed
    case failed(message: String)
    case cancelled

    var isTerminal: Bool {
        switch self {
        case .completed, .failed, .cancelled: return true
        default: return false
        }
    }

    var fractionCompleted: Double {
        switch self {
        case .active(let f): return f
        case .completed: return 1.0
        default: return 0.0
        }
    }
}

struct TransferItem: Identifiable, Sendable {
    let id: UUID
    let direction: TransferDirection
    let bucket: String
    let key: String
    let displayName: String
    var totalBytes: Int64?
    var status: TransferStatus
    let createdAt: Date

    var isTerminal: Bool { status.isTerminal }
    var fractionCompleted: Double { status.fractionCompleted }

    init(
        id: UUID = UUID(),
        direction: TransferDirection,
        bucket: String,
        key: String,
        totalBytes: Int64? = nil,
        status: TransferStatus = .queued,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.direction = direction
        self.bucket = bucket
        self.key = key
        self.displayName = (key as NSString).lastPathComponent
        self.totalBytes = totalBytes
        self.status = status
        self.createdAt = createdAt
    }
}
