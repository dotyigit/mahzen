use anyhow::{anyhow, Result};
use aws_config::BehaviorVersion;
use aws_credential_types::Credentials;
use aws_sdk_s3::config::Region;
use aws_sdk_s3::presigning::PresigningConfig;
use aws_sdk_s3::primitives::ByteStream;
use aws_sdk_s3::types::{Delete, ObjectIdentifier};
use aws_sdk_s3::Client;
use std::path::Path;
use std::time::Duration;

use crate::models::{BucketStats, S3BucketSummary, S3ObjectEntry, S3ObjectListPage, StorageTarget, TargetCredentials};

fn default_region(provider: &str) -> String {
    if provider.eq_ignore_ascii_case("Cloudflare R2") {
        "auto".to_string()
    } else {
        "us-east-1".to_string()
    }
}

pub async fn build_client(target: &StorageTarget, credentials: &TargetCredentials) -> Result<Client> {
    if credentials.access_key_id.trim().is_empty() || credentials.secret_access_key.trim().is_empty() {
        return Err(anyhow!("Missing access key credentials for target."));
    }

    let region = target
        .region
        .as_ref()
        .map(|r| r.trim().to_string())
        .filter(|r| !r.is_empty())
        .unwrap_or_else(|| default_region(&target.provider));

    let shared = aws_config::defaults(BehaviorVersion::latest())
        .region(Region::new(region))
        .credentials_provider(Credentials::new(
            credentials.access_key_id.clone(),
            credentials.secret_access_key.clone(),
            credentials.session_token.clone(),
            None,
            "mahzen",
        ))
        .load()
        .await;

    let mut builder = aws_sdk_s3::config::Builder::from(&shared)
        .force_path_style(target.force_path_style);

    if !target.endpoint.trim().is_empty() {
        builder = builder.endpoint_url(target.endpoint.trim().to_string());
    }

    Ok(Client::from_conf(builder.build()))
}

pub async fn list_buckets(target: &StorageTarget, credentials: &TargetCredentials) -> Result<Vec<S3BucketSummary>> {
    let client = build_client(target, credentials).await?;
    let output = client
        .list_buckets()
        .send()
        .await
        .map_err(|e| anyhow!("S3 list buckets failed: {e}"))?;

    let mut buckets = Vec::new();
    if let Some(items) = output.buckets {
        for bucket in items {
            let name = bucket.name.unwrap_or_default();
            if name.is_empty() {
                continue;
            }
            let created_at = bucket.creation_date.map(|dt| dt.secs());
            buckets.push(S3BucketSummary { name, created_at });
        }
    }

    buckets.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(buckets)
}

pub async fn list_objects(
    target: &StorageTarget,
    credentials: &TargetCredentials,
    bucket: &str,
    prefix: &str,
) -> Result<Vec<S3ObjectEntry>> {
    let client = build_client(target, credentials).await?;
    let mut entries = Vec::new();
    let mut continuation_token: Option<String> = None;

    loop {
        let mut req = client
            .list_objects_v2()
            .bucket(bucket)
            .prefix(prefix)
            .delimiter("/");

        if let Some(token) = &continuation_token {
            req = req.continuation_token(token);
        }

        let output = req
            .send()
            .await
            .map_err(|e| anyhow!("S3 list objects failed: {e}"))?;

        // Common prefixes → folders
        if let Some(prefixes) = output.common_prefixes {
            for cp in prefixes {
                if let Some(p) = cp.prefix {
                    if p == prefix {
                        continue;
                    }
                    let name = p
                        .strip_prefix(prefix)
                        .unwrap_or(&p)
                        .trim_end_matches('/')
                        .to_string();
                    if name.is_empty() {
                        continue;
                    }
                    entries.push(S3ObjectEntry {
                        key: p.clone(),
                        name,
                        size: 0,
                        last_modified: None,
                        etag: None,
                        storage_class: None,
                        is_folder: true,
                        content_type: None,
                    });
                }
            }
        }

        // Contents → files
        if let Some(contents) = output.contents {
            for obj in contents {
                let key = obj.key.unwrap_or_default();
                if key == prefix || key.is_empty() {
                    continue;
                }
                let name = key
                    .strip_prefix(prefix)
                    .unwrap_or(&key)
                    .to_string();
                if name.is_empty() || name.ends_with('/') {
                    continue;
                }
                let last_modified = obj.last_modified.map(|dt| dt.to_string());
                let etag = obj.e_tag;
                let storage_class = obj.storage_class.map(|sc| sc.to_string());

                entries.push(S3ObjectEntry {
                    key: key.clone(),
                    name,
                    size: obj.size.unwrap_or(0),
                    last_modified,
                    etag,
                    storage_class,
                    is_folder: false,
                    content_type: None,
                });
            }
        }

        if output.is_truncated == Some(true) {
            continuation_token = output.next_continuation_token;
            if continuation_token.is_none() {
                break;
            }
        } else {
            break;
        }
    }

    entries.sort_by(|a, b| {
        if a.is_folder != b.is_folder {
            return if a.is_folder {
                std::cmp::Ordering::Less
            } else {
                std::cmp::Ordering::Greater
            };
        }
        a.name.to_lowercase().cmp(&b.name.to_lowercase())
    });

    Ok(entries)
}

