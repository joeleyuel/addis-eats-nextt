// The ONE formatting module (Day 47). Every price and every time in the app goes
// through here — no hand-built "1200.5 birr" and no unnamed time zone, which is what
// causes hydration mismatches between the server and the phone.
//
// Each formatter is built once and exported as an instance: creating an Intl
// formatter is expensive, calling one is not. Locale AND time zone are always named.
// EAT is UTC+3 all year with no daylight saving. Dates are stored as UTC timestamps
// (Date.now()) and converted here, at the edge.
const LOCALE = "en-ET";
const TIME_ZONE = "Africa/Addis_Ababa";

export const etb = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "ETB",
  maximumFractionDigits: 0,
});

export const when = new Intl.DateTimeFormat(LOCALE, {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: TIME_ZONE,
});

// A bare number, for a table column whose header already names the unit ("Total (ETB)").
// Same locale, so the digits match what etb prints — it just drops the repeated "ETB".
export const birr = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });

// The two halves of `when`, so a narrow table can stack the date over the time.
export const whenDate = new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium", timeZone: TIME_ZONE });
export const whenTime = new Intl.DateTimeFormat(LOCALE, { timeStyle: "short", timeZone: TIME_ZONE });

// "13 Oct" — chart axis labels and table rows for a calendar day.
export const dayLabel = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "short",
  timeZone: TIME_ZONE,
});

// "2026-10-13" — a sortable key for "which Addis Ababa day is this moment in?".
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: TIME_ZONE,
});

const relativeFormat = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function dayKey(timestamp) {
  return dayKeyFormat.format(new Date(timestamp));
}

// "12 minutes ago", "in 2 hours", "yesterday".
export function relative(timestamp, now = Date.now()) {
  const seconds = Math.round((timestamp - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return relativeFormat.format(seconds, "second");
  if (abs < 3600) return relativeFormat.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return relativeFormat.format(Math.round(seconds / 3600), "hour");
  return relativeFormat.format(Math.round(seconds / 86400), "day");
}

// Kept for the call sites written on Day 35: same name, now backed by `etb`
// ("ETB 1,528"). A non-number is shown as zero rather than "NaN".
export function formatETB(amount) {
  return etb.format(Number.isFinite(amount) ? amount : 0);
}

export function formatWhen(timestamp) {
  return when.format(new Date(timestamp));
}
