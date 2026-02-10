//
//  BucketsSidebarView.swift
//  Mahzen
//
//  Created by Codex on 2026-02-08.
//

import SwiftUI
import AppKit

struct BucketsSidebarView: View {
    @ObservedObject var model: AppModel
    @State private var bucketSearchText: String = ""
    @FocusState private var focusedField: FocusField?

    /// Local selection bridges — avoids writing @Published during view updates.
    @State private var localTargetId: UUID?
    @State private var localBucket: String?

    private enum FocusField: Hashable {
        case bucketFilter
    }

    var body: some View {
        ZStack {
            AppTheme.sidebarBackground()

            if model.targets.isEmpty {
                HeroEmptyStateView(
                    title: "No Targets",
                    subtitle: "Add a storage target to start browsing buckets and objects.",
                    systemImage: "externaldrive.badge.plus",
                    actionTitle: "Add Target",
                    action: { model.presentSheet(.addTarget) }
                )
            } else {
                VStack(spacing: 12) {
                    headerCard
                    bucketsList
                }
                .padding(.leading, AppTheme.pagePadding)
                .padding(.trailing, AppTheme.pagePadding)
                .padding(.top, AppTheme.pagePadding)
            }
        }
        .navigationTitle("Buckets")
        .onAppear {
            localTargetId = model.selectedTargetId
            localBucket = model.selectedBucket
        }
        .onChange(of: localTargetId) {
            guard localTargetId != model.selectedTargetId else { return }
            bucketSearchText = ""
            Task { model.selectedTargetId = localTargetId }
        }
        .onChange(of: model.selectedTargetId) {
            if localTargetId != model.selectedTargetId {
                localTargetId = model.selectedTargetId
            }
        }
        .onChange(of: localBucket) {
            guard localBucket != model.selectedBucket else { return }
            Task { model.selectedBucket = localBucket }
        }
        .onChange(of: model.selectedBucket) {
            if localBucket != model.selectedBucket {
                localBucket = model.selectedBucket
            }
        }
    }

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Picker("Target", selection: $localTargetId) {
                Text("Select Target").tag(UUID?.none)
                ForEach(model.targets) { t in
                    Text(t.name).tag(UUID?.some(t.id))
                }
            }
            .labelsHidden()
            .pickerStyle(.menu)

            HStack(spacing: 8) {
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(.secondary)
                        .font(.system(size: 12, weight: .semibold, design: .rounded))

                    TextField("Filter buckets…", text: $bucketSearchText)
                        .textFieldStyle(.plain)
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .focused($focusedField, equals: .bucketFilter)

                    if !bucketSearchText.isEmpty {
                        Button {
                            bucketSearchText = ""
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .symbolRenderingMode(.hierarchical)
                                .foregroundStyle(.secondary)
                        }
                        .buttonStyle(.plain)
                        .help("Clear filter")
                    }
                }
                .padding(.horizontal, 10)
                .frame(height: AppTheme.fieldHeight)
                .appGlassFieldChrome(isFocused: focusedField == .bucketFilter)

                Button {
                    model.presentSheet(.addTarget)
                } label: {
                    Image(systemName: "plus")
                }
                .buttonStyle(.plain)
                .appIconButtonChrome()
                .help("Add Target")

                Button {
                    model.presentSheet(.manageTargets)
                } label: {
                    Image(systemName: "gearshape")
                }
                .buttonStyle(.plain)
                .appIconButtonChrome()
                .help("Manage Targets")

                Button {
                    Task {
                        model.refreshTargets()
                        await model.refreshBuckets()
                    }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .buttonStyle(.plain)
                .appIconButtonChrome()
                .help("Refresh Buckets")

                if model.isLoadingBuckets {
                    ProgressView()
                        .controlSize(.small)
                        .transition(.opacity)
                }
            }
        }
        .cardBackground()
        .animation(.snappy(duration: 0.25), value: model.isLoadingBuckets)
    }

    private var bucketsList: some View {
        Group {
            if model.selectedTarget == nil {
                HeroEmptyStateView(
                    title: "No Target Selected",
                    subtitle: "Pick a target to load its buckets.",
                    systemImage: "externaldrive"
                )
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 6) {
                        if !filteredPinnedBuckets.isEmpty {
                            bucketSectionHeader("Pinned")
                            ForEach(filteredPinnedBuckets) { bucket in
                                bucketRowButton(bucket, isPinned: true)
                            }
                        }

                        bucketSectionHeader("Buckets")
                        ForEach(filteredOtherBuckets) { bucket in
                            bucketRowButton(bucket, isPinned: false)
                        }
                    }
                    .padding(.vertical, 4)
                }
                .background(Color.clear)
                .overlay {
                    if !model.isLoadingBuckets, filteredPinnedBuckets.isEmpty, filteredOtherBuckets.isEmpty {
                        HeroEmptyStateView(
                            title: bucketSearchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "No Buckets" : "No Matches",
                            subtitle: bucketSearchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                ? "Try refreshing, or double-check credentials and endpoint."
                                : "Try a different filter.",
                            systemImage: "archivebox"
                        )
                    }
                }
                .animation(.snappy(duration: 0.25), value: model.buckets)
            }
        }
    }

    @ViewBuilder
    private func bucketSectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.system(size: 11, weight: .semibold, design: .rounded))
            .foregroundStyle(.secondary)
            .textCase(.uppercase)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 8)
            .padding(.top, 6)
    }

    private func bucketRowButton(_ bucket: S3Bucket, isPinned: Bool) -> some View {
        Button {
            localBucket = bucket.name
        } label: {
            BucketRowView(name: bucket.name, isPinned: isPinned, isSelected: localBucket == bucket.name)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .buttonStyle(.plain)
        .contextMenu {
            bucketContextMenu(bucket.name, isPinned: isPinned)
        }
    }

    private var pinnedBucketNames: [String] {
        model.selectedTarget?.pinnedBuckets ?? []
    }

    private var pinnedSet: Set<String> {
        Set(pinnedBucketNames.map { $0.lowercased() })
    }

    private var filteredPinnedBuckets: [S3Bucket] {
        filteredBuckets.filter { pinnedSet.contains($0.name.lowercased()) }
    }

    private var filteredOtherBuckets: [S3Bucket] {
        filteredBuckets.filter { !pinnedSet.contains($0.name.lowercased()) }
    }

    private var filteredBuckets: [S3Bucket] {
        let q = bucketSearchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return model.buckets }
        return model.buckets.filter { $0.name.localizedCaseInsensitiveContains(q) }
    }

    // MARK: - Bucket Context Menu

    @ViewBuilder
    private func bucketContextMenu(_ bucketName: String, isPinned: Bool) -> some View {
        Button("Download Bucket") {
            downloadBucket(bucketName)
        }

        Divider()

        if isPinned {
            Button("Unpin") {
                Task { await model.unpinBucket(bucketName) }
            }
        } else {
            Button("Pin Bucket") {
                Task { await model.pinBucket(bucketName) }
            }
        }

        Button("Copy Name") {
            Pasteboard.copyString(bucketName)
        }
    }

    private func downloadBucket(_ bucketName: String) {
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        panel.title = "Download Bucket: \(bucketName)"
        panel.prompt = "Download"

        guard panel.runModal() == .OK, let url = panel.url else { return }
        model.downloadBucket(bucketName, to: url)
    }
}
