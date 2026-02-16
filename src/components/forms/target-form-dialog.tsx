"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/contexts/app-context";
import { providerOptions } from "@/lib/constants";
import { nowEpoch } from "@/lib/format";
import { targetFormSchema, normalizeEndpoint, parseEndpointForBucket, type TargetFormValues } from "@/components/forms/target-form-schema";
import type { StorageTarget, TargetCredentials } from "@/lib/types";

type TargetFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editTarget: StorageTarget | null;
};

export function TargetFormDialog({ open, onOpenChange, editTarget }: TargetFormDialogProps) {
  const { createTarget, updateTarget, getTargetCredentials } = useApp();
  const [busy, setBusy] = useState(false);

  const form = useForm<TargetFormValues>({
    resolver: zodResolver(targetFormSchema),
    defaultValues: {
      id: null,
      name: "",
      provider: "Other (S3 Compatible)",
      endpoint: "",
      region: "us-east-1",
      defaultBucket: "",
      scopedBucket: "",
      pinnedBuckets: "",
      forcePathStyle: true,
      skipDestructiveConfirmations: false,
      accessKeyId: "",
      secretAccessKey: "",
      sessionToken: "",
    },
  });

  useEffect(() => {
    if (!open) return;

    if (editTarget) {
      setBusy(true);
      form.reset({
        id: editTarget.id,
        name: editTarget.name,
        provider: editTarget.provider,
        endpoint: editTarget.endpoint,
        region: editTarget.region ?? "us-east-1",
        defaultBucket: editTarget.defaultBucket ?? "",
        scopedBucket: editTarget.scopedBucket ?? "",
        pinnedBuckets: editTarget.pinnedBuckets.join(", "),
        forcePathStyle: editTarget.forcePathStyle,
        skipDestructiveConfirmations: editTarget.skipDestructiveConfirmations,
        accessKeyId: "",
        secretAccessKey: "",
        sessionToken: "",
      });

      void getTargetCredentials(editTarget.id)
        .then((creds) => {
          if (creds) {
            form.setValue("accessKeyId", creds.accessKeyId);
            form.setValue("secretAccessKey", creds.secretAccessKey);
            form.setValue("sessionToken", creds.sessionToken ?? "");
          }
        })
        .catch(() => toast.error("Failed to load credentials"))
        .finally(() => setBusy(false));
    } else {
      form.reset({
        id: null,
        name: "",
        provider: "Other (S3 Compatible)",
        endpoint: "",
        region: "us-east-1",
        defaultBucket: "",
        scopedBucket: "",
        pinnedBuckets: "",
        forcePathStyle: true,
        skipDestructiveConfirmations: false,
        accessKeyId: "",
        secretAccessKey: "",
        sessionToken: "",
      });
      setBusy(false);
    }
  }, [open, editTarget, form, getTargetCredentials]);

  const handleEndpointBlur = () => {
    const raw = form.getValues("endpoint");
    if (!raw.trim()) return;

    const { baseEndpoint, extractedBucket } = parseEndpointForBucket(raw);

    if (extractedBucket) {
      form.setValue("endpoint", baseEndpoint);
      // Only auto-fill scoped bucket if it's currently empty
      if (!form.getValues("scopedBucket").trim()) {
        form.setValue("scopedBucket", extractedBucket);
      }
      toast.info(`Detected bucket "${extractedBucket}" in URL — moved to Bucket Scope.`);
    }
  };

  const onSubmit = async (values: TargetFormValues) => {
    setBusy(true);
    try {
      let endpoint = normalizeEndpoint(values.endpoint);
      let scopedBucket = values.scopedBucket?.trim() || null;

      // Final safety: parse endpoint again in case user pasted bucket-scoped URL directly
      const { baseEndpoint, extractedBucket } = parseEndpointForBucket(endpoint);
      if (extractedBucket) {
        endpoint = baseEndpoint;
        if (!scopedBucket) scopedBucket = extractedBucket;
      }

      const id = values.id ?? crypto.randomUUID();

      const target: StorageTarget = {
        id,
        name: values.name?.trim() || new URL(endpoint).host || "Target",
        provider: values.provider,
        endpoint,
        region: values.region?.trim() || null,
        forcePathStyle: values.forcePathStyle,
        defaultBucket: values.defaultBucket?.trim() || null,
        scopedBucket,
        pinnedBuckets: (values.pinnedBuckets ?? "")
          .split(",")
          .map((b) => b.trim())
          .filter(Boolean),
        skipDestructiveConfirmations: values.skipDestructiveConfirmations,
        hasCredentials: true,
        updatedAt: nowEpoch(),
      };

      const credentials: TargetCredentials = {
        accessKeyId: values.accessKeyId,
        secretAccessKey: values.secretAccessKey,
        sessionToken: values.sessionToken?.trim() || null,
      };

      if (editTarget) {
        await updateTarget(target, credentials);
      } else {
        await createTarget(target, credentials);
      }

      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save target");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editTarget ? "Edit Storage Target" : "Add Storage Target"}</DialogTitle>
          <DialogDescription>Configure endpoint and credentials to connect to S3-compatible storage.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="My Workspace (optional)" disabled={busy} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="provider"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provider</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={busy}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {providerOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="endpoint"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endpoint</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="https://fra1.digitaloceanspaces.com"
                      disabled={busy}
                      onBlur={() => {
                        field.onBlur();
                        handleEndpointBlur();
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Paste a bucket URL (e.g. mybucket.fra1.digitaloceanspaces.com) and the bucket will be auto-detected.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="region"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Region</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="us-east-1" disabled={busy} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="scopedBucket"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bucket Scope</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="leave empty for all buckets" disabled={busy} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="defaultBucket"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Bucket</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="optional — auto-navigate on select" disabled={busy} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pinnedBuckets"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pinned Buckets (comma separated)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="primary, media, backups" disabled={busy} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="accessKeyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Access Key ID</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="AKIA..." disabled={busy} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="secretAccessKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Secret Access Key</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" placeholder="••••••••" disabled={busy} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="sessionToken"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Session Token (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="optional" disabled={busy} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="forcePathStyle"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <FormLabel className="text-xs font-medium">Force Path Style</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} disabled={busy} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="skipDestructiveConfirmations"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <FormLabel className="text-xs font-medium">Skip Destructive Confirms</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} disabled={busy} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving..." : editTarget ? "Update Target" : "Save Target"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
