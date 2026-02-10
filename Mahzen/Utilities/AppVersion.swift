//
//  AppVersion.swift
//  Mahzen
//

import Foundation

enum AppVersion {
    static var short: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.0.0"
    }

    static var build: String {
        Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
    }

    static var display: String {
        "\(short) (\(build))"
    }
}
