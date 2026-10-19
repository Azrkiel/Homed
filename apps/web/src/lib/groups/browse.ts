// Pure helpers for the group browse and group Match pages. No React, no I/O.

/** Browse results shown per page load. */
export const BROWSE_LIMIT = 50;

/** First `limit` items, in order. */
export function browseSlice<T>(items: T[], limit: number = BROWSE_LIMIT): T[] {
  return items.slice(0, Math.max(0, limit));
}

/** Shortlist button label for one listing. */
export function shortlistLabel(onShortlist: boolean): string {
  return onShortlist ? 'On shortlist' : 'Add to shortlist';
}

/** Live-region text after adding a listing to a group. */
export function addedToGroupMessage(groupName: string): string {
  return `Added to ${groupName}`;
}

/** Banner text when every member has said yes to a listing. */
export function groupMatchMessage(name: string): string {
  return `It's a match! Everyone in the group said yes to ${name}`;
}
