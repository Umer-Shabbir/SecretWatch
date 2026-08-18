import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** String renders as visible field-level error text. `true` applies error styling only (no text) — use when a shared alert above the form already states the message. */
  error?: string | boolean;
}

/** Input — Figma node 5:10. State=Default / State=Error variants, 36px height. */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, className = "", ...props }, ref) => {
    const inputId = id ?? props.name;
    const errorText = typeof error === "string" ? error : undefined;
    const hasError = !!error;
    return (
      <div className="flex w-full flex-col gap-1.5">
        <label htmlFor={inputId} className="text-xs font-medium text-fg-default">
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={hasError}
          aria-describedby={errorText ? `${inputId}-error` : undefined}
          className={`h-9 w-full rounded-small border px-3 text-sm text-fg-default bg-canvas-default focus:outline-none focus:ring-2 focus:ring-accent-emphasis/40 ${
            hasError ? "border-danger-emphasis" : "border-border-default"
          } ${className}`}
          {...props}
        />
        {errorText && (
          <p id={`${inputId}-error`} className="text-xs text-danger-fg">
            {errorText}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
