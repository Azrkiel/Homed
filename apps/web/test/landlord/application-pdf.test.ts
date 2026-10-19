import { describe, expect, it } from 'vitest';
import type { ApplicantProfile, ApplicationMember, FeeQuote } from '@homed/core';
import {
  buildApplicationPacket,
  NEVER_CREDIT_REPORTS,
  packetMembers,
  landlordSafeProfile,
  shapeProfile,
  toWinAnsi,
  type ApplicationPacketInput,
} from '../../src/lib/landlord/application-pdf';

const LEADER = 'U-LEADER';
const ROOMMATE = 'U-ROOMMATE';

const leaderProfile: ApplicantProfile = {
  userId: LEADER,
  legalName: 'Ada Leader',
  phone: '434-555-0100',
  currentAddress: '1 Leader Lane',
  studentStatus: 'undergraduate',
  expectedGraduation: '2028',
  idVerified: true,
  sensitive: { monthlyIncome: 1500, rentalHistory: [], references: [] },
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const roommateProfile: ApplicantProfile = {
  userId: ROOMMATE,
  legalName: 'Rory Roommate',
  phone: '434-555-0199',
  currentAddress: '9 Secret Street',
  studentStatus: 'graduate',
  expectedGraduation: '2027',
  idVerified: false,
  sensitive: {
    monthlyIncome: 4321,
    incomeSource: 'employment',
    guarantor: { name: 'Gina Guarantor', email: 'gina@example.com', relationship: 'parent' },
    rentalHistory: [{ address: '5 Old Road', from: '2023-01-01' }],
    references: [{ name: 'Ref Person', contact: 'ref@example.com', relationship: 'landlord' }],
    dateOfBirth: '2001-02-03',
  },
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const members: ApplicationMember[] = [
  {
    id: 'm1',
    applicationId: 'app-1',
    kind: 'leader',
    userId: LEADER,
    email: 'ada@virginia.edu',
    name: 'Ada Leader',
    inviteToken: 't1',
    inviteStatus: 'accepted',
    done: true,
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'm2',
    applicationId: 'app-1',
    kind: 'roommate',
    userId: ROOMMATE,
    email: 'rory@virginia.edu',
    name: 'Rory Roommate',
    inviteToken: 't2',
    inviteStatus: 'accepted',
    done: true,
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
];

const profiles = new Map<string, ApplicantProfile>([
  [LEADER, leaderProfile],
  [ROOMMATE, roommateProfile],
]);

const fees: FeeQuote = {
  perPerson: [{ label: 'Application fee', amount: 50, refundable: false }],
  perPersonTotal: 50,
  people: 2,
  applicationTotal: 100,
  complianceIssues: [],
};

describe('shapeProfile', () => {
  it('gives the leader only basics for a roommate', () => {
    const shaped = shapeProfile(roommateProfile, { userId: LEADER, landlordView: false });
    expect(shaped).toEqual({
      legalName: 'Rory Roommate',
      studentStatus: 'graduate',
      expectedGraduation: '2027',
    });
    expect(JSON.stringify(shaped)).not.toMatch(/4321|555-0199|Secret|Gina|Ref Person|2001/);
  });

  it('gives a member their own full profile', () => {
    const shaped = shapeProfile(roommateProfile, { userId: ROOMMATE, landlordView: false });
    expect(shaped.phone).toBe('434-555-0199');
    expect(shaped.sensitive?.monthlyIncome).toBe(4321);
  });

  it('gives landlords and admins everything except date of birth (data minimisation)', () => {
    const shaped = shapeProfile(roommateProfile, { userId: 'U-LANDLORD', landlordView: true });
    expect(shaped.currentAddress).toBe('9 Secret Street');
    expect(shaped.sensitive?.guarantor?.name).toBe('Gina Guarantor');
    expect(shaped.sensitive?.dateOfBirth).toBeUndefined();
    expect(landlordSafeProfile(roommateProfile).sensitive.dateOfBirth).toBeUndefined();
    expect(roommateProfile.sensitive.dateOfBirth).toBe('2001-02-03');
  });

  it('the applicant still sees their own date of birth', () => {
    const shaped = shapeProfile(roommateProfile, { userId: ROOMMATE, landlordView: false });
    expect(shaped.sensitive?.dateOfBirth).toBe('2001-02-03');
  });

  it('returns copies, so changing the packet never changes the profile', () => {
    const shaped = shapeProfile(leaderProfile, { userId: LEADER, landlordView: false });
    shaped.sensitive!.monthlyIncome = 0;
    expect(leaderProfile.sensitive.monthlyIncome).toBe(1500);
  });
});

describe('packetMembers', () => {
  it('hides emails from the leader and shows them to the landlord', () => {
    const forLeader = packetMembers(members, profiles, { userId: LEADER, landlordView: false });
    expect(forLeader.every((m) => m.email === undefined)).toBe(true);
    expect(forLeader[1]?.profile?.sensitive).toBeUndefined();

    const forLandlord = packetMembers(members, profiles, { userId: 'U-LANDLORD', landlordView: true });
    expect(forLandlord[1]?.email).toBe('rory@virginia.edu');
    expect(forLandlord[1]?.profile?.sensitive?.monthlyIncome).toBe(4321);
  });

  it('leaves the profile off members without an account', () => {
    const guarantor: ApplicationMember = { ...members[1]!, id: 'm3', kind: 'guarantor', userId: undefined, name: undefined };
    const rows = packetMembers([guarantor], profiles, { userId: LEADER, landlordView: false });
    expect(rows[0]?.name).toBe('Guarantor');
    expect(rows[0]?.profile).toBeUndefined();
  });
});

function packetInput(viewerUserId: string, landlordView: boolean): ApplicationPacketInput {
  return {
    generatedOn: '2026-10-19',
    applicationId: 'app-1',
    status: 'under_review',
    batchRank: 1,
    submittedAt: '2026-10-05T10:00:00.000Z',
    property: { name: 'Test Lofts', address: '1 Test Way' },
    floorPlan: { name: '2BR / 2BA', rentAmount: 1800, rentBasis: 'per_unit', leaseStart: '2027-08-15', leaseEnd: '2028-05-15' },
    fees,
    members: packetMembers(members, profiles, { userId: viewerUserId, landlordView }),
  };
}

describe('buildApplicationPacket', () => {
  it('builds a PDF for the leader view with no roommate sensitive data in the input', async () => {
    const input = packetInput(LEADER, false);
    const serialized = JSON.stringify(input);
    expect(serialized).not.toMatch(/4321|555-0199|Secret Street|Gina|Ref Person/);

    const bytes = await buildApplicationPacket(input);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect(new TextDecoder().decode(bytes.slice(-7)).trim()).toMatch(/%%EOF$/);
  });

  it('builds a PDF for the landlord view', async () => {
    const bytes = await buildApplicationPacket(packetInput('U-LANDLORD', true));
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('%PDF');
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });

  it('handles long profiles across pages and unencodable characters', async () => {
    const long = packetInput(LEADER, false);
    long.members[0]!.name = 'Ada Łódź 中文 '.repeat(20);
    long.members[0]!.profile!.legalName = 'x'.repeat(2000);
    const bytes = await buildApplicationPacket(long);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('%PDF');
  });
});

describe('toWinAnsi', () => {
  it('replaces characters the standard fonts cannot encode', () => {
    expect(toWinAnsi('Café 中\nok')).toBe('Café ? ok');
  });
});

it('states the credit report and not-signing notices', () => {
  expect(NEVER_CREDIT_REPORTS).toBe('Homed never stores credit reports.');
});
