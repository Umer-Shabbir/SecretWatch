"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

export function DeleteFilterDialog({
  open,
  filterPattern,
  onCancel,
  onConfirm,
  deleting,
}: {
  open: boolean;
  filterPattern: string;
  onCancel: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCancel();
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>("button:not(:disabled)");
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.4)] p-4">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-filter-title"
        aria-describedby="delete-filter-description"
        className="flex w-full max-w-[420px] flex-col gap-4 rounded-medium border border-border-default bg-canvas-default p-6 shadow-[0px_4px_8px_rgba(0,0,0,0.12)]"
      >
        <h2 id="delete-filter-title" className="text-base font-semibold leading-6 text-fg-default">
          Delete filter rule?
        </h2>
        <p id="delete-filter-description" className="text-sm text-fg-muted">
          <strong className="text-fg-default">{filterPattern}</strong> will be permanently deleted. This cannot be undone.
        </p>
        <div className="flex w-full items-start justify-end gap-2">
          <Button ref={cancelRef} variant="secondary" className="w-auto" onClick={onCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" className="w-auto" onClick={onConfirm} loading={deleting}>
            Delete Rule
          </Button>
        </div>
      </div>
    </div>
  );
}
