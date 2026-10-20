import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { isPlaceholderPhoto, PropertyIllustration } from '../../src/components/listing/property-illustration';

describe('PropertyIllustration', () => {
  // Seeds whose hashes have the top bit set used to index palettes with negative numbers and crash.
  const seeds = Array.from({ length: 60 }, (_, i) => `Property ${i} ${'x'.repeat(i % 7)}`);
  it.each(['house', 'apartment_complex', 'on_grounds'] as const)('renders %s for many seeds, labelled as an illustration', { timeout: 30_000 }, (kind) => {
    for (const seed of seeds) {
      const html = renderToStaticMarkup(createElement(PropertyIllustration, { kind, seed, name: seed }));
      expect(html).toContain(`aria-label="Illustration of ${seed}. No photo yet."`);
      expect(html).toContain('Illustration');
      expect(html).not.toContain('undefined');
      expect(html).not.toContain('NaN');
    }
  });

  it('is stable for the same property', () => {
    const a = renderToStaticMarkup(createElement(PropertyIllustration, { kind: 'house', seed: 'Bice House', name: 'Bice House' }));
    const b = renderToStaticMarkup(createElement(PropertyIllustration, { kind: 'house', seed: 'Bice House', name: 'Bice House' }));
    expect(a).toBe(b);
  });

  it('treats /placeholder/ images as no photo', () => {
    expect(isPlaceholderPhoto('/placeholder/building.svg')).toBe(true);
    expect(isPlaceholderPhoto('https://example.com/a.jpg')).toBe(false);
  });
});
