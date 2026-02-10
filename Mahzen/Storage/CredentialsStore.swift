//
//  CredentialsStore.swift
//  Mahzen
//

import Foundation
import Security

/// Wraps Keychain access with a DEBUG-only file fallback, so the app remains usable when
/// Keychain APIs are unavailable due to ad-hoc signing / missing entitlements.
struct CredentialsStore {
    private let keychain: KeychainStore
    private let fileStore: FileCredentialsStore

    init(keychain: KeychainStore = KeychainStore(), fileStore: FileCredentialsStore = FileCredentialsStore()) {
        self.keychain = keychain
        self.fileStore = fileStore
    }

    func saveCredentials(_ credentials: S3Credentials, targetId: UUID) throws {
        do {
            try keychain.saveCredentials(credentials, targetId: targetId)
            #if DEBUG
            // Keep a file copy in DEBUG so credentials survive Keychain resets during development.
            try? fileStore.saveCredentials(credentials, targetId: targetId)
            #endif
        } catch {
            #if DEBUG
            // In Debug builds, prefer keeping the app usable even if Keychain is unavailable
            // (common with ad-hoc signing / missing application-identifier entitlements).
            do {
                try fileStore.saveCredentials(credentials, targetId: targetId)
                return
            } catch {
                // fall through to throw the original error
            }
            #endif
            throw error
        }
    }

    func loadCredentials(targetId: UUID) throws -> S3Credentials {
        do {
            return try keychain.loadCredentials(targetId: targetId)
        } catch {
            #if DEBUG
            // In Debug builds, allow file fallback for any Keychain failure.
            let creds = try fileStore.loadCredentials(targetId: targetId)
            // Best-effort: migrate the fallback credentials into Keychain once it becomes available.
            try? keychain.saveCredentials(creds, targetId: targetId)
            return creds
            #else
            throw error
            #endif
        }
    }

    func deleteCredentials(targetId: UUID) throws {
        var lastError: Error?
        do { try keychain.deleteCredentials(targetId: targetId) } catch { lastError = error }
        #if DEBUG
        try? fileStore.deleteCredentials(targetId: targetId)
        #endif
        if let lastError { throw lastError }
    }
}
