import { z } from "zod";

export const targetFormSchema = z.object({
  id: z.string().nullable(),
  name: z.string(),
  provider: z.string().min(1, "Provider is required"),
  endpoint: z
    .string()
    .min(1, "Endpoint is required")
    .refine(
      (val) => {
        try {
          const withScheme = /^https?:\/\//i.test(val.trim()) ? val.trim() : `https://${val.trim()}`;
          new URL(withScheme);
          return true;
        } catch {
          return false;
        }
      },
      { message: "Must be a valid URL or hostname" },
    ),
  region: z.string(),
  defaultBucket: z.string(),
  scopedBucket: z.string(),
  pinnedBuckets: z.string(),
  forcePathStyle: z.boolean(),
  skipDestructiveConfirmations: z.boolean(),
  accessKeyId: z.string().min(1, "Access key is required"),
  secretAccessKey: z.string().min(1, "Secret key is required"),
  sessionToken: z.string(),
});

export type TargetFormValues = z.infer<typeof targetFormSchema>;

export function normalizeEndpoint(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return new URL(withScheme).toString().replace(/\/$/, "");
}

/**
 * Known S3-compatible provider base domains.
 * If the hostname ends with one of these, the first subdomain segment is a bucket name.
 */
const KNOWN_PROVIDER_DOMAINS = [
  "digitaloceanspaces.com",
  "r2.cloudflarestorage.com",
  "backblazeb2.com",
  "wasabisys.com",
  "amazonaws.com",
  "scw.cloud",
  "linodeobjects.com",
  "vultrobjects.com",
];

/**
 * Parses a user-entered endpoint URL and extracts a bucket name if embedded.
 *
 * For example:
 *   "https://mahzen-test-2.fra1.digitaloceanspaces.com"
 *   → { baseEndpoint: "https://fra1.digitaloceanspaces.com", extractedBucket: "mahzen-test-2" }
 *
 *   "https://fra1.digitaloceanspaces.com"
 *   → { baseEndpoint: "https://fra1.digitaloceanspaces.com", extractedBucket: null }
 */
export function parseEndpointForBucket(value: string): {
  baseEndpoint: string;
  extractedBucket: string | null;
} {
  const normalized = normalizeEndpoint(value);
  if (!normalized) return { baseEndpoint: "", extractedBucket: null };

  try {
    const url = new URL(normalized);
    const hostname = url.hostname.toLowerCase();

    for (const domain of KNOWN_PROVIDER_DOMAINS) {
      if (!hostname.endsWith(domain)) continue;

      // Get everything before the provider domain
      const prefix = hostname.slice(0, hostname.length - domain.length);
      if (!prefix || !prefix.endsWith(".")) continue;

      // prefix is like "mahzen-test-2.fra1." for DO Spaces
      // or "mybucket.s3.us-east-1." for AWS
      const segments = prefix.slice(0, -1).split(".");

      // For AWS: mybucket.s3.us-east-1.amazonaws.com → bucket is first segment
      // For DO: mybucket.fra1.digitaloceanspaces.com → bucket is first segment
      // Region-only: fra1.digitaloceanspaces.com → no bucket (only 1 segment = region)
      // s3.us-east-1.amazonaws.com → no bucket (first segment is "s3")
      if (segments.length < 2) continue;

      // Skip if first segment looks like an S3 service prefix, not a bucket
      if (segments[0] === "s3") continue;

      const bucketName = segments[0];
      // Reconstruct the base endpoint without the bucket subdomain
      const baseDomain = segments.slice(1).join(".") + "." + domain;
      url.hostname = baseDomain;
      const baseEndpoint = url.toString().replace(/\/$/, "");

      return { baseEndpoint, extractedBucket: bucketName };
    }
  } catch {
    // Fall through
  }

  return { baseEndpoint: normalized, extractedBucket: null };
}
