// Intentionally public identity used by the site UI. Edit only these two plain-text
// values; audit:public permits one occurrence here and flags copies/obfuscation elsewhere.
const PUBLIC_CONTACT_EMAIL = "asrinklcc@sely.tr";
const PUBLIC_OPERATOR_NAME = "Asrın Kılıç";

export function getPublicContactEmail(): string {
  return PUBLIC_CONTACT_EMAIL;
}

export function getPublicOperatorName(): string {
  return PUBLIC_OPERATOR_NAME;
}

export function getProtectedContactLabel(locale: string): string {
  return locale === "en" ? "Open email contact" : "E-posta ile iletişim";
}

export const publicContactEmail = getPublicContactEmail();
