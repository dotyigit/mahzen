use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct S3ObjectEntry {
    pub key: String,
    pub name: String,
    pub size: i64,
    pub last_modified: Option<String>,
    pub etag: Option<String>,
    pub storage_class: Option<String>,
    pub is_folder: bool,
    pub content_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageTarget {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub endpoint: String,
    pub region: Option<String>,
    pub force_path_style: bool,
    pub default_bucket: Option<String>,
    pub pinned_buckets: Vec<String>,
    pub skip_destructive_confirmations: bool,
    #[serde(default)]
    pub has_credentials: bool,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TargetCredentials {
    pub access_key_id: String,
    pub secret_access_key: String,
    pub session_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct S3BucketSummary {
    pub name: String,
    pub created_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct S3ConnectionResult {
    pub ok: bool,
    pub message: String,
    pub bucket_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncProfile {
    pub id: String,
    pub name: String,
    pub target_id: String,
    pub local_root_path: String,
    pub bucket: String,
    pub prefix: String,
    pub schedule_interval_minutes: Option<i64>,
    pub conflict_policy: String,
    pub delete_policy: String,
    pub include_globs: Vec<String>,
    pub exclude_globs: Vec<String>,
    pub enabled: bool,
    pub last_run_at: Option<i64>,
    pub next_run_at: Option<i64>,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BucketStats {
    pub object_count: i64,
    pub total_size: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryFileEntry {
    pub absolute_path: String,
    pub relative_path: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferQueueItem {
    pub id: String,
    pub direction: String,
    pub target_id: String,
    pub bucket: String,
    pub key: String,
    pub source_path: Option<String>,
    pub destination_path: Option<String>,
    pub total_bytes: Option<i64>,
    pub transferred_bytes: Option<i64>,
    pub status: String,
    pub retry_count: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: String,
    pub font_size: i64,
    pub date_format: String,
    pub size_format: String,
    pub show_file_icons: bool,
    pub compact_mode: bool,
    pub animate_transitions: bool,
    pub double_click_nav: bool,
    pub show_hidden: bool,
    pub remember_path: bool,
    pub auto_refresh: bool,
    pub confirm_delete: bool,
    pub concurrent_uploads: i64,
    pub concurrent_downloads: i64,
    pub multipart_threshold_mb: i64,
    pub part_size_mb: i64,
    pub auto_retry: bool,
    pub retry_count: i64,
    pub preserve_timestamps: bool,
    pub verify_checksum: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            font_size: 12,
            date_format: "relative".to_string(),
            size_format: "binary".to_string(),
            show_file_icons: true,
            compact_mode: false,
            animate_transitions: true,
            double_click_nav: true,
            show_hidden: false,
            remember_path: true,
            auto_refresh: false,
            confirm_delete: true,
            concurrent_uploads: 3,
            concurrent_downloads: 5,
            multipart_threshold_mb: 100,
            part_size_mb: 8,
            auto_retry: true,
            retry_count: 3,
            preserve_timestamps: true,
            verify_checksum: true,
        }
    }
}
