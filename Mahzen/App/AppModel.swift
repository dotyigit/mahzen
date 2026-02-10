//
//  AppModel.swift
//  Mahzen
//
//  Created by Codex on 2026-02-08.
//

import Foundation
import Combine

@MainActor
final class AppModel: ObservableObject {
    enum SheetDestination: Identifiable, Equatable {
        case addTarget
        case editTarget(StorageTarget)
        case manageTargets

        var id: String {
            switch self {
            case .addTarget: return "addTarget"
            case .editTarget(let target): return "editTarget-\(target.id.uuidString)"
            case .manageTargets: return "manageTargets"
            }
        }
    }

    @Published private(set) var targets: [StorageTarget] = []
    @Published var selectedTargetId: UUID?

    @Published private(set) var buckets: [S3Bucket] = []
    @Published var selectedBucket: String?

    /// Menu bar's independent target/bucket selection — used by the floating drop zone.
    /// Changing these does NOT affect the main app's browser.
    @Published var menuBarTargetId: UUID?
    @Published var menuBarBucket: String?

    @Published var prefix: String = ""
    @Published private(set) var entries: [S3BrowserEntry] = []
    @Published var searchText: String = ""

    @Published var isLoadingBuckets: Bool = false
    @Published var isLoadingObjects: Bool = false
    @Published var objectLoadError: String?
    @Published var errorMessage: String?

    @Published var activeSheet: SheetDestination?

    let transferManager = TransferManager()

    @Published private(set) var metricsByKey: [String: S3PrefixMetrics] = [:]
    @Published private(set) var metricsLoadingKeys: Set<String> = []
    @Published private(set) var metricsErrors: [String: String] = [:]

    private let targetsStore: TargetsStore
    private let credentialsStore: CredentialsStore
    private var transferManagerCancellable: AnyCancellable?
    // Keep bucket-wide totals and folder scans from blocking each other.
    private let bucketMetricsComputer = S3MetricsComputer()
    private let prefixMetricsComputer = S3MetricsComputer()
    private var metricsTasks: [String: Task<Void, Never>] = [:]
    private var metricsTaskTokens: [String: UUID] = [:]

    init() {
        self.targetsStore = TargetsStore()
        self.credentialsStore = CredentialsStore()

        self.targets = targetsStore.targets
        self.selectedTargetId = targets.first?.id
        self.menuBarTargetId = targets.first?.id

        transferManager.onUploadCompleted = { [weak self] in
            Task { [weak self] in await self?.refreshObjects(showLoading: false) }
        }
        transferManagerCancellable = transferManager.objectWillChange.sink { [weak self] _ in
            self?.objectWillChange.send()
        }

        setupFilterPipeline()
    }

    init(targetsStore: TargetsStore, credentialsStore: CredentialsStore) {
        self.targetsStore = targetsStore
        self.credentialsStore = credentialsStore

        self.targets = targetsStore.targets
        self.selectedTargetId = targets.first?.id
        self.menuBarTargetId = targets.first?.id

        transferManager.onUploadCompleted = { [weak self] in
            Task { [weak self] in await self?.refreshObjects(showLoading: false) }
        }
        transferManagerCancellable = transferManager.objectWillChange.sink { [weak self] _ in
            self?.objectWillChange.send()
        }

        setupFilterPipeline()
    }

    func presentSheet(_ sheet: SheetDestination) {
        if activeSheet == sheet {
            // If the sheet got stuck "active" but never appeared, force a state transition.
            activeSheet = nil
            DispatchQueue.main.async { [weak self] in
                self?.activeSheet = sheet
            }
        } else {
            activeSheet = sheet
        }
    }

    func refreshTargets() {
        targetsStore.reload()
        targets = targetsStore.targets
        if selectedTargetId == nil {
            selectedTargetId = targets.first?.id
        }
    }

    func addTarget(_ target: StorageTarget, credentials: S3Credentials) throws {
        try credentialsStore.saveCredentials(credentials, targetId: target.id)
        try targetsStore.upsert(target)
        refreshTargets()
        selectedTargetId = target.id
    }

