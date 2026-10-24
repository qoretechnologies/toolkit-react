// Copyright 2026 Qore Technologies, s.r.o.
// A yes / no that holds no value shows no answer (qorus#646, David): the switch was drawn on "No" while the form
// said it had no value and asked for one - display, value and validation disagreed. Unset is the switch's own
// unset state; No is false, Yes is true.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const shown = vi.hoisted(() => ({ checked: 'not drawn' as unknown }));

vi.mock('../src/components/form/fields/boolean/Boolean', async () => {
  const actual = await vi.importActual<
    typeof import('../src/components/form/fields/boolean/Boolean')
  >('../src/components/form/fields/boolean/Boolean');
  const Shown = (props: { checked?: boolean }) => {
    shown.checked = props.checked;
    return null;
  };
  return { ...actual, BooleanFormField: Shown, default: Shown };
});

import { AutoFormField } from '../src/components/form/fields/auto/AutoFormField';

beforeEach(() => {
  shown.checked = 'not drawn';
});

describe('a yes / no', () => {
  for (const [value, expected] of [
    [undefined, undefined],
    [null, undefined],
    [false, false],
    [true, true],
  ] as const) {
    it(`holding ${String(value)} shows ${String(expected)}`, () => {
      render(
        <ReqoreUIProvider>
          <AutoFormField name='flag' defaultType='bool' value={value as never} onChange={vi.fn()} />
        </ReqoreUIProvider>
      );
      expect(shown.checked).toBe(expected);
    });
  }
});
