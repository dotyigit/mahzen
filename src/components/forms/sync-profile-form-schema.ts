import { z } from "zod";

export const syncProfileFormSchema = z.object({
  id: z.string().nullable(),
  name: z.string().min(1, "Name is required"),
  targetId: z.string().min(1, "Target is required"),
  localRootPath: z.string().min(1, "Local root path is required"),
  bucket: z.string().min(1, "Bucket is required"),
  prefix: z.string(),
  scheduleIntervalMinutes: z.number().nullable(),
  conflictPolicy: z.string(),
  deletePolicy: z.string(),
  includeGlobs: z.string(),
  excludeGlobs: z.string(),
  enabled: z.boolean(),
});

export type SyncProfileFormValues = z.infer<typeof syncProfileFormSchema>;
