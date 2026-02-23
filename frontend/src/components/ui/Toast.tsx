import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, Loader2 } from 'lucide-react';
import { cn } from '../utils/cn';

interface ToastProps {
  id: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onClose?: (id: string) => void;
  className?: string;
}

const Toast: React.FC<ToastProps> = ({
  id,
  message,
  type = 'info',
  duration = 3000,
  onClose,
  className,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(() => {
        setIsVisible(false);
        onClose?.(id);
      }, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, id, onClose]);

  if (!isVisible) return null;

  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertCircle,
    info: Info,
  };

  const Icon = icons[type] || Info;

  return (
    <div
      className={cn(
        'fixed top-4 right-4 z-50 w-80 max-w-sm pointer-events-auto',
        isLeaving && 'animate-fade-out',
        className
      )}
    >
      <div
        className={cn(
          'flex items-center p-4 rounded-xl transition-all duration-300 shadow-raised group',
          type === 'success' && 'bg-emerald-50 border border-emerald-200 text-emerald-700',
          type === 'error' && 'bg-rose-50 border border-rose-200 text-rose-700',
          type === 'warning' && 'bg-amber-50 border border-amber-200 text-amber-700',
          type === 'info' && 'bg-blue-50 border border-blue-200 text-blue-700',
          isLeaving && 'opacity-0'
        )}
      >
        <div className="flex-shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 ml-3 min-w-0">
          <p className="text-sm font-medium truncate">{message}</p>
        </div>
        <button
          onClick={() => {
            setIsLeaving(true);
            setTimeout(() => {
              setIsVisible(false);
              onClose?.(id);
            }, 300);
          }}
          className="ml-4 p-1 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Toast;