/**
 * Public legal contact address and operator identity helpers.
 * Obfuscated at runtime to prevent automated email harvesting and scraper bots.
 */

// Obfuscated char codes for contact email
const CONTACT_EMAIL_CHARS = [97, 115, 114, 105, 110, 107, 108, 99, 99, 64, 115, 101, 108, 121, 46, 116, 114];

// Obfuscated char codes for operator name
const OPERATOR_NAME_CHARS = [65, 115, 114, 305, 110, 32, 75, 305, 108, 305, 231];

export function getDecodedContactEmail(): string {
  if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_PUBLIC_CONTACT_EMAIL) {
    return import.meta.env.VITE_PUBLIC_CONTACT_EMAIL;
  }
  return String.fromCharCode(...CONTACT_EMAIL_CHARS);
}

export function getDecodedOperatorName(): string {
  return String.fromCharCode(...OPERATOR_NAME_CHARS);
}

export const publicContactEmail = getDecodedContactEmail();