pub async fn list_objects_page(
    target: &StorageTarget,
    credentials: &TargetCredentials,
    bucket: &str,
    prefix: &str,
    max_keys: i32,
    continuation_token: Option<String>,
) -> Result<S3ObjectListPage> {
    let client = build_client(target, credentials).await?;
    let mut entries = Vec::new();

    let mut req = client
        .list_objects_v2()
        .bucket(bucket)
        .prefix(prefix)
        .delimiter("/")
        .max_keys(max_keys);

    if let Some(token) = &continuation_token {
        req = req.continuation_token(token);
    }

    let output = req
        .send()
        .await
        .map_err(|e| anyhow!("S3 list objects failed: {e}"))?;

    // Common prefixes → folders (only on first page)
    if continuation_token.is_none() {
        if let Some(prefixes) = output.common_prefixes {
            for cp in prefixes {
                if let Some(p) = cp.prefix {
                    if p == prefix {
                        continue;
                    }
                    let name = p
                        .strip_prefix(prefix)
                        .unwrap_or(&p)
                        .trim_end_matches('/')
                        .to_string();
                    if name.is_empty() {
                        continue;
                    }
                    entries.push(S3ObjectEntry {
                        key: p.clone(),
                        name,
                        size: 0,
                        last_modified: None,
                        etag: None,
                        storage_class: None,
                        is_folder: true,
                        content_type: None,
                    });
                }
            }
        }
    }

    // Contents → files
    if let Some(contents) = output.contents {
        for obj in contents {
            let key = obj.key.unwrap_or_default();
            if key == prefix || key.is_empty() {
                continue;
            }
            let name = key
                .strip_prefix(prefix)
                .unwrap_or(&key)
                .to_string();
            if name.is_empty() || name.ends_with('/') {
                continue;
            }
            let last_modified = obj.last_modified.map(|dt| dt.to_string());
            let etag = obj.e_tag;
            let storage_class = obj.storage_class.map(|sc| sc.to_string());

            entries.push(S3ObjectEntry {
                key: key.clone(),
                name,
                size: obj.size.unwrap_or(0),
                last_modified,
                etag,
                storage_class,
                is_folder: false,
                content_type: None,
            });
        }
    }

    let is_truncated = output.is_truncated == Some(true);
    let next_token = if is_truncated {
        output.next_continuation_token
    } else {
        None
    };

    // Sort folders first, then by name
    entries.sort_by(|a, b| {
        if a.is_folder != b.is_folder {
            return if a.is_folder {
                std::cmp::Ordering::Less
            } else {
                std::cmp::Ordering::Greater
            };
        }
        a.name.to_lowercase().cmp(&b.name.to_lowercase())
    });

    Ok(S3ObjectListPage {
        entries,
        next_continuation_token: next_token,
        is_truncated,
    })
}

pub async fn put_object(
    target: &StorageTarget,
    credentials: &TargetCredentials,
    bucket: &str,
    key: &str,
    source_path: &str,
) -> Result<()> {
    let client = build_client(target, credentials).await?;
    let body = ByteStream::from_path(Path::new(source_path))
        .await
        .map_err(|e| anyhow!("Failed to read file {source_path}: {e}"))?;

    let content_type = guess_content_type(key);

    client
        .put_object()
        .bucket(bucket)
        .key(key)
        .body(body)
        .content_type(content_type)
        .send()
        .await
        .map_err(|e| anyhow!("S3 put object failed: {e}"))?;

    Ok(())
}

pub async fn get_object(
    target: &StorageTarget,
    credentials: &TargetCredentials,
    bucket: &str,
    key: &str,
    dest_path: &str,
    on_progress: impl Fn(u64, u64),
) -> Result<()> {
    use std::io::Write;
    use std::time::Instant;
    use tokio::io::AsyncReadExt;

    let client = build_client(target, credentials).await?;
    let output = client
        .get_object()
        .bucket(bucket)
        .key(key)
        .send()
        .await
        .map_err(|e| anyhow!("S3 get object failed: {e}"))?;

    let total = output.content_length().map(|v| v.max(0) as u64).unwrap_or(0);

    let dest = Path::new(dest_path);
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let mut file = std::fs::File::create(dest)?;
    let mut reader = output.body.into_async_read();
    let mut downloaded: u64 = 0;
    let mut buf = vec![0u8; 256 * 1024]; // 256 KB chunks
    let mut last_emit = Instant::now();

    loop {
        let n = reader
            .read(&mut buf)
            .await
            .map_err(|e| anyhow!("Failed to read S3 stream: {e}"))?;
        if n == 0 {
            break;
        }
        file.write_all(&buf[..n])?;
        downloaded += n as u64;

        if last_emit.elapsed().as_millis() >= 50 || downloaded == total {
            on_progress(downloaded, total);
            last_emit = Instant::now();
        }
    }

    // Ensure final progress
    on_progress(downloaded, if total > 0 { total } else { downloaded });
    Ok(())
}

