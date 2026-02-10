//
//  ContentView.swift
//  Mahzen
//
//  Created by Omer Yigit Aker on 8.02.2026.
//

import SwiftUI

struct ContentView: View {
    @ObservedObject var model: AppModel
    @State private var isChangingTarget = false

    var body: some View {
        NavigationSplitView {
            BucketsSidebarView(model: model)
                .navigationSplitViewColumnWidth(min: 240, ideal: 260, max: 360)
        } detail: {
            ObjectsBrowserView(model: model)
        }
        .navigationSplitViewStyle(.balanced)
        .tint(AppTheme.accent)
        .sheet(item: $model.activeSheet) { sheet in
            switch sheet {
            case .addTarget:
                AddTargetView(model: model, showsCancelButton: true)
            case .manageTargets:
                ManageTargetsView(model: model)
            }
        }
        .alert("Error", isPresented: Binding(get: { model.errorMessage != nil }, set: { isPresented in
            if !isPresented { model.errorMessage = nil }
        })) {
            Button("OK", role: .cancel) { }
        } message: {
            Text(model.errorMessage ?? "")
        }
        .task {
            // Initial load.
            model.refreshTargets()
            await model.refreshBuckets()
            await model.refreshObjects()
        }
        .onChange(of: model.selectedTargetId) {
            isChangingTarget = true
            Task {
                model.cancelAllMetricsTasks()
                model.selectedBucket = nil
                model.prefix = ""
                model.clearEntries()
                await model.refreshBuckets()
                await model.refreshObjects()
                isChangingTarget = false
            }
        }
        .onChange(of: model.selectedBucket) {
            guard !isChangingTarget else { return }
            Task {
                model.cancelAllMetricsTasks()
                model.prefix = ""
                model.clearEntries()
                await model.refreshObjects()
            }
        }
    }
}
