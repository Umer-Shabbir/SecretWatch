import { Badge } from "@/components/ui/badge";

type FlagRowStatus = "FLAGGED" | "FAILED";

// Semantic mapping per DESIGN.md §16/23: FLAGGED→green (success), FAILED→red (error). Matches Figma Badge Status=Flagged (5:17) / Status=Failed (5:23).
const badgeStatusByFlagRowStatus: Record<FlagRowStatus, "success" | "error"> = {
  FLAGGED: "success",
  FAILED: "error",
};

/** Maps a Flags-list row status onto the shared Badge component's status variants. Text + color together, never color alone. */
export function FlagStatusBadge({ status }: { status: FlagRowStatus }) {
  return <Badge status={badgeStatusByFlagRowStatus[status]}>{status}</Badge>;
}
