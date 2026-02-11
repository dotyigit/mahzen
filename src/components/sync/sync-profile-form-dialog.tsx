"use client";

import { useEffect } from "react";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/contexts/app-context";
import { useTransfers } from "@/contexts/transfer-context";
import { conflictPolicies, deletePolicies } from "@/lib/constants";
import { nowEpoch } from "@/lib/format";
import { syncProfileFormSchema, type SyncProfileFormValues } from "@/components/forms/sync-profile-form-schema";
import type { SyncProfile } from "@/lib/types";

type SyncProfileFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editProfile: SyncProfile | null;
};

export function SyncProfileFormDialog({ open, onOpenChange, editProfile }: SyncProfileFormDialogProps) {
  const { selectedTarget } = useApp();
  const { upsertProfile } = useTransfers();

  const form = useForm<SyncProfileFormValues>({
    resolver: zodResolver(syncProfileFormSchema),
    defaultValues: {
      id: null,
      name: "",
      targetId: selectedTarget?.id ?? "",
      localRootPath: "",
      bucket: "",
      prefix: "",
      scheduleIntervalMinutes: null,
      conflictPolicy: "newestMtimeWins",
      deletePolicy: "noPropagation",
      includeGlobs: "",
      excludeGlobs: "",
      enabled: true,
    },
  });

  useEffect(() => {
    if (!open) return;

    if (editProfile) {
      form.reset({
        id: editProfile.id,
        name: editProfile.name,
        targetId: editProfile.targetId,
        localRootPath: editProfile.localRootPath,
        bucket: editProfile.bucket,
        prefix: editProfile.prefix,
        scheduleIntervalMinutes: editProfile.scheduleIntervalMinutes,
        conflictPolicy: editProfile.conflictPolicy,
        deletePolicy: editProfile.deletePolicy,
        includeGlobs: editProfile.includeGlobs.join(", "),
        excludeGlobs: editProfile.excludeGlobs.join(", "),
        enabled: editProfile.enabled,
      });
    } else {
      form.reset({
        id: null,
        name: "",
        targetId: selectedTarget?.id ?? "",
        localRootPath: "",
        bucket: "",
        prefix: "",
        scheduleIntervalMinutes: null,
        conflictPolicy: "newestMtimeWins",
        deletePolicy: "noPropagation",
        includeGlobs: "",
        excludeGlobs: "",
        enabled: true,
      });
    }
  }, [open, editProfile, form, selectedTarget?.id]);

  const onSubmit = async (values: SyncProfileFormValues) => {
    try {
      const profile: SyncProfile = {
        id: values.id ?? crypto.randomUUID(),
        name: values.name,
        targetId: values.targetId,
        localRootPath: values.localRootPath,
        bucket: values.bucket,
        prefix: values.prefix ?? "",
        scheduleIntervalMinutes: values.scheduleIntervalMinutes,
        conflictPolicy: values.conflictPolicy,
        deletePolicy: values.deletePolicy,
        includeGlobs: (values.includeGlobs ?? "")
          .split(",")
          .map((g) => g.trim())
          .filter(Boolean),
        excludeGlobs: (values.excludeGlobs ?? "")
          .split(",")
          .map((g) => g.trim())
          .filter(Boolean),
        enabled: values.enabled,
        lastRunAt: editProfile?.lastRunAt ?? null,
        nextRunAt: values.scheduleIntervalMinutes
          ? nowEpoch() + values.scheduleIntervalMinutes * 60
          : null,
        updatedAt: nowEpoch(),
      };

      await upsertProfile(profile);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save sync profile");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editProfile ? "Edit Sync Profile" : "Add Sync Profile"}</DialogTitle>
          <DialogDescription>Configure sync behavior between local filesystem and S3 bucket.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Two-way backup" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="localRootPath"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Local Root Path</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="/Users/me/Documents" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bucket"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bucket</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="my-bucket" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="prefix"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prefix (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="desktop/backups" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="scheduleIntervalMinutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Schedule Interval (minutes)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="60 (leave empty for manual)"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="conflictPolicy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conflict Policy</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {conflictPolicies.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
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
                name="deletePolicy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delete Policy</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {deletePolicies.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="includeGlobs"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Include Globs</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="*.jpg, *.png" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="excludeGlobs"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Exclude Globs</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="*.tmp, .DS_Store" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <FormLabel className="text-xs font-medium">Enabled</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">{editProfile ? "Update Profile" : "Save Profile"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
