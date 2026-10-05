import type { QueryClient } from "@tanstack/react-query";
export { getAllList as getAll } from "./api";
export { formatDate as manilaDate } from "./api";

export function invalidateOperations(client: QueryClient) {
  for (const key of [
    "bookings",
    "invoices",
    "overview",
    "units",
    "inventory",
    "activity",
    "reports",
    "global-search",
    "customers",
  ]) {
    void client.invalidateQueries({ queryKey: [key] });
  }
}

export function manilaDay(value: string | Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function manilaInput(value: string | Date = new Date()): string {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function scheduleIso(local: string): string {
  return new Date(`${local}:00+08:00`).toISOString();
}
export function jobNumber(id: string): string {
  return `WO-${id.slice(-8).toUpperCase()}`;
}
export function isOpenJob(status: string): boolean {
  return status !== "COMPLETED" && status !== "CANCELLED";
}
