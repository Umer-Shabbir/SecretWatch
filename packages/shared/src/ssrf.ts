import dns from "dns/promises";

// Common blocked hostnames and TLDs
const BLOCKED_DOMAINS = [
  "localhost",
  ".localhost",
  ".local",
  ".internal",
  ".lan",
  ".home.arpa",
  ".corp",
  ".onion",
  // Cloud metadata endpoint hostnames
  "metadata.google.internal",
  "instance-data"
];

function isBlockedDomain(hostname: string): boolean {
  const h = hostname.toLowerCase();
  for (const block of BLOCKED_DOMAINS) {
    if (block.startsWith(".") && h.endsWith(block)) return true;
    if (h === block) return true;
  }
  return false;
}

export function isPrivateIPv4(ipStr: string): boolean {
  const parts = ipStr.split(".");
  if (parts.length !== 4) return false;
  const num = parts.map(p => Number(p));
  if (num.some(n => isNaN(n) || n < 0 || n > 255)) return false;
  
  const ip = (((num[0] << 24) | (num[1] << 16) | (num[2] << 8) | num[3]) >>> 0);
  
  if ((ip & 0xFF000000) >>> 0 === 0) return true;
  if ((ip & 0xFF000000) >>> 0 === (10 << 24) >>> 0) return true;
  if ((ip & 0xFFC00000) >>> 0 === (((100 << 24) | (64 << 16)) >>> 0)) return true;
  if ((ip & 0xFF000000) >>> 0 === (127 << 24) >>> 0) return true;
  if ((ip & 0xFFFF0000) >>> 0 === (((169 << 24) | (254 << 16)) >>> 0)) return true;
  if ((ip & 0xFFF00000) >>> 0 === (((172 << 24) | (16 << 16)) >>> 0)) return true;
  if ((ip & 0xFFFFFF00) >>> 0 === (((192 << 24) | (0 << 16) | (0 << 8)) >>> 0)) return true;
  if ((ip & 0xFFFFFF00) >>> 0 === (((192 << 24) | (0 << 16) | (2 << 8)) >>> 0)) return true;
  if ((ip & 0xFFFFFF00) >>> 0 === (((192 << 24) | (88 << 16) | (99 << 8)) >>> 0)) return true;
  if ((ip & 0xFFFF0000) >>> 0 === (((192 << 24) | (168 << 16)) >>> 0)) return true;
  if ((ip & 0xFFFE0000) >>> 0 === (((198 << 24) | (18 << 16)) >>> 0)) return true;
  if ((ip & 0xFFFFFF00) >>> 0 === (((198 << 24) | (51 << 16) | (100 << 8)) >>> 0)) return true;
  if ((ip & 0xFFFFFF00) >>> 0 === (((203 << 24) | (0 << 16) | (113 << 8)) >>> 0)) return true;
  if ((ip & 0xF0000000) >>> 0 === ((224 << 24) >>> 0)) return true;
  if ((ip & 0xF0000000) >>> 0 === ((240 << 24) >>> 0)) return true;
  if (ip === 0xFFFFFFFF) return true;

  return false;
}

export function parseIPv6(ipStr: string): number[] | null {
  let ip = ipStr.startsWith("[") && ipStr.endsWith("]") ? ipStr.slice(1, -1) : ipStr;
  
  if (ip.includes(".")) {
    const lastColon = ip.lastIndexOf(":");
    if (lastColon === -1) return null;
    const ipv4Part = ip.slice(lastColon + 1);
    const prefix = ip.slice(0, lastColon);
    const parts = ipv4Part.split(".");
    if (parts.length !== 4) return null;
    const num = parts.map(p => Number(p));
    if (num.some(n => isNaN(n) || n < 0 || n > 255)) return null;
    const hex1 = ((num[0] << 8) | num[1]).toString(16);
    const hex2 = ((num[2] << 8) | num[3]).toString(16);
    ip = prefix + ":" + hex1 + ":" + hex2;
  }
  
  const doubleColonIndex = ip.indexOf("::");
  let segments: string[] = [];
  if (doubleColonIndex !== -1) {
    const left = ip.slice(0, doubleColonIndex).split(":").filter(Boolean);
    const right = ip.slice(doubleColonIndex + 2).split(":").filter(Boolean);
    const missing = 8 - (left.length + right.length);
    if (missing < 0) return null;
    segments = [...left, ...Array.from({ length: missing }).fill("0") as string[], ...right];
  } else {
    segments = ip.split(":");
  }
  
  if (segments.length !== 8) return null;
  const words = segments.map(s => parseInt(s, 16));
  if (words.some(w => isNaN(w) || w < 0 || w > 0xffff)) return null;
  return words;
}

