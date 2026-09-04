import React from 'react';
import { AlertCircle, Inbox, Loader2 } from 'lucide-react';
import { BookingStatus, PaymentStatus, STATUS_LABELS } from '../../types';

/** Tiny className joiner — avoids pulling in clsx for this. */
export function cn(...parts: Array<string | false | null | undefined>): string {
    return parts.filter(Boolean).join(' ');
}

export const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({
    className,
    children,
}) => (
    <div
        className={cn(
            'bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden',
            className
        )}
    >
        {children}
    </div>
);

export const PageHeader: React.FC<{
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
}> = ({ title, subtitle, action }) => (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{title}</h1>
            {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {action}
    </div>
);

const STATUS_STYLES: Record<BookingStatus, string> = {
    PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
    CONFIRMED: 'bg-blue-50 text-blue-700 border-blue-200',
    ON_SITE: 'bg-violet-50 text-violet-700 border-violet-200',
    COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    CANCELLED: 'bg-slate-100 text-slate-500 border-slate-200',
};

export const StatusBadge: React.FC<{ status: BookingStatus }> = ({ status }) => (
    <span
        className={cn(
            'inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-semibold whitespace-nowrap',
            STATUS_STYLES[status]
        )}
    >
        {STATUS_LABELS[status]}
    </span>
);

const PAYMENT_STYLES: Record<PaymentStatus, string> = {
    PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    PARTIAL: 'bg-amber-50 text-amber-700 border-amber-200',
    UNPAID: 'bg-rose-50 text-rose-700 border-rose-200',
};

export const PaymentBadge: React.FC<{ status: PaymentStatus }> = ({ status }) => (
    <span
        className={cn(
            'inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-semibold',
            PAYMENT_STYLES[status]
        )}
    >
        {status === 'PARTIAL' ? 'Partial' : status === 'PAID' ? 'Paid' : 'Unpaid'}
    </span>
);

export const Spinner: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="mt-2 text-sm">{label}</p>
    </div>
);

/**
 * Error state. Takes the normalised `Error` from the api client, so the real
 * server message is shown instead of a generic "connection failed".
 */
export const ErrorState: React.FC<{ error: unknown; onRetry?: () => void }> = ({
    error,
    onRetry,
}) => (
    <Card className="p-6">
        <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="flex-1">
                <p className="text-sm font-semibold text-slate-800">Something went wrong</p>
                <p className="text-sm text-slate-500 mt-0.5">
                    {error instanceof Error ? error.message : 'Unexpected error.'}
                </p>
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="mt-3 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                    >
                        Try again
                    </button>
                )}
            </div>
        </div>
    </Card>
);

export const EmptyState: React.FC<{
    title: string;
    message?: string;
    action?: React.ReactNode;
}> = ({ title, message, action }) => (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
            <Inbox className="w-6 h-6 text-slate-400" />
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-700">{title}</p>
        {message && <p className="mt-1 text-sm text-slate-500 max-w-sm">{message}</p>}
        {action && <div className="mt-4">{action}</div>}
    </div>
);

/** Primary/secondary/danger button with consistent sizing. */
export const Button: React.FC<
    React.ButtonHTMLAttributes<HTMLButtonElement> & {
        variant?: 'primary' | 'secondary' | 'danger';
        loading?: boolean;
    }
> = ({ variant = 'primary', loading, className, children, disabled, ...rest }) => {
    const styles = {
        primary: 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-300',
        secondary:
            'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 disabled:text-slate-400',
        danger: 'bg-rose-600 hover:bg-rose-700 text-white disabled:bg-rose-300',
    }[variant];

    return (
        <button
            {...rest}
            disabled={disabled || loading}
            className={cn(
                'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition disabled:cursor-not-allowed',
                styles,
                className
            )}
        >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : children}
        </button>
    );
};

/** Labelled input/select wrapper so forms stay visually consistent. */
export const Field: React.FC<{
    label: string;
    htmlFor?: string;
    hint?: string;
    children: React.ReactNode;
}> = ({ label, htmlFor, hint, children }) => (
    <div className="space-y-1.5">
        <label
            htmlFor={htmlFor}
            className="block text-xs font-semibold text-slate-500 uppercase tracking-wide"
        >
            {label}
        </label>
        {children}
        {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
);

export const inputClass =
    'w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition disabled:bg-slate-100 disabled:text-slate-400';
