"use client";

/**
 * Pagination — Figma node 7:67. Compact prev/next + numeric page control,
 * 32px targets, selected page uses accent fill. Reused wherever a paginated
 * list needs page controls (first consumer: Findings list, M04).
 *
 * Keeps the page-number window small (max 5 numbers around the current
 * page) so it stays readable regardless of totalPages; always shows
 * prev/next controls, disabled at the bounds.
 */
export function Pagination({
  page,
  totalPages,
  onPageChange,
  disabled = false,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  const clampedTotal = Math.max(totalPages, 1);

  const pageNumbers = getPageWindow(page, clampedTotal);

  return (
    <nav aria-label="Pagination" className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Previous page"
        onClick={() => onPageChange(page - 1)}
        disabled={disabled || page <= 1}
        className="flex size-8 items-center justify-center rounded-small text-sm text-fg-default hover:bg-canvas-subtle disabled:cursor-not-allowed disabled:opacity-40"
      >
        ‹
      </button>
      {pageNumbers.map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`Page ${n}`}
          aria-current={n === page ? "page" : undefined}
          onClick={() => onPageChange(n)}
          disabled={disabled}
          className={`flex size-8 items-center justify-center rounded-small text-sm disabled:cursor-not-allowed ${
            n === page
              ? "bg-accent-emphasis font-medium text-white"
              : "text-fg-default hover:bg-canvas-subtle"
          }`}
        >
          {n}
        </button>
      ))}
      <button
        type="button"
        aria-label="Next page"
        onClick={() => onPageChange(page + 1)}
        disabled={disabled || page >= clampedTotal}
        className="flex size-8 items-center justify-center rounded-small text-sm text-fg-default hover:bg-canvas-subtle disabled:cursor-not-allowed disabled:opacity-40"
      >
        ›
      </button>
    </nav>
  );
}

function getPageWindow(page: number, totalPages: number, windowSize = 5): number[] {
  if (totalPages <= windowSize) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  const end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}
