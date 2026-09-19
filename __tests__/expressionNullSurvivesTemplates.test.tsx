import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/hooks/useStorage/useStorage', () => ({
  useReqraftStorage: (_k: string, d: unknown) => [d, vi.fn()],
}));

import { Expression } from '../src/components/form/expressions/builder';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

/** The served `value` expression: one argument, declared `any`. */
const VALUE_EXPRESSION = {
  name: 'value',
  display_name: 'Value',
  return_type: 'any',
  args: [
    {
      signature_type_code: 'any',
      name: 'any',
      display_name: 'Any',
      ui_type: 'any',
      required: true,
    },
  ],
};

/**
 * Templates ON OFFER — the condition that made this bug invisible in a bare
 * harness. The selector-restore rule only fires when the field has templates
 * it could offer, so a test without them cannot reproduce the report.
 */
const TEMPLATES = {
  items: [
    {
      divider: true,
      label: 'Context',
      items: [
        { label: 'Order ID', value: '$local:order_id' },
        { label: 'Status', value: '$local:status' },
      ],
    },
  ],
};

const renderBuilder = (
  args: unknown[],
  onValueChange: (v: unknown) => void,
  templates: unknown = TEMPLATES
) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <Expression
          value={{ is_expression: true, value: { exp: 'value', args } } as never}
          onValueChange={onValueChange as never}
          expressions={[VALUE_EXPRESSION] as never}
          localTemplates={templates as never}
          type='any'
          level={0}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

const settled = () => new Promise((resolve) => setTimeout(resolve, 1200));

/**
 * Writing `null` in the Text tab and switching to Visual silently erased it:
 * the draft came back holding `{type: "any"}` — an argument with a type and no
 * value — and the visual view said
 * `Value for argument 1 ("any") is invalid: Value is empty`.
 *
 * The null literal was being counted as an EMPTY FIELD. With a type of `any`
 * and templates on offer, the "the author cleared this, re-offer the template
 * selector" rule fired, flipped the argument into template mode with a null
 * template value, and that reported the field as cleared.
 */
describe('an argument holding the DPQL null literal', () => {
  it('is not erased when the field has templates to offer', async () => {
    const changes: any[] = [];
    renderBuilder([{ type: 'any', value: null }], (v) => changes.push(v));
    await settled();

    // Nothing may rewrite the argument at all — the author did not touch it.
    const erasing = changes.filter((c) => {
      const arg = c?.value?.args?.[0];
      return !arg || arg.value === undefined;
    });

    expect(erasing).toEqual([]);
  });

  it('does not report the field as empty', async () => {
    renderBuilder([{ type: 'any', value: null }], () => undefined);
    await settled();

    expect(document.body.textContent).not.toContain('Value is empty');
    expect(document.body.textContent).not.toContain('Something went wrong');
  });

  it('still offers the template selector for a genuinely empty argument', async () => {
    // The rule itself must survive: an argument with NO value, `any`-typed,
    // with templates on offer, is what the selector is for.
    renderBuilder([{}], () => undefined);
    await settled();

    expect(document.body.textContent).toContain('Select Template');
  });
});
