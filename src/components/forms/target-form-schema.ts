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
