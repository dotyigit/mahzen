//
//  MahzenApp.swift
//  Mahzen
//
//  Created by Omer Yigit Aker on 8.02.2026.
//

import SwiftUI
import Sparkle

@main
struct MahzenApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var model = AppModel()
    @State private var dropZoneCoordinator: DropZoneCoordinator?

    private let updaterController = SPUStandardUpdaterController(
        startingUpdater: true,
        updaterDelegate: nil,
        userDriverDelegate: nil
    )

    var body: some Scene {
        Window("Mahzen", id: "main") {
            ContentView(model: model)
                .frame(minWidth: 900, minHeight: 620)
                .onAppear {
                    if dropZoneCoordinator == nil {
                        let coordinator = DropZoneCoordinator(model: model)
                        coordinator.start()
                        dropZoneCoordinator = coordinator
                    }
                }
        }
        .defaultSize(width: 1100, height: 720)
        .windowResizability(.contentMinSize)
        .commands {
            CommandGroup(after: .appInfo) {
                CheckForUpdatesView(updater: updaterController.updater)
            }
        }

        MenuBarExtra("Mahzen", systemImage: "archivebox") {
            MenuBarView(model: model)
        }
        .menuBarExtraStyle(.window)
    }
}

/// Prevents duplicate app instances — only one menu bar icon at a time.
/// Also configures MenuBarExtra panels to stay visible during file drags.
final class AppDelegate: NSObject, NSApplicationDelegate {
    private var panelObserver: Any?
    private var windowCloseObserver: Any?

    func applicationDidFinishLaunching(_ notification: Notification) {
        // First launch shows the main window with a Dock icon.
        // When the user closes the window, we switch to .accessory (menu bar only).

        guard let bundleId = Bundle.main.bundleIdentifier else { return }
        let running = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId)
        if running.count > 1 {
            for app in running where app != .current {
                app.activate()
            }
            DispatchQueue.main.async {
                NSApp.terminate(nil)
            }
            return
        }

        panelObserver = NotificationCenter.default.addObserver(
            forName: NSWindow.didBecomeKeyNotification,
            object: nil,
            queue: .main
        ) { notification in
            guard let panel = notification.object as? NSPanel else { return }
            panel.hidesOnDeactivate = false
        }

        // When a regular (non-panel) window closes and no others remain, hide from Dock.
        windowCloseObserver = NotificationCenter.default.addObserver(
            forName: NSWindow.willCloseNotification,
            object: nil,
            queue: .main
        ) { notification in
            guard let window = notification.object as? NSWindow else { return }
            // Only react to regular windows closing, never panels.
            guard !(window is NSPanel) else { return }

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                let hasMainWindows = NSApp.windows.contains { w in
                    w.isVisible && !(w is NSPanel) && w.level == .normal
                }
                if !hasMainWindows {
                    NSApp.setActivationPolicy(.accessory)
                }
            }
        }
    }
}
