import React, { useId } from "react";
import { AlertCircle, Inbox, Loader2 } from "lucide-react";
import { BookingStatus, PaymentStatus, STATUS_LABELS } from "../../types";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
export const Card = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => <div className={cn("panel", className)}>{children}</div>;
export const PageHeader = ({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) => (
  <div className="page-header">
    <div>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
    {action && <div className="page-actions">{action}</div>}
  </div>
);
export const StatusBadge = ({ status }: { status: BookingStatus }) => (
  <span className={`badge status-${status.toLowerCase()}`}>
    <i />
    {STATUS_LABELS[status]}
  </span>
);
export const PaymentBadge = ({ status }: { status: PaymentStatus }) => (
  <span className={`badge payment-${status.toLowerCase()}`}>
    <i />
    {status === "PARTIAL"
      ? "Partially paid"
      : status === "PAID"
        ? "Paid"
        : "Unpaid"}
  </span>
);
export const Spinner = ({ label = "Loading…" }: { label?: string }) => (
  <div className="empty-state" role="status">
    <Loader2 className="spin" size={24} />
    <p>{label}</p>
  </div>
);
export const ErrorState = ({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) => (
  <Card className="error-state">
    <AlertCircle size={22} />
    <div>
      <h3>We couldn’t load this view</h3>
      <p>{error instanceof Error ? error.message : "Please try again."}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  </Card>
);
export const EmptyState = ({
  title,
  message,
  action,
}: {
  title: string;
  message?: string;
  action?: React.ReactNode;
}) => (
  <div className="empty-state">
    <Inbox size={27} />
    <h3>{title}</h3>
    {message && <p>{message}</p>}
    {action}
  </div>
);
export const Button = ({
  variant = "primary",
  loading,
  className,
  children,
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
  loading?: boolean;
}) => (
  <button
    {...rest}
    disabled={disabled || loading}
    className={cn("btn", `btn-${variant}`, className)}
  >
    {loading && <Loader2 size={16} className="spin" />}
    {children}
  </button>
);
export const Field = ({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) => {
  const generatedId = useId();
  const child = React.isValidElement<{
    id?: string;
    "aria-describedby"?: string;
  }>(children)
    ? children
    : null;
  const id = htmlFor || child?.props.id || generatedId;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {child
        ? React.cloneElement(child, {
            id,
            ...(hint ? { "aria-describedby": `${id}-hint` } : {}),
          })
        : children}
      {hint && (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
    </div>
  );
};
export const inputClass = "field-input";
