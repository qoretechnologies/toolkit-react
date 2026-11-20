import { describe, expect, it } from 'vitest';
import { buildTemplates, ITemplatesPayload } from '../src/helpers/templates';

/**
 * A list of templates says what the server gives as a person would read it: an example as it is written, the full
 * description where there is one, no stand-in for a missing one, and the server's own context in sentence case.
 */
const PAYLOAD: ITemplatesPayload = {
  _context: {
    display_name: 'Context Data',
    short_desc: 'No description available',
    internal: true,
    builtin: true,
    items: [
      {
        display_name: 'City',
        value: '$local:city',
        type: 'string',
        example_value: 'Prague',
        short_desc: 'The city',
        desc: 'The city the order ships to, as the customer wrote it.',
      },
      {
        display_name: 'Address',
        value: '$local:address',
        type: 'hash',
        example_value: { street: 'Main', number: 3 },
        short_desc: 'No description available',
      },
    ],
  },
  receive_order: {
    display_name: 'Receive Order',
    short_desc: 'No Description Available.',
    items: [{ display_name: 'ID', value: '$data:{receive_order.id}', type: 'int' }],
  },
};

const groups = () => buildTemplates(PAYLOAD)?.items ?? [];
const context = () => groups().find((group) => group.label === 'Context data');
const item = (label: string) => context()?.items?.find((entry) => entry.label === label);

describe('a list of templates in the server’s words', () => {
  it('shows a text example as it is written and anything else as data', () => {
    expect(item('City')?.description).toBe('Example value: Prague');
    expect(item('Address')?.description).toBe('Example value: {"street":"Main","number":3}');
  });

  it('hovers with the full description where there is one, else the line', () => {
    expect((item('City')?.metadata as { description?: string }).description).toBe(
      'The city the order ships to, as the customer wrote it.'
    );
  });

  it('says nothing where the server says it has no description', () => {
    expect((item('Address')?.metadata as { description?: string }).description).toBeUndefined();
    expect(context()?.description).toBeUndefined();
    expect(groups().find((group) => group.label === 'Receive Order')?.description).toBeUndefined();
  });

  it('names the server’s own context in sentence case and keeps a state’s name as written', () => {
    expect(groups().map((group) => group.label)).toEqual(['Context data', 'Receive Order']);
    expect((item('City')?.metadata as { displayName?: string }).displayName).toBe('Context data');
  });
});
