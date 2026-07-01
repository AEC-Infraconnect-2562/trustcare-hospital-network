import { createHash, randomUUID } from "node:crypto";
import type { JsonRecord, JsonValue } from "./types";

export function isoNow(): string {
  return new Date().toISOString();
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function stableStringify(value: unknown): string {
  if (value === undefined) return '"__undefined__"';
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
}

export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)).filter((item) => item !== undefined) as T;
  }
  if (!value || typeof value !== "object") return value;
  const cleaned: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (item === undefined) continue;
    cleaned[key] = stripUndefined(item);
  }
  return cleaned as T;
}

export function sha256(value: unknown): string {
  return createHash("sha256").update(typeof value === "string" ? value : stableStringify(value)).digest("hex");
}

export function compactId(prefix: string, value: unknown): string {
  return `${prefix}-${sha256(value).slice(0, 16)}`;
}

export function urnUuid(): string {
  return `urn:uuid:${randomUUID()}`;
}

export function asRecord(value: unknown): JsonRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as JsonRecord;
  return {};
}

export function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

export function stringValue(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

export function optionalString(value: unknown): string | undefined {
  const normalized = stringValue(value);
  return normalized ? normalized : undefined;
}

export function dateOnly(value: unknown): string | undefined {
  const text = stringValue(value);
  if (!text) return undefined;
  if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
}

export function dateTime(value: unknown): string | undefined {
  const text = stringValue(value);
  if (!text) return undefined;
  if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}T00:00:00.000Z`;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export function putJson(record: JsonRecord, path: string, value: JsonValue | undefined): void {
  if (value === undefined || value === "") return;
  const parts = path.split(".");
  let cursor: JsonRecord = record;
  for (const part of parts.slice(0, -1)) {
    const current = cursor[part];
    if (!current || typeof current !== "object" || Array.isArray(current)) cursor[part] = {};
    cursor = cursor[part] as JsonRecord;
  }
  cursor[parts[parts.length - 1]] = value;
}
