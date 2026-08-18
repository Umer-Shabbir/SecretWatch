import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./format-relative-time";

describe("formatRelativeTime", () => {
  const now = new Date("2026-08-16T12:00:00.000Z");

  it("returns 'just now' for sub-minute durations", () => {
    expect(formatRelativeTime(new Date("2026-08-16T11:59:45.000Z"), now)).toBe("just now");
  });

  it("formats minutes", () => {
    expect(formatRelativeTime(new Date("2026-08-16T11:58:00.000Z"), now)).toBe("2m ago");
  });

  it("formats hours", () => {
    expect(formatRelativeTime(new Date("2026-08-16T09:00:00.000Z"), now)).toBe("3h ago");
  });

  it("formats days", () => {
    expect(formatRelativeTime(new Date("2026-08-13T12:00:00.000Z"), now)).toBe("3d ago");
  });

  it("clamps a future date to 'just now' instead of a negative duration", () => {
    expect(formatRelativeTime(new Date("2026-08-16T12:05:00.000Z"), now)).toBe("just now");
  });
});
