import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function toValidDate(input: string | Date) {
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

const addisTimeZone = "Africa/Addis_Ababa";

export function formatWesternAddisDateTime(input: string | Date) {
  const d = toValidDate(input);
  if (!d) return "Invalid date";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: addisTimeZone,
    weekday: "short",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function formatWesternAddisDate(input: string | Date) {
  const d = toValidDate(input);
  if (!d) return "Invalid date";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: addisTimeZone,
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(d);
}

export function formatWesternAddisTime(input: string | Date) {
  const d = toValidDate(input);
  if (!d) return "Invalid time";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: addisTimeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function formatEthiopianClockTime(input: string | Date) {
  const d = toValidDate(input);
  if (!d) return "Invalid date";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: addisTimeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const hourPart = parts.find((p) => p.type === "hour")?.value;
  const minutePart = parts.find((p) => p.type === "minute")?.value;

  const westernHour = hourPart ? parseInt(hourPart, 10) : NaN;
  const minute = minutePart ? parseInt(minutePart, 10) : NaN;

  if (Number.isNaN(westernHour) || Number.isNaN(minute)) return "Invalid date";

  const ethiopianHour24 = (westernHour + 24 - 6) % 24;
  const ethiopianHour12 =
    ethiopianHour24 % 12 === 0 ? 12 : ethiopianHour24 % 12;
  const label = westernHour >= 6 && westernHour < 18 ? "day" : "night";

  const minuteStr = String(minute).padStart(2, "0");
  return `${ethiopianHour12}:${minuteStr} ${label}`;
}

export function formatDualTimeRange(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined
) {
  if (!start || !end) {
    return {
      western: "Not specified",
      ethiopian: "",
    };
  }

  return {
    western: `${formatWesternAddisDate(start)}, ${formatWesternAddisTime(
      start
    )} - ${formatWesternAddisTime(end)}`,
    ethiopian: "",
  };
}

export function formatSessionSummary(input: {
  occurrences?:
    | Array<{ startTime?: string | Date | null; endTime?: string | Date | null }>
    | null;
  startTime?: string | Date | null;
  endTime?: string | Date | null;
}) {
  const sessions =
    input.occurrences && input.occurrences.length
      ? input.occurrences
      : [
          {
            startTime: input.startTime,
            endTime: input.endTime,
          },
        ];

  const labels = sessions
    .map((session) =>
      formatDualTimeRange(session.startTime, session.endTime).western,
    )
    .filter((label) => label && label !== "Not specified");

  if (!labels.length) return "Time: Not specified";
  if (labels.length === 1) return `Time: ${labels[0]}`;
  return `Sessions: ${labels.join(" | ")}`;
}
