import { cn } from "../../lib/classnames";
import { formatWorkflowStatus } from "../../lib/format/workflow";

interface WorkflowBadgeProps {
  status: string;
  label?: string;
}

function resolveTone(status: string) {
  switch (status) {
    case "DRAFT":
      return "bg-[hsl(var(--workflow-draft))]/15 text-[hsl(var(--workflow-draft))]";
    case "REVIEW":
    case "READY_FOR_REVIEW":
      return "bg-[hsl(var(--workflow-review))]/15 text-[hsl(var(--workflow-review))]";
    case "VALIDATED":
    case "PREVIEW_READY":
      return "bg-[hsl(var(--workflow-validated))]/15 text-[hsl(var(--workflow-validated))]";
    case "FINALIZED":
      return "bg-[hsl(var(--workflow-finalized))]/15 text-[hsl(var(--workflow-finalized))]";
    case "EXPORTED":
      return "bg-[hsl(var(--workflow-exported))]/15 text-[hsl(var(--workflow-exported))]";
    default:
      return "bg-muted text-foreground";
  }
}

export function WorkflowBadge({ status, label }: WorkflowBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
        resolveTone(status)
      )}
    >
      {label ?? formatWorkflowStatus(status)}
    </span>
  );
}
