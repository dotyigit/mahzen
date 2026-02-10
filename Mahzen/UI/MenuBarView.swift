//
//  MenuBarView.swift
//  Mahzen
//
//  Created on 2026-02-09.
//

import SwiftUI
import UniformTypeIdentifiers

struct MenuBarView: View {
    @ObservedObject var model: AppModel
    @Environment(\.openWindow) private var openWindow
    @Environment(\.dismiss) private var dismiss

    /// Local-only target selection — does NOT affect the main app's selectedTargetId.
    @State private var localTargetId: UUID?
    /// Local-only bucket highlight — does NOT affect the main app's selectedBucket.
    @State private var highlightedBucket: String?
    /// Buckets fetched independently for the menu bar's selected target.
    @State private var localBuckets: [S3Bucket] = []
    @State private var isLoadingLocalBuckets = false
    private let panelWidth: CGFloat = 320

    private let byteFormatter: ByteCountFormatter = {
        let f = ByteCountFormatter()
        f.allowedUnits = [.useKB, .useMB, .useGB, .useTB]
        f.countStyle = .file
        return f
    }()

    /// The effective target ID — local takes priority, falls back to model's menu bar state.
    private var effectiveTargetId: UUID? {
        localTargetId ?? model.menuBarTargetId
    }

    /// The effective target object.
    private var effectiveTarget: StorageTarget? {
        guard let id = effectiveTargetId else { return nil }
        return model.targets.first(where: { $0.id == id })
    }

    /// The bucket shown in the menu bar footer — local highlight takes priority.
    private var effectiveBucket: String? {
        highlightedBucket ?? model.menuBarBucket
    }

