//
//  TargetRowView.swift
//  Mahzen
//
//  Created by Codex on 2026-02-08.
//

import SwiftUI

struct TargetRowView: View {
    let target: StorageTarget

    var body: some View {
        HStack(spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(providerTint.opacity(0.18))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .strokeBorder(providerTint.opacity(0.22))
                    )
                    .frame(width: 28, height: 28)

                Image(systemName: providerIcon)
                    .font(.system(size: 14, weight: .semibold))
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(providerTint)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(target.name)
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .lineLimit(1)

                HStack(spacing: 6) {
                    Text(target.endpoint.host ?? target.endpoint.absoluteString)
                        .font(.system(size: 11, weight: .regular, design: .rounded))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .truncationMode(.middle)

                    if target.forcePathStyle {
                        Text("Path")
                            .font(.system(size: 10, weight: .semibold, design: .rounded))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(.thinMaterial, in: Capsule())
                            .overlay(Capsule().strokeBorder(.white.opacity(0.12)))
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .padding(.vertical, 2)
    }

    private var providerIcon: String {
        switch target.provider {
        case .aws:
            return "cloud"
        case .cloudflareR2:
            return "cloud.sun"
        case .digitalOcean:
            return "drop"
        case .hetzner:
            return "server.rack"
        case .minio:
            return "cube.box"
        case .other:
            return "externaldrive"
        }
    }

    private var providerTint: Color {
        switch target.provider {
        case .aws:
            return .blue
        case .cloudflareR2:
            return AppTheme.accent
        case .digitalOcean:
            return .cyan
        case .hetzner:
            return .green
        case .minio:
            return .red
        case .other:
            return .secondary
        }
    }
}

