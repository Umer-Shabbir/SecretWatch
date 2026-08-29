"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

/**
 * Confirm Approve dialog — Figma node 42:848 (Admin / Review Queue / Confirm
 * Approve), instancing Dialog=Confirmation (7:2). Shared between M05's
 * Finding Detail screen and M06's Review Queue (components/admin/review-queue-client.tsx),
 * per M06's doc comment: "reuses ConfirmApproveDialog, same component M05's
 * Finding Detail already uses." No shared Dialog component exists in
 * components/ui yet, so this follows the same local-composition precedent
 * as components/admin/disable-rule-dialog.tsx (accessible modal: scrim,
 * role="alertdialog", focus trap, Escape to close, focus restored to the
 * trigger by the caller).
 *
 * Approving a finding is the trigger for M07's flagger worker to later open
 * a GitHub issue via an authorized token — a real, semi-irreversible
 * action (an issue gets posted on a third-party repo), so unlike Ignore
 * (a plain one-click action) this is gated behind confirmation, matching
 * Figma's dedicated Confirm Approve frame.
 */
export function ConfirmApproveDialog({
  open,
  approving,
  count = 1,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  approving: boolean;
  count?: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();

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
        aria-labelledby="confirm-approve-title"
        aria-describedby="confirm-approve-description"
        className="flex w-full max-w-[420px] flex-col gap-4 rounded-medium border border-border-default bg-canvas-default p-6 shadow-[0px_4px_8px_rgba(0,0,0,0.12)]"
      >
        <h2 id="confirm-approve-title" className="text-base font-semibold leading-6 text-fg-default">
          Approve {count === 1 ? "this finding" : `these ${count} findings`}?
        </h2>
        <p id="confirm-approve-description" className="text-sm text-fg-muted">
          Approving flags {count === 1 ? "this finding" : "these findings"} for a GitHub issue to be opened on the affected repository using an
          authorized token. This action cannot be undone.
        </p>
        <div className="flex w-full items-start justify-end gap-2">
          <Button ref={confirmRef} variant="secondary" className="w-auto" onClick={onCancel} disabled={approving}>
            Cancel
          </Button>
          <Button variant="primary" className="w-auto" onClick={onConfirm} loading={approving}>
            Approve &amp; Flag
          </Button>
        </div>
      </div>
    </div>
  );
}
