import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: {
          default: "var(--color-canvas-default)",
          subtle: "var(--color-canvas-subtle)",
          inset: "var(--color-canvas-inset)",
        },
        border: {
          default: "var(--color-border-default)",
          muted: "var(--color-border-muted)",
        },
        fg: {
          default: "var(--color-fg-default)",
          muted: "var(--color-fg-muted)",
          subtle: "var(--color-fg-subtle)",
        },
        accent: {
          emphasis: "var(--color-accent-emphasis)",
          fg: "var(--color-accent-fg)",
          subtle: "var(--color-accent-subtle)",
        },
        success: {
          emphasis: "var(--color-success-emphasis)",
          fg: "var(--color-success-fg)",
          subtle: "var(--color-success-subtle)",
        },
        warning: {
          emphasis: "var(--color-warning-emphasis)",
          fg: "var(--color-warning-fg)",
          subtle: "var(--color-warning-subtle)",
        },
        danger: {
          emphasis: "var(--color-danger-emphasis)",
          fg: "var(--color-danger-fg)",
          subtle: "var(--color-danger-subtle)",
        },
        done: {
          emphasis: "var(--color-done-emphasis)",
          fg: "var(--color-done-fg)",
          subtle: "var(--color-done-subtle)",
        },
      },
      borderRadius: {
        small: "var(--radius-small)",
        medium: "var(--radius-medium)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
