import { describe, expect, it } from 'vitest';
import { isEmail, isStudentEmail } from '../src/validation';

describe('isStudentEmail', () => {
  it('accepts name@virginia.edu', () => expect(isStudentEmail('abc2de@virginia.edu')).toBe(true));
  it('is case-insensitive and trims', () => expect(isStudentEmail('  Abc2DE@Virginia.EDU ')).toBe(true));
  it('rejects subdomains', () => expect(isStudentEmail('a@alumni.virginia.edu')).toBe(false));
  it('rejects other domains', () => expect(isStudentEmail('a@gmail.com')).toBe(false));
  it('rejects lookalike suffix domains', () => expect(isStudentEmail('a@notvirginia.edu')).toBe(false));
  it('rejects domain in local part', () => expect(isStudentEmail('virginia.edu@gmail.com')).toBe(false));
  it('rejects empty local part', () => expect(isStudentEmail('@virginia.edu')).toBe(false));
  it('rejects missing @', () => expect(isStudentEmail('virginia.edu')).toBe(false));
  it('rejects empty string', () => expect(isStudentEmail('')).toBe(false));
});

describe('isEmail', () => {
  it('accepts a normal address', () => expect(isEmail('a@b.com')).toBe(true));
  it('trims surrounding whitespace', () => expect(isEmail('  a@b.com ')).toBe(true));
  it('accepts multi-label domains', () => expect(isEmail('a@mail.b.co.uk')).toBe(true));
  it('rejects no @', () => expect(isEmail('ab.com')).toBe(false));
  it('rejects two @', () => expect(isEmail('a@b@c.com')).toBe(false));
  it('rejects empty local', () => expect(isEmail('@b.com')).toBe(false));
  it('rejects empty domain', () => expect(isEmail('a@')).toBe(false));
  it('rejects undotted domain', () => expect(isEmail('a@localhost')).toBe(false));
  it('rejects empty domain labels', () => {
    expect(isEmail('a@.com')).toBe(false);
    expect(isEmail('a@b.')).toBe(false);
    expect(isEmail('a@b..com')).toBe(false);
  });
  it('rejects inner spaces', () => expect(isEmail('a b@c.com')).toBe(false));
});
