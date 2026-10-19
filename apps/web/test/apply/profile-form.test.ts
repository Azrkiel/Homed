import { describe, expect, it } from 'vitest';
import {
  parseProfileForm,
  profileCompleteness,
  profileToFormValues,
  type ApplicantProfileDraft,
} from '../../src/lib/apply/profile-form';

const TODAY = '2026-10-19';
const base: Record<string, string> = {
  legalName: '  Jordan Lee ',
  phone: '(434) 555-0123',
  currentAddress: '100 Rugby Rd, Charlottesville VA',
  studentStatus: 'undergraduate',
};

function form(fields: Record<string, string>): URLSearchParams {
  return new URLSearchParams(fields);
}

function parse(fields: Record<string, string>) {
  return parseProfileForm(form(fields), 'user-1', { today: TODAY });
}

function errorsOf(fields: Record<string, string>): Record<string, string> {
  const r = parse(fields);
  if (r.ok) throw new Error('expected errors');
  return r.errors;
}

describe('parseProfileForm: required fields', () => {
  it('accepts the minimum and trims values', () => {
    const r = parse(base);
    expect(r).toEqual({
      ok: true,
      profile: {
        userId: 'user-1',
        legalName: 'Jordan Lee',
        phone: '(434) 555-0123',
        currentAddress: '100 Rugby Rd, Charlottesville VA',
        studentStatus: 'undergraduate',
        idVerified: false,
        sensitive: { rentalHistory: [], references: [] },
      },
    });
  });

  it('reports every missing required field at once', () => {
    expect(errorsOf({})).toEqual({
      legalName: 'Enter your legal name.',
      phone: 'Enter a phone number.',
      currentAddress: 'Enter your current address.',
      studentStatus: 'Choose your student status.',
    });
  });

  it('rejects an unknown student status', () => {
    expect(errorsOf({ ...base, studentStatus: 'phd' })).toEqual({ studentStatus: 'Choose a listed student status.' });
  });

  it('rejects names and addresses over the length limit', () => {
    const e = errorsOf({ ...base, legalName: 'x'.repeat(121), currentAddress: 'y'.repeat(201) });
    expect(e.legalName).toMatch(/120/);
    expect(e.currentAddress).toMatch(/200/);
  });
});

describe('parseProfileForm: phone and graduation', () => {
  it('rejects phones with letters or too few digits', () => {
    expect(errorsOf({ ...base, phone: '555-CALL-NOW' }).phone).toBeDefined();
    expect(errorsOf({ ...base, phone: '555-1234' }).phone).toBeDefined();
  });

  it('keeps expectedGraduation free text and omits it when blank', () => {
    const r = parse({ ...base, expectedGraduation: ' May 2027 ' });
    expect(r.ok && r.profile.expectedGraduation).toBe('May 2027');
    const blank = parse({ ...base, expectedGraduation: '   ' });
    expect(blank.ok && 'expectedGraduation' in blank.profile).toBe(false);
  });

  it('rejects an over-long graduation string', () => {
    expect(errorsOf({ ...base, expectedGraduation: 'z'.repeat(41) }).expectedGraduation).toMatch(/40/);
  });
});

describe('parseProfileForm: idVerified and SSN', () => {
  it('always sets idVerified false, even if the form claims otherwise', () => {
    const r = parse({ ...base, idVerified: 'true' });
    expect(r.ok && r.profile.idVerified).toBe(false);
  });

  it('never reads or stores an SSN field', () => {
    const r = parse({ ...base, ssn: '123-45-6789', SSN: '123456789', guarantorSsn: '987-65-4321' });
    expect(r.ok).toBe(true);
    expect(JSON.stringify(r)).not.toMatch(/123-?45-?6789|987-65-4321/);
    expect(JSON.stringify(r)).not.toMatch(/ssn/i);
  });
});

