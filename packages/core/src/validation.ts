export const STUDENT_EMAIL_DOMAIN = 'virginia.edu';

/** True for name@virginia.edu (case-insensitive, trimmed). Subdomains like @alumni.virginia.edu are rejected. */
export function isStudentEmail(email: string): boolean {
  const clean = email.trim().toLowerCase();
  if (!isEmail(clean)) return false;
  return clean.slice(clean.lastIndexOf('@') + 1) === STUDENT_EMAIL_DOMAIN;
}

/** Basic email shape check for landlords and guarantors: one "@", non-empty local part, dotted domain, no spaces. */
export function isEmail(email: string): boolean {
  const clean = email.trim();
  if (/\s/.test(clean)) return false;
  const parts = clean.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts as [string, string];
  if (!local || !domain) return false;
  const labels = domain.split('.');
  return labels.length >= 2 && labels.every((l) => l.length > 0);
}
