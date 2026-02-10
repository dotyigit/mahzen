//
//  ObjectInspectorView.swift
//  Mahzen
//
//  Created by Codex on 2026-02-08.
//

import SwiftUI

struct ObjectInspectorView: View {
    @ObservedObject var model: AppModel
    let selection: [S3BrowserEntry]

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
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                header
                Divider().opacity(0.5)
                location
                if bucket != nil {
                    Divider().opacity(0.5)
                    analytics
                }
                Divider().opacity(0.5)
                details
                Spacer(minLength: 0)
            }
            .padding(16)
        }
        .frame(minWidth: 220, idealWidth: 260, maxWidth: 320)
    }

    private var target: StorageTarget? {
        model.selectedTarget
    }

    private var bucket: String? {
        let b = model.selectedBucket
        return (b?.isEmpty == false) ? b : nil
    }

    private var prefix: String {
        model.prefix
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(AppTheme.accent.opacity(0.18))
                        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(.white.opacity(0.14)))
                        .frame(width: 40, height: 40)

                    Image(systemName: headerIcon)
                        .font(.system(size: 18, weight: .semibold, design: .rounded))
                        .symbolRenderingMode(.hierarchical)
                        .foregroundStyle(AppTheme.accent)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(headerTitle)
                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                        .lineLimit(2)

                    Text(headerSubtitle)
                        .font(.system(size: 11, weight: .regular, design: .rounded))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
            }
        }
    }

    private var location: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Location")
                .font(.system(size: 12, weight: .semibold, design: .rounded))
                .foregroundStyle(.secondary)

            InspectorRow(label: "Target", value: target?.name ?? "—", copyValue: target?.name)
            InspectorRow(label: "Endpoint", value: target?.endpoint.host ?? "—", copyValue: target?.endpoint.absoluteString)
            InspectorRow(label: "Bucket", value: bucket ?? "—", copyValue: bucket)
            InspectorRow(label: "Prefix", value: prefix.isEmpty ? "/" : prefix, copyValue: prefix.isEmpty ? "/" : prefix)
        }
    }

    private var analytics: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Analytics")
                .font(.system(size: 12, weight: .semibold, design: .rounded))
                .foregroundStyle(.secondary)

            bucketAnalytics

            if selection.count == 1, case .folder(let pfx) = selection[0] {
                Divider().opacity(0.5)
                folderAnalytics(prefix: pfx)
            }
        }
    }

    @ViewBuilder
    private var bucketAnalytics: some View {
        let bucketPrefix = ""
        let metrics = model.metricsForSelectedBucket(prefix: bucketPrefix)
        let isComputing = model.isComputingMetricsForSelectedBucket(prefix: bucketPrefix)
        let error = model.metricsErrorForSelectedBucket(prefix: bucketPrefix)

        HStack(spacing: 10) {
            if isComputing {
                ProgressView()
                    .controlSize(.small)
                Text("Scanning bucket…")
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundStyle(.secondary)
            } else {
                Text("Bucket totals")
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundStyle(.secondary)
            }

            Spacer()

            if isComputing {
                Button("Stop") {
                    model.cancelMetricsForSelectedBucket(prefix: bucketPrefix)
                }
                .buttonStyle(.borderless)
            } else if metrics == nil {
                Button("Compute") {
                    model.ensureBucketMetricsIfNeeded(priority: .userInitiated)
                }
                .buttonStyle(.borderless)
            }
        }

        InspectorRow(label: "Objects", value: metrics.map { "\($0.objectCount)" } ?? "—")
        InspectorRow(label: "Size", value: metrics.map { byteFormatter.string(fromByteCount: $0.totalBytes) } ?? "—")
        InspectorRow(label: "Updated", value: metrics.map { dateFormatter.string(from: $0.lastUpdated) } ?? "—")

        if let error, !error.isEmpty {
            Label(error, systemImage: "exclamationmark.triangle.fill")
                .font(.system(size: 11, weight: .semibold, design: .rounded))
                .foregroundStyle(.red)
        }
    }

    @ViewBuilder
    private func folderAnalytics(prefix pfx: String) -> some View {
        let metrics = model.metricsForSelectedBucket(prefix: pfx)
        let isComputing = model.isComputingMetricsForSelectedBucket(prefix: pfx)
        let error = model.metricsErrorForSelectedBucket(prefix: pfx)

        HStack(spacing: 10) {
            if isComputing {
                ProgressView()
                    .controlSize(.small)
                Text("Scanning folder…")
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundStyle(.secondary)
            } else {
                Text("Selected folder")
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundStyle(.secondary)
            }

            Spacer()

            if isComputing {
                Button("Stop") {
                    model.cancelMetricsForSelectedBucket(prefix: pfx)
                }
                .buttonStyle(.borderless)
            } else if metrics == nil {
                Button("Compute") {
                    model.ensureMetricsForSelectedBucket(prefix: pfx, priority: .userInitiated)
                }
                .buttonStyle(.borderless)
            }
        }

        InspectorRow(label: "Objects", value: metrics.map { "\($0.objectCount)" } ?? "—")
        InspectorRow(label: "Size", value: metrics.map { byteFormatter.string(fromByteCount: $0.totalBytes) } ?? "—")
        InspectorRow(label: "Updated", value: metrics.map { dateFormatter.string(from: $0.lastUpdated) } ?? "—")

        if let error, !error.isEmpty {
            Label(error, systemImage: "exclamationmark.triangle.fill")
                .font(.system(size: 11, weight: .semibold, design: .rounded))
                .foregroundStyle(.red)
        }
    }

    @ViewBuilder
    private var details: some View {
        if selection.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text("Selection")
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundStyle(.secondary)
                Text("Select an object or folder to see details.")
                    .font(.system(size: 12, weight: .regular, design: .rounded))
                    .foregroundStyle(.secondary)
            }
        } else if selection.count > 1 {
            VStack(alignment: .leading, spacing: 10) {
                Text("Selection")
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundStyle(.secondary)

                InspectorRow(label: "Items", value: "\(selection.count)")
            }
        } else {
            let entry = selection[0]
            VStack(alignment: .leading, spacing: 10) {
                Text("Details")
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundStyle(.secondary)

                switch entry {
                case .folder(let pfx):
                    InspectorRow(label: "Type", value: "Folder")
                    InspectorRow(label: "Prefix", value: pfx, copyValue: pfx)
                case .object(let obj):
                    InspectorRow(label: "Type", value: "Object")
                    InspectorRow(label: "Key", value: obj.key, copyValue: obj.key)
                    InspectorRow(label: "S3 URI", value: s3URI(bucket: bucket, key: obj.key), copyValue: s3URI(bucket: bucket, key: obj.key))
                    InspectorRow(label: "Size", value: sizeText(obj.sizeBytes))
                    InspectorRow(label: "Modified", value: dateText(obj.lastModified))
                    InspectorRow(label: "ETag", value: obj.eTag ?? "—", copyValue: obj.eTag)
                    InspectorRow(label: "Storage", value: obj.storageClass ?? "—")
                }
            }
        }
    }

    private var headerIcon: String {
        if selection.count > 1 { return "rectangle.stack" }
        switch selection.first {
        case .none:
            return "info.circle"
        case .some(.folder):
            return "folder"
        case .some(.object):
            return "doc.text"
        }
    }

    private var headerTitle: String {
        if selection.isEmpty { return "Inspector" }
        if selection.count > 1 { return "\(selection.count) items selected" }
        switch selection[0] {
        case .folder(let pfx):
            return pfx
        case .object(let obj):
            return obj.key
        }
    }

    private var headerSubtitle: String {
        target?.provider.rawValue ?? "S3 Compatible"
    }

    private func s3URI(bucket: String?, key: String) -> String {
        guard let bucket, !bucket.isEmpty else { return "—" }
        return "s3://\(bucket)/\(key)"
    }

    private func sizeText(_ bytes: Int64?) -> String {
        guard let bytes else { return "—" }
        return byteFormatter.string(fromByteCount: bytes)
    }

    private func dateText(_ date: Date?) -> String {
        guard let date else { return "—" }
        return dateFormatter.string(from: date)
    }
}

