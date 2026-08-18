import Image from "next/image";

/** Header — Figma node 7:34. Compact, product logo/breadcrumb left, search/theme/avatar right. Per DESIGN.md §11. */
export function Header({
  breadcrumb,
  userImage,
  userName,
}: {
  breadcrumb?: string;
  userImage?: string | null;
  userName?: string | null;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-default bg-canvas-default px-5">
      <div className="flex items-center gap-3">
        <span className="text-base font-semibold text-fg-default">SecretWatch</span>
        {breadcrumb && <span className="text-sm text-fg-muted">{breadcrumb}</span>}
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden h-8 w-[200px] items-center rounded-small border border-border-default bg-canvas-subtle px-2.5 sm:flex">
          <span className="text-[13px] text-fg-subtle">Search...</span>
        </div>
        <button
          type="button"
          aria-label="Toggle theme"
          className="flex size-8 items-center justify-center rounded-small border border-border-default bg-canvas-default text-fg-muted"
        >
          ◐
        </button>
        {userImage ? (
          <Image
            src={userImage}
            alt={userName ? `${userName} avatar` : "Account avatar"}
            width={32}
            height={32}
            className="size-8 rounded-full"
          />
        ) : (
          <span className="size-8 rounded-full bg-accent-subtle" aria-hidden="true" />
        )}
      </div>
    </header>
  );
}
