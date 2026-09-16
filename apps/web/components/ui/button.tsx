import { ButtonHTMLAttributes, forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "destructive";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-accent-emphasis text-white hover:opacity-90 disabled:opacity-50",
  secondary:
    "bg-canvas-default text-fg-default border border-border-default hover:bg-canvas-subtle disabled:opacity-50",
  destructive:
    "bg-danger-emphasis text-white hover:opacity-90 disabled:opacity-50",
};

/** Button — Figma node 4:50. Primary/Secondary/Destructive variants (4:2/4:14/4:26), Medium size (36px height). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", loading, disabled, className = "", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`h-9 w-full rounded-small px-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${variantClasses[variant]} ${className}`}
        {...props}
      >
        {loading && (
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current"
          />
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
