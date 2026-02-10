//
//  AddTargetView.swift
//  Mahzen
//
//  Created by Codex on 2026-02-08.
//

import SwiftUI

struct AddTargetView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var model: AppModel
    var showsCancelButton: Bool = true

    @State private var provider: StorageTarget.Provider = .other

    @State private var name: String = ""
    @State private var endpoint: String = ""
    @State private var bucket: String = ""
    @State private var region: String = ""
    @State private var forcePathStyle: Bool = true

    @State private var accessKeyId: String = ""
    @State private var secretAccessKey: String = ""
    @State private var sessionToken: String = ""
    @State private var revealsSecret: Bool = false

    @State private var isAdvancedExpanded: Bool = false
    @State private var isSaving: Bool = false
    @State private var didAttemptSave: Bool = false
    @State private var errorText: String?
    @State private var appear: Bool = false

    var body: some View {
        ZStack {
            AppTheme.contentBackground()
                .ignoresSafeArea()

            VStack(spacing: 0) {
                header
                    .padding(.horizontal, 18)
                    .padding(.top, 16)
                    .padding(.bottom, 14)

                Divider().opacity(0.5)

                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        connectionCard
                        credentialsCard
                        advancedCard
                    }
                    .padding(18)
                    .padding(.top, 6)
                }
                .scrollIndicators(.hidden)

                Divider().opacity(0.5)

                actionBar
                    .padding(.horizontal, 18)
                    .padding(.vertical, 14)
            }
            .frame(minWidth: 600, idealWidth: 690, maxWidth: 760, minHeight: 520, idealHeight: 560, maxHeight: 640)
        }
        .onAppear {
            applyProviderPresetIfNeeded()
            withAnimation(.snappy(duration: 0.35)) { appear = true }
        }
        .animation(.snappy(duration: 0.22), value: provider)
        .animation(.snappy(duration: 0.22), value: isAdvancedExpanded)
        .animation(.snappy(duration: 0.22), value: errorText)
        .animation(.snappy(duration: 0.22), value: isSaving)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .center, spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(AppTheme.accent.opacity(0.16))
                        .overlay(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .strokeBorder(.white.opacity(0.12))
                        )
                        .frame(width: 44, height: 44)

                    Image(systemName: "externaldrive.badge.plus")
                        .font(.system(size: 18, weight: .semibold))
                        .symbolRenderingMode(.hierarchical)
                        .foregroundStyle(AppTheme.accent)
                }
                .scaleEffect(appear ? 1.0 : 0.92)
                .opacity(appear ? 1.0 : 0.0)

                VStack(alignment: .leading, spacing: 3) {
                    Text("Add Storage Target")
                        .font(.system(size: 16, weight: .semibold))

                    Text("Connect AWS S3 or any S3-compatible provider with endpoint + keys.")
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                }
                .opacity(appear ? 1.0 : 0.0)

                Spacer(minLength: 0)
            }

            providerStrip

            if let errorText, !errorText.isEmpty {
                ErrorBanner(text: errorText)
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
    }

    private var providerStrip: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach(StorageTarget.Provider.allCases) { p in
                    ProviderPill(
                        title: shortName(for: p),
                        symbol: symbol(for: p),
                        isSelected: p == provider
                    ) {
                        withAnimation(.snappy(duration: 0.22)) {
                            provider = p
                            applyProviderPresetIfNeeded()
                            errorText = nil
                        }
                    }
                }
            }
            .padding(.vertical, 2)
        }
        .scrollIndicators(.hidden)
        .contentMargins(.horizontal, 2)
    }

    private var connectionCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            SheetCardHeader(symbol: "link", title: "Connection")

            SheetField(title: "Endpoint", isRequired: true, footnote: endpointFootnote) {
                VStack(alignment: .leading, spacing: 4) {
                    TextField("", text: $endpoint, prompt: Text(endpointPrompt))
                        .textFieldStyle(.roundedBorder)
                        .autocorrectionDisabled()
                        .textContentType(.URL)

                    if didAttemptSave, let msg = endpointValidationError {
                        Text(msg)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.red)
                            .transition(.opacity)
                    }
                }
            }

            SheetField(title: "Bucket", footnote: "Optional. If you don’t have ListBuckets permission, enter a bucket here for direct access.") {
                TextField("", text: $bucket, prompt: Text("Optional"))
                    .textFieldStyle(.roundedBorder)
                    .autocorrectionDisabled()
            }

            Toggle(isOn: $forcePathStyle) {
                Text("Force path-style access")
                    .font(.system(size: 12, weight: .semibold))
            }
            .toggleStyle(.switch)
            .padding(.top, 2)
        }
        .cardBackground(padding: 14)
    }

    private var credentialsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            SheetCardHeader(symbol: "key.fill", title: "Credentials")

            SheetField(title: "Access Key", isRequired: true) {
                TextField("", text: $accessKeyId, prompt: Text("AKIA…"))
                    .textFieldStyle(.roundedBorder)
                    .autocorrectionDisabled()
                    .textContentType(.username)
            }

            SheetField(title: "Secret Key", isRequired: true) {
                HStack(spacing: 8) {
                    Group {
                        if revealsSecret {
                            TextField("", text: $secretAccessKey, prompt: Text("••••••••"))
                        } else {
                            SecureField("", text: $secretAccessKey, prompt: Text("••••••••"))
                        }
                    }
                    .textFieldStyle(.roundedBorder)
                    .autocorrectionDisabled()
                    .textContentType(.password)

                    Button {
                        withAnimation(.snappy(duration: 0.18)) { revealsSecret.toggle() }
                    } label: {
                        Image(systemName: revealsSecret ? "eye.slash" : "eye")
                    }
                    .buttonStyle(.borderless)
                    .help(revealsSecret ? "Hide Secret" : "Show Secret")
                }
            }

            SheetField(title: "Session Token", footnote: "Optional. Only needed for temporary credentials.") {
                TextField("", text: $sessionToken, prompt: Text("Optional"))
                    .textFieldStyle(.roundedBorder)
                    .autocorrectionDisabled()
            }
        }
        .cardBackground(padding: 14)
    }

    private var advancedCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            DisclosureGroup(isExpanded: $isAdvancedExpanded) {
                VStack(alignment: .leading, spacing: 12) {
                    SheetField(title: "Display Name", footnote: "Optional. Defaults to the endpoint host.") {
                        TextField("", text: $name, prompt: Text("Optional"))
                            .textFieldStyle(.roundedBorder)
                            .autocorrectionDisabled()
                    }

                    SheetField(title: "Region", footnote: "Optional. Mostly required for AWS; other providers can usually ignore this.") {
                        TextField("", text: $region, prompt: Text("Auto"))
                            .textFieldStyle(.roundedBorder)
                            .autocorrectionDisabled()
                    }
                }
                .padding(.top, 10)
            } label: {
                HStack(spacing: 10) {
                    Image(systemName: "slider.horizontal.3")
                        .symbolRenderingMode(.hierarchical)
                        .foregroundStyle(.secondary)
                    Text("Advanced")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.secondary)
                    Spacer()
                }
                .contentShape(Rectangle())
            }
        }
        .cardBackground(padding: 14)
    }

    private var actionBar: some View {
        HStack(spacing: 10) {
            if isSaving {
                HStack(spacing: 8) {
                    ProgressView()
                        .controlSize(.small)
                    Text("Saving…")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.secondary)
                }
                .transition(.opacity)
            } else {
                Text("Region is optional. Bucket is optional for direct access.")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }

            Spacer(minLength: 0)

            if showsCancelButton {
                Button("Cancel", role: .cancel) {
                    dismiss()
                }
                .keyboardShortcut(.cancelAction)
            }

            Button {
                Task { await save() }
            } label: {
                HStack(spacing: 8) {
                    if isSaving {
                        ProgressView()
                            .controlSize(.small)
                    } else {
                        Image(systemName: "checkmark")
                            .font(.system(size: 12, weight: .bold))
                    }
                    Text("Save")
                        .font(.system(size: 13, weight: .semibold))
                }
                .frame(minWidth: 96)
            }
            .buttonStyle(.borderedProminent)
            .tint(AppTheme.accent)
            .keyboardShortcut(.defaultAction)
            .disabled(!canSave || isSaving)
        }
    }

    private var canSave: Bool {
        !endpoint.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !accessKeyId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !secretAccessKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var endpointPrompt: String {
        switch provider {
        case .aws:
            return "https://s3.us-east-1.amazonaws.com"
        case .cloudflareR2:
            return "https://<accountid>.r2.cloudflarestorage.com"
        case .digitalOcean:
            return "https://nyc3.digitaloceanspaces.com"
        case .hetzner:
            return "https://fsn1.your-objectstorage.com"
        case .minio:
            return "http://localhost:9000"
        case .other:
            return "https://s3.example.com"
        }
    }

    private var endpointFootnote: String {
        switch provider {
        case .cloudflareR2:
            return "For R2, use your account endpoint. Path-style is recommended."
        case .aws:
            return "For AWS, you can paste an endpoint or just the hostname."
        default:
            return "Paste a full URL or just the hostname (https will be assumed)."
        }
    }

    private var endpointValidationError: String? {
        let raw = endpoint.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !raw.isEmpty else { return "Endpoint is required." }

        switch normalizeEndpointURL(raw) {
        case .success:
            return nil
        case .failure(let err):
            return err.message
        }
    }

    private func save() async {
        guard !isSaving else { return }
        didAttemptSave = true
        errorText = nil

        let rawEndpoint = endpoint.trimmingCharacters(in: .whitespacesAndNewlines)
        let endpointURL: URL
        switch normalizeEndpointURL(rawEndpoint) {
        case .success(let url):
            endpointURL = url
        case .failure(let err):
            withAnimation(.snappy(duration: 0.2)) {
                errorText = err.message
            }
            return
        }

        isSaving = true
        defer { isSaving = false }

        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let resolvedName = trimmedName.isEmpty ? (endpointURL.host ?? provider.rawValue) : trimmedName
        let trimmedRegion = region.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedBucket = bucket.trimmingCharacters(in: .whitespacesAndNewlines)

        let target = StorageTarget(
            name: resolvedName,
            provider: provider,
            endpoint: endpointURL,
            region: trimmedRegion.isEmpty ? nil : trimmedRegion,
            forcePathStyle: forcePathStyle,
            pinnedBuckets: trimmedBucket.isEmpty ? [] : [trimmedBucket]
        )

        let creds = S3Credentials(
            accessKeyId: accessKeyId.trimmingCharacters(in: .whitespacesAndNewlines),
            secretAccessKey: secretAccessKey.trimmingCharacters(in: .whitespacesAndNewlines),
            sessionToken: sessionToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                ? nil
                : sessionToken.trimmingCharacters(in: .whitespacesAndNewlines)
        )

        do {
            try model.addTarget(target, credentials: creds)
            dismiss()
        } catch {
            withAnimation(.snappy(duration: 0.2)) {
                errorText = error.localizedDescription
            }
        }
    }

    private func normalizeEndpointURL(_ raw: String) -> Result<URL, EndpointInputError> {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return .failure(EndpointInputError(message: "Endpoint is required.")) }

        let candidate: String
        if trimmed.contains("://") {
            candidate = trimmed
        } else {
            let lower = trimmed.lowercased()
            let defaultScheme: String = {
                if provider == .minio { return "http" }
                if lower.hasPrefix("localhost") || lower.hasPrefix("127.0.0.1") || lower.hasPrefix("0.0.0.0") { return "http" }
                return "https"
            }()
            candidate = "\(defaultScheme)://\(trimmed)"
        }

        guard var comps = URLComponents(string: candidate) else {
            return .failure(EndpointInputError(message: "Endpoint must be a valid URL or hostname."))
        }
        guard let scheme = comps.scheme?.lowercased(), scheme == "https" || scheme == "http" else {
            return .failure(EndpointInputError(message: "Endpoint must use http or https."))
        }
        guard comps.host != nil else {
            return .failure(EndpointInputError(message: "Endpoint must include a hostname."))
        }

        comps.query = nil
        comps.fragment = nil
        // Normalize "/" to empty for consistent URL building.
        if comps.path == "/" { comps.path = "" }

        guard let url = comps.url else {
            return .failure(EndpointInputError(message: "Endpoint must be a valid URL."))
        }
        return .success(url)
    }

    private func applyProviderPresetIfNeeded() {
        let trimmed = endpoint.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.isEmpty else { return }

        switch provider {
        case .aws:
            endpoint = "https://s3.us-east-1.amazonaws.com"
            forcePathStyle = false
        case .cloudflareR2:
            // Avoid bucket subdomain wildcard TLS mismatch; recommend path-style.
            endpoint = "https://accountid.r2.cloudflarestorage.com"
            forcePathStyle = true
        case .digitalOcean:
            endpoint = "https://nyc3.digitaloceanspaces.com"
            forcePathStyle = true
        case .hetzner:
            endpoint = "https://fsn1.your-objectstorage.com"
            forcePathStyle = true
        case .minio:
            endpoint = "http://localhost:9000"
            forcePathStyle = true
        case .other:
            forcePathStyle = true
        }
    }

    private func shortName(for provider: StorageTarget.Provider) -> String {
        switch provider {
        case .aws: return "AWS"
        case .cloudflareR2: return "R2"
        case .digitalOcean: return "Spaces"
        case .hetzner: return "Hetzner"
        case .minio: return "MinIO"
        case .other: return "Other"
        }
    }

    private func symbol(for provider: StorageTarget.Provider) -> String {
        switch provider {
        case .aws: return "cloud.fill"
        case .cloudflareR2: return "shield.lefthalf.filled"
        case .digitalOcean: return "drop.fill"
        case .hetzner: return "server.rack"
        case .minio: return "cube.box.fill"
        case .other: return "externaldrive.fill"
        }
    }
}