    var body: some View {
        VStack(spacing: 0) {
            if model.targets.isEmpty {
                emptyState
            } else {
                header
                divider
                targetSelector
                divider
                bucketsSection
                if effectiveBucket != nil {
                    divider
                    footer
                }
                if model.transferManager.hasVisibleTransfers {
                    divider
                    transfersSection
                }
            }
        }
        .frame(width: panelWidth)
        .task(id: effectiveTargetId) {
            await refreshLocalBuckets()
        }
        .onAppear {
            // Belt-and-suspenders: also configure here in case AppDelegate observer
            // fired before the panel was fully set up.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                for window in NSApp.windows {
                    guard let panel = window as? NSPanel else { continue }
                    panel.hidesOnDeactivate = false
                }
            }
        }
    }

    private func refreshLocalBuckets() async {
        guard let targetId = effectiveTargetId else {
            localBuckets = []
            return
        }
        isLoadingLocalBuckets = true
        localBuckets = await model.listBuckets(forTargetId: targetId)
        for bucket in localBuckets.prefix(12) {
            model.ensureMetricsForBucket(bucket.name, targetId: targetId)
        }
        if let bucket = effectiveBucket {
            model.ensureMetricsForBucket(bucket, targetId: targetId, priority: .userInitiated)
        }
        isLoadingLocalBuckets = false
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: 8) {
            ZStack {
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(AppTheme.accent.opacity(0.14))
                    .overlay(
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .strokeBorder(AppTheme.accent.opacity(0.18))
                    )
                    .frame(width: 24, height: 24)

                Image(systemName: "archivebox")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(AppTheme.accent)
            }

            Text("Mahzen")
                .font(.system(size: 13, weight: .semibold, design: .rounded))

            Text("v\(AppVersion.short)")
                .font(.system(size: 10, weight: .medium, design: .rounded))
                .foregroundStyle(.tertiary)

            Spacer()

            Button {
                if let targetId = localTargetId, targetId != model.selectedTargetId {
                    model.selectedTargetId = targetId
                }
                if let bucket = highlightedBucket {
                    model.selectedBucket = bucket
                    model.prefix = ""
                }
                NSApp.setActivationPolicy(.regular)
                NSApp.activate()
                openWindow(id: "main")
                dismiss()
            } label: {
                Text("Open")
                    .font(.system(size: 11, weight: .medium, design: .rounded))
            }
            .buttonStyle(.bordered)
            .controlSize(.small)

            Button {
                NSApp.terminate(nil)
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
            .frame(width: 22, height: 22)
            .background(AppTheme.hoverFill, in: RoundedRectangle(cornerRadius: 6, style: .continuous))
        }
        .padding(AppTheme.pagePadding)
    }

    // MARK: - Target Selector

    private var targetSelector: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Label("Target", systemImage: "target")
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundStyle(.secondary)

                Picker("", selection: Binding(
                    get: { effectiveTargetId },
                    set: { newValue in
                        localTargetId = newValue
                        highlightedBucket = nil
                        model.menuBarTargetId = newValue
                        model.menuBarBucket = nil
                    }
                )) {
                    ForEach(model.targets) { target in
                        Text(target.name).tag(Optional(target.id))
                    }
                }
                .labelsHidden()
                .pickerStyle(.menu)

                Spacer()
            }

            if let target = effectiveTarget {
                Text(target.endpoint.host ?? target.endpoint.absoluteString)
                    .font(.system(size: 11, design: .rounded))
                    .foregroundStyle(.tertiary)
                    .lineLimit(1)
                    .padding(.leading, 2)
            }
        }
        .padding(.horizontal, AppTheme.pagePadding)
        .padding(.vertical, 8)
    }

    // MARK: - Buckets Section

    private var bucketsSection: some View {
        VStack(spacing: 0) {
            // Section header
            HStack {
                Text("Buckets")
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundStyle(.secondary)

                Spacer()

                if isLoadingLocalBuckets {
                    ProgressView()
                        .controlSize(.small)
                } else {
                    Button {
                        Task { await refreshLocalBuckets() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, AppTheme.pagePadding)
            .padding(.top, 8)
            .padding(.bottom, 6)

            // Bucket list
            if localBuckets.isEmpty && !isLoadingLocalBuckets {
                Text("No buckets found")
                    .font(.system(size: 12, design: .rounded))
                    .foregroundStyle(.tertiary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
            } else {
                ScrollView {
                    LazyVStack(spacing: 2) {
                        ForEach(localBuckets) { bucket in
                            MenuBarBucketRow(
                                bucket: bucket,
                                isSelected: bucket.name == effectiveBucket,
                                metrics: effectiveTargetId.flatMap { model.metricsForBucket(bucket.name, targetId: $0) },
                                byteFormatter: byteFormatter,
                                onSelect: {
                                    highlightedBucket = bucket.name
                                    model.menuBarBucket = bucket.name
                                    if let targetId = effectiveTargetId {
                                        model.ensureMetricsForBucket(bucket.name, targetId: targetId, priority: .userInitiated)
                                    }
                                },
                                onDrop: { urls in handleDrop(urls, toBucket: bucket.name) },
                                onEnsureMetrics: {
                                    if let targetId = effectiveTargetId {
                                        model.ensureMetricsForBucket(bucket.name, targetId: targetId)
                                    }
                                }
                            )
                        }
                    }
                    .padding(.horizontal, AppTheme.pagePadding)
                }
                .frame(maxHeight: 240)
            }

            Spacer()
                .frame(height: 6)
        }
    }

    /// Handle dropped file/folder URLs — upload them to the given bucket.
    private func handleDrop(_ urls: [URL], toBucket bucket: String) {
        guard let targetId = effectiveTargetId else { return }
        for url in urls {
            var isDir: ObjCBool = false
            if FileManager.default.fileExists(atPath: url.path, isDirectory: &isDir), isDir.boolValue {
                model.uploadDirectory(url: url, targetId: targetId, bucket: bucket)
            } else {
                model.uploadFiles(urls: [url], targetId: targetId, bucket: bucket)
            }
        }
    }

    // MARK: - Transfers Section

    private var transfersSection: some View {
        VStack(spacing: 0) {
            // Section header
            HStack {
                Text("Transfers")
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundStyle(.secondary)

                Spacer()

                if model.transferManager.hasVisibleTransfers {
                    Text(transferCompactStatus)
                        .font(.system(size: 11, weight: .semibold, design: .rounded))
                        .foregroundStyle(.tertiary)
                        .monospacedDigit()
                }
            }
            .padding(.horizontal, AppTheme.pagePadding)
            .padding(.top, 8)
            .padding(.bottom, 6)

            // Aggregate progress bar when transfers are in flight.
            if model.transferManager.isTransferring {
                HStack(spacing: 8) {
                    ProgressView(value: model.transferManager.aggregateProgress)
                        .tint(AppTheme.accent)

                    Text("\(Int(model.transferManager.aggregateProgress * 100))%")
                        .font(.system(size: 10, weight: .semibold, design: .rounded))
                        .foregroundStyle(.secondary)
                        .monospacedDigit()
                        .frame(width: 32, alignment: .trailing)
                }
                .padding(.horizontal, AppTheme.pagePadding)
                .padding(.bottom, 4)
            }

            // Individual transfer rows (most recent first, max 6 visible).
            ScrollView {
                LazyVStack(spacing: 2) {
                    ForEach(model.transferManager.transfers.reversed().prefix(6), id: \.id) { item in
                        menuBarTransferRow(item)
                    }
                }
                .padding(.horizontal, AppTheme.pagePadding)
            }
            .frame(maxHeight: 160)

            // Actions row.
            HStack(spacing: 8) {
                if model.transferManager.isTransferring {
                    Button("Cancel All") {
                        model.transferManager.cancelAll()
                    }
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .buttonStyle(.plain)
                    .foregroundStyle(.red)
                }

                Spacer()

                if model.transferManager.completedCount > 0 || model.transferManager.failedCount > 0 || model.transferManager.cancelledCount > 0 {
                    HStack(spacing: 6) {
                        if model.transferManager.completedCount > 0 {
                            Button("Clear Completed") {
                                model.transferManager.clearCompleted()
                            }
                            .font(.system(size: 11, weight: .medium, design: .rounded))
                            .buttonStyle(.bordered)
                            .controlSize(.mini)
                        }

                        if model.transferManager.failedCount > 0 || model.transferManager.cancelledCount > 0 {
                            Button("Clear Finished") {
                                model.transferManager.clearFinished()
                            }
                            .font(.system(size: 11, weight: .medium, design: .rounded))
                            .buttonStyle(.bordered)
                            .controlSize(.mini)
                        }
                    }
                }
            }
            .padding(.horizontal, AppTheme.pagePadding)
            .padding(.vertical, 6)
        }
    }

    private func menuBarTransferRow(_ item: TransferItem) -> some View {
        HStack(spacing: 8) {
            // Direction icon.
            Image(systemName: item.direction == .download ? "arrow.down.circle" : "arrow.up.circle")
                .font(.system(size: 12, weight: .semibold))
                .symbolRenderingMode(.hierarchical)
                .foregroundStyle(item.direction == .download ? AppTheme.accent : .blue)

            Text(item.displayName)
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .lineLimit(1)
                .truncationMode(.middle)
                .frame(maxWidth: .infinity, alignment: .leading)

            // Status indicator.
            Group {
                switch item.status {
                case .queued:
                    Text("Queued")
                        .foregroundStyle(.tertiary)
                case .active(let f):
                    Text("\(Int(f * 100))%")
                        .foregroundStyle(.secondary)
                        .monospacedDigit()
                case .completed:
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                case .failed:
                    Image(systemName: "exclamationmark.circle.fill")
                        .foregroundStyle(.red)
                case .cancelled:
                    Image(systemName: "minus.circle.fill")
                        .foregroundStyle(.secondary)
                }
            }
            .font(.system(size: 11, weight: .medium, design: .rounded))

            // Cancel button for non-terminal items.
            if !item.isTerminal {
                Button {
                    model.transferManager.cancelTransfer(id: item.id)
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .frame(width: 18, height: 18)
            }
        }
        .padding(.vertical, 4)
        .padding(.horizontal, 4)
    }

    // MARK: - Footer

    private var footer: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let bucket = effectiveBucket {
                Text(bucket)
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)

                if let targetId = effectiveTargetId, let metrics = model.metricsForBucket(bucket, targetId: targetId) {
                    Text("\(metrics.objectCount) objects · \(byteFormatter.string(fromByteCount: metrics.totalBytes))")
                        .font(.system(size: 11, design: .rounded))
                        .foregroundStyle(.tertiary)
                } else if let targetId = effectiveTargetId, model.isComputingMetricsForBucket(bucket, targetId: targetId) {
                    HStack(spacing: 4) {
                        ProgressView()
                            .controlSize(.mini)
                        Text("Computing metrics…")
                            .font(.system(size: 11, design: .rounded))
                            .foregroundStyle(.tertiary)
                    }
                }
            }
        }
        .padding(.horizontal, AppTheme.pagePadding)
        .padding(.vertical, 8)
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "externaldrive.badge.questionmark")
                .font(.system(size: 28, weight: .light))
                .foregroundStyle(.tertiary)

            Text("No Targets")
                .font(.system(size: 13, weight: .semibold, design: .rounded))

            Text("Open the app to add a storage target.")
                .font(.system(size: 11, design: .rounded))
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            Button {
                NSApp.setActivationPolicy(.regular)
                NSApp.activate()
                openWindow(id: "main")
                dismiss()
            } label: {
                Text("Open App")
                    .font(.system(size: 12, weight: .medium, design: .rounded))
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
        }
        .padding(AppTheme.pagePadding)
        .padding(.vertical, 12)
    }

    // MARK: - Helpers

    private var divider: some View {
        Divider().opacity(AppTheme.dividerOpacity)
    }

    private var transferCompactStatus: String {
        let completed = model.transferManager.completedCount
        let failed = model.transferManager.failedCount
        let cancelled = model.transferManager.cancelledCount
        let total = model.transferManager.transfers.count
        if failed == 0, cancelled == 0 {
            return "\(completed)/\(total)"
        }
        return "\(completed)/\(failed)/\(cancelled)"
    }

}

