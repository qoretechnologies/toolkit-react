import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StructuredDataView } from '../src/components/form/engine/_structuredData/StructuredDataView';
import { FormAppearanceProvider, TFormEngineAppearance } from '../src/components/form/engine/formAppearance';

/**
 * A hash read in the calm look is a fact sheet: its keys are quiet gray labels, not blue chips. Blue is a filter
 * that is on; a key is a name.
 */
const VALUE = { 'Selected option': 'Retry', attempts: 3 };

const keyColour = (appearance: TFormEngineAppearance): string => {
  const { container, unmount } = render(
    <ReqoreUIProvider>
      <FormAppearanceProvider value={appearance}>
        <StructuredDataView value={VALUE} collapsibleRoot={false} />
      </FormAppearanceProvider>
    </ReqoreUIProvider>
  );
  const key = container.querySelector<HTMLElement>('.reqore-data-view-key');
  expect(key, 'a key is drawn').toBeTruthy();
  const colour = getComputedStyle(key!).borderTopColor || getComputedStyle(key!).color;
  unmount();
  return colour;
};

const channels = (colour: string) => (colour.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);

describe("a hash's keys in the calm look", () => {
  it('are not drawn in the blue of a filter, as the classic look draws them', () => {
    const classic = keyColour('classic');
    const calm = keyColour('calm');
    expect(calm).not.toBe(classic);
    // the classic key is blue: its blue channel leads
    const [r, , b] = channels(classic);
    expect(b).toBeGreaterThan(r);
    // the calm key is a gray: no channel leads by much
    const [cr, cg, cb] = channels(calm);
    expect(Math.max(cr, cg, cb) - Math.min(cr, cg, cb)).toBeLessThan(30);
  });
});
