//
//  SharedStoragePaths.swift
//  Mahzen
//

import Foundation

enum SharedStoragePaths {
    static func supportDirectoryURL() -> URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            .appendingPathComponent("Mahzen", isDirectory: true)
    }

    static func targetsFileURL() -> URL {
        supportDirectoryURL().appendingPathComponent("targets.json")
    }

    static func credentialsFileURL() -> URL {
        supportDirectoryURL().appendingPathComponent("credentials.json")
    }
}
