//
//  HeroEmptyStateView.swift
//  Mahzen
//
//  Created by Codex on 2026-02-08.
//

import SwiftUI

struct HeroEmptyStateView: View {
    let title: String
    let subtitle: String
    let systemImage: String
    var actionTitle: String?
    var action: (() -> Void)?

    @State private var appear: Bool = false

    var body: some View {
        VStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [
                                AppTheme.accent.opacity(0.35),
                                AppTheme.accent.opacity(0.10),
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 72, height: 72)
                    .overlay(Circle().strokeBorder(.white.opacity(0.18)))

                Image(systemName: systemImage)
                    .font(.system(size: 30, weight: .semibold, design: .rounded))
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(AppTheme.accent)
            }
            .scaleEffect(appear ? 1.0 : 0.92)
            .opacity(appear ? 1.0 : 0.0)

            VStack(spacing: 6) {
                Text(title)
                    .font(.system(size: 18, weight: .semibold, design: .rounded))

                Text(subtitle)
                    .font(.system(size: 13, weight: .regular, design: .rounded))
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 340)
            }
            .opacity(appear ? 1.0 : 0.0)

            if let actionTitle, let action {
                Button(actionTitle) {
                    action()
                }
                .buttonStyle(.borderedProminent)
                .tint(AppTheme.accent)
                .opacity(appear ? 1.0 : 0.0)
                .padding(.top, 2)
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onAppear {
            withAnimation(.snappy(duration: 0.35)) {
                appear = true
            }
        }
    }
}

