//
//  S3XMLParsers.swift
//  Mahzen
//
//  Created by Codex on 2026-02-08.
//

import Foundation

final class S3ListBucketsParser: NSObject, XMLParserDelegate {
    private let iso8601 = ISO8601DateFormatter()

    private(set) var buckets: [S3Bucket] = []

    private var inBucket = false
    private var currentBucketName: String?
    private var currentCreationDate: Date?
    private var currentText: String = ""

    func parser(_ parser: XMLParser, didStartElement elementName: String, namespaceURI: String?, qualifiedName qName: String?, attributes attributeDict: [String: String] = [:]) {
        currentText = ""
        if elementName == "Bucket" {
            inBucket = true
            currentBucketName = nil
            currentCreationDate = nil
        }
    }

    func parser(_ parser: XMLParser, foundCharacters string: String) {
        currentText += string
    }

    func parser(_ parser: XMLParser, didEndElement elementName: String, namespaceURI: String?, qualifiedName qName: String?) {
        let text = currentText.trimmingCharacters(in: .whitespacesAndNewlines)
        defer { currentText = "" }

        guard inBucket else { return }

        switch elementName {
        case "Name":
            currentBucketName = text
        case "CreationDate":
            currentCreationDate = iso8601.date(from: text)
        case "Bucket":
            if let name = currentBucketName, !name.isEmpty {
                buckets.append(S3Bucket(name: name, creationDate: currentCreationDate))
            }
            inBucket = false
        default:
            break
        }
    }
}

final class S3ListObjectsV2Parser: NSObject, XMLParserDelegate {
    private let iso8601 = ISO8601DateFormatter()

    private(set) var objects: [S3Object] = []
    private(set) var commonPrefixes: [String] = []
    private(set) var isTruncated: Bool = false
    private(set) var nextContinuationToken: String?

    private var currentText: String = ""

    private var inContents = false
    private var inCommonPrefixes = false

    private var curKey: String?
    private var curLastModified: Date?
    private var curETag: String?
    private var curSize: Int64?
    private var curStorageClass: String?

    func parser(_ parser: XMLParser, didStartElement elementName: String, namespaceURI: String?, qualifiedName qName: String?, attributes attributeDict: [String: String] = [:]) {
        currentText = ""

        switch elementName {
        case "Contents":
            inContents = true
            curKey = nil
            curLastModified = nil
            curETag = nil
            curSize = nil
            curStorageClass = nil
        case "CommonPrefixes":
            inCommonPrefixes = true
        default:
            break
        }
    }

    func parser(_ parser: XMLParser, foundCharacters string: String) {
        currentText += string
    }

    func parser(_ parser: XMLParser, didEndElement elementName: String, namespaceURI: String?, qualifiedName qName: String?) {
        let text = currentText.trimmingCharacters(in: .whitespacesAndNewlines)
        defer { currentText = "" }

        if inContents {
            switch elementName {
            case "Key":
                curKey = text
            case "LastModified":
                curLastModified = iso8601.date(from: text)
            case "ETag":
                // S3 includes quotes in the ETag.
                curETag = text.trimmingCharacters(in: CharacterSet(charactersIn: "\""))
            case "Size":
                curSize = Int64(text)
            case "StorageClass":
                curStorageClass = text
            case "Contents":
                if let key = curKey, !key.isEmpty {
                    objects.append(
                        S3Object(
                            key: key,
                            lastModified: curLastModified,
                            eTag: curETag,
                            sizeBytes: curSize,
                            storageClass: curStorageClass
                        )
                    )
                }
                inContents = false
            default:
                break
            }
            return
        }

        if inCommonPrefixes {
            if elementName == "Prefix" {
                if !text.isEmpty {
                    commonPrefixes.append(text)
                }
            } else if elementName == "CommonPrefixes" {
                inCommonPrefixes = false
            }
            return
        }

        switch elementName {
        case "IsTruncated":
            isTruncated = (text as NSString).boolValue
        case "NextContinuationToken":
            nextContinuationToken = text.isEmpty ? nil : text
        default:
            break
        }
    }
}

