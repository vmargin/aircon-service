import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Shared modal shell. Previously each modal re-implemented its own overlay,
 * and none of them closed on Escape or restored body scroll.
 */
const Modal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    maxWidth?: 'sm' | 'md';
}> = ({ isOpen, onClose, title, subtitle, children, maxWidth = 'md' }) => {
    useEffect(() => {
        if (!isOpen) return;

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);

        // Stop the page behind the modal from scrolling.
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = previous;
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-4 overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-label={title}
        >
            <div className="fixed inset-0 bg-slate-900/50" onClick={onClose} />
            <div
                className={`relative w-full ${
                    maxWidth === 'sm' ? 'max-w-sm' : 'max-w-md'
                } my-auto bg-white rounded-2xl shadow-xl`}
            >
                <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
                    <div>
                        <h2 className="text-base font-bold text-slate-800">{title}</h2>
                        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="p-1.5 -mr-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                    >
                        <X className="w-4.5 h-4.5" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
};

export default Modal;
