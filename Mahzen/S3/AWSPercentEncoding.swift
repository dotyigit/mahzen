//
//  AWSPercentEncoding.swift
//  Mahzen
//
//  Created by Codex on 2026-02-08.
//

import Foundation

enum AWSPercentEncoding {
    // RFC 3986 unreserved characters.
    private static let unreserved = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.~")

    static func encode(_ string: String) -> String {
        // Encode everything except unreserved.
        var out = ""
        out.reserveCapacity(string.utf8.count)

        for scalar in string.unicodeScalars {
            if unreserved.contains(scalar) {
                out.unicodeScalars.append(scalar)
            } else {
                for byte in String(scalar).utf8 {
                    out += String(format: "%%%02X", byte)
                }
            }
        }
        return out
    }

    static func encodePath(_ path: String) -> String {
        // Preserve "/" separators but encode each segment.
        // Ensure leading "/" stays as-is.
        if path.isEmpty { return "/" }

        let leadingSlash = path.hasPrefix("/")
        let trailingSlash = path.hasSuffix("/")

        let trimmed = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let segments = trimmed.split(separator: "/", omittingEmptySubsequences: false).map(String.init)
        let encodedSegments = segments.map { encode($0) }

        var result = (leadingSlash ? "/" : "") + encodedSegments.joined(separator: "/")
        if trailingSlash && !result.hasSuffix("/") { result += "/" }
        if result.isEmpty { result = "/" }
        return result
    }
}