private struct InspectorRow: View {
    let label: String
    let value: String
    var copyValue: String? = nil

    @State private var isHovering: Bool = false
    @State private var justCopied: Bool = false

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            Text(label)
                .font(.system(size: 11, weight: .semibold, design: .rounded))
                .foregroundStyle(.secondary)
                .frame(width: 82, alignment: .leading)

            Text(value)
                .font(.system(size: 12, weight: .regular, design: .rounded))
                .lineLimit(1)
                .truncationMode(.middle)
                .frame(maxWidth: .infinity, alignment: .leading)
                .help(value)
                .textSelection(.enabled)

            if let copyValue, copyValue != "—" {
                Button {
                    Pasteboard.copyString(copyValue)
                    withAnimation(.snappy(duration: 0.16)) {
                        justCopied = true
                    }
                    Task {
                        try? await Task.sleep(nanoseconds: 900_000_000)
                        await MainActor.run {
                            withAnimation(.snappy(duration: 0.16)) {
                                justCopied = false
                            }
                        }
                    }
                } label: {
                    Image(systemName: justCopied ? "checkmark" : "doc.on.doc")
                }
                .buttonStyle(.plain)
                .appIconButtonChrome()
                .help(justCopied ? "Copied" : "Copy")
                .opacity(isHovering ? 1 : 0)
                .allowsHitTesting(isHovering)
            }
        }
        .padding(.vertical, 3)
        .padding(.horizontal, 6)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(isHovering ? AppTheme.hoverFill.opacity(0.85) : Color.clear)
        )
        .contentShape(Rectangle())
        .onHover { hovering in
            withAnimation(.snappy(duration: 0.16)) {
                isHovering = hovering
            }
        }
        .animation(.snappy(duration: 0.18), value: justCopied)
    }
}