// MARK: - Shared Drag Helpers

/// Extracts file URLs from drag-and-drop NSItemProviders.
private func menuBarExtractFileURLs(from providers: [NSItemProvider], completion: @escaping ([URL]) -> Void) {
    let group = DispatchGroup()
    var urls: [URL] = []
    let lock = NSLock()

    for provider in providers {
        group.enter()
        provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { data, _ in
            defer { group.leave() }
            guard let data = data as? Data,
                  let urlString = String(data: data, encoding: .utf8),
                  let url = URL(string: urlString) else { return }
            lock.lock()
            urls.append(url)
            lock.unlock()
        }
    }

    group.notify(queue: .main) {
        completion(urls)
    }
}

// MARK: - Bucket Row with Drop Target

/// Separate view so each row has its own `@State isDropTargeted` for per-row drag highlight.
private struct MenuBarBucketRow: View {
    let bucket: S3Bucket
    let isSelected: Bool
    let metrics: S3PrefixMetrics?
    let byteFormatter: ByteCountFormatter
    let onSelect: () -> Void
    let onDrop: ([URL]) -> Void
    let onEnsureMetrics: () -> Void

    @State private var isDropTargeted = false

    var body: some View {
        Button { onSelect() } label: {
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 7, style: .continuous)
                        .fill(iconBackground)
                        .overlay(
                            RoundedRectangle(cornerRadius: 7, style: .continuous)
                                .strokeBorder(iconBorder)
                        )
                        .frame(width: 28, height: 28)

                    Image(systemName: isDropTargeted ? "square.and.arrow.down" : "archivebox")
                        .font(.system(size: 13, weight: .medium))
                        .symbolRenderingMode(.hierarchical)
                        .foregroundStyle(isDropTargeted ? .blue : AppTheme.accent)
                }

