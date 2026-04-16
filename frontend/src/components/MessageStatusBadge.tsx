import { MessageStatus } from "@/types";
import { cn } from "@/lib/utils";
import { Check, CheckCheck, AlertCircle } from "lucide-react";

interface MessageStatusBadgeProps {
  status: MessageStatus;
  readAt?: string;
  className?: string;
}

/**
 * WhatsApp-style delivery indicator:
 *   ✓       Single grey tick  → queued / processing
 *   ✓✓      Double grey tick  → sent (delivered)
 *   ✓✓ blue Double blue tick  → read
 *   ⚠       Red alert         → failed
 */
export function MessageStatusBadge({
  status,
  readAt,
  className,
}: MessageStatusBadgeProps) {
  if (status === "failed") {
    return (
      <div
        className={cn(
          "flex items-center gap-1 text-[10px] font-medium text-red-500",
          className,
        )}
      >
        <AlertCircle size={12} />
        <span>Failed</span>
      </div>
    );
  }

  if (readAt) {
    return (
      <div
        className={cn("flex items-center text-blue-500", className)}
        title={`Read at ${new Date(readAt).toLocaleTimeString()}`}
      >
        <CheckCheck size={16} />
      </div>
    );
  }

  if (status === "sent") {
    return (
      <div
        className={cn("flex items-center text-gray-400", className)}
        title="Delivered"
      >
        <CheckCheck size={16} />
      </div>
    );
  }

  // Queued or Processing
  return (
    <div
      className={cn("flex items-center text-gray-400", className)}
      title={status === "processing" ? "Processing…" : "Queued"}
    >
      <Check
        size={16}
        className={status === "processing" ? "animate-pulse" : ""}
      />
    </div>
  );
}
