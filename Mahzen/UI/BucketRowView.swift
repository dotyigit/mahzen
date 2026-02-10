//
//  BucketRowView.swift
//  Mahzen
//
//  Created by Codex on 2026-02-08.
//

import SwiftUI

struct BucketRowView: View {
    let name: String
    var isPinned: Bool = false
    var isSelected: Bool = false

    @State private var isHovering: Bool = false

    var body: some View {
        HStack(spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(AppTheme.accent.opacity(0.14))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .strokeBorder(AppTheme.accent.opacity(0.18))
                    )
                    .frame(width: 28, height: 28)

                Image(systemName: "archivebox")
                    .font(.system(size: 14, weight: .semibold))
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(AppTheme.accent)
            }

            Text(name)
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .lineLimit(1)
                .truncationMode(.middle)
                .frame(maxWidth: .infinity, alignment: .leading)

            if isPinned {
                Image(systemName: "pin.fill")
                    .font(.system(size: 11, weight: .semibold))
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(.secondary)
                    .accessibilityLabel("Pinned")
            }
        }
        .padding(.vertical, 2)
        .padding(.horizontal, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(backgroundFill)
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .strokeBorder(backgroundStroke)
                )
        )
        .onHover { hovering in
            withAnimation(.snappy(duration: 0.18)) {
                isHovering = hovering
            }
        }
        .animation(.snappy(duration: 0.18), value: isSelected)
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
}