                Text(bucket.name)
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .lineLimit(1)
                    .truncationMode(.middle)

                Spacer()

                if isDropTargeted {
                    Text("Drop to upload")
                        .font(.system(size: 10, weight: .semibold, design: .rounded))
                        .foregroundStyle(.blue)
                } else if let metrics {
                    Text(byteFormatter.string(fromByteCount: metrics.totalBytes))
                        .font(.system(size: 11, design: .rounded))
                        .foregroundStyle(.secondary)
                } else {
                    Text("—")
                        .font(.system(size: 11, design: .rounded))
                        .foregroundStyle(.quaternary)
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .background(
                RoundedRectangle(cornerRadius: AppTheme.controlCornerRadius, style: .continuous)
                    .fill(rowFill)
            )
            .overlay(
                RoundedRectangle(cornerRadius: AppTheme.controlCornerRadius, style: .continuous)
                    .strokeBorder(rowStroke, style: isDropTargeted ? StrokeStyle(lineWidth: 1.5, dash: [5, 3]) : StrokeStyle())
            )
            .contentShape(RoundedRectangle(cornerRadius: AppTheme.controlCornerRadius, style: .continuous))
        }
        .buttonStyle(.plain)
        .onDrop(of: [.fileURL], isTargeted: $isDropTargeted) { providers in
            menuBarExtractFileURLs(from: providers) { urls in
                guard !urls.isEmpty else { return }
                onDrop(urls)
            }
            return true
        }
        .onAppear {
            onEnsureMetrics()
        }
        .animation(.snappy(duration: 0.18), value: isDropTargeted)
    }

    private var iconBackground: Color {
        isDropTargeted ? Color.blue.opacity(0.18) : AppTheme.accent.opacity(0.14)
    }

    private var iconBorder: Color {
        isDropTargeted ? Color.blue.opacity(0.3) : AppTheme.accent.opacity(0.18)
    }

    private var rowFill: Color {
        if isDropTargeted { return Color.blue.opacity(0.12) }
        if isSelected { return AppTheme.accent.opacity(0.16) }
        return .clear
    }

    private var rowStroke: Color {
        if isDropTargeted { return Color.blue.opacity(0.4) }
        if isSelected { return AppTheme.accent.opacity(0.32) }
        return .clear
    }

}