pub async fn delete_objects(
    target: &StorageTarget,
    credentials: &TargetCredentials,
    bucket: &str,
    keys: Vec<String>,
) -> Result<()> {
    if keys.is_empty() {
        return Ok(());
    }

    let client = build_client(target, credentials).await?;

    // S3 delete_objects supports up to 1000 keys per request
    for chunk in keys.chunks(1000) {
        let objects: Vec<ObjectIdentifier> = chunk
            .iter()
            .map(|k| ObjectIdentifier::builder().key(k).build())
            .collect::<std::result::Result<Vec<_>, _>>()
            .map_err(|e| anyhow!("Failed to build object identifier: {e}"))?;

        let delete = Delete::builder()
            .set_objects(Some(objects))
            .build()
            .map_err(|e| anyhow!("Failed to build delete request: {e}"))?;

        client
            .delete_objects()
            .bucket(bucket)
            .delete(delete)
            .send()
            .await
            .map_err(|e| anyhow!("S3 delete objects failed: {e}"))?;
    }

    Ok(())
}

pub async fn create_folder(
    target: &StorageTarget,
    credentials: &TargetCredentials,
    bucket: &str,
    key: &str,
) -> Result<()> {
    let client = build_client(target, credentials).await?;
    let folder_key = if key.ends_with('/') {
        key.to_string()
    } else {
        format!("{key}/")
    };

    client
        .put_object()
        .bucket(bucket)
        .key(&folder_key)
        .body(ByteStream::from_static(b""))
        .content_type("application/x-directory")
        .send()
        .await
        .map_err(|e| anyhow!("S3 create folder failed: {e}"))?;

    Ok(())
}

pub async fn bucket_stats(
    target: &StorageTarget,
    credentials: &TargetCredentials,
    bucket: &str,
) -> Result<BucketStats> {
    let client = build_client(target, credentials).await?;
    let mut object_count: i64 = 0;
    let mut total_size: i64 = 0;
    let mut continuation_token: Option<String> = None;

    loop {
        let mut req = client.list_objects_v2().bucket(bucket);
        if let Some(token) = &continuation_token {
            req = req.continuation_token(token);
        }

        let output = req
            .send()
            .await
            .map_err(|e| anyhow!("S3 list objects for stats failed: {e}"))?;

        if let Some(contents) = &output.contents {
            for obj in contents {
                object_count += 1;
                total_size += obj.size.unwrap_or(0);
            }
        }

        if output.is_truncated == Some(true) {
            continuation_token = output.next_continuation_token;
            if continuation_token.is_none() {
                break;
            }
        } else {
            break;
        }
    }

    Ok(BucketStats {
        object_count,
        total_size,
    })
}

pub async fn presign_object(
    target: &StorageTarget,
    credentials: &TargetCredentials,
    bucket: &str,
    key: &str,
    expires_in_secs: u64,
) -> Result<String> {
    let client = build_client(target, credentials).await?;

    let presigning_config = PresigningConfig::builder()
        .expires_in(Duration::from_secs(expires_in_secs))
        .build()
        .map_err(|e| anyhow!("Failed to build presigning config: {e}"))?;

    let presigned = client
        .get_object()
        .bucket(bucket)
        .key(key)
        .presigned(presigning_config)
        .await
        .map_err(|e| anyhow!("S3 presign failed: {e}"))?;

    Ok(presigned.uri().to_string())
}

