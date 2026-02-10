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
    }
}
