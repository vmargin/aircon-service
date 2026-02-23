import React from 'react';
import { cn } from '../utils/cn';

interface StatusBadgeProps {
  status: 'PENDING' | 'CONFIRMED' | 'ON_SITE' | 'COMPLETED' | 'CANCELLED' | 'UNPAID' | 'PARTIAL' | 'PAID';
  className?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const statusColors = {
    PENDING: {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
      icon: ''
    },
    CONFIRMED: {
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
      icon: ''
    },
    ON_SITE: {
      bg: 'bg-indigo-50',
      text: 'text-indigo-700',
      border: 'border-indigo-200',
      icon: ''
    },
    COMPLETED: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      icon: ''
    },
    CANCELLED: {
      bg: 'bg-slate-50',
      text: 'text-slate-700',
      border: 'border-slate-200',
      icon: ''
    },
    UNPAID: {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
      icon: ''
    },
    PARTIAL: {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
      icon: ''
    },
    PAID: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      icon: ''
    },
  };

  const colors = statusColors[status] || statusColors.PENDING;

  return (
    <span
      className={cn(
        'px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all duration-200 whitespace-nowrap inline-flex items-center gap-1',
        colors.bg,
        colors.text,
        colors.border,
        className
      )}
    >
      {colors.icon}
      {status.replace('_', ' ')}
    </span>
  );
};

export default StatusBadge;