describe('parseProfileForm: sensitive section', () => {
  it('parses income as a non-negative amount and strips $ and commas', () => {
    const r = parse({ ...base, monthlyIncome: '$1,250.50' });
    expect(r.ok && r.profile.sensitive.monthlyIncome).toBe(1250.5);
  });

  it('rejects negative, malformed or 3-decimal income', () => {
    for (const bad of ['-5', 'lots', '12.345', '1e3']) {
      expect(errorsOf({ ...base, monthlyIncome: bad }).monthlyIncome).toBeDefined();
    }
  });

  it('treats blank income as absent', () => {
    const r = parse({ ...base, monthlyIncome: '' });
    expect(r.ok && 'monthlyIncome' in r.profile.sensitive).toBe(false);
  });

  it('accepts a listed income source and rejects others', () => {
    const r = parse({ ...base, incomeSource: 'savings' });
    expect(r.ok && r.profile.sensitive.incomeSource).toBe('savings');
    expect(errorsOf({ ...base, incomeSource: 'lottery' }).incomeSource).toBeDefined();
  });

  it('validates date of birth as a real past date', () => {
    const r = parse({ ...base, dateOfBirth: '2005-03-14' });
    expect(r.ok && r.profile.sensitive.dateOfBirth).toBe('2005-03-14');
    expect(errorsOf({ ...base, dateOfBirth: '2005-02-30' }).dateOfBirth).toBeDefined();
    expect(errorsOf({ ...base, dateOfBirth: '03/14/2005' }).dateOfBirth).toBeDefined();
    expect(errorsOf({ ...base, dateOfBirth: TODAY }).dateOfBirth).toMatch(/past/);
    expect(errorsOf({ ...base, dateOfBirth: '2027-01-01' }).dateOfBirth).toMatch(/past/);
  });
});

describe('parseProfileForm: guarantor all-or-nothing', () => {
  const g = { guarantorName: 'Pat Lee', guarantorEmail: 'Pat@Example.com', guarantorRelationship: 'Parent' };

  it('stores a complete guarantor with a lowercased email and optional phone', () => {
    const r = parse({ ...base, ...g, guarantorPhone: '434 555 0199' });
    expect(r.ok && r.profile.sensitive.guarantor).toEqual({
      name: 'Pat Lee',
      email: 'pat@example.com',
      relationship: 'Parent',
      phone: '434 555 0199',
    });
  });

  it('requires name, email and relationship once any guarantor field is given', () => {
    expect(errorsOf({ ...base, guarantorEmail: 'pat@example.com' })).toEqual({
      guarantorName: 'Enter your guarantor name.',
      guarantorRelationship: 'Enter how your guarantor is related to you.',
    });
    expect(errorsOf({ ...base, guarantorName: 'Pat' }).guarantorEmail).toMatch(/email/);
    expect(errorsOf({ ...base, guarantorPhone: '434 555 0199' }).guarantorName).toBeDefined();
  });

  it('rejects an invalid guarantor email', () => {
    expect(errorsOf({ ...base, ...g, guarantorEmail: 'pat@' }).guarantorEmail).toMatch(/valid/);
  });

  it('omits the guarantor when every guarantor field is blank', () => {
    const r = parse({ ...base, ...Object.fromEntries(Object.keys(g).map((k) => [k, ''])) });
    expect(r.ok && 'guarantor' in r.profile.sensitive).toBe(false);
  });
});

