// Copyright 2026 Qore Technologies, s.r.o.
/*
 * A host's words are read when something is drawn or built, never copied at load: a completion's kind badge says the
 * host's word for its kind, and the template tree finds its own groups by what they are, not by their English label.
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CompletionList } from '../src/components/smartEditor/CompletionMenu';
import { kindBadge } from '../src/components/smartEditor/completionStyle';
import { toDropdownItems } from '../src/components/smartEditor/useLspAutocomplete';
import { setReqraftLabels } from '../src/helpers/reqraftLabels';
import {
  allTemplateNodes,
  templateTree,
  withServerCompletions,
} from '../src/helpers/templateTree';

afterEach(() => {
  setReqraftLabels();
});

const list = (kind: number) =>
  render(
    <ReqoreUIProvider>
      <CompletionList
        id='kinds'
        groups={[{ label: '', items: toDropdownItems([{ label: 'PENDING', kind } as never]) }]}
        focusedIndex={0}
        onSelect={vi.fn()}
      />
    </ReqoreUIProvider>
  );

describe("a completion's kind badge", () => {
  it('says the kind in words, never the protocol name', async () => {
    list(20);
    await waitFor(() => expect(document.body.textContent).toContain('Enum member'));
    expect(document.body.textContent).not.toContain('EnumMember');
  });

  it("says the host's word for the kind, not the English read when the module loaded", async () => {
    setReqraftLabels({ editor: { completionKinds: { 20: 'Aufzählungswert' } } });
    list(20);
    await waitFor(() => expect(document.body.textContent).toContain('Aufzählungswert'));
    expect(document.body.textContent).not.toContain('Enum member');
  });

  it('keeps the words a row was given, in its kind’s colour', () => {
    expect(kindBadge(3, false, 'Eigene')).toMatchObject({ label: 'Eigene' });
    setReqraftLabels({ editor: { completionKinds: { 3: 'Funktion' } } });
    expect(kindBadge(3)).toMatchObject({ label: 'Funktion' });
    expect(kindBadge(undefined)).toBeUndefined();
  });
});

const SERVER_FIELDS = [
  { label: '@status', kind: 5, insertText: '@status', detail: 'Text' },
  { label: '$timestamp:', kind: 6, insertText: '$timestamp:' },
];

describe("the template tree's own groups, in a host's words", () => {
  const roots = () =>
    templateTree(
      { items: [{ label: 'Order data', items: [{ label: 'order id', value: '$local:{order_id}' }] }] },
      { fields: { name: { type: 'string' } } }
    );

  it("joins the server's record fields to the record's own group when the host words it", () => {
    setReqraftLabels({ templateTree: { recordFields: 'Datensatzfelder' } });
    const merged = withServerCompletions(roots(), SERVER_FIELDS);
    const groups = merged.filter((node) => node.group === 'recordFields');
    // one group, the field's own and the server's together, under the host's word
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Datensatzfelder');
    expect(groups[0].children?.map((node) => node.value)).toEqual(['@name', '@status']);
    expect(merged.map((node) => node.label)).not.toContain('Record fields');
  });

  it("names the groups a template is in with the host's words", () => {
    setReqraftLabels({
      templateTree: { recordFields: 'Datensatzfelder', templateContexts: 'Vorlagenkontexte' },
    });
    const merged = withServerCompletions(roots(), SERVER_FIELDS);
    const status = allTemplateNodes(merged).find((node) => node.value === '@status');
    expect(status?.trail).toEqual(['Datensatzfelder']);
    const timestamp = allTemplateNodes(merged).find((node) => node.reference === '$timestamp:');
    expect(timestamp?.trail).toEqual(['Vorlagenkontexte']);
    expect(merged.find((node) => node.group === 'templateContexts')?.label).toBe('Vorlagenkontexte');
  });
});
