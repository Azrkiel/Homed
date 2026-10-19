import { isEmail, type ApplicantProfile, type ApplicantSensitive, type ID, type ISODate, type RentalHistoryEntry, type Reference } from '@homed/core';
import { localDate } from '../format';
import { isIsoDate } from './dates';
import { readField, type FormSource } from './form-input';

export const RENTAL_ROWS = 5;
export const REFERENCE_ROWS = 3;

export const STUDENT_STATUSES = ['undergraduate', 'graduate', 'other'] as const;
export const INCOME_SOURCES = ['guarantor', 'employment', 'financial_aid', 'savings', 'other'] as const;
type StudentStatus = ApplicantProfile['studentStatus'];
type IncomeSource = NonNullable<ApplicantSensitive['incomeSource']>;
type Guarantor = NonNullable<ApplicantSensitive['guarantor']>;

export const REQUIRED_PROFILE_FIELDS = ['legalName', 'phone', 'currentAddress', 'studentStatus'] as const;

/** Profile as stored, before updatedAt is set. */
export type ApplicantProfileDraft = Omit<ApplicantProfile, 'updatedAt'>;

export type ProfileFormResult = { ok: true; profile: ApplicantProfileDraft } | { ok: false; errors: Record<string, string> };

export interface ProfileFormOptions {
  /** YYYY-MM-DD used for the date-of-birth check. Defaults to today (UTC). */
  today?: ISODate;
}

const MAX_NAME = 120;
const MAX_ADDRESS = 200;
const MAX_SHORT = 40;
const MAX_TEXT = 200;
const PHONE_CHARS = /^[+\d\s().-]+$/;
const MONEY = /^\d+(\.\d{1,2})?$/;

function isStudentStatus(v: string): v is StudentStatus {
  return (STUDENT_STATUSES as readonly string[]).includes(v);
}

function isIncomeSource(v: string): v is IncomeSource {
  return (INCOME_SOURCES as readonly string[]).includes(v);
}

/**
 * Parses the applicant profile form. Collects every error at once, keyed by form field name.
 * Blank repeated rows are skipped. Any SSN-looking key is never read.
 */
