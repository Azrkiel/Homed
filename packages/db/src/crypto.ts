// AES-256-GCM helpers shared by both stores. CONTRACT (Phase 0, lead-owned).
// Envelope: "v1.<iv b64url>.<tag b64url>.<ciphertext b64url>"
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function keyBytes(keyB64: string): Buffer {
  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== 32) throw new Error('Encryption key must be 32 bytes (base64)');
  return key;
}

export function encryptBytes(plain: Uint8Array, keyB64: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyBytes(keyB64), iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join('.');
}

export function decryptBytes(envelope: string, keyB64: string): Uint8Array {
  const [v, iv, tag, ct] = envelope.split('.');
  if (v !== 'v1' || !iv || !tag || ct === undefined) throw new Error('Bad ciphertext envelope');
  const decipher = createDecipheriv('aes-256-gcm', keyBytes(keyB64), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return new Uint8Array(Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]));
}

export function encryptJson(value: unknown, keyB64: string): string {
  return encryptBytes(Buffer.from(JSON.stringify(value), 'utf8'), keyB64);
}

export function decryptJson<T>(envelope: string, keyB64: string): T {
  return JSON.parse(Buffer.from(decryptBytes(envelope, keyB64)).toString('utf8')) as T;
}
