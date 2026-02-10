//
//  TransferPanelView.swift
//  Mahzen
//

import SwiftUI

struct TransferPanelView: View {
    @ObservedObject var transferManager: TransferManager
    @State private var isExpanded: Bool = false

    private let byteFormatter: ByteCountFormatter = {
        let f = ByteCountFormatter()
        f.allowedUnits = [.useKB, .useMB, .useGB, .useTB]
        f.countStyle = .file
        return f
    }()

    var body: some View {
        VStack(spacing: 0) {
            summaryBar
            if isExpanded {
                Divider().opacity(AppTheme.dividerOpacity)
                expandedContent
            }
        }
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: AppTheme.controlCornerRadius, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AppTheme.controlCornerRadius, style: .continuous)
                .strokeBorder(AppTheme.stroke)
        )
        .animation(.snappy(duration: 0.25), value: isExpanded)
    }

    // MARK: - Summary Bar

    private var summaryBar: some View {
        HStack(spacing: 10) {
            // Tappable area for expand/collapse — everything except Clear Done.
            HStack(spacing: 10) {
                Image(systemName: isExpanded ? "chevron.down" : "chevron.up")
                    .font(.system(size: 10, weight: .bold, design: .rounded))
                    .foregroundStyle(.secondary)

                let completed = transferManager.completedCount
                let total = transferManager.transfers.count
                Text("\(completed) of \(total) transfer\(total == 1 ? "" : "s") complete")
                    .font(.system(size: 11, weight: .semibold, design: .rounded))
                    .foregroundStyle(.secondary)

                if transferManager.isTransferring {
                    ProgressView(value: transferManager.aggregateProgress)
                        .tint(AppTheme.accent)
                        .frame(maxWidth: 160)

                    Text("\(Int(transferManager.aggregateProgress * 100))%")
                        .font(.system(size: 11, weight: .semibold, design: .rounded))
                        .foregroundStyle(.secondary)
                        .monospacedDigit()
                }

                Spacer()
            }
            .contentShape(Rectangle())
            .onTapGesture {
                withAnimation(.snappy(duration: 0.25)) {
                    isExpanded.toggle()
                }
            }

            // Clear Done button — outside the tap gesture area so it always works.
            if isExpanded {
                Button("Clear Done") {
                    transferManager.clearCompleted()
                }
                .font(.system(size: 11, weight: .medium, design: .rounded))
                .buttonStyle(.bordered)
                .controlSize(.mini)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }

    // MARK: - Expanded Content

    private var expandedContent: some View {
        ScrollView {
            LazyVStack(spacing: 2) {
                ForEach(transferManager.transfers) { item in
                    transferRow(item)
                }
            }
            .padding(.vertical, 4)
        }
        .frame(maxHeight: 200)
    }

    private func transferRow(_ item: TransferItem) -> some View {
        HStack(spacing: 8) {
            directionIcon(item.direction)

            Text(item.displayName)
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .lineLimit(1)
                .truncationMode(.middle)
                .frame(maxWidth: .infinity, alignment: .leading)

            statusView(item)

            if !item.isTerminal {
                Button {
                    transferManager.cancelTransfer(id: item.id)
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 13))
                        .symbolRenderingMode(.hierarchical)
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .help("Cancel")
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 5)
    }

    private func directionIcon(_ direction: TransferDirection) -> some View {
        let symbol = direction == .download ? "arrow.down.circle" : "arrow.up.circle"
        let color: Color = direction == .download ? AppTheme.accent : .blue
        return Image(systemName: symbol)
            .font(.system(size: 14, weight: .semibold))
            .symbolRenderingMode(.hierarchical)
            .foregroundStyle(color)
    }

    @ViewBuilder
    private func statusView(_ item: TransferItem) -> some View {
        switch item.status {
        case .queued:
            Text("Queued")
                .font(.system(size: 11, weight: .medium, design: .rounded))
                .foregroundStyle(.secondary)

        case .active(let fraction):
            HStack(spacing: 6) {
                ProgressView(value: fraction)
                    .tint(AppTheme.accent)
                    .frame(width: 80)

                if let total = item.totalBytes, total > 0 {
                    let transferred = Int64(fraction * Double(total))
                    Text("\(byteFormatter.string(fromByteCount: transferred)) / \(byteFormatter.string(fromByteCount: total))")
                        .font(.system(size: 10, weight: .medium, design: .rounded))
                        .foregroundStyle(.secondary)
                        .monospacedDigit()
                }
            }

        case .completed:
            Text("Done")
                .font(.system(size: 11, weight: .medium, design: .rounded))
                .foregroundStyle(.secondary)

        case .failed(let message):
            Text("Failed: \(message)")
                .font(.system(size: 11, weight: .medium, design: .rounded))
                .foregroundStyle(.red)
                .lineLimit(1)
                .truncationMode(.tail)

        case .cancelled:
            Text("Cancelled")
                .font(.system(size: 11, weight: .medium, design: .rounded))
                .foregroundStyle(.secondary)
        }
    }
}
