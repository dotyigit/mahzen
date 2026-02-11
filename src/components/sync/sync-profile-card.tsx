"use client";

import { Clock3, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { SyncProfile } from "@/lib/types";

type SyncProfileCardProps = {
  profile: SyncProfile;
  onEdit: () => void;
  onDelete: () => void;
  onToggleEnabled: (enabled: boolean) => void;
};

export function SyncProfileCard({ profile, onEdit, onDelete, onToggleEnabled }: SyncProfileCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold">{profile.name}</p>
            <Switch
              checked={profile.enabled}
              onCheckedChange={onToggleEnabled}
              className="shrink-0"
            />
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {profile.bucket}/{profile.prefix || "/"}
          </p>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5" />
              {profile.scheduleIntervalMinutes ? `${profile.scheduleIntervalMinutes} min` : "manual"}
            </span>
            <Badge variant={profile.enabled ? "default" : "outline"} className="text-[10px]">
              {profile.enabled ? "enabled" : "paused"}
            </Badge>
          </div>
          <div className="flex items-center gap-1 pt-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
