import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import {
  X,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  ArrowUpRight,
} from "lucide-react";
import type { Evaluation, Issue } from "./types";
import { termLabel } from "./api";

export function Button({
  children,
  variant = "primary",
  busy = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={`button ${variant} ${props.className || ""}`}
    >
      {busy ? <Loader2 size={16} className="spin" /> : null}
      {children}
    </button>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Info size={24} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    const cancel = (e: Event) => {
      e.preventDefault();
      closeRef.current();
    };
    d.addEventListener("cancel", cancel);
    return () => {
      d.removeEventListener("cancel", cancel);
      d.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Issues({
  issues,
  compact = false,
}: {
  issues: Issue[];
  compact?: boolean;
}) {
  if (!issues.length)
    return (
      <div className="inline-success">
        <CheckCircle2 size={18} />
        <div>
          <strong>All academic checks passed</strong>
          <span>
            Prerequisites, credit limits, offerings and timetables are
            consistent.
          </span>
        </div>
      </div>
    );
  return (
    <div className={`issues ${compact ? "compact" : ""}`}>
      {issues.map((i, index) => (
        <div className={`issue ${i.severity.toLowerCase()}`} key={index}>
          {i.severity === "ERROR" ? (
            <AlertTriangle size={17} />
          ) : (
            <Info size={17} />
          )}
          <div>
            <strong>{i.code.replaceAll("_", " ").toLowerCase()}</strong>
            <p>{i.message}</p>
            {i.term && (
              <small>
                {termLabel(i.term)}
                {i.courseCode ? ` · ${i.courseCode}` : ""}
              </small>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
export function Progress({
  value,
  max,
  planned = 0,
}: {
  value: number;
  max: number;
  planned?: number;
}) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label="Earned credits"
    >
      <span
        style={{
          width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%`,
        }}
      />
      {planned > 0 && max > 0 && (
        <span
          className="planned-progress"
          style={{
            width: `${Math.min(100 - (value / max) * 100, (planned / max) * 100)}%`,
          }}
        />
      )}
    </div>
  );
}
export function EvaluationSummary({
  evaluation,
  baseline,
}: {
  evaluation: Evaluation;
  baseline?: Evaluation;
}) {
  const errors = evaluation.issues.filter((i) => i.severity === "ERROR").length;
  return (
    <div className="evaluation-summary">
      <div>
        <span className="label">Graduation estimate</span>
        <h3>{termLabel(evaluation.graduation)}</h3>
        <p>
          {evaluation.graduation
            ? "Assuming all future courses are passed and remain available."
            : evaluation.valid
              ? "Schedule all degree requirements to get a finish estimate."
              : "Resolve academic errors to confirm a finish estimate."}
        </p>
      </div>
      <div className="summary-status">
        <Badge tone={errors ? "red" : evaluation.complete ? "green" : "amber"}>
          {errors
            ? `${errors} academic issue${errors === 1 ? "" : "s"}`
            : evaluation.complete
              ? "Valid & complete"
              : "Incomplete path"}
        </Badge>
        {evaluation.targetStatus === "AFTER_TARGET" && (
          <Badge tone="amber">After your target</Badge>
        )}
        {evaluation.targetStatus === "ON_TRACK" && (
          <Badge tone="green">Within your target</Badge>
        )}
        {baseline && baseline.graduation !== evaluation.graduation && (
          <p className="change">
            Saved estimate: {termLabel(baseline.graduation)}{" "}
            <ArrowUpRight size={13} />
          </p>
        )}
      </div>
    </div>
  );
}
