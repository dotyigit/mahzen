//
//  BreadcrumbBar.swift
//  Mahzen
//
//  Created by Codex on 2026-02-08.
//

import SwiftUI

struct BreadcrumbBar: View {
    let prefix: String
    var onSelectPrefix: (String) -> Void

    var body: some View {
        HStack(spacing: 6) {
            CrumbButton(
                title: "Root",
                systemImage: "house",
                isCurrent: prefix.isEmpty,
                action: { selectPrefix("") }
            )

            ForEach(crumbs, id: \.value) { c in
                Image(systemName: "chevron.right")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.secondary)

                CrumbButton(
                    title: c.title,
                    systemImage: "folder",
                    isCurrent: c.value == prefix,
                    action: { selectPrefix(c.value) }
                )
            }
        }
        .lineLimit(1)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: AppTheme.controlCornerRadius, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AppTheme.controlCornerRadius, style: .continuous)
                .strokeBorder(AppTheme.stroke)
        )
        .contentTransition(.opacity)
    }

    private func selectPrefix(_ value: String) {
        withAnimation(.snappy(duration: 0.25)) {
            onSelectPrefix(value)
        }
    }

    private var crumbs: [(title: String, value: String)] {
        // prefix is stored as "a/b/c/".
        var trimmed = prefix
        if trimmed.hasSuffix("/") { trimmed.removeLast() }
        if trimmed.isEmpty { return [] }

        let parts = trimmed.split(separator: "/").map(String.init)
        var out: [(String, String)] = []
        var running = ""
        for part in parts {
            running += part + "/"
            out.append((part, running))
        }
        return out
    }
}

private struct CrumbButton: View {
    let title: String
    let systemImage: String
    let isCurrent: Bool
    let action: () -> Void

    @State private var isHovering: Bool = false

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .labelStyle(.titleAndIcon)
                .font(.system(size: 12, weight: .semibold, design: .rounded))
                .foregroundStyle(isCurrent ? .primary : .secondary)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(backgroundFill)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .strokeBorder(backgroundStroke)
                )
        }
        .buttonStyle(.plain)
        .contentShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .onHover { hovering in
            withAnimation(.snappy(duration: 0.16)) {
                isHovering = hovering
            }
        }
    }

    private var backgroundFill: Color {
        if isCurrent { return AppTheme.accent.opacity(0.16) }
        if isHovering { return AppTheme.hoverFill }
        return .clear
    }

    private var backgroundStroke: Color {
        if isCurrent { return AppTheme.accent.opacity(0.26) }
        return .clear
    }
}
