/**
 * Public legal contact address.
 * Reads VITE_PUBLIC_CONTACT_EMAIL from environment variables if set,
 * or defaults to generic placeholder for public release.
 */
export const publicContactEmail =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_PUBLIC_CONTACT_EMAIL) ||
  "your-email@example.com";
