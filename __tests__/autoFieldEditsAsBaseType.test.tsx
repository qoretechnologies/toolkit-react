// Copyright 2026 Qore Technologies, s.r.o.
// A field of a type it has no editor of is edited as its base type.
//
// Qorus gives every field, option and argument the base data type of its values (`base_type`: `string` for an
// email address, `int` for a timeout). A field of a type the auto field draws no editor of - a string format
// type such as an email address, a user type, a type a newer server adds - showed "Unknown type!" in place of
// its editor, so a form could not set it (qorus#646). It is now edited as its base type; only a type with no
// base type it can edit is unknown.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* Every render of the text editor an auto field draws text in. */
const drawn = vi.hoisted(() => ({ longString: [] as Record<string, any>[] }));

vi.mock('../src/components/form/fields/long-string/LongString', () => ({
  default: (props: Record<string, any>) => {
    drawn.longString.push(props);
    return null;
  },
}));

import { AutoFormField, IAutoFieldProps } from '../src/components/form/fields/auto/AutoFormField';

const field = (props: Partial<IAutoFieldProps>) =>
  render(
    <ReqoreUIProvider>
      <AutoFormField name='field' onChange={vi.fn()} {...props} />
    </ReqoreUIProvider>
  );

beforeEach(() => {
  drawn.longString = [];
});

describe('a field of a type the auto field has no editor of', () => {
  it('is edited as text where its base type is text: a string format type', () => {
    field({ type: 'email', defaultType: 'email', base_type: 'string', value: 'ops@example.com' });

    expect(screen.queryByText('Unknown type!')).toBeNull();
    expect(drawn.longString.length).toBeGreaterThan(0);
    drawn.longString.forEach((props) =>
      expect(props).toMatchObject({ type: 'string', value: 'ops@example.com' })
    );
  });

  it('is edited as its base type: a user type of whole numbers', () => {
    const { container } = field({
      type: 'qoretechnologies/order-id' as never,
      defaultType: 'qoretechnologies/order-id' as never,
      base_type: 'int',
      value: 7,
    });

    expect(screen.queryByText('Unknown type!')).toBeNull();
    expect(container.querySelector<HTMLInputElement>('input')?.value).toBe('7');
    expect(drawn.longString).toHaveLength(0);
  });

  it('is edited as its base type with a soft base type too', () => {
    field({ type: 'order-ref' as never, defaultType: 'order-ref' as never, base_type: 'softstring' });

    expect(screen.queryByText('Unknown type!')).toBeNull();
    expect(drawn.longString.length).toBeGreaterThan(0);
  });

  it('is unknown with no base type', () => {
    field({ type: 'legacy-code' as never, defaultType: 'legacy-code' as never, value: 'A7' });

    expect(screen.getByText('Unknown type!')).toBeTruthy();
    expect(drawn.longString).toHaveLength(0);
  });

  it('is unknown with a base type it has no editor of either', () => {
    field({
      type: 'legacy-code' as never,
      defaultType: 'legacy-code' as never,
      base_type: 'mystery',
      value: 'A7',
    });

    expect(screen.getByText('Unknown type!')).toBeTruthy();
  });

  it('keeps the editor of a type it has one of, whatever its base type', () => {
    field({ type: 'string', defaultType: 'string', base_type: 'int', value: 'abc' });

    expect(drawn.longString.length).toBeGreaterThan(0);
    drawn.longString.forEach((props) => expect(props).toMatchObject({ value: 'abc' }));
  });
});
