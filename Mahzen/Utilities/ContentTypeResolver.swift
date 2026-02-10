//
//  ContentTypeResolver.swift
//  Mahzen
//

import Foundation
import UniformTypeIdentifiers

enum ContentTypeResolver {
    static func mimeType(for url: URL) -> String {
        UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
    }
}
