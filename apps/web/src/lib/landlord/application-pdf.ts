// Application packet PDF. shapeProfile / packetMembers decide what each viewer may see; buildApplicationPacket only
// lays out the shaped input. Keep the shaping separate so tests can check it without parsing PDF bytes.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import {
  APPLY_IS_NOT_SIGNING,
  statusLabel,
  type ApplicantProfile,
  type ApplicantSensitive,
  type ApplicationMember,
  type ApplicationStatus,
  type FeeQuote,
  type ID,
  type ISODate,
} from '@homed/core';

export const NEVER_CREDIT_REPORTS = 'Homed never stores credit reports.';

/** What a viewer may see: landlord/admin see everything; the leader sees their own full profile and others' basics. */
export interface PacketViewer {
  userId: ID;
  landlordView: boolean;
}

export interface PacketProfile {
  legalName: string;
  studentStatus: ApplicantProfile['studentStatus'];
  expectedGraduation?: string;
  phone?: string;
  currentAddress?: string;
  sensitive?: ApplicantSensitive;
}

export interface PacketMember {
  kind: ApplicationMember['kind'];
  name: string;
  done: boolean;
  email?: string;
  profile?: PacketProfile;
}

export interface ApplicationPacketInput {
  generatedOn: ISODate;
  applicationId: ID;
  status: ApplicationStatus;
  batchRank: number;
  submittedAt?: string;
  property: { name: string; address: string };
  floorPlan: { name: string; rentAmount: number; rentBasis: 'per_bed' | 'per_unit'; leaseStart: ISODate; leaseEnd: ISODate };
  fees: FeeQuote;
  members: PacketMember[];
}

/**
 * Profile fields for one member. Full (contact details and sensitive data) for landlords, admins and the member
 * themself. Everyone else gets name, student status and expected graduation only.
 */
export function shapeProfile(profile: ApplicantProfile, viewer: PacketViewer): PacketProfile {
  const basic: PacketProfile = {
    legalName: profile.legalName,
    studentStatus: profile.studentStatus,
    expectedGraduation: profile.expectedGraduation,
  };
  if (!viewer.landlordView && profile.userId !== viewer.userId) return basic;
  return {
    ...basic,
    phone: profile.phone,
    currentAddress: profile.currentAddress,
    sensitive: structuredClone(profile.sensitive),
  };
}

/**
 * Members for the packet. Emails are shown to landlords and admins only. Profiles are looked up by user id;
 * a member without a profile (or without an account) has none.
 */
export function packetMembers(
  members: ApplicationMember[],
  profilesByUserId: Map<ID, ApplicantProfile>,
  viewer: PacketViewer,
): PacketMember[] {
  return members.map((m) => {
    const row: PacketMember = {
      kind: m.kind,
      name: m.name?.trim() || (m.kind === 'leader' ? 'Leader' : m.kind === 'guarantor' ? 'Guarantor' : 'Roommate'),
      done: m.done,
    };
    if (viewer.landlordView) row.email = m.email;
    const profile = m.userId ? profilesByUserId.get(m.userId) : undefined;
    if (profile) row.profile = shapeProfile(profile, viewer);
    return row;
  });
}

// --- layout ----------------------------------------------------------------

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 54;
const LINE = 14;

/** WinAnsi (the standard fonts' encoding) cannot encode everything; unknown characters become "?". */
export function toWinAnsi(text: string): string {
  return text.replace(/[\r\n\t]+/g, ' ').replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
}

