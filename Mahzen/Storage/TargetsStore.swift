//
//  TargetsStore.swift
//  Mahzen
//
//  Created by Codex on 2026-02-08.
//

import Foundation
import Combine

@MainActor
final class TargetsStore: ObservableObject {
    @Published private(set) var targets: [StorageTarget] = []

    private let fileURL: URL

    init(fileURL: URL? = nil) {
        self.fileURL = fileURL ?? SharedStoragePaths.targetsFileURL()
        reload()
    }

    func reload() {
        do {
            let data = try Data(contentsOf: fileURL)
            let decoded = try JSONDecoder().decode([StorageTarget].self, from: data)
            self.targets = decoded.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        } catch {
            // Missing file or decode errors should not prevent app startup.
            self.targets = []
        }
    }

    func upsert(_ target: StorageTarget) throws {
        var updated = targets
        if let idx = updated.firstIndex(where: { $0.id == target.id }) {
            updated[idx] = target
        } else {
            updated.append(target)
        }
        try persist(updated)
        self.targets = updated.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    func delete(ids: Set<UUID>) throws {
        let updated = targets.filter { !ids.contains($0.id) }
        try persist(updated)
        self.targets = updated
    }

    private func persist(_ targets: [StorageTarget]) throws {
        let folderURL = fileURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: folderURL, withIntermediateDirectories: true)

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(targets)
        try data.write(to: fileURL, options: [.atomic])
    }
}
