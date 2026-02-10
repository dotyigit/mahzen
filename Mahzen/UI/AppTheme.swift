//
//  AppTheme.swift
//  Mahzen
//
//  Created by Codex on 2026-02-08.
//

import SwiftUI

enum AppTheme {
    // Warm accent that still feels native on macOS.
    static let accent = Color(red: 0.96, green: 0.56, blue: 0.18)

    // Layout
    static let pagePadding: CGFloat = 12
    static let fieldHeight: CGFloat = 34
    static let controlCornerRadius: CGFloat = 12
    static let cornerRadius: CGFloat = 14
    static let stroke = Color.white.opacity(0.12)
    static let strokeStrong = Color.white.opacity(0.18)
    static let hoverFill = Color.primary.opacity(0.06)
    static let cardPadding: CGFloat = 12
    static let dividerOpacity: Double = 0.5

    static func sidebarBackground() -> some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(nsColor: .windowBackgroundColor),
                    Color(nsColor: .windowBackgroundColor).opacity(0.65),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            // Subtle tint wash so the app doesn't look like a template.
            RadialGradient(
                colors: [
                    accent.opacity(0.16),
                    .clear,
                ],
                center: .topLeading,
                startRadius: 20,
                endRadius: 420
            )
        }
    }

    static func contentBackground() -> some View {
        ZStack {
            Color(nsColor: .windowBackgroundColor)
            LinearGradient(
                colors: [
                    .clear,
                    accent.opacity(0.07),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
        }
    }
}

struct CardBackground: ViewModifier {
    var padding: CGFloat = 12

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: AppTheme.cornerRadius, style: .continuous)
        content
            .padding(padding)
            .background(.regularMaterial, in: shape)
            .overlay(
                shape.strokeBorder(AppTheme.stroke)
            )
            // Prevent inner materials/backgrounds from "squaring off" corners.
            .clipShape(shape)
    }
}

extension View {
    func cardBackground(padding: CGFloat = 12) -> some View {
        modifier(CardBackground(padding: padding))
    }

    func appIconButtonChrome() -> some View {
        modifier(AppIconButtonChrome())
    }

    func appGlassFieldChrome(isFocused: Bool) -> some View {
        modifier(AppGlassFieldChrome(isFocused: isFocused))
    }
}

private struct AppIconButtonChrome: ViewModifier {
    @State private var isHovering: Bool = false

    func body(content: Content) -> some View {
        content
            .padding(6)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(isHovering ? AppTheme.hoverFill : Color.clear)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .strokeBorder(isHovering ? AppTheme.stroke : Color.clear)
            )
            .contentShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .onHover { hovering in
                withAnimation(.snappy(duration: 0.16)) {
                    isHovering = hovering
                }
            }
    }
}

private struct AppGlassFieldChrome: ViewModifier {
    var isFocused: Bool
    @State private var isHovering: Bool = false

    func body(content: Content) -> some View {
        content
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: AppTheme.controlCornerRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AppTheme.controlCornerRadius, style: .continuous)
                    .strokeBorder(borderColor)
            )
            .contentShape(RoundedRectangle(cornerRadius: AppTheme.controlCornerRadius, style: .continuous))
            .onHover { hovering in
                withAnimation(.snappy(duration: 0.16)) {
                    isHovering = hovering
                }
            }
            .animation(.snappy(duration: 0.18), value: isFocused)
    }

    private var borderColor: Color {
        if isFocused { return AppTheme.accent.opacity(0.55) }
        if isHovering { return AppTheme.strokeStrong }
        return AppTheme.stroke
    }
}
