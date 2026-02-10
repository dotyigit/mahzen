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
                            Button(role: .destructive) {
                                model.deleteTargets([target.id])
                            } label: {
                                Image(systemName: "trash")
                            }
                            .buttonStyle(.borderless)
                            .help("Delete")
                        }
                        .contextMenu {
                            Button("Delete Target", role: .destructive) {
                                model.deleteTargets([target.id])
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
        }
        .frame(width: 620, height: 600)
        .tint(AppTheme.accent)
    }
}