export function parseProfileForm(fd: FormSource, userId: ID, options: ProfileFormOptions = {}): ProfileFormResult {
  const today = options.today ?? localDate(new Date().toISOString());
  const errors: Record<string, string> = {};
  const fail = (key: string, message: string) => {
    if (!(key in errors)) errors[key] = message;
  };
  const maxLen = (key: string, value: string, max: number) => {
    if (value.length > max) fail(key, `Keep this under ${max} characters.`);
  };

  const legalName = readField(fd, 'legalName');
  if (!legalName) fail('legalName', 'Enter your legal name.');
  maxLen('legalName', legalName, MAX_NAME);

  const phone = readField(fd, 'phone');
  const digits = phone.replace(/\D/g, '');
  if (!phone) fail('phone', 'Enter a phone number.');
  else if (!PHONE_CHARS.test(phone) || digits.length < 10 || digits.length > 15) {
    fail('phone', 'Enter a phone number with 10 to 15 digits.');
  }

  const currentAddress = readField(fd, 'currentAddress');
  if (!currentAddress) fail('currentAddress', 'Enter your current address.');
  maxLen('currentAddress', currentAddress, MAX_ADDRESS);

  const statusRaw = readField(fd, 'studentStatus');
  const studentStatus = isStudentStatus(statusRaw) ? statusRaw : undefined;
  if (!statusRaw) fail('studentStatus', 'Choose your student status.');
  else if (!studentStatus) fail('studentStatus', 'Choose a listed student status.');

  const expectedGraduation = readField(fd, 'expectedGraduation');
  maxLen('expectedGraduation', expectedGraduation, MAX_SHORT);

  // Sensitive section.
  const incomeRaw = readField(fd, 'monthlyIncome').replace(/[$,\s]/g, '');
  let monthlyIncome: number | undefined;
  if (incomeRaw !== '') {
    if (MONEY.test(incomeRaw)) monthlyIncome = Number(incomeRaw);
    else fail('monthlyIncome', 'Enter an amount like 1200 or 1200.50.');
  }

  const incomeSourceRaw = readField(fd, 'incomeSource');
  let incomeSource: IncomeSource | undefined;
  if (incomeSourceRaw !== '') {
    if (isIncomeSource(incomeSourceRaw)) incomeSource = incomeSourceRaw;
    else fail('incomeSource', 'Choose a listed income source.');
  }

  const dateOfBirth = readField(fd, 'dateOfBirth');
  if (dateOfBirth !== '') {
    if (!isIsoDate(dateOfBirth)) fail('dateOfBirth', 'Use a date like 2005-03-14.');
    else if (dateOfBirth >= today) fail('dateOfBirth', 'Date of birth must be in the past.');
  }

  // Guarantor: all or nothing. Any field given means name, email and relationship are required.
  const gName = readField(fd, 'guarantorName');
  const gEmail = readField(fd, 'guarantorEmail');
  const gRelationship = readField(fd, 'guarantorRelationship');
  const gPhone = readField(fd, 'guarantorPhone');
  let guarantor: Guarantor | undefined;
  if (gName || gEmail || gRelationship || gPhone) {
    if (!gName) fail('guarantorName', 'Enter your guarantor name.');
    if (!gEmail) fail('guarantorEmail', 'Enter your guarantor email.');
    else if (!isEmail(gEmail)) fail('guarantorEmail', 'Enter a valid email address.');
    if (!gRelationship) fail('guarantorRelationship', 'Enter how your guarantor is related to you.');
    if (gName && gEmail && isEmail(gEmail) && gRelationship) {
      guarantor = { name: gName, email: gEmail.toLowerCase(), relationship: gRelationship };
      if (gPhone) guarantor.phone = gPhone;
    }
  }
  maxLen('guarantorName', gName, MAX_NAME);

  // Rental history: a row is blank when all five fields are blank.
  const rentalHistory: RentalHistoryEntry[] = [];
  for (let n = 0; n < RENTAL_ROWS; n++) {
    const address = readField(fd, `rh_address_${n}`);
    const landlordName = readField(fd, `rh_landlordName_${n}`);
    const landlordContact = readField(fd, `rh_landlordContact_${n}`);
    const from = readField(fd, `rh_from_${n}`);
    const to = readField(fd, `rh_to_${n}`);
    if (!address && !landlordName && !landlordContact && !from && !to) continue;

    const before = Object.keys(errors).length;
    if (!address) fail(`rh_address_${n}`, 'Enter the address.');
    maxLen(`rh_address_${n}`, address, MAX_ADDRESS);
    if (!from) fail(`rh_from_${n}`, 'Enter the start date.');
    else if (!isIsoDate(from)) fail(`rh_from_${n}`, 'Use a date like 2024-08-15.');
    if (to) {
      if (!isIsoDate(to)) fail(`rh_to_${n}`, 'Use a date like 2025-05-10.');
      else if (isIsoDate(from) && to < from) fail(`rh_to_${n}`, 'End date is before the start date.');
    }
    maxLen(`rh_landlordName_${n}`, landlordName, MAX_NAME);
    maxLen(`rh_landlordContact_${n}`, landlordContact, MAX_TEXT);
    if (Object.keys(errors).length > before) continue;

    const entry: RentalHistoryEntry = { address, from };
    if (to) entry.to = to;
    if (landlordName) entry.landlordName = landlordName;
    if (landlordContact) entry.landlordContact = landlordContact;
    rentalHistory.push(entry);
  }

  // References: a row is blank when all three fields are blank; otherwise all three are required.
  const references: Reference[] = [];
  for (let n = 0; n < REFERENCE_ROWS; n++) {
    const name = readField(fd, `ref_name_${n}`);
    const contact = readField(fd, `ref_contact_${n}`);
    const relationship = readField(fd, `ref_relationship_${n}`);
    if (!name && !contact && !relationship) continue;

    const before = Object.keys(errors).length;
    if (!name) fail(`ref_name_${n}`, 'Enter the reference name.');
    if (!contact) fail(`ref_contact_${n}`, 'Enter how to reach this reference.');
    if (!relationship) fail(`ref_relationship_${n}`, 'Enter how you know this reference.');
    maxLen(`ref_name_${n}`, name, MAX_NAME);
    maxLen(`ref_contact_${n}`, contact, MAX_TEXT);
    maxLen(`ref_relationship_${n}`, relationship, MAX_TEXT);
    if (Object.keys(errors).length > before) continue;

    references.push({ name, contact, relationship });
  }

  if (Object.keys(errors).length > 0 || studentStatus === undefined) return { ok: false, errors };

  const sensitive: ApplicantSensitive = { rentalHistory, references };
  if (monthlyIncome !== undefined) sensitive.monthlyIncome = monthlyIncome;
  if (incomeSource !== undefined) sensitive.incomeSource = incomeSource;
  if (guarantor !== undefined) sensitive.guarantor = guarantor;
  if (dateOfBirth !== '') sensitive.dateOfBirth = dateOfBirth;

  const profile: ApplicantProfileDraft = {
    userId,
    legalName,
    phone,
    currentAddress,
    studentStatus,
    idVerified: false,
    sensitive,
  };
  if (expectedGraduation !== '') profile.expectedGraduation = expectedGraduation;
  return { ok: true, profile };
}

