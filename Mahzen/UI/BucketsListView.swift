//
//  BucketsListView.swift
//  Mahzen
//
//  Created by Codex on 2026-02-08.
//

import SwiftUI

struct BucketsListView: View {
    @ObservedObject var model: AppModel
    @State private var bucketSearchText: String = ""

    var body: some View {
        VStack(spacing: 0) {
            if model.selectedTarget == nil {
                HeroEmptyStateView(
                    title: "No Target Selected",
                    subtitle: "Add a storage target to start browsing buckets and objects.",
                    systemImage: "externaldrive",
                    actionTitle: "Add Target",
                    action: { model.presentSheet(.addTarget) }
                )
            } else {
                List {
                    Section {
                        ForEach(filteredBuckets) { bucket in
                            BucketRowView(name: bucket.name, isSelected: model.selectedBucket == bucket.name)
                                .contentShape(Rectangle())
                                .onTapGesture { model.selectedBucket = bucket.name }
                                .listRowBackground(Color.clear)
                        }
                    } header: {
                        HStack(alignment: .firstTextBaseline, spacing: 10) {
                            Text("Buckets")
                                .font(.system(size: 13, weight: .semibold, design: .rounded))

                            Spacer()

                            if model.isLoadingBuckets {
                                ProgressView()
                                    .controlSize(.small)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
                .listStyle(.inset)
                .scrollContentBackground(.hidden)
                .background(AppTheme.contentBackground())
                .overlay {
                    if !model.isLoadingBuckets, filteredBuckets.isEmpty {
                        HeroEmptyStateView(
                            title: "No Buckets Found",
                            subtitle: bucketSearchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                ? "Try refreshing, or double-check credentials and endpoint."
                                : "No buckets match your search.",
                            systemImage: "archivebox",
                            actionTitle: "Refresh",
                            action: { Task { await model.refreshBuckets() } }
                        )
                    }
                }
                .navigationTitle(model.selectedTarget?.name ?? "Buckets")
                .toolbar {
                    ToolbarItemGroup {
                        Button {
                            Task { await model.refreshBuckets() }
                        } label: {
                            Image(systemName: "arrow.clockwise")
                        }
                        .help("Refresh Buckets")
                    }
                }
                .animation(.snappy(duration: 0.25), value: model.buckets)
            }
        }
    }

    private var filteredBuckets: [S3Bucket] {
        let q = bucketSearchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return model.buckets }
        return model.buckets.filter { $0.name.localizedCaseInsensitiveContains(q) }
    }
}