function usd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function wrap(font: PDFFont, text: string, size: number, width: number): string[] {
  const words = toWinAnsi(text).split(' ').filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

interface Writer {
  doc: PDFDocument;
  regular: PDFFont;
  bold: PDFFont;
  page: PDFPage;
  y: number;
}

function newPage(w: Writer): void {
  w.page = w.doc.addPage([PAGE_W, PAGE_H]);
  w.y = PAGE_H - MARGIN;
}

function ensure(w: Writer, height: number): void {
  if (w.y - height < MARGIN) newPage(w);
}

function text(w: Writer, value: string, opts: { size?: number; bold?: boolean; indent?: number; gap?: number } = {}): void {
  const size = opts.size ?? 10;
  const font = opts.bold ? w.bold : w.regular;
  const x = MARGIN + (opts.indent ?? 0);
  const width = PAGE_W - MARGIN - x;
  for (const line of wrap(font, value, size, width)) {
    ensure(w, LINE);
    w.page.drawText(line, { x, y: w.y - size, size, font, color: rgb(0.1, 0.1, 0.12) });
    w.y -= LINE;
  }
  w.y -= opts.gap ?? 0;
}

function heading(w: Writer, value: string): void {
  ensure(w, 30);
  w.y -= 8;
  text(w, value, { size: 12, bold: true, gap: 2 });
}

function field(w: Writer, label: string, value: string | undefined, indent = 0): void {
  if (value === undefined || value === '') return;
  text(w, `${label}: ${value}`, { indent });
}

function profileLines(w: Writer, p: PacketProfile, indent: number): void {
  field(w, 'Legal name', p.legalName, indent);
  field(w, 'Student status', p.studentStatus, indent);
  field(w, 'Expected graduation', p.expectedGraduation, indent);
  field(w, 'Phone', p.phone, indent);
  field(w, 'Current address', p.currentAddress, indent);
  const s = p.sensitive;
  if (!s) return;
  field(w, 'Monthly income', s.monthlyIncome === undefined ? undefined : usd(s.monthlyIncome), indent);
  field(w, 'Income source', s.incomeSource, indent);
  field(w, 'Date of birth', s.dateOfBirth, indent);
  if (s.guarantor) {
    const g = s.guarantor;
    field(w, 'Guarantor', `${g.name}, ${g.relationship}, ${g.email}${g.phone ? `, ${g.phone}` : ''}`, indent);
  }
  for (const r of s.rentalHistory) {
    text(w, `Rental: ${r.address}, ${r.from} to ${r.to ?? 'present'}${r.landlordName ? `, landlord ${r.landlordName}` : ''}`, { indent });
  }
  for (const r of s.references) {
    text(w, `Reference: ${r.name}, ${r.relationship}, ${r.contact}`, { indent });
  }
}

/** Renders the packet. Input must already be shaped for the viewer (see packetMembers). */
export async function buildApplicationPacket(input: ApplicationPacketInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Application ${input.applicationId}`);
  doc.setCreator('Homed');
  const w: Writer = {
    doc,
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    page: doc.addPage([PAGE_W, PAGE_H]),
    y: PAGE_H - MARGIN,
  };

  const status = statusLabel(input.status);
  text(w, 'Application packet', { size: 18, bold: true, gap: 4 });
  text(w, `${input.property.name}, ${input.floorPlan.name}`, { size: 12, gap: 6 });
  field(w, 'Status', `${status.label}. ${status.detail}`);
  field(w, 'Application ID', input.applicationId);
  field(w, 'Batch rank', `#${input.batchRank}`);
  field(w, 'Submitted', input.submittedAt ?? 'Not submitted yet');
  field(w, 'Generated', input.generatedOn);

  heading(w, 'Property');
  field(w, 'Name', input.property.name);
  field(w, 'Address', input.property.address);
  const rent = input.floorPlan.rentBasis === 'per_bed' ? 'per person' : 'per unit';
  field(w, 'Floor plan', input.floorPlan.name);
  field(w, 'Rent', `${usd(input.floorPlan.rentAmount)} a month, ${rent}`);
  field(w, 'Lease', `${input.floorPlan.leaseStart} to ${input.floorPlan.leaseEnd}`);

  heading(w, 'Fees');
  for (const line of input.fees.perPerson) {
    text(w, `${line.label}: ${usd(line.amount)}${line.refundable ? ' (refundable)' : ' (non-refundable)'}`, { indent: 10 });
  }
  field(w, 'Per person total', usd(input.fees.perPersonTotal));
  field(w, 'People', String(input.fees.people));
  field(w, 'Application total', usd(input.fees.applicationTotal));

  heading(w, 'Members');
  for (const m of input.members) {
    text(w, `${m.name} (${m.kind}): ${m.done ? 'done' : 'not done yet'}`, { bold: true, indent: 10, gap: 2 });
    field(w, 'Email', m.email, 20);
    if (m.profile) profileLines(w, m.profile, 20);
    else text(w, 'No applicant profile attached.', { indent: 20 });
  }

  heading(w, 'Notices');
  text(w, APPLY_IS_NOT_SIGNING, { gap: 4 });
  text(w, NEVER_CREDIT_REPORTS, { gap: 4 });

  const pages = doc.getPages();
  pages.forEach((page, i) => {
    page.drawText(toWinAnsi(`Homed application packet, page ${i + 1} of ${pages.length}`), {
      x: MARGIN,
      y: MARGIN / 2,
      size: 8,
      font: w.regular,
      color: rgb(0.4, 0.4, 0.45),
    });
  });

  return doc.save();
}
