//
//  ObjectsBrowserView.swift
//  Mahzen
//

import SwiftUI
import AppKit
import UniformTypeIdentifiers

struct ObjectsBrowserView: View {
    @ObservedObject var model: AppModel

    @State private var selection: Set<S3BrowserEntry.ID> = []
    @State private var isInspectorPresented: Bool = true
    @State private var keyDownMonitor: Any?
    @State private var isDropTargeted: Bool = false
    @State private var listWidth: CGFloat = 600
    @State private var mouseMonitor: Any?
    @State private var isListHovered: Bool = false
    @FocusState private var focusedField: FocusField?

    private enum FocusField: Hashable {
        case search
    }

    private let byteFormatter: ByteCountFormatter = {
        let f = ByteCountFormatter()
        f.allowedUnits = [.useKB, .useMB, .useGB, .useTB]
        f.countStyle = .file
        return f
    }()

    private let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        return f
    }()

    var body: some View {
        ZStack {
            AppTheme.contentBackground()

            VStack(spacing: 12) {
                header

                Group {
                    if model.selectedBucket == nil {
                        HeroEmptyStateView(
                            title: "No Bucket Selected",
                            subtitle: "Select a bucket to browse objects.",
                            systemImage: "archivebox"
                        )
                    } else if !model.isLoadingObjects, model.filteredEntries.isEmpty {
                        HeroEmptyStateView(
                            title: model.searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Empty Folder" : "No Matches",
                            subtitle: model.searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                ? "This prefix has no objects."
                                : "Try a different search term.",
                            systemImage: "folder"
                        )
                    } else {
                        fileList
                            .cardBackground(padding: 0)
                            .padding(.bottom, 0)
                    }
                }

                if model.transferManager.hasVisibleTransfers {
                    TransferPanelView(transferManager: model.transferManager)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }

                if model.selectedBucket != nil {
                    statusBar
                        .padding(.bottom, 12)
                }
            }
            .padding(.top, 12)
            .padding(.horizontal, AppTheme.pagePadding)

            // Drop zone overlay.
            if isDropTargeted {
                dropOverlay
            }
        }
        .onDrop(of: [.fileURL], isTargeted: $isDropTargeted) { providers in
            handleDrop(providers)
        }
        .navigationTitle("Mahzen")
        .inspector(isPresented: $isInspectorPresented) {
            ObjectInspectorView(
                model: model,
                selection: resolvedSelection
            )
        }
        .toolbar {
            ToolbarItemGroup {
                Button {
                    presentUploadPanel()
                } label: {
                    Image(systemName: "square.and.arrow.up")
                }
                .help("Upload Files")
                .keyboardShortcut("u", modifiers: [.command])
                .disabled(model.selectedBucket == nil)

                Button {
                    presentDownloadPanel()
                } label: {
                    Image(systemName: "square.and.arrow.down")
                }
                .help("Download Selected")
                .keyboardShortcut("d", modifiers: [.command])
                .disabled(!hasDownloadableSelection)

                Button {
                    Task { await model.goUpOneLevel() }
                } label: {
                    Image(systemName: "chevron.left")
                }
                .disabled(model.prefix.isEmpty)
                .help("Up One Level")
                .keyboardShortcut(.upArrow, modifiers: [.command])

                Button {
                    Task { await model.refreshObjects() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .help("Refresh Objects")
                .keyboardShortcut("r", modifiers: [.command])

                Button {
                    withAnimation(.snappy(duration: 0.25)) {
                        isInspectorPresented.toggle()
                    }
                } label: {
                    Image(systemName: "sidebar.right")
                }
                .help(isInspectorPresented ? "Hide Inspector" : "Show Inspector")
                .keyboardShortcut("i", modifiers: [.command])
            }
        }
        .animation(.snappy(duration: 0.25), value: model.transferManager.hasVisibleTransfers)
        .onAppear { installKeyMonitorIfNeeded(); installMouseMonitorIfNeeded() }
        .onDisappear { uninstallKeyMonitor(); uninstallMouseMonitor() }
        .onChange(of: model.selectedBucket) {
            selection.removeAll()
        }
        .onChange(of: model.prefix) {
            selection.removeAll()
        }
        .onChange(of: selection) {
            let selectedIds = selection
            guard !selectedIds.isEmpty else { return }
            guard let entry = model.filteredEntries.first(where: { selectedIds.contains($0.id) }) else { return }
            guard case .folder(let pfx) = entry else { return }
            model.ensureMetricsForSelectedBucket(prefix: pfx, priority: .userInitiated)
        }
    }

    // MARK: - Selected Entries

    private var selectedObjectKeys: [String] {
        let selectedIds = selection
        return model.filteredEntries.compactMap { entry in
            guard selectedIds.contains(entry.id) else { return nil }
            if case .object(let obj) = entry { return obj.key }
            return nil
        }
    }

    private var hasDownloadableSelection: Bool {
        let selectedIds = selection
        guard !selectedIds.isEmpty else { return false }
        return model.filteredEntries.contains { entry in
            selectedIds.contains(entry.id)
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(spacing: 10) {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(model.selectedBucket ?? "Objects")
                        .font(.system(size: 18, weight: .semibold, design: .rounded))
                        .contentTransition(.opacity)

                    Text(model.selectedTarget?.name ?? "")
                        .font(.system(size: 12, weight: .regular, design: .rounded))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }

                Spacer()

                searchField

                if model.isLoadingObjects {
                    ProgressView()
                        .controlSize(.small)
                        .transition(.opacity)
                }
            }
            .padding(.horizontal, 0)

            BreadcrumbBar(prefix: model.prefix) { newPrefix in
                Task {
                    model.prefix = newPrefix
                    await model.refreshObjects()
                }
            }
        }
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)
                .font(.system(size: 12, weight: .semibold, design: .rounded))

            TextField("Search objects…", text: $model.searchText)
                .textFieldStyle(.plain)
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .focused($focusedField, equals: .search)

            if !model.searchText.isEmpty {
                Button {
                    model.searchText = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .symbolRenderingMode(.hierarchical)
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .help("Clear search")
            }
        }
        .padding(.horizontal, 10)
        .frame(height: AppTheme.fieldHeight)
        .frame(minWidth: 160, idealWidth: 240, maxWidth: 360)
        .appGlassFieldChrome(isFocused: focusedField == .search)
    }

    private var showModifiedColumn: Bool { listWidth > 520 }

    private var sizeColumnWidth: CGFloat {
        min(110, max(70, listWidth * 0.14))
    }

    private var modifiedColumnWidth: CGFloat {
        min(180, max(120, listWidth * 0.22))
    }

    // MARK: - File List

    private var fileList: some View {
        ZStack {
            List(selection: $selection) {
                // Column header – lives inside the List so columns align.
                fileListHeaderRow
                    .listRowInsets(EdgeInsets(top: 0, leading: 0, bottom: 0, trailing: 0))
                    .listRowSeparator(.hidden)
                    .listRowBackground(Color(nsColor: .controlBackgroundColor))

                ForEach(model.filteredEntries, id: \.id) { entry in
                    ObjectListRowView(
                        entry: entry,
                        name: model.displayName(for: entry),
                        size: rowSizeText(for: entry),
                        modified: showModifiedColumn ? rowModifiedText(for: entry) : nil,
                        sizeWidth: sizeColumnWidth,
                        modifiedWidth: modifiedColumnWidth,
                        isSelected: selection.contains(entry.id)
                    )
                    .tag(entry.id)
                    .listRowInsets(EdgeInsets(top: 3, leading: 0, bottom: 3, trailing: 0))
                    .listRowSeparator(.hidden)
                    .listRowBackground(Color(nsColor: .controlBackgroundColor))
                    .contextMenu { contextMenu(for: entry) }
                    .draggable(entry.keyOrPrefix) {
                        Label(model.displayName(for: entry), systemImage: entry.isFolder ? "folder" : "doc")
                    }
                }
            }
            .listStyle(.plain)
            .id((model.selectedBucket ?? "") + ":" + model.prefix)
            .scrollContentBackground(.hidden)
            .background(Color.clear)

            if model.isLoadingObjects {
                loadingOverlay
                    .transition(.opacity)
            }
        }
        .onHover { isListHovered = $0 }
        .background(GeometryReader { geo in
            Color.clear.preference(key: ListWidthKey.self, value: geo.size.width)
        })
        .onPreferenceChange(ListWidthKey.self) { listWidth = $0 }
        .animation(.snappy(duration: 0.25), value: model.isLoadingObjects)
    }

    /// Column header row. Lives inside the List to guarantee column alignment.
    private var fileListHeaderRow: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Color.clear
                    .frame(width: 28, height: 1)

                Text("Name")
                    .font(.system(size: 11, weight: .semibold, design: .rounded))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Text("Size")
                    .font(.system(size: 11, weight: .semibold, design: .rounded))
                    .foregroundStyle(.secondary)
                    .frame(width: sizeColumnWidth, alignment: .trailing)

                if showModifiedColumn {
                    Text("Modified")
                        .font(.system(size: 11, weight: .semibold, design: .rounded))
                        .foregroundStyle(.secondary)
                        .frame(width: modifiedColumnWidth, alignment: .leading)
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)

            Divider().opacity(0.5)
        }
        .background(.thinMaterial)
    }

    private var loadingOverlay: some View {
        VStack(spacing: 10) {
            ProgressView()
                .controlSize(.regular)

            Text("Loading…")
                .font(.system(size: 12, weight: .semibold, design: .rounded))
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(AppTheme.strokeStrong)
        )
        .shadow(color: .black.opacity(0.15), radius: 18, x: 0, y: 8)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black.opacity(0.03))
    }

    // MARK: - Drop Overlay

    private var dropOverlay: some View {
        RoundedRectangle(cornerRadius: AppTheme.cornerRadius, style: .continuous)
            .strokeBorder(AppTheme.accent, style: StrokeStyle(lineWidth: 2, dash: [8, 4]))
            .background(
                RoundedRectangle(cornerRadius: AppTheme.cornerRadius, style: .continuous)
                    .fill(AppTheme.accent.opacity(0.08))
            )
            .overlay(
                VStack(spacing: 8) {
                    Image(systemName: "square.and.arrow.down.on.square")
                        .font(.system(size: 32, weight: .semibold))
                        .foregroundStyle(AppTheme.accent)
                    Text("Drop files to upload")
                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                        .foregroundStyle(AppTheme.accent)
                }
            )
            .padding(AppTheme.pagePadding)
            .allowsHitTesting(false)
    }

    // MARK: - Status Bar

    private var statusBar: some View {
        HStack(spacing: 10) {
            let count = model.filteredEntries.count
            Text("\(count) item\(count == 1 ? "" : "s")")
                .font(.system(size: 11, weight: .semibold, design: .rounded))
                .foregroundStyle(.secondary)

            Spacer()

            Text(model.prefix.isEmpty ? "Root" : model.prefix)
                .font(.system(size: 11, weight: .semibold, design: .rounded))
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .truncationMode(.middle)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: AppTheme.controlCornerRadius, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AppTheme.controlCornerRadius, style: .continuous)
                .strokeBorder(AppTheme.stroke)
        )
    }

    // MARK: - Helpers

    private func sizeText(_ bytes: Int64?) -> String {
        guard let bytes else { return "—" }
        return byteFormatter.string(fromByteCount: bytes)
    }

    private func dateText(_ date: Date?) -> String {
        guard let date else { return "—" }
        return dateFormatter.string(from: date)
    }

    private func rowSizeText(for entry: S3BrowserEntry) -> String {
        switch entry {
        case .folder(let pfx):
            if model.isComputingMetricsForSelectedBucket(prefix: pfx) { return "…" }
            if let metrics = model.metricsForSelectedBucket(prefix: pfx) {
                return byteFormatter.string(fromByteCount: metrics.totalBytes)
            }
            return "—"
        case .object(let obj):
            return sizeText(obj.sizeBytes)
        }
    }

    private func rowModifiedText(for entry: S3BrowserEntry) -> String {
        switch entry {
        case .folder:
            return "—"
        case .object(let obj):
            return dateText(obj.lastModified)
        }
    }

    private var resolvedSelection: [S3BrowserEntry] {
        guard !selection.isEmpty else { return [] }
        let selectedIds = selection
        return model.filteredEntries.filter { selectedIds.contains($0.id) }
    }

    // MARK: - Context Menu

    @ViewBuilder
    private func contextMenu(for entry: S3BrowserEntry) -> some View {
        switch entry {
        case .folder(let pfx):
            Button("Open") {
                openEntry(.folder(prefix: pfx))
            }

            Button("Download Folder") {
                downloadFolder(prefix: pfx)
            }

            Divider()

            Button("Copy Prefix") {
                Pasteboard.copyString(pfx)
            }

        case .object(let obj):
            Button("Download") {
                downloadSingleObject(key: obj.key)
            }

            Divider()

            Button("Copy Key") {
                Pasteboard.copyString(obj.key)
            }
            if let bucket = model.selectedBucket, !bucket.isEmpty {
                Button("Copy S3 URI") {
                    Pasteboard.copyString("s3://\(bucket)/\(obj.key)")
                }
            }
            if let etag = obj.eTag, !etag.isEmpty {
                Button("Copy ETag") {
                    Pasteboard.copyString(etag)
                }
            }
        }
    }

    // MARK: - Actions

    private func openEntry(_ entry: S3BrowserEntry) {
        guard case .folder(let pfx) = entry else { return }
        selection.removeAll()
        Task { await model.enterFolder(pfx) }
    }

    private func openSelection() -> Bool {
        guard !selection.isEmpty else { return false }

        let selectedSet = selection
        guard let entry = model.filteredEntries.first(where: { selectedSet.contains($0.id) }) else { return false }
        guard entry.isFolder else { return false }

        openEntry(entry)
        return true
    }

    private func presentUploadPanel() {
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = true
        panel.title = "Upload to S3"
        panel.prompt = "Upload"

        guard panel.runModal() == .OK else { return }

        for url in panel.urls {
            var isDir: ObjCBool = false
            if FileManager.default.fileExists(atPath: url.path, isDirectory: &isDir), isDir.boolValue {
                model.uploadDirectory(url: url)
            } else {
                model.uploadFiles(urls: [url])
            }
        }
    }

    private func presentDownloadPanel() {
        let selectedIds = selection
        guard !selectedIds.isEmpty else { return }

        let selectedEntries = model.filteredEntries.filter { selectedIds.contains($0.id) }
        guard !selectedEntries.isEmpty else { return }

        // Gather objects and folder prefixes separately.
        var objectKeys: [String] = []
        var folderPrefixes: [String] = []
        for entry in selectedEntries {
            switch entry {
            case .object(let obj): objectKeys.append(obj.key)
            case .folder(let pfx): folderPrefixes.append(pfx)
            }
        }

        // Single object, no folders — use NSSavePanel.
        if objectKeys.count == 1 && folderPrefixes.isEmpty {
            downloadSingleObject(key: objectKeys[0])
            return
        }

        // Everything else: choose a destination directory.
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        panel.title = "Choose Download Folder"
        panel.prompt = "Download"

        guard panel.runModal() == .OK, let url = panel.url else { return }

        if !objectKeys.isEmpty {
            model.downloadSelectedObjects(keys: objectKeys, to: url)
        }
        for pfx in folderPrefixes {
            model.downloadPrefix(pfx, to: url)
        }
    }

    private func downloadSingleObject(key: String) {
        let fileName = (key as NSString).lastPathComponent
        let panel = NSSavePanel()
        panel.nameFieldStringValue = fileName
        panel.title = "Save Download"
        panel.prompt = "Download"

        guard panel.runModal() == .OK, let url = panel.url else { return }
        model.downloadSingleObject(key: key, to: url)
    }

    private func downloadFolder(prefix: String) {
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        panel.title = "Choose Download Folder"
        panel.prompt = "Download"

        guard panel.runModal() == .OK, let url = panel.url else { return }
        model.downloadPrefix(prefix, to: url)
    }

    // MARK: - Drag & Drop

    private func handleDrop(_ providers: [NSItemProvider]) -> Bool {
        guard model.selectedBucket != nil else { return false }

        for provider in providers {
            provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { data, _ in
                guard let data = data as? Data,
                      let urlString = String(data: data, encoding: .utf8),
                      let url = URL(string: urlString) else { return }

                Task { @MainActor in
                    var isDir: ObjCBool = false
                    if FileManager.default.fileExists(atPath: url.path, isDirectory: &isDir), isDir.boolValue {
                        model.uploadDirectory(url: url)
                    } else {
                        model.uploadFiles(urls: [url])
                    }
                }
            }
        }
        return true
    }

    // MARK: - Key Monitor

    private func installKeyMonitorIfNeeded() {
        guard keyDownMonitor == nil else { return }

        keyDownMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
            if model.activeSheet != nil {
                return event
            }

            // Enter/Return key to open folder.
            if let firstResponder = NSApp.keyWindow?.firstResponder, firstResponder is NSTextView {
                return event
            }

            if event.keyCode == 36 || event.keyCode == 76 {
                if openSelection() {
                    return nil
                }
            }
            return event
        }
    }

    private func uninstallKeyMonitor() {
        if let monitor = keyDownMonitor {
            NSEvent.removeMonitor(monitor)
            keyDownMonitor = nil
        }
    }

    private func installMouseMonitorIfNeeded() {
        guard mouseMonitor == nil else { return }
        mouseMonitor = NSEvent.addLocalMonitorForEvents(matching: .leftMouseDown) { event in
            guard event.clickCount == 2, isListHovered else { return event }
            if model.activeSheet != nil { return event }
            if openSelection() { return nil }
            return event
        }
    }

    private func uninstallMouseMonitor() {
        if let monitor = mouseMonitor {
            NSEvent.removeMonitor(monitor)
            mouseMonitor = nil
        }
    }

}

