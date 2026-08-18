/** Formats a Date as an absolute short date ("Aug 15, 2026"), matching Figma's "Created Aug 15, 2026" rule-row copy. */
export function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