    func deleteTargets(_ ids: Set<UUID>) {
        do {
            for id in ids {
                try? credentialsStore.deleteCredentials(targetId: id)
            }
            try targetsStore.delete(ids: ids)
            refreshTargets()
            if let selectedTargetId, ids.contains(selectedTargetId) {
                self.selectedTargetId = targets.first?.id
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func refreshBuckets() async {
        guard let target = selectedTarget else {
            buckets = []
            selectedBucket = nil
            return
        }

        isLoadingBuckets = true
        defer { isLoadingBuckets = false }

        let directBucket = normalizedBucketName(target.defaultBucket)
        let pinnedNames = normalizedBucketNames(target.pinnedBuckets)
        let fallbackNames = mergedPinnedAndDirectBuckets(pinnedNames: pinnedNames, directBucket: directBucket)
        let preferredBucket = directBucket ?? pinnedNames.first
        let pinnedSet = Set(pinnedNames)

        do {
            let client = try client(for: target)
            let fetched = try await client.listBuckets()
            let fetchedByName = Dictionary(uniqueKeysWithValues: fetched.map { ($0.name, $0) })

            var merged: [S3Bucket] = []
            merged.reserveCapacity(pinnedNames.count + fetched.count)

            // Pinned first (but prefer real bucket metadata when available).
            for name in pinnedNames {
                merged.append(fetchedByName[name] ?? S3Bucket(name: name, creationDate: nil))
            }

            // Direct-access bucket can be independent from pinned buckets.
            if let directBucket,
               !pinnedSet.contains(directBucket),
               fetchedByName[directBucket] == nil {
                merged.append(S3Bucket(name: directBucket, creationDate: nil))
            }

            // Then the rest.
            merged.append(contentsOf: fetched.filter { !pinnedSet.contains($0.name) })

            buckets = merged
            selectBucketIfNeeded(preferred: preferredBucket)
        } catch {
            // If we have pinned or direct buckets, allow access without ListBuckets permission.
            if fallbackNames.isEmpty {
                errorMessage = error.localizedDescription
            }
            buckets = fallbackNames.map { S3Bucket(name: $0, creationDate: nil) }
            selectBucketIfNeeded(preferred: preferredBucket)
        }
    }

    func refreshObjects(showLoading: Bool = true) async {
        guard let target = selectedTarget, let bucket = selectedBucket, !bucket.isEmpty else {
            entries = []
            objectLoadError = nil
            return
        }

        if showLoading { isLoadingObjects = true }
        defer { if showLoading { isLoadingObjects = false } }
        objectLoadError = nil

        do {
            let client = try client(for: target)
            let page = try await client.listObjectsV2(bucket: bucket, prefix: prefix)

            let folderEntries = page.commonPrefixes
                .filter { !$0.isEmpty }
                .map { S3BrowserEntry.folder(prefix: $0) }

            let objectEntries = page.objects
                .filter { obj in
                    // Hide "folder marker" objects if present.
                    if obj.key.hasSuffix("/") {
                        if (obj.sizeBytes ?? 0) == 0 { return false }
                    }
                    if !prefix.isEmpty, obj.key == prefix { return false }
                    return true
                }
                .map { S3BrowserEntry.object($0) }

            entries = (folderEntries + objectEntries).sorted(by: Self.entrySort(prefix: prefix))
            objectLoadError = nil
        } catch {
            objectLoadError = error.localizedDescription
            entries = []
        }
    }

    func clearEntries() {
        entries = []
    }

    func enterFolder(_ folderPrefix: String) async {
        prefix = folderPrefix
        entries = []
        await refreshObjects()
    }

    func goUpOneLevel() async {
        prefix = Self.parentPrefix(of: prefix)
        entries = []
        await refreshObjects()
    }

    var selectedTarget: StorageTarget? {
        guard let id = selectedTargetId else { return nil }
        return targets.first(where: { $0.id == id })
    }

    @Published private(set) var filteredEntries: [S3BrowserEntry] = []

    private func setupFilterPipeline() {
        Publishers.CombineLatest($entries, $searchText)
            .debounce(for: .milliseconds(50), scheduler: RunLoop.main)
            .map { [weak self] entries, raw -> [S3BrowserEntry] in
                let q = raw.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !q.isEmpty, let self else { return entries }
                return entries.filter { entry in
                    self.displayName(for: entry).localizedCaseInsensitiveContains(q)
                }
            }
            .removeDuplicates()
            .assign(to: &$filteredEntries)
    }

    func displayName(for entry: S3BrowserEntry) -> String {
        let full = entry.keyOrPrefix
        var relative = full

        if !prefix.isEmpty, full.hasPrefix(prefix) {
            relative = String(full.dropFirst(prefix.count))
        }
        if entry.isFolder, relative.hasSuffix("/") {
            relative.removeLast()
        }
        return relative.isEmpty ? full : relative
    }

    func loadCredentials(targetId: UUID) throws -> S3Credentials {
        try credentialsStore.loadCredentials(targetId: targetId)
    }

    private func client(for target: StorageTarget) throws -> S3Client {
        let creds = try credentialsStore.loadCredentials(targetId: target.id)
        return S3Client(target: target, credentials: creds)
    }

    func pinBucket(_ bucketName: String) async {
        let trimmed = bucketName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        guard var target = selectedTarget else { return }

        let existing = normalizedBucketNames(target.pinnedBuckets)
        if existing.contains(where: { $0.caseInsensitiveCompare(trimmed) == .orderedSame }) {
            selectedBucket = existing.first(where: { $0.caseInsensitiveCompare(trimmed) == .orderedSame })
            await refreshObjects()
            return
        }

        target.pinnedBuckets.append(trimmed)
        do {
            try targetsStore.upsert(target)
            refreshTargets()
            selectedTargetId = target.id
            selectedBucket = trimmed
            await refreshBuckets()
            await refreshObjects()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func unpinBucket(_ bucketName: String) async {
        let trimmed = bucketName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        guard var target = selectedTarget else { return }

        target.pinnedBuckets.removeAll { $0.caseInsensitiveCompare(trimmed) == .orderedSame }
        do {
            try targetsStore.upsert(target)
            refreshTargets()
            selectedTargetId = target.id
            await refreshBuckets()
            if selectedBucket?.caseInsensitiveCompare(trimmed) == .orderedSame {
                selectedBucket = buckets.first?.name
                await refreshObjects()
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func selectBucketIfNeeded(preferred: String?) {
        if let selectedBucket, buckets.contains(where: { $0.name == selectedBucket }) {
            return
        }
        if let preferred, buckets.contains(where: { $0.name == preferred }) {
            selectedBucket = preferred
            return
        }
        selectedBucket = buckets.first?.name
    }

    private func normalizedBucketNames(_ names: [String]) -> [String] {
        var out: [String] = []
        out.reserveCapacity(names.count)

        for raw in names {
            let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { continue }
            if out.contains(where: { $0.caseInsensitiveCompare(trimmed) == .orderedSame }) { continue }
            out.append(trimmed)
        }
        return out
    }

    private func normalizedBucketName(_ name: String?) -> String? {
        guard let name else { return nil }
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private func mergedPinnedAndDirectBuckets(pinnedNames: [String], directBucket: String?) -> [String] {
        var out = pinnedNames
        guard let directBucket else { return out }
        if !out.contains(where: { $0.caseInsensitiveCompare(directBucket) == .orderedSame }) {
            out.append(directBucket)
        }
        return out
    }

    private static func parentPrefix(of prefix: String) -> String {
        guard !prefix.isEmpty else { return "" }
        var p = prefix
        if p.hasSuffix("/") { p.removeLast() }
        guard let idx = p.lastIndex(of: "/") else { return "" }
        return String(p[..<p.index(after: idx)])
    }

    private static func entrySort(prefix: String) -> (S3BrowserEntry, S3BrowserEntry) -> Bool {
        { a, b in
            if a.isFolder != b.isFolder {
                return a.isFolder && !b.isFolder
            }
            let nameA = displayNameStatic(prefix: prefix, entry: a)
            let nameB = displayNameStatic(prefix: prefix, entry: b)
            return nameA.localizedCaseInsensitiveCompare(nameB) == .orderedAscending
        }
    }

    private static func displayNameStatic(prefix: String, entry: S3BrowserEntry) -> String {
        let full = entry.keyOrPrefix
        var relative = full
        if !prefix.isEmpty, full.hasPrefix(prefix) {
            relative = String(full.dropFirst(prefix.count))
        }
        if entry.isFolder, relative.hasSuffix("/") {
            relative.removeLast()
        }
        return relative.isEmpty ? full : relative
    }

    // MARK: - Independent Bucket Listing (Menu Bar)

    /// Fetches buckets for a specific target without changing model state. Used by the menu bar.
    func listBuckets(forTargetId targetId: UUID) async -> [S3Bucket] {
        guard let target = targets.first(where: { $0.id == targetId }) else { return [] }
        let directBucket = normalizedBucketName(target.defaultBucket)
        let pinnedNames = normalizedBucketNames(target.pinnedBuckets)
        let fallbackNames = mergedPinnedAndDirectBuckets(pinnedNames: pinnedNames, directBucket: directBucket)
        let pinnedSet = Set(pinnedNames)

        do {
            let client = try client(for: target)
            let fetched = try await client.listBuckets()
            let fetchedByName = Dictionary(uniqueKeysWithValues: fetched.map { ($0.name, $0) })
            var merged: [S3Bucket] = []
            merged.reserveCapacity(fallbackNames.count + fetched.count)
            for name in pinnedNames {
                merged.append(fetchedByName[name] ?? S3Bucket(name: name, creationDate: nil))
            }
            if let directBucket,
               !pinnedSet.contains(directBucket),
               fetchedByName[directBucket] == nil {
                merged.append(S3Bucket(name: directBucket, creationDate: nil))
            }
            merged.append(contentsOf: fetched.filter { !pinnedSet.contains($0.name) })
            return merged
        } catch {
            return fallbackNames.map { S3Bucket(name: $0, creationDate: nil) }
        }
    }

    /// Metrics lookup by explicit target ID. Used by the menu bar when its target differs from model's.
    func metricsForBucket(_ bucket: String, targetId: UUID) -> S3PrefixMetrics? {
        guard !bucket.isEmpty else { return nil }
        return metricsByKey[metricsKey(targetId: targetId, bucket: bucket, prefix: "")]
    }

    func isComputingMetricsForBucket(_ bucket: String, targetId: UUID) -> Bool {
        guard !bucket.isEmpty else { return false }
        return metricsLoadingKeys.contains(metricsKey(targetId: targetId, bucket: bucket, prefix: ""))
    }

    // MARK: - Metrics (Bucket/Prefix Analytics)

    func metricsForSelectedBucket(prefix: String) -> S3PrefixMetrics? {
        guard let target = selectedTarget, let bucket = selectedBucket, !bucket.isEmpty else { return nil }
        return metricsByKey[metricsKey(targetId: target.id, bucket: bucket, prefix: prefix)]
    }

    /// Metrics lookup that does not depend on selectedBucket. Used by the menu bar.
    func metricsForBucket(_ bucket: String) -> S3PrefixMetrics? {
        guard let target = selectedTarget, !bucket.isEmpty else { return nil }
        return metricsByKey[metricsKey(targetId: target.id, bucket: bucket, prefix: "")]
    }

    func isComputingMetricsForBucket(_ bucket: String) -> Bool {
        guard let target = selectedTarget, !bucket.isEmpty else { return false }
        return metricsLoadingKeys.contains(metricsKey(targetId: target.id, bucket: bucket, prefix: ""))
    }

    func ensureMetricsForBucket(_ bucket: String) {
        guard let target = selectedTarget, !bucket.isEmpty else { return }
        ensureMetrics(target: target, bucket: bucket, prefix: "", priority: .utility)
    }

    func ensureMetricsForBucket(_ bucket: String, targetId: UUID, priority: TaskPriority = .utility) {
        guard let target = targets.first(where: { $0.id == targetId }), !bucket.isEmpty else { return }
        ensureMetrics(target: target, bucket: bucket, prefix: "", priority: priority)
    }

    func metricsErrorForSelectedBucket(prefix: String) -> String? {
        guard let target = selectedTarget, let bucket = selectedBucket, !bucket.isEmpty else { return nil }
        return metricsErrors[metricsKey(targetId: target.id, bucket: bucket, prefix: prefix)]
    }

    func isComputingMetricsForSelectedBucket(prefix: String) -> Bool {
        guard let target = selectedTarget, let bucket = selectedBucket, !bucket.isEmpty else { return false }
        return metricsLoadingKeys.contains(metricsKey(targetId: target.id, bucket: bucket, prefix: prefix))
    }

    func ensureMetricsForSelectedBucket(prefix: String) {
        guard let target = selectedTarget, let bucket = selectedBucket, !bucket.isEmpty else { return }
        ensureMetrics(target: target, bucket: bucket, prefix: prefix, priority: .utility)
    }

    func ensureMetricsForSelectedBucket(prefix: String, priority: TaskPriority) {
        guard let target = selectedTarget, let bucket = selectedBucket, !bucket.isEmpty else { return }
        ensureMetrics(target: target, bucket: bucket, prefix: prefix, priority: priority)
    }

    func ensureBucketMetricsIfNeeded(priority: TaskPriority = .utility) {
        // Bucket-wide metrics are represented as prefix == "".
        ensureMetricsForSelectedBucket(prefix: "", priority: priority)
    }

    func cancelMetricsForSelectedBucket(prefix: String) {
        guard let target = selectedTarget, let bucket = selectedBucket, !bucket.isEmpty else { return }
        let key = metricsKey(targetId: target.id, bucket: bucket, prefix: prefix)
        metricsTasks[key]?.cancel()
        metricsTasks[key] = nil
        metricsTaskTokens[key] = nil
        metricsLoadingKeys.remove(key)
    }

    func cancelAllMetricsTasks() {
        for (_, task) in metricsTasks {
            task.cancel()
        }
        metricsTasks = [:]
        metricsTaskTokens = [:]
        metricsLoadingKeys = []
    }

    private func ensureMetrics(target: StorageTarget, bucket: String, prefix: String, priority: TaskPriority) {
        let key = metricsKey(targetId: target.id, bucket: bucket, prefix: prefix)
        if metricsByKey[key] != nil { return }
        if metricsTasks[key] != nil { return }

        let creds: S3Credentials
        do {
            creds = try credentialsStore.loadCredentials(targetId: target.id)
        } catch {
            metricsErrors[key] = error.localizedDescription
            return
        }

        metricsErrors[key] = nil
        metricsLoadingKeys.insert(key)

        let token = UUID()
        metricsTaskTokens[key] = token

        // Run this off the main actor; the UI should stay responsive even for big buckets.
        let computer = prefix.isEmpty ? bucketMetricsComputer : prefixMetricsComputer
        metricsTasks[key] = Task.detached(priority: priority) { [computer, target, creds, bucket, prefix, key, token] in
            do {
                let computed = try await computer.computePrefixMetrics(
                    target: target,
                    credentials: creds,
                    bucket: bucket,
                    prefix: prefix
                )
                await MainActor.run { [weak self] in
                    guard let self else { return }
                    guard self.metricsTaskTokens[key] == token else { return }
                    self.metricsByKey[key] = computed
                    self.metricsErrors[key] = nil
                    self.metricsLoadingKeys.remove(key)
                    self.metricsTasks[key] = nil
                    self.metricsTaskTokens[key] = nil
                }
            } catch is CancellationError {
                await MainActor.run { [weak self] in
                    guard let self else { return }
                    guard self.metricsTaskTokens[key] == token else { return }
                    self.metricsLoadingKeys.remove(key)
                    self.metricsTasks[key] = nil
                    self.metricsTaskTokens[key] = nil
                }
            } catch {
                await MainActor.run { [weak self] in
                    guard let self else { return }
                    guard self.metricsTaskTokens[key] == token else { return }
                    self.metricsErrors[key] = error.localizedDescription
                    self.metricsLoadingKeys.remove(key)
                    self.metricsTasks[key] = nil
                    self.metricsTaskTokens[key] = nil
                }
            }
        }
    }

    private func metricsKey(targetId: UUID, bucket: String, prefix: String) -> String {
        "\(targetId.uuidString)|\(bucket)|\(prefix)"
    }

    // MARK: - Transfer Convenience Methods

    func downloadSelectedObjects(keys: [String], to directoryURL: URL) {
        guard let target = selectedTarget, let bucket = selectedBucket, !bucket.isEmpty else { return }
        guard let creds = try? credentialsStore.loadCredentials(targetId: target.id) else { return }
        // Wrap in a bucket-named subfolder so files don't mix with existing contents.
        let wrapper = directoryURL.appendingPathComponent(bucket)
        transferManager.downloadObjects(target: target, credentials: creds, bucket: bucket, keys: keys, to: wrapper)
    }

    func downloadSingleObject(key: String, to fileURL: URL) {
        guard let target = selectedTarget, let bucket = selectedBucket, !bucket.isEmpty else { return }
        guard let creds = try? credentialsStore.loadCredentials(targetId: target.id) else { return }
        transferManager.downloadObject(target: target, credentials: creds, bucket: bucket, key: key, to: fileURL)
    }

    /// Recursively lists all objects under `prefix` and queues them for download,
    /// preserving folder structure relative to the prefix inside a wrapper subfolder.
    func downloadPrefix(_ prefixToDownload: String, to directoryURL: URL) {
        guard let target = selectedTarget, let bucket = selectedBucket, !bucket.isEmpty else { return }
        guard let creds = try? credentialsStore.loadCredentials(targetId: target.id) else { return }

        // Create a wrapper subfolder so contents don't mix with existing files.
        let wrapper: URL
        if prefixToDownload.isEmpty {
            wrapper = directoryURL.appendingPathComponent(bucket)
        } else {
            var name = prefixToDownload
            if name.hasSuffix("/") { name.removeLast() }
            name = (name as NSString).lastPathComponent
            wrapper = directoryURL.appendingPathComponent(name)
        }

        Task {
            do {
                let client = try self.clientForCurrentTarget()
                let keys = try await self.listAllKeys(client: client, bucket: bucket, prefix: prefixToDownload)
                guard !keys.isEmpty else { return }

                var destinations: [String: URL] = [:]
                for key in keys {
                    let relativePath = String(key.dropFirst(prefixToDownload.count))
                    guard !relativePath.isEmpty else { continue }
                    destinations[key] = wrapper.appendingPathComponent(relativePath)
                }

                for (key, dest) in destinations {
                    transferManager.downloadObject(target: target, credentials: creds, bucket: bucket, key: key, to: dest)
                }
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    /// Downloads the entire currently selected bucket to `directoryURL`.
    func downloadBucket(to directoryURL: URL) {
        downloadPrefix("", to: directoryURL)
    }

    /// Downloads an explicit bucket (not necessarily the selected one) to `directoryURL`.
    func downloadBucket(_ bucketName: String, to directoryURL: URL) {
        guard let target = selectedTarget, !bucketName.isEmpty else { return }
        guard let creds = try? credentialsStore.loadCredentials(targetId: target.id) else { return }

        // Wrap in a bucket-named subfolder.
        let wrapper = directoryURL.appendingPathComponent(bucketName)

        Task {
            do {
                let client = try self.clientForCurrentTarget()
                let keys = try await self.listAllKeys(client: client, bucket: bucketName, prefix: "")
                guard !keys.isEmpty else { return }
                for key in keys {
                    let dest = wrapper.appendingPathComponent(key)
                    transferManager.downloadObject(target: target, credentials: creds, bucket: bucketName, key: key, to: dest)
                }
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    func uploadFiles(urls: [URL]) {
        guard let target = selectedTarget, let bucket = selectedBucket, !bucket.isEmpty else { return }
        guard let creds = try? credentialsStore.loadCredentials(targetId: target.id) else { return }
        transferManager.uploadFiles(target: target, credentials: creds, bucket: bucket, prefix: prefix, fileURLs: urls)
    }

    func uploadDirectory(url: URL) {
        guard let target = selectedTarget, let bucket = selectedBucket, !bucket.isEmpty else { return }
        guard let creds = try? credentialsStore.loadCredentials(targetId: target.id) else { return }
        transferManager.uploadDirectory(target: target, credentials: creds, bucket: bucket, prefix: prefix, directoryURL: url)
    }

    /// Upload files to an explicit target + bucket (used by the menu bar drop zone).
    func uploadFiles(urls: [URL], targetId: UUID, bucket: String) {
        guard let target = targets.first(where: { $0.id == targetId }), !bucket.isEmpty else { return }
        guard let creds = try? credentialsStore.loadCredentials(targetId: target.id) else { return }
        transferManager.uploadFiles(target: target, credentials: creds, bucket: bucket, prefix: "", fileURLs: urls)
    }

    /// Upload a directory to an explicit target + bucket (used by the menu bar drop zone).
    func uploadDirectory(url: URL, targetId: UUID, bucket: String) {
        guard let target = targets.first(where: { $0.id == targetId }), !bucket.isEmpty else { return }
        guard let creds = try? credentialsStore.loadCredentials(targetId: target.id) else { return }
        transferManager.uploadDirectory(target: target, credentials: creds, bucket: bucket, prefix: "", directoryURL: url)
    }

    // MARK: - Recursive Listing

    private func clientForCurrentTarget() throws -> S3Client {
        guard let target = selectedTarget else { throw S3ServiceError(message: "No target selected.", statusCode: nil) }
        return try client(for: target)
    }

    /// Paginates through all objects under a prefix with no delimiter (flat listing).
    private func listAllKeys(client: S3Client, bucket: String, prefix: String) async throws -> [String] {
        var allKeys: [String] = []
        var token: String? = nil
        repeat {
            let page = try await client.listObjectsV2(
                bucket: bucket,
                prefix: prefix,
                delimiter: nil,
                continuationToken: token
            )
            allKeys.append(contentsOf: page.objects.map(\.key))
            token = page.isTruncated ? page.nextContinuationToken : nil
        } while token != nil
        return allKeys
    }
}
