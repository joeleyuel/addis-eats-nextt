// What an admin LIST may show about a customer. Pure, no imports.
// Full phone numbers and street addresses appear only on a single order's detail page,
// where the person delivering the order needs them. Lists, search results and the
// customers table show the masked form.

// "0911234567" → "0911 ••• 567" (first four and last three digits). Anything that is not a
// plain digit string is reduced to its digits first; a short or empty value is fully masked.
export function maskPhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length < 8) return "•••";
  return `${digits.slice(0, 4)} ••• ${digits.slice(-3)}`;
}

// "Almaz Bekele" → "Almaz B." for narrow tables; a single name is returned as is.
export function shortName(value) {
  const parts = String(value ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}
