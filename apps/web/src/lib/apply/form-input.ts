// Read helpers shared by the apply form parsers. Work on FormData (server actions) and URLSearchParams (tests, URLs).

export type FormSource = FormData | URLSearchParams;

/** Trimmed string value, or '' when missing or a file. */
export function readField(src: FormSource, name: string): string {
  const v = src.get(name);
  return typeof v === 'string' ? v.trim() : '';
}

/** Trimmed string values of a repeated field, in order. Files are skipped. */
export function readAll(src: FormSource, name: string): string[] {
  const out: string[] = [];
  for (const v of src.getAll(name)) {
    if (typeof v === 'string') out.push(v.trim());
  }
  return out;
}

/** Every key present in the form, repeats included. */
export function formKeys(src: FormSource): string[] {
  const out: string[] = [];
  for (const k of src.keys()) out.push(k);
  return out;
}