/** Flat string defaults for every form field, so inputs are always controlled. Null profile -> all ''. */
export function profileToFormValues(profile: ApplicantProfileDraft | null): Record<string, string> {
  const out: Record<string, string> = {
    legalName: '',
    phone: '',
    currentAddress: '',
    studentStatus: '',
    expectedGraduation: '',
    dateOfBirth: '',
    monthlyIncome: '',
    incomeSource: '',
    guarantorName: '',
    guarantorEmail: '',
    guarantorRelationship: '',
    guarantorPhone: '',
  };
  for (let n = 0; n < RENTAL_ROWS; n++) {
    out[`rh_address_${n}`] = '';
    out[`rh_landlordName_${n}`] = '';
    out[`rh_landlordContact_${n}`] = '';
    out[`rh_from_${n}`] = '';
    out[`rh_to_${n}`] = '';
  }
  for (let n = 0; n < REFERENCE_ROWS; n++) {
    out[`ref_name_${n}`] = '';
    out[`ref_contact_${n}`] = '';
    out[`ref_relationship_${n}`] = '';
  }
  if (!profile) return out;

  out.legalName = profile.legalName;
  out.phone = profile.phone;
  out.currentAddress = profile.currentAddress;
  out.studentStatus = profile.studentStatus;
  out.expectedGraduation = profile.expectedGraduation ?? '';

  const s = profile.sensitive;
  out.dateOfBirth = s.dateOfBirth ?? '';
  out.monthlyIncome = s.monthlyIncome !== undefined ? String(s.monthlyIncome) : '';
  out.incomeSource = s.incomeSource ?? '';
  if (s.guarantor) {
    out.guarantorName = s.guarantor.name;
    out.guarantorEmail = s.guarantor.email;
    out.guarantorRelationship = s.guarantor.relationship;
    out.guarantorPhone = s.guarantor.phone ?? '';
  }
  s.rentalHistory.slice(0, RENTAL_ROWS).forEach((r, n) => {
    out[`rh_address_${n}`] = r.address;
    out[`rh_landlordName_${n}`] = r.landlordName ?? '';
    out[`rh_landlordContact_${n}`] = r.landlordContact ?? '';
    out[`rh_from_${n}`] = r.from;
    out[`rh_to_${n}`] = r.to ?? '';
  });
  s.references.slice(0, REFERENCE_ROWS).forEach((r, n) => {
    out[`ref_name_${n}`] = r.name;
    out[`ref_contact_${n}`] = r.contact;
    out[`ref_relationship_${n}`] = r.relationship;
  });
  return out;
}

/** Required fields that are missing. complete = nothing missing. Null profile -> all required fields missing. */
export function profileCompleteness(profile: ApplicantProfileDraft | null): { complete: boolean; missing: string[] } {
  const missing = REQUIRED_PROFILE_FIELDS.filter((k) => {
    const v = profile?.[k];
    return typeof v !== 'string' || v.trim() === '';
  });
  return { complete: missing.length === 0, missing: [...missing] };
}