private struct EndpointInputError: Error {
    let message: String
}

private struct ProviderPill: View {
    let title: String
    let symbol: String
    let isSelected: Bool
    let onSelect: () -> Void

    @State private var hovering: Bool = false

    var body: some View {
        Button {
            onSelect()
        } label: {
            HStack(spacing: 8) {
                Image(systemName: symbol)
                    .font(.system(size: 12, weight: .semibold))
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(isSelected ? AppTheme.accent : .secondary)

                Text(title)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(isSelected ? .primary : .secondary)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(background)
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(borderColor)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { isHovering in
            withAnimation(.snappy(duration: 0.18)) { hovering = isHovering }
        }
    }

    private var background: some View {
        RoundedRectangle(cornerRadius: 12, style: .continuous)
            .fill(
                isSelected
                    ? AppTheme.accent.opacity(0.18)
                    : Color.primary.opacity(hovering ? 0.05 : 0.03)
            )
    }

    private var borderColor: Color {
        if isSelected { return AppTheme.accent.opacity(0.28) }
        return .white.opacity(0.10)
    }
}

private struct SheetCardHeader: View {
    let symbol: String
    let title: String

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: symbol)
                .font(.system(size: 13, weight: .semibold))
                .symbolRenderingMode(.hierarchical)
                .foregroundStyle(.secondary)

            Text(title)
                .font(.system(size: 13, weight: .semibold))

            Spacer(minLength: 0)
        }
    }
}

private struct SheetField<Content: View>: View {
    let title: String
    var isRequired: Bool = false
    var footnote: String? = nil
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Text(title)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.secondary)
                if isRequired {
                    Text("Required")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(.thinMaterial, in: Capsule())
                        .overlay(Capsule().strokeBorder(.white.opacity(0.10)))
                        .offset(y: -0.5)
                }
                Spacer(minLength: 0)
            }

            content

            if let footnote, !footnote.isEmpty {
                Text(footnote)
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
        }
    }
}

private struct ErrorBanner: View {
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.red)

            Text(text)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.primary)
                .fixedSize(horizontal: false, vertical: true)

            Spacer(minLength: 0)

            Button {
                Pasteboard.copyString(text)
            } label: {
                Image(systemName: "doc.on.doc")
            }
            .buttonStyle(.borderless)
            .help("Copy error")
        }
        .padding(10)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(.red.opacity(0.25))
        )
    }
}
