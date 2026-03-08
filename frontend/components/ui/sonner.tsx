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
      className="toaster seqpulse-toaster group"
      position="top-right"
      closeButton
      visibleToasts={4}
      gap={0}
      expand={false}
      icons={{
        success: <CircleCheckIcon className="size-4 stroke-[2.25]" />,
        info: <InfoIcon className="size-4 stroke-[2.25]" />,
        warning: <TriangleAlertIcon className="size-4 stroke-[2.25]" />,
        error: <OctagonXIcon className="size-4 stroke-[2.25]" />,
        loading: <Loader2Icon className="size-4 animate-spin stroke-[2.25]" />,
      }}
      toastOptions={{
        classNames: {
          toast: "seqpulse-toast",
          title: "seqpulse-toast-title",
          description: "seqpulse-toast-description",
          closeButton: "seqpulse-toast-close",
          actionButton: "seqpulse-toast-action",
          cancelButton: "seqpulse-toast-cancel",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
