//
//  AWSSigV4Signer.swift
//  Mahzen
//
//  Created by Codex on 2026-02-08.
//

import Foundation
import CryptoKit

enum AWSSigV4SignerError: Error {
    case missingURL
    case missingHTTPMethod
}

enum AWSSigV4Signer {
    static func sign(
        request: inout URLRequest,
        credentials: S3Credentials,
        region: String,
        service: String,
        date: Date = Date()
    ) throws {
        guard let url = request.url else { throw AWSSigV4SignerError.missingURL }
        guard let method = request.httpMethod else { throw AWSSigV4SignerError.missingHTTPMethod }

        let amzDate = amzDateTime(date)
        let dateStamp = amzDateStamp(date)

        var headers = request.allHTTPHeaderFields ?? [:]

        // Required signing headers.
        headers["Host"] = hostHeaderValue(for: url)
        headers["x-amz-date"] = amzDate

        let payloadHash = headers["x-amz-content-sha256"] ?? sha256Hex(request.httpBody ?? Data())
        headers["x-amz-content-sha256"] = payloadHash

        if let token = credentials.sessionToken, !token.isEmpty {
            headers["x-amz-security-token"] = token
        }

        // Canonicalize.
        let canonicalURI = AWSPercentEncoding.encodePath(url.path.isEmpty ? "/" : url.path)
        let canonicalQueryString = canonicalQuery(from: url)

        let canonicalHeaderPairs: [(String, String)] = headers
            .map { ($0.key.lowercased(), normalizeHeaderValue($0.value)) }
            .sorted { $0.0 < $1.0 }

        let signedHeaders = canonicalHeaderPairs.map(\.0).joined(separator: ";")
        let canonicalHeaders = canonicalHeaderPairs.map { "\($0.0):\($0.1)\n" }.joined()

        let canonicalRequest = [
            method,
            canonicalURI,
            canonicalQueryString,
            canonicalHeaders,
            signedHeaders,
            payloadHash
        ].joined(separator: "\n")

        let credentialScope = "\(dateStamp)/\(region)/\(service)/aws4_request"
        let stringToSign = [
            "AWS4-HMAC-SHA256",
            amzDate,
            credentialScope,
            sha256Hex(Data(canonicalRequest.utf8))
        ].joined(separator: "\n")

        let signingKey = derivedSigningKey(
            secretAccessKey: credentials.secretAccessKey,
            dateStamp: dateStamp,
            region: region,
            service: service
        )

        let signature = hmacSHA256Hex(key: signingKey, message: stringToSign)

        let authorization = "AWS4-HMAC-SHA256 Credential=\(credentials.accessKeyId)/\(credentialScope), SignedHeaders=\(signedHeaders), Signature=\(signature)"

        // Write headers back to the request.
        for (k, v) in headers {
            request.setValue(v, forHTTPHeaderField: k)
        }
        request.setValue(authorization, forHTTPHeaderField: "Authorization")
    }

    private static func canonicalQuery(from url: URL) -> String {
        guard var comps = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return "" }
        let items = comps.queryItems ?? []
        if items.isEmpty { return "" }

        let encoded: [(String, String)] = items.map { item in
            (AWSPercentEncoding.encode(item.name), AWSPercentEncoding.encode(item.value ?? ""))
        }
        .sorted {
            if $0.0 == $1.0 { return $0.1 < $1.1 }
            return $0.0 < $1.0
        }

        // Ensure URLComponents doesn't try to "help" by changing encoding.
        comps.queryItems = nil
        return encoded.map { "\($0.0)=\($0.1)" }.joined(separator: "&")
    }

    private static func derivedSigningKey(
        secretAccessKey: String,
        dateStamp: String,
        region: String,
        service: String
    ) -> SymmetricKey {
        let kSecret = SymmetricKey(data: Data(("AWS4" + secretAccessKey).utf8))
        let kDate = hmacSHA256(key: kSecret, message: dateStamp)
        let kRegion = hmacSHA256(key: kDate, message: region)
        let kService = hmacSHA256(key: kRegion, message: service)
        let kSigning = hmacSHA256(key: kService, message: "aws4_request")
        return kSigning
    }

    private static func normalizeHeaderValue(_ value: String) -> String {
        // Trim and compress whitespace, per SigV4 canonicalization.
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        var out = ""
        out.reserveCapacity(trimmed.count)

        var lastWasSpace = false
        for ch in trimmed {
            if ch == " " || ch == "\t" || ch == "\n" || ch == "\r" {
                if !lastWasSpace {
                    out.append(" ")
                    lastWasSpace = true
                }
            } else {
                out.append(ch)
                lastWasSpace = false
            }
        }
        return out
    }

    private static func hostHeaderValue(for url: URL) -> String {
        guard let host = url.host else { return "" }
        if let port = url.port {
            let isDefault = (url.scheme == "https" && port == 443) || (url.scheme == "http" && port == 80)
            if !isDefault { return "\(host):\(port)" }
        }
        return host
    }

    private static func sha256Hex(_ data: Data) -> String {
        let digest = SHA256.hash(data: data)
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    private static func hmacSHA256(key: SymmetricKey, message: String) -> SymmetricKey {
        let mac = HMAC<SHA256>.authenticationCode(for: Data(message.utf8), using: key)
        return SymmetricKey(data: Data(mac))
    }

    private static func hmacSHA256Hex(key: SymmetricKey, message: String) -> String {
        let mac = HMAC<SHA256>.authenticationCode(for: Data(message.utf8), using: key)
        return mac.map { String(format: "%02x", $0) }.joined()
    }

    private static func amzDateTime(_ date: Date) -> String {
        let fmt = DateFormatter()
        fmt.calendar = Calendar(identifier: .gregorian)
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = TimeZone(secondsFromGMT: 0)
        fmt.dateFormat = "yyyyMMdd'T'HHmmss'Z'"
        return fmt.string(from: date)
    }

    private static func amzDateStamp(_ date: Date) -> String {
        let fmt = DateFormatter()
        fmt.calendar = Calendar(identifier: .gregorian)
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = TimeZone(secondsFromGMT: 0)
        fmt.dateFormat = "yyyyMMdd"
        return fmt.string(from: date)
    }
}

