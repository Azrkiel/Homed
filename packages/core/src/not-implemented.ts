/** Placeholder thrown by contract stubs until the owning phase implements them. */
export function notImplemented(name: string): never {
  throw new Error(`${name} is not implemented yet`);
}
