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
    @State private var openBucketText: String = ""
    @FocusState private var focusedField: FocusField?

    @State private var isHoveringOpenAction: Bool = false

    /// Local selection bridges — avoids writing @Published during view updates.
    @State private var localTargetId: UUID?
    @State private var localBucket: String?

    private enum FocusField: Hashable {
        case bucketFilter
        case openBucket
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
                .padding(.trailing, AppTheme.pagePadding + 6)
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
            HStack(spacing: 10) {
                HStack(spacing: 10) {
                    Text("Target")
                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                        .foregroundStyle(.secondary)

                    Picker("", selection: $localTargetId) {
                        Text("Select Target").tag(UUID?.none)
                        ForEach(model.targets) { t in
                            Text(t.name).tag(UUID?.some(t.id))
                        }
                    }
                    .labelsHidden()
                    .pickerStyle(.menu)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.horizontal, 10)
                .frame(height: AppTheme.fieldHeight)
                .appGlassFieldChrome(isFocused: false)

                HStack(spacing: 4) {
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
                }
            }

            HStack(spacing: 10) {
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

                if model.isLoadingBuckets {
                    ProgressView()
                        .controlSize(.small)
                        .transition(.opacity)
                }
            }

            HStack(spacing: 10) {
                openBucketRow
            }
        }
        .cardBackground()
        .animation(.snappy(duration: 0.25), value: model.isLoadingBuckets)
    }

    private var openBucketRow: some View {
        let canPin = model.selectedTarget != nil && !openBucketTrimmed.isEmpty

        return HStack(spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "link")
                    .foregroundStyle(.secondary)
                    .font(.system(size: 12, weight: .semibold, design: .rounded))

                TextField("Open bucket…", text: $openBucketText)
                    .textFieldStyle(.plain)
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .focused($focusedField, equals: .openBucket)
                    .onSubmit { pinOpenBucketIfPossible() }

                if !openBucketText.isEmpty {
                    Button {
                        openBucketText = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .symbolRenderingMode(.hierarchical)
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                    .help("Clear")
                }
            }
            .padding(.horizontal, 10)
            .frame(height: AppTheme.fieldHeight)
            .appGlassFieldChrome(isFocused: focusedField == .openBucket)

            Button {
                pinOpenBucketIfPossible()
            } label: {
                Image(systemName: "arrow.right.circle.fill")
                    .font(.system(size: 18, weight: .semibold, design: .rounded))
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(canPin ? AppTheme.accent : .secondary)
                    .frame(width: AppTheme.fieldHeight, height: AppTheme.fieldHeight)
                    .scaleEffect((isHoveringOpenAction && canPin) ? 1.06 : 1.0)
                    .opacity(canPin ? 1.0 : 0.55)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(!canPin)
            .help("Connect to a bucket directly")
            .onHover { hovering in
                withAnimation(.snappy(duration: 0.16)) {
                    isHoveringOpenAction = hovering
                }
            }
            .animation(.snappy(duration: 0.18), value: canPin)
        }
    }

    private var openBucketTrimmed: String {
        openBucketText.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func pinOpenBucketIfPossible() {
        let trimmed = openBucketTrimmed
        guard model.selectedTarget != nil, !trimmed.isEmpty else { return }
        Task { await model.pinBucket(trimmed) }
        openBucketText = ""
        focusedField = nil
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
                List(selection: $localBucket) {
                    if !pinnedBucketNames.isEmpty {
                        Section("Pinned") {
                            ForEach(filteredPinnedBuckets) { bucket in
                                BucketRowView(name: bucket.name, isPinned: true)
                                    .tag(bucket.name)
                                    .listRowSeparator(.hidden)
                                    .contextMenu {
                                        bucketContextMenu(bucket.name, isPinned: true)
                                    }
                            }
                        }
                    }

                    Section("Buckets") {
                        ForEach(filteredOtherBuckets) { bucket in
                            BucketRowView(name: bucket.name)
                                .tag(bucket.name)
                                .listRowSeparator(.hidden)
                                .contextMenu {
                                    bucketContextMenu(bucket.name, isPinned: false)
                                }
                        }
                    }
                }
                .listStyle(.sidebar)
                .tint(AppTheme.accent)
                .scrollContentBackground(.hidden)
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
