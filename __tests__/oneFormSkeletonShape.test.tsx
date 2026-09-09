import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * A form that is waiting looks like a form, everywhere it waits.
 *
 * Reported twice as "a series of skeletons when loading". The boot gates were
 * unified first; this is the same defect one level down, inside a form. A
 * single page could show, in order: the engine's own loading state (three bars
 * over three big panels), a spinner reading "Loading field data…" while a field
 * resolved its `arg_schema`, an 80px block for a nested hash, and the host's
 * own field-row skeleton. Four pictures for one wait, each replacing the last.
 *
 * Read from source rather than by mounting: each of these gates is closed only
 * while a different request is in flight, so a test that mounted one would say
 * nothing about the other three. The rule is that they all reach for the same
 * component.
 */
const WAITS: Record<string, string> = {
  'the engine waiting for its options': 'src/components/form/engine/FormEngine.tsx',
  'a field resolving its arg_schema': 'src/components/form/fields/auto/AutoFormField.tsx',
  'a hash rendering a nested form': 'src/components/form/fields/Field.tsx',
};

describe('every wait inside a form', () => {
  it.each(Object.entries(WAITS))('%s draws the one form skeleton', (_name, path) => {
    expect(readFileSync(path, 'utf8')).toContain('<FormFieldsSkeleton');
  });

  it.each(Object.entries(WAITS))('%s draws nothing else', (_name, path) => {
    const src = readFileSync(path, 'utf8');

    /* The shapes this replaced. A bare skeleton block or a spinner inside a
       form is a second vocabulary, which is what made the page read as a
       series.
    
       Matched as RENDERED tags: these files still discuss the old spinner in
       their comments, which is where that history belongs, and an assertion on
       the raw text would forbid explaining what changed. */
    expect(src).not.toContain('<ReqoreSkeleton');
    expect(src).not.toContain('<ReqoreSpinner');
  });

  it('is exported, so a host can wait in the same shape', () => {
    // The Qorus IDE has its own `FormSkeleton` in front of these; it delegates
    // here rather than keeping a lookalike that could drift.
    expect(readFileSync('src/components/form/index.tsx', 'utf8')).toContain(
      "export * from './engine/FormFieldsSkeleton'"
    );
  });
});
