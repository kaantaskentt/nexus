import {
  MessageCircle,
  FileSpreadsheet,
  ShoppingBag,
  Printer,
  HelpCircle,
  FileText,
  Zap,
  Mail,
  CircleCheck,
  Circle,
  Info,
} from "lucide-react";
import type { StepStatus, ToolKind, WorkflowStep } from "@/lib/types";
import { cn } from "@/lib/cn";

const TOOL_ICON: Record<ToolKind, typeof Mail> = {
  whatsapp: MessageCircle,
  excel: FileSpreadsheet,
  shopify: ShoppingBag,
  printer: Printer,
  notion: FileText,
  apify: Zap,
  email: Mail,
  unknown: HelpCircle,
};

const STATUS: Record<
  StepStatus,
  { label: string; pill: string; icon: typeof CircleCheck; dot: string }
> = {
  verified: { label: "Verified", pill: "bg-success-soft text-tag-verified", icon: CircleCheck, dot: "bg-success text-on-accent" },
  partial: { label: "Partial", pill: "bg-pain-moderate text-tag-guess", icon: Circle, dot: "bg-accent text-on-accent" },
  needs_clarification: { label: "Needs clarification", pill: "bg-surface-raised text-ink-soft", icon: Info, dot: "bg-ink-faint text-on-accent" },
};

// A workflow step (stage8): numbered status dot, title, tool/input/action/output,
// and a verification badge — the verified workflow map from the compiled interview.
export function WorkflowStepCard({
  step,
  onClick,
}: {
  step: WorkflowStep;
  onClick?: () => void;
}) {
  const s = STATUS[step.status];
  const ToolIcon = TOOL_ICON[step.tool.kind];
  const StatusIcon = s.icon;
  const dashed = step.status === "needs_clarification";

  return (
    <div className="flex w-[15.5rem] shrink-0 flex-col">
      <button
        onClick={onClick}
        className={cn(
          "lift flex flex-1 flex-col rounded-card border bg-surface p-4 text-left hover:border-line-strong",
          dashed ? "border-dashed border-line-strong" : "border-line",
        )}
      >
        <span className={cn("mb-3 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold", s.dot)}>
          {step.index}
        </span>
        <h3 className="font-semibold leading-snug text-ink">{step.title}</h3>

        <Field label="Tool">
          <span className="flex items-center gap-2">
            <ToolIcon className="h-4 w-4 shrink-0 text-ink-soft" strokeWidth={1.75} />
            <span className={step.tool.name === "—" ? "text-ink-faint" : ""}>
              {toolLabel(step.tool.name)}
            </span>
          </span>
        </Field>
        {step.input && <Field label="Input">{step.input}</Field>}
        {step.action && <Field label="Action">{step.action}</Field>}
        {step.output && <Field label="Output">{step.output}</Field>}

        <span className={cn("mt-4 inline-flex items-center gap-1.5 self-start rounded-chip px-3 py-1.5 text-xs font-semibold", s.pill)}>
          <StatusIcon className="h-3.5 w-3.5" strokeWidth={2} />
          {s.label}
        </span>
      </button>

      {step.note && (
        <p className="mt-2 flex items-start gap-1.5 px-1 text-xs text-ink-soft">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={1.75} />
          {step.note}
        </p>
      )}
    </div>
  );
}

// The compiler emits "—" for a step whose tool it couldn't name. Render that as honest
// microcopy ("Not captured") rather than a bare dash — truthful and more readable.
export function toolLabel(name: string): string {
  return name === "—" ? "Not captured" : name;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <div className="text-xs font-medium text-ink-faint">{label}</div>
      <div className="mt-0.5 text-sm leading-snug text-ink">{children}</div>
    </div>
  );
}
