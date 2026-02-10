//
//  KeychainStore.swift
//  Mahzen
//
//  Created by Codex on 2026-02-08.
//

import Foundation
import Security

enum KeychainStoreError: Error {
    case unexpectedStatus(OSStatus)
    case missingCredentials
}

extension KeychainStoreError: LocalizedError {
    var errorDescription: String? {
        switch self {
        case .missingCredentials:
            return "Credentials not found."
        case .unexpectedStatus(let status):
            let msg = SecCopyErrorMessageString(status, nil) as String? ?? "Unknown Keychain error"
            return "\(msg) (OSStatus \(status))"
        }
    }
}

struct KeychainStore {
    private let service = "dev.mahzen.storage"

    // Keep stable to avoid breaking existing stored items.
    private func credentialsAccount(targetId: UUID) -> String {
        "s3-target-\(targetId.uuidString)"
    }

    func saveCredentials(_ credentials: S3Credentials, targetId: UUID) throws {
        let data = try JSONEncoder().encode(credentials)
        let account = credentialsAccount(targetId: targetId)

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]

        // Upsert.
        SecItemDelete(query as CFDictionary)
        var addQuery = query
        addQuery[kSecValueData as String] = data
        #if !os(macOS)
        addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        #endif

        let status = SecItemAdd(addQuery as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw KeychainStoreError.unexpectedStatus(status)
        }
    }

    func loadCredentials(targetId: UUID) throws -> S3Credentials {
        let account = credentialsAccount(targetId: targetId)

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecMatchLimit as String: kSecMatchLimitOne,
            kSecReturnData as String: true
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)

        if status == errSecItemNotFound {
            throw KeychainStoreError.missingCredentials
        }
        guard status == errSecSuccess else {
            throw KeychainStoreError.unexpectedStatus(status)
        }
        guard let data = item as? Data else {
            throw KeychainStoreError.missingCredentials
        }
        return try JSONDecoder().decode(S3Credentials.self, from: data)
    }

    func deleteCredentials(targetId: UUID) throws {
        let account = credentialsAccount(targetId: targetId)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainStoreError.unexpectedStatus(status)
        }
    }
}
