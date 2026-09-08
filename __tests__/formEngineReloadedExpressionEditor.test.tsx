/**
 * A RELOADED expression opens in the expression editor, not as raw data.
 *
 * An expression is written as `{ type, is_expression: true, value: ast }` and
 * SAVED as `{ type, value: { is_expression: true, value: ast } }` — the flag
 * moves onto the value. `FormEngine` handed the field `other.is_expression`,
 * which does not exist in the saved shape, so a reloaded expression was not
 * recognised as one: an `auto` field resolved its type from the envelope it
 * could see, called it `hash`, and rendered `1 + 2` as an editable tree of
 * `is_expression` / `exp` / `args`.
 *
 * Reported from the live IDE as "after Run assertion my Expected Value shows as
 * raw expression data". The run is incidental — the `Value` field beside it,
 * which no run touched, was equally raw. The trigger is a RELOAD, the only
 * thing that puts an expression into its saved shape.
 *
 * Three traps, each of which produced a green test against the broken code:
 *
 *  - the form renders ASYNCHRONOUSLY, so reading `textContent` straight after
 *    `render` inspects an empty DOM and every "does not contain" assertion
 *    passes against nothing;
 *  - the editor only mounts for an EXPANDED row, so `initialExpandedOptions` is
 *    required — `expandFirstRequired` alone left the row collapsed, where both
 *    shapes correctly render `1 + 2` and the bug is invisible;
 *  - the runtime shape must be asserted alongside the saved one, or a fix that
 *    simply trades one shape for the other still passes.
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';

const fetchContext = {
  get: vi.fn(async () => ({ ok: true, data: [] })),
  post: vi.fn(async () => ({ ok: true, data: [] })),
  put: vi.fn(async () => ({ ok: true, data: [] })),
  del: vi.fn(async () => ({ ok: true, data: [] })),
};

/** `1 + 2`, as the expression builder stores it. */
const AST = {
  exp: '+',
  args: [
    { type: 'int', value: 1 },
    { type: 'int', value: 2 },
  ],
};

const SCHEMA = {
  expected_value: {
    type: 'auto',
    ui_type: 'auto',
    display_name: 'Expected Value',
    required: true,
    supports_expressions: true,
  },
};

const renderExpanded = async (value: Record<string, unknown>) => {
  const { container } = render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext as never}>
        <FormEngine
          compact
          // The editor mounts only for an expanded row — the whole point.
          initialExpandedOptions={['expected_value']}
          name='reloaded-expression'
          allowFunctions
          value={value as never}
          options={SCHEMA as never}
          onChange={vi.fn()}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

  await waitFor(() => {
    expect(container.textContent || '').toContain('Expected Value');
  });

  /* Wait for an editor of EITHER kind to mount before asserting anything.
     Waiting only for "some content" resolved while the row was still empty, so
     a "does not contain the raw envelope" assertion passed against a DOM that
     had not rendered it yet — green against the broken code. `Visual` is the
     expression editor's view tab and `Editor` the data editor's; settling on
     either means the row has decided which one it is. */
  await waitFor(() => {
    const text = container.textContent || '';
    expect(text.includes('Visual') || text.includes('Editor')).toBe(true);
  });

  return container;
};

/* The tell, taken from the live report: the type pill reads `Key/Value {}` and
   the envelope's own keys are laid out for hand editing. `is_expression` is
   never something an author types. */
const showsRawEnvelope = (container: HTMLElement) => {
  const text = container.textContent || '';
  return text.includes('is_expression') || text.includes('Key/Value');
};

describe('an expression loaded from a saved draft', () => {
  it('does not render the raw envelope for the author to edit', async () => {
    // THE REGRESSION — the saved shape, with the flag on the value.
    const container = await renderExpanded({
      expected_value: { type: 'auto', value: { is_expression: true, value: AST } },
    });

    expect(showsRawEnvelope(container)).toBe(false);
  });

  it('opens the expression editor for the saved shape', async () => {
    // Not just "the raw tree is gone" — the expression editor is what mounts.
    const container = await renderExpanded({
      expected_value: { type: 'auto', value: { is_expression: true, value: AST } },
    });

    expect(container.textContent || '').toContain('Visual');
  });

  it('still opens the expression editor for a freshly typed expression', async () => {
    // The runtime shape, which always worked — kept so a fix that trades one
    // shape for the other cannot pass.
    const container = await renderExpanded({
      expected_value: { type: 'auto', is_expression: true, value: AST },
    });

    expect(showsRawEnvelope(container)).toBe(false);
    expect(container.textContent || '').toContain('Visual');
  });

  it('still renders a value that really is a hash as data', async () => {
    // The guard is on `is_expression`, not on "the value is an object": a field
    // genuinely holding a hash must still get the data editor.
    const container = await renderExpanded({
      expected_value: { type: 'hash', value: { exp: 'not-an-expression' } },
    });

    expect(container.textContent || '').toContain('not-an-expression');
  });
});
