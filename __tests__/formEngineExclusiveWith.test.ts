import { describe, expect, it } from 'vitest';
import { fixOptions, isExcludedBySetOption } from '../src/components/form/engine/FormEngine';

/* Discord's send-message options as the server declares them: the webhook URL is preselected and
 * cannot be set together with a connection, a guild or a channel; the two ways to send form one
 * required group. */
const schema = {
  content: { type: 'string', required: true, preselected: true },
  webhook: {
    type: 'string',
    preselected: true,
    required_groups: ['discord-destination'],
    exclusive_with: ['qorus_app_connection', 'guild', 'channel'],
  },
  qorus_app_connection: {
    type: 'string',
    preselected: true,
    required_groups: ['discord-destination'],
  },
  guild: { type: 'string' },
  channel: { type: 'string' },
} as never;

describe('fixOptions and exclusive_with', () => {
  it('does not add an option that cannot be set together with one the value holds', () => {
    const fixed = fixOptions(
      {
        content: { type: 'string', value: 'hello' },
        qorus_app_connection: { type: 'string', value: 'discord' },
      } as never,
      schema
    );
    expect(fixed).not.toHaveProperty('webhook');
    expect(fixed.qorus_app_connection).toEqual({ type: 'string', value: 'discord' });
  });

  it('counts an exclusion declared only on the other option', () => {
    // the connection is not in the value; the webhook holds one and names the connection
    const fixed = fixOptions(
      { webhook: { type: 'string', value: 'https://discord.com/api/webhooks/1/x' } } as never,
      schema
    );
    expect(fixed).not.toHaveProperty('qorus_app_connection');
    expect(fixed.content).toEqual({ type: 'string', value: undefined });
  });

  it('still offers both ways to send when the value holds neither', () => {
    const fixed = fixOptions({} as never, schema);
    expect(Object.keys(fixed).sort()).toEqual(['content', 'qorus_app_connection', 'webhook']);
  });

  it('keeps an option the value already holds, even one it excludes', () => {
    const value = {
      webhook: { type: 'string', value: 'https://discord.com/api/webhooks/1/x' },
      qorus_app_connection: { type: 'string', value: 'discord' },
    } as never;
    const fixed = fixOptions(value, schema);
    expect(fixed.webhook).toEqual({
      type: 'string',
      value: 'https://discord.com/api/webhooks/1/x',
    });
    expect(fixed.qorus_app_connection).toEqual({ type: 'string', value: 'discord' });
  });

  it('does not let an empty option exclude another', () => {
    const fixed = fixOptions(
      { qorus_app_connection: { type: 'string', value: '' } } as never,
      schema
    );
    expect(fixed).toHaveProperty('webhook');
  });
});

describe('isExcludedBySetOption', () => {
  it('reads both directions, a bare value, and ignores malformed declarations', () => {
    expect(isExcludedBySetOption('webhook', { guild: 'Qore' } as never, schema)).toBe(true);
    expect(isExcludedBySetOption('guild', { webhook: 'https://x' } as never, schema)).toBe(true);
    expect(isExcludedBySetOption('guild', { channel: 'api' } as never, schema)).toBe(false);
    expect(isExcludedBySetOption('webhook', { guild: [] } as never, schema)).toBe(false);
    expect(
      isExcludedBySetOption(
        'a',
        { b: 'x' } as never,
        { a: { type: 'string', exclusive_with: 'b' } } as never
      )
    ).toBe(false);
    expect(isExcludedBySetOption('a', undefined as never, schema)).toBe(false);
  });
});
