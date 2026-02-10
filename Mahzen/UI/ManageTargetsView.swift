//
//  ManageTargetsView.swift
//  Mahzen
//
//  Created by Codex on 2026-02-08.
//

import SwiftUI

struct ManageTargetsView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var model: AppModel
    @State private var isAddingTarget: Bool = false
    @State private var editingTarget: StorageTarget?
    @State private var targetPendingDeletion: StorageTarget?

    var body: some View {
        NavigationStack {
            List {
                if model.targets.isEmpty {
                    HeroEmptyStateView(
                        title: "No Targets",
                        subtitle: "Add a storage target to get started.",
                        systemImage: "externaldrive.badge.plus",
                        actionTitle: "Add Target",
                        action: { isAddingTarget = true }
                    )
                    .listRowInsets(EdgeInsets())
                    .listRowSeparator(.hidden)
                } else {
                    ForEach(model.targets) { target in
                        HStack {
                            TargetRowView(target: target)
                            Spacer()
                            Button {
                                editingTarget = target
                            } label: {
                                Image(systemName: "pencil")
                            }
                            .buttonStyle(.borderless)
                            .help("Edit")

                            Button(role: .destructive) {
                                requestDelete(target)
                            } label: {
                                Image(systemName: "trash")
                            }
                            .buttonStyle(.borderless)
                            .help("Delete")
                        }
                        .contextMenu {
                            Button {
                                editingTarget = target
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
            .navigationTitle("Targets")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        isAddingTarget = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .navigationDestination(isPresented: $isAddingTarget) {
                AddTargetView(model: model, showsCancelButton: false)
            }
            .navigationDestination(item: $editingTarget) { target in
                AddTargetView(model: model, existingTarget: target, showsCancelButton: false)
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
        .frame(width: 620, height: 600)
        .tint(AppTheme.accent)
    }

    private func requestDelete(_ target: StorageTarget) {
        targetPendingDeletion = target
    }
}