// MARK: - Object List Row View

private struct ObjectListRowView: View {
    let entry: S3BrowserEntry
    let name: String
    let size: String
    let modified: String?
    let sizeWidth: CGFloat
    let modifiedWidth: CGFloat
    let isSelected: Bool

    @State private var isHovering: Bool = false

    var body: some View {
        HStack(spacing: 10) {
            icon

            Text(name)
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .lineLimit(1)
                .truncationMode(.middle)
                .frame(maxWidth: .infinity, alignment: .leading)

            Text(size)
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .foregroundStyle(.secondary)
                .frame(width: sizeWidth, alignment: .trailing)

            if let modified {
                Text(modified)
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundStyle(.secondary)
                    .frame(width: modifiedWidth, alignment: .leading)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
        .background(hoverBackground)
        .onHover { hovering in
            withAnimation(.snappy(duration: 0.18)) {
                isHovering = hovering
            }
        }
        .animation(.snappy(duration: 0.18), value: isSelected)
    }

    private var hoverBackground: some View {
        RoundedRectangle(cornerRadius: 12, style: .continuous)
            .fill(backgroundFill)
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(backgroundStroke)
            )
    }

    private var backgroundFill: Color {
        if isSelected { return AppTheme.accent.opacity(0.16) }
        if isHovering { return AppTheme.hoverFill }
        return .clear
    }

    private var backgroundStroke: Color {
        if isSelected { return AppTheme.accent.opacity(0.32) }
        return .clear
    }

    private var icon: some View {
        let isFolder = entry.isFolder
        let bg = isFolder ? AppTheme.accent.opacity(0.18) : Color.secondary.opacity(0.12)
        let fg: Color = isFolder ? AppTheme.accent : .secondary
        let symbol = isFolder ? "folder.fill" : "doc.text"

        return ZStack {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(bg)
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .strokeBorder(.white.opacity(0.10))
                )
                .frame(width: 28, height: 28)

            Image(systemName: symbol)
                .font(.system(size: 14, weight: .semibold))
                .symbolRenderingMode(.hierarchical)
                .foregroundStyle(fg)
        }
    }
}

// MARK: - Preference Key for List Width

private struct ListWidthKey: PreferenceKey {
    static var defaultValue: CGFloat = 600
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}
