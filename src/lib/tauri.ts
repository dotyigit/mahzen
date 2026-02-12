"use client";

import { invoke } from "@tauri-apps/api/core";

import type {
  AppSettings,
  BucketStats,
  CachedBucketStats,
  DirectoryFileEntry,
  S3BucketSummary,
  S3ConnectionResult,
  S3ObjectEntry,
  S3ObjectListPage,
  StorageTarget,
  SyncProfile,
  TargetCredentials,
  TransferQueueItem,
} from "@/lib/types";

export const isTauriRuntime = (): boolean => {
  if (typeof window === "undefined") return false;
  return "__TAURI_INTERNALS__" in window;
};

const invokeSafe = async <T>(command: string, payload?: Record<string, unknown>): Promise<T> => {
  if (!isTauriRuntime()) {
    throw new Error("Tauri runtime not detected. Start with `npm run tauri:dev`.");
  }
  return invoke<T>(command, payload);
};

export const targetsList = () => invokeSafe<StorageTarget[]>("targets_list");
export const targetsUpsert = (target: StorageTarget) =>
  invokeSafe<StorageTarget>("targets_upsert", { target });
export const targetsDelete = (ids: string[]) => invokeSafe<void>("targets_delete", { ids });
export const targetCredentialsGet = (targetId: string) =>
  invokeSafe<TargetCredentials | null>("target_credentials_get", { targetId });
export const targetCredentialsUpsert = (targetId: string, credentials: TargetCredentials) =>
  invokeSafe<void>("target_credentials_upsert", { targetId, credentials });
export const targetBucketsList = (targetId: string) =>
  invokeSafe<S3BucketSummary[]>("target_buckets_list", { targetId });
export const targetConnectionTest = (targetId: string) =>
  invokeSafe<S3ConnectionResult>("target_connection_test", { targetId });

export const targetObjectsList = (targetId: string, bucket: string, prefix: string) =>
  invokeSafe<S3ObjectEntry[]>("target_objects_list", { targetId, bucket, prefix });
export const targetObjectsListPage = (targetId: string, bucket: string, prefix: string, maxKeys: number, continuationToken: string | null) =>
  invokeSafe<S3ObjectListPage>("target_objects_list_page", { targetId, bucket, prefix, maxKeys, continuationToken });
export const targetObjectUpload = (targetId: string, bucket: string, key: string, sourcePath: string) =>
  invokeSafe<void>("target_object_upload", { targetId, bucket, key, sourcePath });
export const targetObjectDownload = (targetId: string, bucket: string, key: string, destPath: string, transferId: string) =>
  invokeSafe<void>("target_object_download", { targetId, bucket, key, destPath, transferId });
export const targetObjectsDelete = (targetId: string, bucket: string, keys: string[]) =>
  invokeSafe<void>("target_objects_delete", { targetId, bucket, keys });
export const targetFolderCreate = (targetId: string, bucket: string, key: string) =>
  invokeSafe<void>("target_folder_create", { targetId, bucket, key });
export const targetBucketStats = (targetId: string, bucket: string) =>
  invokeSafe<BucketStats>("target_bucket_stats", { targetId, bucket });
export const targetObjectsListRecursive = (targetId: string, bucket: string, prefix: string) =>
  invokeSafe<S3ObjectEntry[]>("target_objects_list_recursive", { targetId, bucket, prefix });
export const targetObjectsDownloadZip = (targetId: string, bucket: string, keys: string[], basePrefix: string, destPath: string, transferId: string, totalSize: number) =>
  invokeSafe<number>("target_objects_download_zip", { targetId, bucket, keys, basePrefix, destPath, transferId, totalSize });
export const targetObjectPresign = (targetId: string, bucket: string, key: string, expiresInSecs: number) =>
  invokeSafe<string>("target_object_presign", { targetId, bucket, key, expiresInSecs });
export const bucketStatsCacheList = () =>
  invokeSafe<CachedBucketStats[]>("bucket_stats_cache_list");
export const bucketStatsCacheUpsert = (targetId: string, bucket: string, objectCount: number, totalSize: number) =>
  invokeSafe<void>("bucket_stats_cache_upsert", { targetId, bucket, objectCount, totalSize });
export const listDirectoryFiles = (path: string) =>
  invokeSafe<DirectoryFileEntry[]>("list_directory_files", { path });

export const syncProfilesList = () => invokeSafe<SyncProfile[]>("sync_profiles_list");
export const syncProfilesUpsert = (profile: SyncProfile) =>
  invokeSafe<SyncProfile>("sync_profiles_upsert", { profile });
export const syncProfilesDelete = (ids: string[]) => invokeSafe<void>("sync_profiles_delete", { ids });

export const transferQueueList = () => invokeSafe<TransferQueueItem[]>("transfer_queue_list");
export const transferQueueUpsert = (item: TransferQueueItem) =>
  invokeSafe<TransferQueueItem>("transfer_queue_upsert", { item });
export const transferQueueDelete = (id: string) => invokeSafe<void>("transfer_queue_delete", { id });
export const transferQueueClearTerminal = () => invokeSafe<void>("transfer_queue_clear_terminal");

export const settingsGet = () => invokeSafe<AppSettings>("settings_get");
export const settingsUpsert = (settings: AppSettings) =>
  invokeSafe<AppSettings>("settings_upsert", { settings });
