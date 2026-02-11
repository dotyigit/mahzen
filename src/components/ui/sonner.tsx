"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "!bg-card !text-card-foreground !border-border !shadow-lg !rounded-lg !font-sans !text-[13px]",
          title: "!font-medium !text-[13px]",
          description: "!text-muted-foreground !text-[12px]",
          actionButton: "!bg-primary !text-primary-foreground !text-[12px] !font-medium",
          cancelButton: "!bg-secondary !text-secondary-foreground !text-[12px] !font-medium",
          success: "!border-success/20 [&>svg]:!text-success",
          error: "!border-destructive/20 [&>svg]:!text-destructive",
          warning: "!border-warning/20 [&>svg]:!text-warning",
          info: "!border-primary/20 [&>svg]:!text-primary",
        },
      }}
      style={
        {
          "--normal-bg": "var(--card)",
          "--normal-text": "var(--card-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
