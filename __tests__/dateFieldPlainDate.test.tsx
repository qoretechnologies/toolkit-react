import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A plain date (queue item 33): a day held as `YYYY-MM-DD` reaches Reqore's picker as the day it is, with the
 * picker's `plainDate`. Made a full date-time first, it was UTC midnight: the day before west of UTC.
 */

/** What the field handed the picker, render by render. */
const handed: Record<string, unknown>[] = [];

vi.mock('@qoretechnologies/reqore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@qoretechnologies/reqore')>();

  return {
    ...actual,
    DatePicker: (props: Record<string, unknown>) => {
      handed.push(props);
      return null;
    },
  };
});

const { DateFormField } = await import('../src/components/form/fields/date/Date');

beforeEach(() => {
  handed.length = 0;
});

const last = () => handed[handed.length - 1];

describe('a date field', () => {
  it('hands a plain date to the picker as the day it is', () => {
    render(
      <ReqoreUIProvider>
        <DateFormField plainDate value='2026-10-17' onChange={vi.fn()} />
      </ReqoreUIProvider>
    );

    expect(last()).toMatchObject({ value: '2026-10-17', plainDate: true });
  });

  it('still hands any other date as a full date-time, as it did', () => {
    render(
      <ReqoreUIProvider>
        <DateFormField value='2026-10-17' onChange={vi.fn()} />
      </ReqoreUIProvider>
    );

    expect(last()?.value).toBe('2026-10-17T00:00:00.000Z');
    expect(last()).not.toHaveProperty('plainDate');
  });
});
