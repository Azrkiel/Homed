import { describe, expect, it } from 'vitest';
import {
  BROWSE_LIMIT,
  addedToGroupMessage,
  browseSlice,
  groupMatchMessage,
  shortlistLabel,
} from '../../src/lib/groups/browse';

describe('group browse and match helpers', () => {
  it('caps browse results at 50 and keeps order', () => {
    const items = Array.from({ length: 120 }, (_, i) => i);
    const shown = browseSlice(items);
    expect(BROWSE_LIMIT).toBe(50);
    expect(shown).toHaveLength(50);
    expect(shown[0]).toBe(0);
    expect(shown[49]).toBe(49);
    expect(browseSlice([1, 2], 50)).toEqual([1, 2]);
    expect(browseSlice([1, 2, 3], -1)).toEqual([]);
  });

  it('labels the shortlist button', () => {
    expect(shortlistLabel(true)).toBe('On shortlist');
    expect(shortlistLabel(false)).toBe('Add to shortlist');
  });

  it('builds the added and match messages', () => {
    expect(addedToGroupMessage('Hoos Crew')).toBe('Added to Hoos Crew');
    expect(groupMatchMessage('Fontaine 4BR')).toBe("It's a match! Everyone in the group said yes to Fontaine 4BR");
  });
});
