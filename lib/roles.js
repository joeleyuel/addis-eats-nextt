// Role helpers with NO imports, so the server (lib/, pages, handlers) and the client
// (SiteHeader) read the same definition.
//
//   customer  anyone who signs in with a name and a phone number
//   staff     kitchen + dashboard (listed in STAFF_PHONES; sign-in is by phone number alone)
//   admin     everything staff can do, plus the /admin console. Granted ONLY by the separate
//             admin sign-in (/admin/signin), which also needs the secret ADMIN_ACCESS_CODE.
//             The normal sign-in can never produce it. See ADMIN.md.
export const ROLES = ["customer", "staff", "admin"];

export const isStaffRole = (role) => role === "staff" || role === "admin";
export const isAdminRole = (role) => role === "admin";
