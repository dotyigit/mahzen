//
//  DropZonePanel.swift
//  Mahzen
//
//  Created on 2026-02-09.
//

import SwiftUI
import Combine
import UniformTypeIdentifiers

// MARK: - DropZoneCoordinator

@MainActor
final class DropZoneCoordinator {
    private let model: AppModel
    private var panel: DropZonePanel?
    private var globalDragMonitor: Any?
    private var globalMouseUpMonitor: Any?
    private var hideTimer: Timer?
    private var isDragActive = false
    private var lastDragChangeCount: Int = NSPasteboard(name: .drag).changeCount

    init(model: AppModel) {
        self.model = model
    }

    func start() {
        globalDragMonitor = NSEvent.addGlobalMonitorForEvents(matching: .leftMouseDragged) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.handleDragEvent()
            }
        }
        globalMouseUpMonitor = NSEvent.addGlobalMonitorForEvents(matching: .leftMouseUp) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.handleDragEnd()
            }
        }
    }

    func stop() {
        if let monitor = globalDragMonitor {
            NSEvent.removeMonitor(monitor)
            globalDragMonitor = nil
        }
        if let monitor = globalMouseUpMonitor {
            NSEvent.removeMonitor(monitor)
            globalMouseUpMonitor = nil
        }
        hideTimer?.invalidate()
        hideTimer = nil
        hidePanel()
    }

    private func handleDragEvent() {
        guard !isDragActive else { return }
        let pb = NSPasteboard(name: .drag)
        let currentChangeCount = pb.changeCount
        guard currentChangeCount != lastDragChangeCount else { return }
        lastDragChangeCount = currentChangeCount
        guard pb.types?.contains(.fileURL) == true else { return }
        isDragActive = true
        hideTimer?.invalidate()
        showPanel()
    }

    private func handleDragEnd() {
        guard isDragActive else { return }
        isDragActive = false
        hideTimer?.invalidate()
        hideTimer = Timer.scheduledTimer(withTimeInterval: 1.5, repeats: false) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.hidePanel()
            }
        }
    }

    private func showPanel() {
        if panel == nil {
            panel = DropZonePanel(model: model, onClose: { [weak self] in
                self?.hidePanel()
            })
        }
        panel?.positionBelowMenuBarIcon()
        panel?.orderFrontRegardless()
    }

    private func hidePanel() {
        hideTimer?.invalidate()
        hideTimer = nil
        panel?.orderOut(nil)
    }
}

// MARK: - Shared Drop State

/// Bridges AppKit drag events to SwiftUI. The wrapper NSView writes to this,
/// and the SwiftUI content view observes it.
@MainActor
final class DropZoneDropState: ObservableObject {
    @Published var isDragging = false
    @Published var droppedURLs: [URL]?
}

// MARK: - DropAcceptingView

/// NSView that wraps the SwiftUI hosting view and implements NSDraggingDestination.
/// This is the only reliable way to receive file drops in a floating non-activating panel —
/// SwiftUI's .onDrop and NSViewRepresentable overlays do not work in this context.
final class DropAcceptingView: NSView {
    private let dropState: DropZoneDropState

    init(hostingView: NSView, dropState: DropZoneDropState) {
        self.dropState = dropState
        super.init(frame: .zero)

        addSubview(hostingView)
        hostingView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            hostingView.leadingAnchor.constraint(equalTo: leadingAnchor),
            hostingView.trailingAnchor.constraint(equalTo: trailingAnchor),
            hostingView.topAnchor.constraint(equalTo: topAnchor),
            hostingView.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        registerForDraggedTypes([.fileURL])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation {
        dropState.isDragging = true
        return .copy
    }

    override func draggingUpdated(_ sender: NSDraggingInfo) -> NSDragOperation {
        .copy
    }

    override func draggingExited(_ sender: NSDraggingInfo?) {
        dropState.isDragging = false
    }

    override func draggingEnded(_ sender: NSDraggingInfo) {
        dropState.isDragging = false
    }

    override func prepareForDragOperation(_ sender: NSDraggingInfo) -> Bool {
        true
    }

    override func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
        dropState.isDragging = false
        guard let urls = sender.draggingPasteboard.readObjects(
            forClasses: [NSURL.self],
            options: [.urlReadingFileURLsOnly: true]
        ) as? [URL], !urls.isEmpty else {
            return false
        }
        dropState.droppedURLs = urls
        return true
    }
}

// MARK: - DropZonePanel

final class DropZonePanel: NSPanel {
    // Keep hosting controller alive.
    private var _hostingController: AnyObject?

    init(model: AppModel, onClose: @escaping () -> Void) {
        super.init(
            contentRect: NSRect(x: 0, y: 0, width: 240, height: 240),
            styleMask: [.nonactivatingPanel, .utilityWindow],
            backing: .buffered,
            defer: false
        )
        level = .floating
        hidesOnDeactivate = false
        isMovableByWindowBackground = true
        hasShadow = true
        isOpaque = false
        backgroundColor = .clear
        animationBehavior = .utilityWindow

        let dropState = DropZoneDropState()
        let rootView = DropZoneContentView(model: model, onClose: onClose, dropState: dropState)
        let hosting = NSHostingController(rootView: rootView)
        _hostingController = hosting

        let wrapper = DropAcceptingView(hostingView: hosting.view, dropState: dropState)
        contentView = wrapper
    }

