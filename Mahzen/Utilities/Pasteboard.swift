//
//  Pasteboard.swift
//  Mahzen
//
//  Created by Codex on 2026-02-08.
//

import AppKit

enum Pasteboard {
    static func copyString(_ value: String) {
        let pb = NSPasteboard.general
        pb.clearContents()
        pb.setString(value, forType: .string)
    }
}

