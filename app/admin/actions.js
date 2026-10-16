"use server";
// The admin sign-in. It is separate from the normal sign-in on purpose: the normal one needs
// no password, so it can never hand out the admin role. This one needs
//   - a phone number listed in ADMIN_PHONES, and
//   - the secret ADMIN_ACCESS_CODE,
// both read from the server's environment (see lib/admin-auth.js and ADMIN.md).
//
// Every failure — wrong code, a phone that is not an admin's, a badly formed field — redirects
// with the SAME message, so the form never tells a stranger which admin numbers exist. Repeated
// failures are slowed down per address and per phone number.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { startSession } from "@/lib/session";
import { adminConfig, adminLoginLimiter, clientIp, verifyAdminCredentials } from "@/lib/admin-auth";
import { normalizePhone, validateContact } from "@/lib/validate";
import { adminSignInUrl, safeAdminNext } from "@/lib/safe-next";

const text = (formData, key) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

export async function adminSignIn(formData) {
  const next = safeAdminNext(text(formData, "next")); // untrusted: validated here, not only on the page
  const fields = { name: text(formData, "name"), phone: text(formData, "phone") };
  const code = text(formData, "code");

  if (!adminConfig().enabled) redirect(adminSignInUrl(next, "off"));

  const ipKey = clientIp((name) => headers().get(name));
  const phoneKey = normalizePhone(fields.phone) || "none";
  if (adminLoginLimiter.ip.retryAfter(ipKey) > 0 || adminLoginLimiter.phone.retryAfter(phoneKey) > 0) {
    redirect(adminSignInUrl(next, "locked"));
  }

  const formOk = Object.keys(validateContact(fields)).length === 0;
  // verifyAdminCredentials runs even when the form is malformed, so timing is the same.
  const credentialsOk = verifyAdminCredentials({ phone: fields.phone, code });
  if (!formOk || !credentialsOk) {
    adminLoginLimiter.ip.fail(ipKey);
    adminLoginLimiter.phone.fail(phoneKey);
    redirect(adminSignInUrl(next, "invalid"));
  }

  adminLoginLimiter.ip.clear(ipKey);
  adminLoginLimiter.phone.clear(phoneKey);
  await startSession({ name: fields.name, phone: fields.phone }, { admin: true });
  redirect(next);
}
