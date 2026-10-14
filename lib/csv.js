// CSV writing (Day 47: "the escaping is the whole problem"). Pure, no imports, so it
// runs in the route handler and in tests.
//
//  1. A cell containing a comma, a quotation mark or a newline is wrapped in quotes,
//     and quotation marks inside it are doubled (RFC 4180).
//  2. A TEXT cell starting with = + - @ (or a tab / carriage return) would be run as a
//     formula by Excel and Google Sheets — and names, addresses and delivery notes are
//     typed by customers. A leading apostrophe makes it plain text. Numbers are not
//     touched, so totals stay summable.
export function csvCell(value) {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers, rows) {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(","));
  return lines.join("\r\n") + "\r\n";
}