export function isPrivateIPv6(ipStr: string): boolean {
  const words = parseIPv6(ipStr);
  if (!words) return false;
  
  if (words.every(w => w === 0)) return true;
  if (words.slice(0, 7).every(w => w === 0) && words[7] === 1) return true;
  
  if (words.slice(0, 5).every(w => w === 0) && words[5] === 0xffff) {
    const ipv4Num = ((words[6] << 16) | words[7]) >>> 0;
    const p1 = (ipv4Num >>> 24) & 0xff;
    const p2 = (ipv4Num >>> 16) & 0xff;
    const p3 = (ipv4Num >>> 8) & 0xff;
    const p4 = ipv4Num & 0xff;
    return isPrivateIPv4(`${p1}.${p2}.${p3}.${p4}`);
  }
  
  if (words[0] === 0x0064 && words[1] === 0xff9b && words.slice(2, 6).every(w => w === 0)) return true;
  if (words[0] === 0x0100 && words.slice(1, 4).every(w => w === 0)) return true;
  if (words[0] === 0x2001 && words[1] === 0x0db8) return true;
  if (words[0] === 0x2001 && (words[1] & 0xfff0) === 0x0010) return true;
  if (words[0] === 0x2002) return true;
  if ((words[0] & 0xfe00) === 0xfc00) return true;
  if ((words[0] & 0xffc0) === 0xfe80) return true;
  if ((words[0] & 0xff00) === 0xff00) return true;
  
  return false;
}

export function isPrivateIP(ip: string): boolean {
  if (ip.includes(":")) return isPrivateIPv6(ip);
  return isPrivateIPv4(ip);
}

export const isPrivateOrReservedIp = isPrivateIP;

export class SSRFValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SSRFValidationError";
  }
}

export const SsrfViolationError = SSRFValidationError;

export function validateWebhookUrlSync(urlString: string): void {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new SSRFValidationError("Invalid URL format.");
  }
  
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SSRFValidationError("Invalid protocol. Only http and https are permitted.");
  }
  
  if (parsed.username || parsed.password) {
    throw new SSRFValidationError("URL cannot contain embedded credentials");
  }
  
  if (isBlockedDomain(parsed.hostname)) {
    throw new SSRFValidationError(`Hostname ${parsed.hostname} is blocklisted.`);
  }

  if (isPrivateIP(parsed.hostname)) {
    throw new SSRFValidationError(`Target IP address is not permitted.`);
  }
}

export async function assertSafeWebhookUrlAsync(urlString: string): Promise<URL> {
  validateWebhookUrlSync(urlString);
  
  const parsed = new URL(urlString);
  const hostForDns = parsed.hostname.startsWith("[") 
    ? parsed.hostname.slice(1, -1) 
    : parsed.hostname;

  let records: { address: string; family: number }[] = [];
  try {
    records = await dns.lookup(hostForDns, { all: true });
  } catch (err) {
    throw new SSRFValidationError("Could not resolve DNS for the webhook URL.");
  }
  
  if (!records || records.length === 0) {
    throw new SSRFValidationError("No IP addresses found for hostname.");
  }
  
  for (const record of records) {
    if (isPrivateIP(record.address)) {
      throw new SSRFValidationError(`DNS resolved to a prohibited internal IP address: ${record.address}`);
    }
  }

  return parsed;
}

export const validateSafeUrl = assertSafeWebhookUrlAsync;

export async function safeWebhookFetch(urlString: string, options?: RequestInit): Promise<Response> {
  await assertSafeWebhookUrlAsync(urlString);
  return fetch(urlString, {
    ...options,
    redirect: "error"
  });
}