    func positionBelowMenuBarIcon() {
        guard let screen = NSScreen.main else { return }

        var anchorMidX: CGFloat?
        for window in NSApp.windows where window != self {
            let className = String(describing: type(of: window))
            if className.contains("NSStatusBar") {
                anchorMidX = window.frame.midX
                break
            }
        }

        let y = screen.visibleFrame.maxY - frame.height
        let x: CGFloat
        if let midX = anchorMidX {
            let proposed = midX - frame.width / 2
            x = max(screen.visibleFrame.minX, min(proposed, screen.visibleFrame.maxX - frame.width))
        } else {
            x = screen.visibleFrame.maxX - frame.width - 16
        }
        setFrameOrigin(NSPoint(x: x, y: y))
    }

    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }
}

// MARK: - DropZoneContentView

private struct DropZoneContentView: View {
    @ObservedObject var model: AppModel
    let onClose: () -> Void
    @ObservedObject var dropState: DropZoneDropState

    private var isUploading: Bool { model.transferManager.isTransferring }

    var body: some View {
        VStack(spacing: 0) {
            if let bucket = model.menuBarBucket, model.menuBarTargetId != nil {
                // Bucket label
                HStack(spacing: 6) {
                    Image(systemName: "archivebox")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(AppTheme.accent)

                    Text(bucket)
                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                        .lineLimit(1)
                        .truncationMode(.middle)

                    Spacer()
                }
                .padding(.horizontal, 14)
                .padding(.top, 14)
                .padding(.bottom, 8)

                // Drop area
                VStack(spacing: 8) {
                    Spacer()

                    Image(systemName: dropState.isDragging ? "arrow.down.doc.fill" : "arrow.down.doc")
                        .font(.system(size: 32, weight: .light))
                        .foregroundStyle(dropState.isDragging ? .blue : .secondary)

                    Text(dropState.isDragging ? "Drop to upload" : "Drag files here")
                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                        .foregroundStyle(dropState.isDragging ? .blue : .secondary)

                    Spacer()
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(dropState.isDragging ? Color.blue.opacity(0.08) : Color.clear)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .strokeBorder(
                            dropState.isDragging ? Color.blue.opacity(0.5) : Color.secondary.opacity(0.2),
                            style: StrokeStyle(lineWidth: 1.5, dash: [6, 4])
                        )
                )
                .padding(.horizontal, 14)
                .padding(.bottom, isUploading ? 6 : 14)

                // Upload progress indicator
                if isUploading {
                    HStack(spacing: 8) {
                        ProgressView(value: model.transferManager.aggregateProgress)
                            .tint(AppTheme.accent)

                        Text("\(Int(model.transferManager.aggregateProgress * 100))%")
                            .font(.system(size: 10, weight: .semibold, design: .rounded))
                            .foregroundStyle(.secondary)
                            .monospacedDigit()
                            .frame(width: 32, alignment: .trailing)
                    }
                    .padding(.horizontal, 14)
                    .padding(.bottom, 10)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            } else {
                // No bucket selected
                VStack(spacing: 8) {
                    Spacer()

                    Image(systemName: "archivebox.circle")
                        .font(.system(size: 28, weight: .light))
                        .foregroundStyle(.tertiary)

                    Text("No Bucket Selected")
                        .font(.system(size: 13, weight: .semibold, design: .rounded))

                    Text("Select a bucket in the menu bar first.")
                        .font(.system(size: 11, design: .rounded))
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)

                    Spacer()
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(14)
            }
        }
        .frame(width: 240, height: 240)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(
                    dropState.isDragging ? Color.blue.opacity(0.6) : AppTheme.stroke,
                    lineWidth: dropState.isDragging ? 2 : 1
                )
                .allowsHitTesting(false)
        )
        .animation(.snappy(duration: 0.2), value: dropState.isDragging)
        .animation(.snappy(duration: 0.25), value: isUploading)
        .onChange(of: dropState.droppedURLs) { _, urls in
            guard let urls else { return }
            dropState.droppedURLs = nil
            guard let bucket = model.menuBarBucket,
                  let targetId = model.menuBarTargetId else { return }
            handleDrop(urls, targetId: targetId, bucket: bucket)
        }
    }

    private func handleDrop(_ urls: [URL], targetId: UUID, bucket: String) {
        for url in urls {
            var isDir: ObjCBool = false
            if FileManager.default.fileExists(atPath: url.path, isDirectory: &isDir), isDir.boolValue {
                model.uploadDirectory(url: url, targetId: targetId, bucket: bucket)
            } else {
                model.uploadFiles(urls: [url], targetId: targetId, bucket: bucket)
            }
        }
    }
}
