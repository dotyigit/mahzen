//
//  TargetsSidebarView.swift
//  Mahzen
//
//  Created by Codex on 2026-02-08.
//

import SwiftUI

struct TargetsSidebarView: View {
    @ObservedObject var model: AppModel
    @State private var targetPendingDeletion: StorageTarget?

    var body: some View {
        VStack(spacing: 0) {
            if model.targets.isEmpty {
                VStack(spacing: 10) {
                    Image(systemName: "externaldrive.badge.plus")
                        .font(.system(size: 28, weight: .semibold, design: .rounded))
                        .symbolRenderingMode(.hierarchical)
                        .foregroundStyle(AppTheme.accent)

                    Text("Add a storage target")
                        .font(.system(size: 14, weight: .semibold, design: .rounded))

                    Text("Connect AWS S3, Cloudflare R2, MinIO, and other S3-compatible providers.")
                        .font(.system(size: 12, weight: .regular, design: .rounded))
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 240)

                    Button("Add Target") {
                        model.presentSheet(.addTarget)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(AppTheme.accent)
                    .padding(.top, 4)
                }
                .padding(22)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(AppTheme.sidebarBackground())
            } else {
                List(selection: $model.selectedTargetId) {
                    Section("Targets") {
                        ForEach(model.targets) { target in
                            TargetRowView(target: target)
                                .tag(target.id)
                                .contextMenu {
                                    Button {
                                        model.presentSheet(.editTarget(target))
                                    } label: {
                                        Label("Edit Target", systemImage: "pencil")
                                    }

                                    Divider()

                                    Button("Delete Target", role: .destructive) {
                                        requestDelete(target)
                                    }
                                }
                        }
                    }
                }
                .listStyle(.sidebar)
                .scrollContentBackground(.hidden)
                .background(AppTheme.sidebarBackground())
                .animation(.snappy(duration: 0.25), value: model.targets)
            }
        }
        .navigationTitle("Mahzen")
        .toolbar {
            ToolbarItemGroup {
                Button {
                    model.presentSheet(.addTarget)
                } label: {
                    Image(systemName: "plus")
                }

                Button {
                    withAnimation(.snappy(duration: 0.25)) {
                        model.refreshTargets()
                    }
                    Task { await model.refreshBuckets() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .help("Refresh")
            }
        }
        .confirmationDialog(
            "Delete Target?",
            isPresented: Binding(
                get: { targetPendingDeletion != nil },
                set: { isPresented in
                    if !isPresented { targetPendingDeletion = nil }
                }
            ),
            titleVisibility: .visible
        ) {
            if let target = targetPendingDeletion {
                Button("Delete \(target.name)", role: .destructive) {
                    model.deleteTargets([target.id])
                    targetPendingDeletion = nil
                }
            }
            Button("Cancel", role: .cancel) {
                targetPendingDeletion = nil
            }
        } message: {
            Text("This removes the target configuration and stored credentials from Keychain.")
        }
    }

    private func requestDelete(_ target: StorageTarget) {
        targetPendingDeletion = target
    }
}
