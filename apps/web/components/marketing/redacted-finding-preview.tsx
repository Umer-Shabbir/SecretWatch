/**
 * Redacted finding preview — the marketing "product preview" (M12 Landing frame
 * 53:2013). Mirrors the real finding card (DESIGN.md §16–18) but is static
 * illustrative content.
 *
 * SECURITY: this is a redacted example only. Per DESIGN.md §17 and the project
 * security rules, a raw secret must never appear anywhere — the value uses the
 * exact redaction pattern (AKIA••••••••••9F3) from DESIGN.md §18.
 */
export function RedactedFindingPreview() {
  return (
    <div className="overflow-hidden rounded-medium border border-border-default bg-canvas-default text-left shadow-sm">
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-border-default bg-canvas-subtle px-4 py-2.5">
        <span aria-hidden="true" className="size-3 rounded-full bg-danger-emphasis/70" />
        <span aria-hidden="true" className="size-3 rounded-full bg-warning-emphasis/70" />
        <span aria-hidden="true" className="size-3 rounded-full bg-success-emphasis/70" />
        <span className="ml-2 font-mono text-xs text-fg-muted">findings / detail</span>
      </div>

      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-sm text-fg-default">acme-corp/payments-api</p>
            <p className="font-mono text-xs text-fg-muted">src/config/aws.js · line 42</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-warning-emphasis/30 bg-warning-subtle px-2.5 py-1 text-xs font-medium text-warning-fg">
            <span aria-hidden="true">●</span> Pending review
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
            Matched rule
          </span>
          <span className="text-sm text-fg-default">AWS Access Key ID</span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
            Redacted evidence
          </span>
          <pre className="overflow-x-auto rounded-small border border-border-default bg-canvas-inset px-3 py-2">
            <code className="font-mono text-sm text-fg-default">
              const AWS_ACCESS_KEY = &quot;AKIA••••••••••9F3&quot;;
            </code>
          </pre>
          <span className="text-xs text-fg-muted">
            Raw secret never stored, logged, or displayed.
          </span>
        </div>

        <div className="flex gap-2 pt-1">
          <span className="flex h-8 items-center rounded-small border border-border-default px-3 text-xs font-medium text-fg-default">
            Ignore
          </span>
          <span className="flex h-8 items-center rounded-small bg-accent-emphasis px-3 text-xs font-medium text-white">
            Approve &amp; flag
          </span>
        </div>
      </div>
    </div>
  );
}
