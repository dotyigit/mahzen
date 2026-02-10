//
//  FileCredentialsStore.swift
//  Mahzen
//
//  Fallback credentials storage for local development builds where the keychain can be
//  unavailable due to ad-hoc signing / missing entitlements.
//
//  IMPORTANT: This stores secrets on disk. Only used as a last resort.
//

import Foundation

enum FileCredentialsStoreError: Error {
    case missingCredentials
}

struct FileCredentialsStore {
    private let fileURL: URL

    init(fileURL: URL? = nil) {
        self.fileURL = fileURL ?? SharedStoragePaths.credentialsFileURL()
    }

    func saveCredentials(_ credentials: S3Credentials, targetId: UUID) throws {
        var all = try loadAll()
        all[targetId.uuidString] = credentials
        try persist(all)
    }

    func loadCredentials(targetId: UUID) throws -> S3Credentials {
        let all = try loadAll()
        guard let creds = all[targetId.uuidString] else {
            throw FileCredentialsStoreError.missingCredentials
        }
        return creds
    }

    func deleteCredentials(targetId: UUID) throws {
        var all = try loadAll()
        all.removeValue(forKey: targetId.uuidString)
        try persist(all)
    }

    private func loadAll() throws -> [String: S3Credentials] {
        do {
            let data = try Data(contentsOf: fileURL)
            return try JSONDecoder().decode([String: S3Credentials].self, from: data)
        } catch let ns as NSError {
            if ns.domain == NSCocoaErrorDomain && ns.code == NSFileReadNoSuchFileError {
                return [:]
            }
            // If the file is corrupt, treat it as empty to keep the app usable.
            return [:]
        }
    }

    private func persist(_ all: [String: S3Credentials]) throws {
        let folderURL = fileURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: folderURL, withIntermediateDirectories: true)

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(all)
        try data.write(to: fileURL, options: [.atomic])
    }
}
