import { describe, expect, it } from "vitest";
import {
  validateSafeUrl,
  isPrivateOrReservedIp,
  SsrfViolationError,
} from "../ssrf";

describe("isPrivateOrReservedIp", () => {
  it("detects loopback addresses", () => {
    expect(isPrivateOrReservedIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("127.255.255.254")).toBe(true);
  });

  it("detects RFC 1918 private IPv4 ranges", () => {
    expect(isPrivateOrReservedIp("10.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("10.255.255.255")).toBe(true);
    expect(isPrivateOrReservedIp("172.16.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("172.31.255.255")).toBe(true);
    expect(isPrivateOrReservedIp("192.168.1.1")).toBe(true);
    expect(isPrivateOrReservedIp("192.168.254.254")).toBe(true);
  });

  it("detects cloud metadata link-local address (169.254.169.254)", () => {
    expect(isPrivateOrReservedIp("169.254.169.254")).toBe(true);
    expect(isPrivateOrReservedIp("169.254.0.1")).toBe(true);
  });

  it("detects carrier-grade NAT, test nets, and broadcast addresses", () => {
    expect(isPrivateOrReservedIp("100.64.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("192.0.2.1")).toBe(true);
    expect(isPrivateOrReservedIp("198.51.100.1")).toBe(true);
    expect(isPrivateOrReservedIp("203.0.113.1")).toBe(true);
    expect(isPrivateOrReservedIp("255.255.255.255")).toBe(true);
  });

  it("allows public IPv4 addresses", () => {
    expect(isPrivateOrReservedIp("8.8.8.8")).toBe(false);
    expect(isPrivateOrReservedIp("1.1.1.1")).toBe(false);
    expect(isPrivateOrReservedIp("140.82.121.3")).toBe(false); // GitHub IP
  });
});

describe("isPrivateOrReservedIp IPv6", () => {
  it("detects loopback and unique local addresses", () => {
    expect(isPrivateOrReservedIp("::1")).toBe(true);
    expect(isPrivateOrReservedIp("fc00::1")).toBe(true);
    expect(isPrivateOrReservedIp("fd12:3456:789a:1::1")).toBe(true);
    expect(isPrivateOrReservedIp("fe80::1")).toBe(true);
  });

  it("detects IPv4-mapped IPv6 addresses for private ranges", () => {
    expect(isPrivateOrReservedIp("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("::ffff:169.254.169.254")).toBe(true);
    expect(isPrivateOrReservedIp("::ffff:10.0.0.1")).toBe(true);
  });

  it("allows public IPv6 addresses", () => {
    expect(isPrivateOrReservedIp("2607:f8b0:4005:805::200e")).toBe(false); // Google IPv6
  });
});

describe("isPrivateOrReservedIp routing", () => {
  it("correctly routes v4 and v6", () => {
    expect(isPrivateOrReservedIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("::1")).toBe(true);
    expect(isPrivateOrReservedIp("8.8.8.8")).toBe(false);
  });
});

describe("validateSafeUrl", () => {
  it("rejects invalid URL formats", async () => {
    await expect(validateSafeUrl("not-a-url")).rejects.toThrow(SsrfViolationError);
  });

  it("rejects dangerous schemes like file:, ftp:, gopher:", async () => {
    await expect(validateSafeUrl("file:///etc/passwd")).rejects.toThrow(SsrfViolationError);
    await expect(validateSafeUrl("ftp://example.com")).rejects.toThrow(SsrfViolationError);
    await expect(validateSafeUrl("gopher://127.0.0.1")).rejects.toThrow(SsrfViolationError);
  });

  it("rejects embedded credentials in URL", async () => {
    await expect(validateSafeUrl("https://admin:password@example.com/webhook")).rejects.toThrow(
      "URL cannot contain embedded credentials"
    );
  });

  it("rejects direct loopback and localhost URLs", async () => {
    await expect(validateSafeUrl("http://127.0.0.1:8000/webhook")).rejects.toThrow(SsrfViolationError);
    await expect(validateSafeUrl("http://localhost:3000/webhook")).rejects.toThrow(SsrfViolationError);
  });

  it("rejects cloud metadata endpoints", async () => {
    await expect(validateSafeUrl("http://169.254.169.254/latest/meta-data/")).rejects.toThrow(
      SsrfViolationError
    );
    await expect(validateSafeUrl("http://metadata.google.internal/computeMetadata/v1/")).rejects.toThrow(
      SsrfViolationError
    );
  });
});
