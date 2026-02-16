export type StorageTarget = {
  id: string;
  name: string;
  provider: string;
  endpoint: string;
  region: string | null;
  forcePathStyle: boolean;
  defaultBucket: string | null;
  scopedBucket: string | null;
  pinnedBuckets: string[];
  skipDestructiveConfirmations: boolean;
  hasCredentials: boolean;
  updatedAt: number;
};

export type TargetCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string | null;
};

export type S3BucketSummary = {
  name: string;
  createdAt: number | null;
};

export type S3ConnectionResult = {
  ok: boolean;
  message: string;
  bucketCount: number;
};

export type SyncProfile = {
  id: string;
  name: string;
  targetId: string;
  localRootPath: string;
  bucket: string;
  prefix: string;
  scheduleIntervalMinutes: number | null;
  conflictPolicy: string;
  deletePolicy: string;
  includeGlobs: string[];
  excludeGlobs: string[];
  enabled: boolean;
  lastRunAt: number | null;
  nextRunAt: number | null;
  updatedAt: number;
};

export type BucketStats = {
  objectCount: number;
  totalSize: number;
};

export type SidebarBucket = {
  name: string;
  region: string;
  targetId: string;
  targetName: string;
  provider: string;
  objectCount: number | null;
  totalSize: number | null;
};

export type CachedBucketStats = {
  targetId: string;
  bucket: string;
  objectCount: number;
  totalSize: number;
  cachedAt: number;
};

export type DirectoryFileEntry = {
  absolutePath: string;
  relativePath: string;
  size: number;
};

export type S3ObjectEntry = {
  key: string;
  name: string;
  size: number;
  lastModified: string | null;
  etag: string | null;
  storageClass: string | null;
  isFolder: boolean;
  contentType: string | null;
};

export type S3ObjectListPage = {
  entries: S3ObjectEntry[];
  nextContinuationToken: string | null;
  isTruncated: boolean;
};

export type AppSettings = {
  theme: string;
  fontSize: number;
  dateFormat: string;
  sizeFormat: string;
  showFileIcons: boolean;
  compactMode: boolean;
  animateTransitions: boolean;
  doubleClickNav: boolean;
  showHidden: boolean;
  rememberPath: boolean;
  autoRefresh: boolean;
  confirmDelete: boolean;
  concurrentUploads: number;
  concurrentDownloads: number;
  multipartThresholdMb: number;
  partSizeMb: number;
  autoRetry: boolean;
  retryCount: number;
  preserveTimestamps: boolean;
  verifyChecksum: boolean;
};

export type CloneConflictPolicy = "skip" | "overwrite" | "overwriteIfNewer";

export type CloneJobStatus =
  | "pending"
  | "enumerating"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type CloneJob = {
  id: string;
  status: CloneJobStatus;
  sourceTargetId: string;
  sourceBucket: string;
  sourcePrefix: string;
  destTargetId: string;
  destBucket: string;
  destPrefix: string;
  conflictPolicy: CloneConflictPolicy;
  isSameTarget: boolean;
  enumerationToken: string | null;
  enumerationComplete: boolean;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  skippedItems: number;
  totalBytes: number;
  transferredBytes: number;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
};

export type CloneJobItem = {
  id: string;
  jobId: string;
  sourceKey: string;
  destKey: string;
  size: number;
  sourceEtag: string | null;
  sourceLastModified: string | null;
  status: "pending" | "active" | "completed" | "skipped" | "failed";
  errorMessage: string | null;
  retryCount: number;
  createdAt: number;
  updatedAt: number;
};

export type CloneProgressEvent = {
  jobId: string;
  status: string;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  skippedItems: number;
  totalBytes: number;
  transferredBytes: number;
  currentKey: string | null;
};

export type BucketIndexStatus = "idle" | "indexing" | "error";

export type BucketIndexState = {
  targetId: string;
  bucket: string;
  status: BucketIndexStatus;
  totalObjects: number;
  indexedObjects: number;
  totalSize: number;
  continuationToken: string | null;
  lastIndexedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type IndexProgressEvent = {
  targetId: string;
  bucket: string;
  status: string;
  indexedObjects: number;
  totalSize: number;
};

export type TransferQueueItem = {
  id: string;
  direction: string;
  targetId: string;
  bucket: string;
  key: string;
  sourcePath: string | null;
  destinationPath: string | null;
  totalBytes: number | null;
  transferredBytes: number | null;
  status: string;
  retryCount: number;
  createdAt: number;
  updatedAt: number;
};
