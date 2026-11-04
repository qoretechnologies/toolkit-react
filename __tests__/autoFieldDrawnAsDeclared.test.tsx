// Copyright 2026 Qore Technologies, s.r.o.
// A field is drawn as the type it is declared from its first render.
//
// It was drawn first as the untyped `any` and given its declared type only once it had mounted. For that
// first render an untyped field's editor - text, with the field's templates as chips - was handed the
// value as text, and a rich-text value is a document: `String()` made it `[object Object]`, on screen
// until the next render. Reqraft's expression builder showed it in an `in(...)` operand holding rich
// text, in the Qorus IDE's Expression Builder stories.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* Every render of the two editors an AutoField can draw text in, in order. */
const drawn = vi.hoisted(() => ({
  richText: [] as Record<string, any>[],
  longString: [] as Record<string, any>[],
}));

vi.mock('../src/components/form/fields/rich-text/RichText', () => ({
  RichTextFormField: (props: Record<string, any>) => {
    drawn.richText.push(props);
    return null;
  },
}));

vi.mock('../src/components/form/fields/long-string/LongString', () => ({
  default: (props: Record<string, any>) => {
    drawn.longString.push(props);
    return null;
  },
}));

import {
  AutoFormField,
  IAutoFieldProps,
  resolveAutoFieldTypes,
} from '../src/components/form/fields/auto/AutoFormField';

const TEMPLATES = { items: [{ label: 'Richtext Template', value: '$local:some-richtext' }] };

/** A rich-text value: a document holding one template chip, as the builder stores it. */
const DOCUMENT = [
  {
    type: 'paragraph',
    children: [
      {
        type: 'tag',
        label: 'Richtext Template',
        value: '$local:some-richtext',
        children: [{ text: '' }],
      },
    ],
  },
];

const field = (props: Partial<IAutoFieldProps>) =>
  render(
    <ReqoreUIProvider>
      <AutoFormField name='list' onChange={vi.fn()} {...props} />
    </ReqoreUIProvider>
  );

beforeEach(() => {
  drawn.richText = [];
  drawn.longString = [];
});

describe('a field declared as rich text, holding a document, with templates on offer', () => {
  it('is drawn in the rich-text editor holding the document from its first render', () => {
    field({
      type: 'richtext',
      defaultType: 'richtext',
      value: DOCUMENT,
      templates: TEMPLATES,
      allowTemplates: true,
    });

    expect(drawn.richText.length).toBeGreaterThan(0);
    // every render: never the untyped field's text editor, never the document written as text
    drawn.richText.forEach((props) => {
      expect(props.valueFormat).toBeUndefined();
      expect(props.value).toBe(DOCUMENT);
    });
    expect(drawn.longString).toHaveLength(0);
  });

  it('is drawn in the rich-text editor from its first render without templates too', () => {
    field({ type: 'richtext', defaultType: 'richtext', value: DOCUMENT });

    drawn.richText.forEach((props) => expect(props.value).toBe(DOCUMENT));
    expect(drawn.richText.length).toBeGreaterThan(0);
    // the untyped field's editor without templates is the textarea: not drawn either
    expect(drawn.longString).toHaveLength(0);
  });
});

describe('a field declared as long text', () => {
  it('is drawn as a document from its first render, never as the one line an untyped field takes', () => {
    field({
      defaultType: 'long-string',
      value: 'Interface $local:id failed',
      templates: TEMPLATES,
      allowTemplates: true,
    });

    expect(drawn.richText.length).toBeGreaterThan(0);
    drawn.richText.forEach((props) =>
      expect(props).toMatchObject({ valueFormat: 'text', singleLine: false })
    );
  });
});

describe('the types a field mounts with', () => {
  it('is the declared type, unquoted, for both', () => {
    expect(resolveAutoFieldTypes('"richtext"' as any, undefined, DOCUMENT)).toEqual({
      type: 'richtext',
      internalType: 'richtext',
    });
  });

  it("edits an untyped field holding a value as the value's type", () => {
    expect(resolveAutoFieldTypes('any', undefined, 12)).toEqual({
      type: 'any',
      internalType: 'int',
    });
    expect(resolveAutoFieldTypes('auto', undefined, ['a'])).toEqual({
      type: 'auto',
      internalType: 'list',
    });
  });

  it('leaves an untyped field holding nothing untyped', () => {
    expect(resolveAutoFieldTypes('any', undefined, undefined)).toEqual({
      type: 'any',
      internalType: 'any',
    });
  });

  it('edits as `defaultInternalType` where one is given', () => {
    expect(resolveAutoFieldTypes('any', 'string', 12)).toEqual({
      type: 'any',
      internalType: 'string',
    });
  });

  it("takes the value's type where no type is declared", () => {
    expect(resolveAutoFieldTypes(undefined, undefined, true)).toEqual({
      type: 'bool',
      internalType: 'bool',
    });
    expect(resolveAutoFieldTypes(undefined, undefined, undefined)).toEqual({
      type: 'auto',
      internalType: 'auto',
    });
  });
});