describe('parseProfileForm: rental history rows', () => {
  it('skips blank rows and keeps filled rows in order', () => {
    const r = parse({
      ...base,
      rh_address_1: '12 Oak St',
      rh_landlordName_1: 'Oak LLC',
      rh_landlordContact_1: 'oak@example.com',
      rh_from_1: '2024-08-15',
      rh_to_1: '2025-05-10',
      rh_address_3: '9 Elm Ave',
      rh_from_3: '2025-06-01',
    });
    expect(r.ok && r.profile.sensitive.rentalHistory).toEqual([
      {
        address: '12 Oak St',
        from: '2024-08-15',
        to: '2025-05-10',
        landlordName: 'Oak LLC',
        landlordContact: 'oak@example.com',
      },
      { address: '9 Elm Ave', from: '2025-06-01' },
    ]);
  });

  it('requires address and start date on a non-blank row', () => {
    expect(errorsOf({ ...base, rh_landlordName_0: 'Oak LLC' })).toEqual({
      rh_address_0: 'Enter the address.',
      rh_from_0: 'Enter the start date.',
    });
  });

  it('validates dates and end-after-start', () => {
    expect(errorsOf({ ...base, rh_address_0: 'A', rh_from_0: '2024-13-01' }).rh_from_0).toBeDefined();
    expect(errorsOf({ ...base, rh_address_0: 'A', rh_from_0: '2024-08-15', rh_to_0: 'soon' }).rh_to_0).toBeDefined();
    expect(errorsOf({ ...base, rh_address_0: 'A', rh_from_0: '2024-08-15', rh_to_0: '2024-01-01' }).rh_to_0).toMatch(/before/);
  });

  it('ignores rows past the fifth', () => {
    const fields: Record<string, string> = { ...base };
    for (let n = 0; n < 6; n++) {
      fields[`rh_address_${n}`] = `Place ${n}`;
      fields[`rh_from_${n}`] = '2024-01-01';
    }
    const r = parse(fields);
    expect(r.ok && r.profile.sensitive.rentalHistory).toHaveLength(5);
  });
});

describe('parseProfileForm: references', () => {
  it('skips blank rows and stores complete rows', () => {
    const r = parse({ ...base, ref_name_0: 'Dr. Ames', ref_contact_0: 'ames@example.com', ref_relationship_0: 'Professor' });
    expect(r.ok && r.profile.sensitive.references).toEqual([
      { name: 'Dr. Ames', contact: 'ames@example.com', relationship: 'Professor' },
    ]);
  });

  it('requires all three fields once any is given', () => {
    expect(errorsOf({ ...base, ref_name_2: 'Dr. Ames' })).toEqual({
      ref_contact_2: 'Enter how to reach this reference.',
      ref_relationship_2: 'Enter how you know this reference.',
    });
  });
});

describe('profileToFormValues', () => {
  it('returns empty defaults for every field when there is no profile', () => {
    const v = profileToFormValues(null);
    expect(v.legalName).toBe('');
    expect(v.rh_address_4).toBe('');
    expect(v.ref_relationship_2).toBe('');
    expect(Object.values(v).every((x) => x === '')).toBe(true);
  });

  it('round-trips a saved profile back through parseProfileForm', () => {
    const draft: ApplicantProfileDraft = {
      userId: 'user-1',
      legalName: 'Jordan Lee',
      phone: '4345550123',
      currentAddress: '100 Rugby Rd',
      studentStatus: 'graduate',
      expectedGraduation: 'May 2027',
      idVerified: false,
      sensitive: {
        monthlyIncome: 1200.5,
        incomeSource: 'employment',
        dateOfBirth: '2001-02-03',
        guarantor: { name: 'Pat', email: 'pat@example.com', relationship: 'Parent', phone: '4345550199' },
        rentalHistory: [{ address: 'Oak', from: '2024-08-15', to: '2025-05-10', landlordName: 'Oak LLC' }],
        references: [{ name: 'Dr. Ames', contact: 'ames@example.com', relationship: 'Professor' }],
      },
    };
    const values = profileToFormValues(draft);
    const r = parseProfileForm(new URLSearchParams(values), 'user-1', { today: TODAY });
    expect(r).toEqual({ ok: true, profile: draft });
  });
});

describe('profileCompleteness', () => {
  it('lists every required field when there is no profile', () => {
    expect(profileCompleteness(null)).toEqual({
      complete: false,
      missing: ['legalName', 'phone', 'currentAddress', 'studentStatus'],
    });
  });

  it('is complete when the required fields are present', () => {
    const r = parse(base);
    if (!r.ok) throw new Error('setup');
    expect(profileCompleteness(r.profile)).toEqual({ complete: true, missing: [] });
  });

  it('counts whitespace-only values as missing', () => {
    const r = parse(base);
    if (!r.ok) throw new Error('setup');
    expect(profileCompleteness({ ...r.profile, legalName: '   ' })).toEqual({ complete: false, missing: ['legalName'] });
  });
});
