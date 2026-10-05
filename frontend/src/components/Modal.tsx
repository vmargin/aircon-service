import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
const Modal = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = "md",
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg";
}) => {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    if (!isOpen || !dialog) return;
    const active = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!dialog.open) dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previous;
      active?.focus();
    };
  }, [isOpen]);
  if (!isOpen) return null;
  return (
    <dialog
      ref={ref}
      className={`arctic-modal modal-${maxWidth}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        closeRef.current();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeRef.current();
      }}
    >
      <div className="modal-content">
        <header className="modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={19} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
};
export default Modal;
