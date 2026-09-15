export interface WebhookEndpointSummary {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type WebhookEventType =
  | "finding.created"
  | "finding.approved"
  | "finding.flagged"
  | "flag.failed";

export const ALL_WEBHOOK_EVENTS: { type: WebhookEventType; label: string; description: string }[] = [
  {
    type: "finding.created",
    label: "Finding Created",
    description: "Triggered when the scanner detects a new secret finding.",
  },
  {
    type: "finding.approved",
    label: "Finding Approved",
    description: "Triggered when a finding is approved manually or via auto-approve.",
  },
  {
    type: "finding.flagged",
    label: "Finding Flagged (Issue Created)",
    description: "Triggered when the flagger creates a GitHub issue for an approved finding.",
  },
  {
    type: "flag.failed",
    label: "Flag Failed",
    description: "Triggered when issue creation encounters an error or rate limit.",
  },
];
