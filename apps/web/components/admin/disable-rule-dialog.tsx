"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

/**
 * Disable Confirmation dialog — Figma node 51:269 (Admin / Scan Rules /
 * Disable Confirmation), instancing Dialog=Confirmation (7:2). No shared
 * Dialog component exists in components/ui yet, so this follows the same
 * local-composition precedent as components/findings/confirm-approve-dialog.tsx
 * and components/tokens/revoke-dialog.tsx (accessible modal: scrim,
 * role="alertdialog", focus trap, Escape to close, focus restored to the
 * trigger by the caller).
 *
 * Copy matches the Figma text exactly, with the rule name interpolated in
 * place of the "AWS Access Key" example per the task's explicit instruction.
 * Per scopeNotes in state/modules/M08.json, the primary action intentionally
 * uses the standard accent/blue Button (not Danger/red) — disabling a rule
 * is reversible and non-destructive to existing Finding data.
 */
export function DisableRuleDialog({
  open,
  ruleName,
  onCancel,
  onConfirm,
  disabling,
}: {
  open: boolean;
  ruleName: string;
  onCancel: () => void;
  onConfirm: () => void;
  disabling: boolean;
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
        aria-labelledby="disable-rule-title"
        aria-describedby="disable-rule-description"
        className="flex w-full max-w-[420px] flex-col gap-4 rounded-medium border border-border-default bg-canvas-default p-6 shadow-[0px_4px_8px_rgba(0,0,0,0.12)]"
      >
        <h2 id="disable-rule-title" className="text-base font-semibold leading-6 text-fg-default">
          Disable rule?
        </h2>
        <p id="disable-rule-description" className="text-sm text-fg-muted">
          {ruleName} will no longer be evaluated by the scanner. Existing findings from this rule are not affected.
        </p>
        <div className="flex w-full items-start justify-end gap-2">
          <Button ref={cancelRef} variant="secondary" className="w-auto" onClick={onCancel} disabled={disabling}>
            Cancel
          </Button>
          <Button variant="primary" className="w-auto" onClick={onConfirm} loading={disabling}>
            Disable Rule
          </Button>
        </div>
      </div>
    </div>
  );
}