pub async fn list_objects_recursive(
    target: &StorageTarget,
    credentials: &TargetCredentials,
    bucket: &str,
    prefix: &str,
) -> Result<Vec<S3ObjectEntry>> {
    let client = build_client(target, credentials).await?;
    let mut entries = Vec::new();
    let mut continuation_token: Option<String> = None;

    loop {
        let mut req = client
            .list_objects_v2()
            .bucket(bucket)
            .prefix(prefix);

        if let Some(token) = &continuation_token {
            req = req.continuation_token(token);
        }

        let output = req
            .send()
            .await
            .map_err(|e| anyhow!("S3 list objects recursive failed: {e}"))?;

        if let Some(contents) = output.contents {
            for obj in contents {
                let key = obj.key.unwrap_or_default();
                if key.is_empty() || key.ends_with('/') {
                    continue;
                }
                let name = key
                    .rsplit('/')
                    .next()
                    .unwrap_or(&key)
                    .to_string();
                let last_modified = obj.last_modified.map(|dt| dt.to_string());
                let etag = obj.e_tag;
                let storage_class = obj.storage_class.map(|sc| sc.to_string());

                entries.push(S3ObjectEntry {
                    key,
                    name,
                    size: obj.size.unwrap_or(0),
                    last_modified,
                    etag,
                    storage_class,
                    is_folder: false,
                    content_type: None,
                });
            }
        }

        if output.is_truncated == Some(true) {
            continuation_token = output.next_continuation_token;
            if continuation_token.is_none() {
                break;
            }
        } else {
            break;
        }
    }

    Ok(entries)
}

pub async fn download_objects_as_zip(
    target: &StorageTarget,
    credentials: &TargetCredentials,
    bucket: &str,
    keys: Vec<String>,
    base_prefix: &str,
    dest_path: &str,
    total_size: u64,
    on_progress: impl Fn(u64, u64),
) -> Result<u64> {
    use std::io::{BufWriter, Write};
    use std::time::Instant;
    use tokio::io::AsyncReadExt;
    use zip::write::SimpleFileOptions;
    use zip::ZipWriter;

    let client = build_client(target, credentials).await?;

    let file = std::fs::File::create(dest_path)
        .map_err(|e| anyhow!("Failed to create ZIP file at {dest_path}: {e}"))?;
    let buf_writer = BufWriter::new(file);
    let mut zip = ZipWriter::new(buf_writer);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    let mut cumulative: u64 = 0;
    let mut last_emit = Instant::now();

    for key in &keys {
        let entry_name = key.strip_prefix(base_prefix).unwrap_or(key);
        if entry_name.is_empty() {
            continue;
        }

        let output = client
            .get_object()
            .bucket(bucket)
            .key(key)
            .send()
            .await
            .map_err(|e| anyhow!("S3 get object failed for {key}: {e}"))?;

        zip.start_file(entry_name, options)
            .map_err(|e| anyhow!("Failed to start ZIP entry {entry_name}: {e}"))?;

        // Stream body chunks directly into ZIP entry
        let mut reader = output.body.into_async_read();
        let mut buf = vec![0u8; 256 * 1024];
        loop {
            let n = reader
                .read(&mut buf)
                .await
                .map_err(|e| anyhow!("Failed to read S3 stream for {key}: {e}"))?;
            if n == 0 {
                break;
            }
            zip.write_all(&buf[..n])
                .map_err(|e| anyhow!("Failed to write ZIP entry {entry_name}: {e}"))?;
            cumulative += n as u64;

            if last_emit.elapsed().as_millis() >= 50 {
                on_progress(cumulative, total_size);
                last_emit = Instant::now();
            }
        }
    }

    // Final progress
    on_progress(cumulative, if total_size > 0 { total_size } else { cumulative });

    let buf_writer = zip
        .finish()
        .map_err(|e| anyhow!("Failed to finalize ZIP: {e}"))?;
    buf_writer
        .into_inner()
        .map_err(|e| anyhow!("Failed to flush ZIP: {e}"))?;

    let metadata = std::fs::metadata(dest_path)
        .map_err(|e| anyhow!("Failed to read ZIP file size: {e}"))?;
    Ok(metadata.len())
}

fn guess_content_type(key: &str) -> String {
    let ext = key
        .rsplit('.')
        .next()
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "html" | "htm" => "text/html",
        "css" => "text/css",
        "js" | "mjs" => "application/javascript",
        "json" => "application/json",
        "xml" => "application/xml",
        "csv" => "text/csv",
        "txt" | "log" => "text/plain",
        "md" => "text/markdown",
        "yaml" | "yml" => "application/yaml",
        "toml" => "application/toml",
        "pdf" => "application/pdf",
        "zip" => "application/zip",
        "gz" | "gzip" => "application/gzip",
        "tar" => "application/x-tar",
        "7z" => "application/x-7z-compressed",
        "rar" => "application/x-rar-compressed",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        "bmp" => "image/bmp",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "mov" => "video/quicktime",
        "avi" => "video/x-msvideo",
        "mkv" => "video/x-matroska",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "ogg" => "audio/ogg",
        "flac" => "audio/flac",
        "aac" => "audio/aac",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "ttf" => "font/ttf",
        "otf" => "font/otf",
        "doc" => "application/msword",
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xls" => "application/vnd.ms-excel",
        "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "ppt" => "application/vnd.ms-powerpoint",
        "pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        _ => "application/octet-stream",
    }
    .to_string()
}

