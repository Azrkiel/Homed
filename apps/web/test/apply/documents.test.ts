import { describe, expect, it } from 'vitest';
import { addDaysIso, isIsoDate } from '../../src/lib/apply/dates';
import { deleteAfterDate, MAX_UPLOAD_BYTES, safeFilename, validateUpload } from '../../src/lib/apply/documents';

const ok = { name: 'transcript.pdf', size: 1024, type: 'application/pdf' };

describe('validateUpload', () => {
  it('accepts pdf, png and jpg/jpeg when mime and extension agree', () => {
    expect(validateUpload(ok)).toEqual({ ok: true, mime: 'application/pdf' });
    expect(validateUpload({ name: 'id.PNG', size: 10, type: 'image/png' })).toEqual({ ok: true, mime: 'image/png' });
    expect(validateUpload({ name: 'photo.jpg', size: 10, type: 'image/jpeg' })).toEqual({ ok: true, mime: 'image/jpeg' });
    expect(validateUpload({ name: 'photo.jpeg', size: 10, type: 'image/jpeg' })).toEqual({ ok: true, mime: 'image/jpeg' });
  });

  it('accepts exactly 5 MB and rejects one byte more', () => {
    expect(validateUpload({ ...ok, size: MAX_UPLOAD_BYTES }).ok).toBe(true);
    const big = validateUpload({ ...ok, size: MAX_UPLOAD_BYTES + 1 });
    expect(big).toEqual({ ok: false, message: 'Files must be 5 MB or smaller.' });
  });

  it('rejects empty files', () => {
    expect(validateUpload({ ...ok, size: 0 })).toEqual({ ok: false, message: 'The file is empty.' });
    expect(validateUpload({ ...ok, size: Number.NaN }).ok).toBe(false);
  });

  it('rejects unsupported mime types', () => {
    for (const type of ['text/plain', 'image/gif', 'image/jpg', '', 'application/x-msdownload']) {
      expect(validateUpload({ name: 'file.pdf', size: 10, type })).toEqual({
        ok: false,
        message: 'Upload a PDF, PNG, or JPG file.',
      });
    }
  });

  it('rejects a mime type whose extension does not match', () => {
    expect(validateUpload({ name: 'evil.exe.pdf', size: 10, type: 'image/png' }).ok).toBe(false);
    expect(validateUpload({ name: 'scan.png', size: 10, type: 'application/pdf' }).ok).toBe(false);
    expect(validateUpload({ name: 'noext', size: 10, type: 'application/pdf' }).ok).toBe(false);
  });
});

describe('deleteAfterDate', () => {
  it('adds 90 days in calendar math', () => {
    expect(deleteAfterDate('2026-10-19')).toBe('2027-01-17');
    expect(deleteAfterDate('2027-12-01')).toBe('2028-02-29');
    expect(deleteAfterDate('2026-02-01')).toBe('2026-05-02');
  });

  it('rejects malformed dates', () => {
    expect(() => deleteAfterDate('2026-02-30')).toThrow(RangeError);
    expect(() => deleteAfterDate('10/19/2026')).toThrow(RangeError);
  });
});

describe('addDaysIso and isIsoDate', () => {
  it('validates real calendar dates', () => {
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2027-02-29')).toBe(false);
    expect(isIsoDate('2026-1-01')).toBe(false);
  });

  it('subtracts days across month and year boundaries', () => {
    expect(addDaysIso('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDaysIso('2026-10-19', 0)).toBe('2026-10-19');
  });
});

describe('safeFilename', () => {
  it('keeps a plain name', () => {
    expect(safeFilename('lease copy.pdf')).toBe('lease copy.pdf');
  });

  it('strips directory parts from both separator styles', () => {
    expect(safeFilename('../../etc/passwd.pdf')).toBe('passwd.pdf');
    expect(safeFilename('C:\\Users\\jiang\\Downloads\\pay stub.pdf')).toBe('pay stub.pdf');
  });

  it('removes control characters and surrounding spaces', () => {
    expect(safeFilename('  bad\u0000name\r\n.png  ')).toBe('badname.png');
    expect(safeFilename('x\u007f.pdf')).toBe('x.pdf');
  });

  it('falls back to "upload" for empty or dot-only names', () => {
    expect(safeFilename('')).toBe('upload');
    expect(safeFilename('   ')).toBe('upload');
    expect(safeFilename('..')).toBe('upload');
    expect(safeFilename('a/')).toBe('upload');
  });

  it('caps length at 120 and keeps the extension', () => {
    const long = `${'a'.repeat(300)}.pdf`;
    const out = safeFilename(long);
    expect(out.length).toBe(120);
    expect(out.endsWith('.pdf')).toBe(true);
    expect(safeFilename('b'.repeat(300)).length).toBe(120);
  });
});
