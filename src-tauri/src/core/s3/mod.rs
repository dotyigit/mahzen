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

    // Common prefixes → folders (include from every page)
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

pub async fn head_object(
    target: &StorageTarget,
    credentials: &TargetCredentials,
    bucket: &str,
    key: &str,
) -> Result<Option<(i64, Option<String>)>> {
    let client = build_client(target, credentials).await?;
    match client.head_object().bucket(bucket).key(key).send().await {
        Ok(output) => {
            let size = output.content_length().unwrap_or(0);
            let last_modified = output.last_modified().map(|dt| dt.to_string());
            Ok(Some((size, last_modified)))
        }
        Err(e) => {
            if let aws_sdk_s3::error::SdkError::ServiceError(service_err) = &e {
                if service_err.err().is_not_found() {
                    return Ok(None);
                }
            }
            Err(anyhow!("S3 head object failed: {e}"))
        }
    }
}

pub async fn copy_object(
    target: &StorageTarget,
    credentials: &TargetCredentials,
    source_bucket: &str,
    source_key: &str,
    dest_bucket: &str,
    dest_key: &str,
    source_size: i64,
) -> Result<()> {
    let client = build_client(target, credentials).await?;
    let copy_source = format!("{}/{}", source_bucket, source_key);

    const FIVE_GB: i64 = 5 * 1024 * 1024 * 1024;
    const PART_SIZE: i64 = 100 * 1024 * 1024;

    if source_size <= FIVE_GB {
        client
            .copy_object()
            .copy_source(&copy_source)
            .bucket(dest_bucket)
            .key(dest_key)
            .send()
            .await
            .map_err(|e| anyhow!("S3 copy object failed: {e}"))?;
    } else {
        let create = client
            .create_multipart_upload()
            .bucket(dest_bucket)
            .key(dest_key)
            .send()
            .await
            .map_err(|e| anyhow!("Failed to create multipart upload: {e}"))?;

        let upload_id = create
            .upload_id()
            .ok_or_else(|| anyhow!("No upload_id returned"))?
            .to_string();

        let mut parts = Vec::new();
        let mut offset: i64 = 0;
        let mut part_number: i32 = 1;

        while offset < source_size {
            let end = std::cmp::min(offset + PART_SIZE - 1, source_size - 1);
            let range = format!("bytes={}-{}", offset, end);

            let part_result = client
                .upload_part_copy()
                .copy_source(&copy_source)
                .copy_source_range(&range)
                .bucket(dest_bucket)
                .key(dest_key)
                .upload_id(&upload_id)
                .part_number(part_number)
                .send()
                .await;

            match part_result {
                Ok(part) => {
                    let etag = part
                        .copy_part_result()
                        .and_then(|r| r.e_tag().map(|s| s.to_string()))
                        .ok_or_else(|| anyhow!("No ETag for part {part_number}"))?;

                    parts.push(
                        aws_sdk_s3::types::CompletedPart::builder()
                            .e_tag(etag)
                            .part_number(part_number)
                            .build(),
                    );
                }
                Err(e) => {
                    let _ = client
                        .abort_multipart_upload()
                        .bucket(dest_bucket)
                        .key(dest_key)
                        .upload_id(&upload_id)
                        .send()
                        .await;
                    return Err(anyhow!("UploadPartCopy failed for part {part_number}: {e}"));
                }
            }

            offset = end + 1;
            part_number += 1;
        }

        let completed = aws_sdk_s3::types::CompletedMultipartUpload::builder()
            .set_parts(Some(parts))
            .build();

        client
            .complete_multipart_upload()
            .bucket(dest_bucket)
            .key(dest_key)
            .upload_id(&upload_id)
            .multipart_upload(completed)
            .send()
            .await
            .map_err(|e| anyhow!("Failed to complete multipart copy: {e}"))?;
    }

    Ok(())
}

pub async fn cross_target_copy(
    source_target: &StorageTarget,
    source_credentials: &TargetCredentials,
    source_bucket: &str,
    source_key: &str,
    dest_target: &StorageTarget,
    dest_credentials: &TargetCredentials,
    dest_bucket: &str,
    dest_key: &str,
    temp_dir: &Path,
    on_progress: impl Fn(u64, u64),
) -> Result<()> {
    let temp_file = temp_dir.join(format!("clone_{}", uuid::Uuid::now_v7()));
    let temp_path = temp_file
        .to_str()
        .ok_or_else(|| anyhow!("Invalid temp path"))?;

    let download_result = get_object(
        source_target,
        source_credentials,
        source_bucket,
        source_key,
        temp_path,
        &on_progress,
    )
    .await;

    if let Err(e) = download_result {
        let _ = std::fs::remove_file(&temp_file);
        return Err(e);
    }

    let upload_result =
        put_object(dest_target, dest_credentials, dest_bucket, dest_key, temp_path).await;

    let _ = std::fs::remove_file(&temp_file);
    upload_result
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

