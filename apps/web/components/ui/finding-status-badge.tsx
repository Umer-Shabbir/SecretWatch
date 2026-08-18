import { Badge } from "@/components/ui/badge";

type FindingStatus = "PENDING" | "APPROVED" | "FLAGGED" | "IGNORED" | "FAILED";

// Semantic mapping per DESIGN.md §16: PENDING→yellow, APPROVED→blue, FLAGGED→green, IGNORED→gray, FAILED→red.
const badgeStatusByFindingStatus: Record<FindingStatus, "default" | "success" | "warning" | "error" | "done" | "accent"> = {
  PENDING: "warning",
  APPROVED: "accent",
  FLAGGED: "success",
  IGNORED: "default",
  FAILED: "error",
};

/** Maps a Finding.status value onto the shared Badge component's status variants. */
export function FindingStatusBadge({ status }: { status: FindingStatus }) {
  return <Badge status={badgeStatusByFindingStatus[status]}>{status}</Badge>;
}
