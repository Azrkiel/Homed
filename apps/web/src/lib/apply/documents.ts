import type { ISODate } from '@homed/core';
import { addDaysIso } from './dates';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const DELETE_AFTER_DAYS = 90;
export const MAX_FILENAME = 120;

export const UPLOAD_MIMES = ['application/pdf', 'image/png', 'image/jpeg'] as const;
export type UploadMime = (typeof UPLOAD_MIMES)[number];

const EXTENSIONS: Record<UploadMime, readonly string[]> = {
  'application/pdf': ['pdf'],
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
};

export interface UploadInput {
  name: string;
  size: number;
  type: string;
}

export type UploadCheck = { ok: true; mime: UploadMime } | { ok: false; message: string };

/** PDF, PNG or JPG only; mime and extension must agree; 0 < size <= 5 MB. */
export function validateUpload(input: UploadInput): UploadCheck {
  const fail = (message: string): UploadCheck => ({ ok: false, message });
  const mime = (UPLOAD_MIMES as readonly string[]).includes(input.type) ? (input.type as UploadMime) : undefined;
  if (mime === undefined) return fail('Upload a PDF, PNG, or JPG file.');

  const dot = input.name.lastIndexOf('.');
  const ext = dot >= 0 ? input.name.slice(dot + 1).toLowerCase() : '';
  if (!EXTENSIONS[mime].includes(ext)) return fail('The file name must match its type (.pdf, .png, .jpg, or .jpeg).');

  if (!(input.size > 0)) return fail('The file is empty.');
  if (input.size > MAX_UPLOAD_BYTES) return fail('Files must be 5 MB or smaller.');
  return { ok: true, mime };
}

/** Upload deletion date: today + 90 days (UTC calendar math). */
export function deleteAfterDate(today: ISODate): ISODate {
  return addDaysIso(today, DELETE_AFTER_DAYS);
}

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

/**
 * Stored filename: last path segment only, no control characters, max 120 chars.
 * Keeps the extension when truncating. Empty, '.' or '..' -> 'upload'.
 */
export function safeFilename(name: string): string {
  const noControl = name.replace(CONTROL_CHARS, '');
  const segments = noControl.split(/[\\/]/);
  const base = (segments[segments.length - 1] ?? '').trim();
  if (base === '' || base === '.' || base === '..') return 'upload';
  if (base.length <= MAX_FILENAME) return base;

  const dot = base.lastIndexOf('.');
  const ext = dot > 0 && base.length - dot <= 11 ? base.slice(dot) : '';
  return base.slice(0, MAX_FILENAME - ext.length) + ext;
}
