// Copyright 2026 Qore Technologies, s.r.o.
// A template reference is drawn as the same chip wherever it is shown: the read summary (TemplateText), the
// read-only chip (ReadOnlyTemplateTag) and the expression editor (RichText) (qorus#646).
//
// The three drew the chip at different sizes — `size='tiny'` with the prose's own font, the caller's size,
// and the editor's default size — so switching a value between its Visual and Expression views made the chip
// jump. They now all draw a `tiny` chip whose label takes the font of whatever it sits in (`fontSize:
// 'inherit'`), so a reference is the same size in every view.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const editor = vi.hoisted(() => ({ props: undefined as Record<string, any> | undefined }));

vi.mock('@qoretechnologies/reqore/dist/components/RichTextEditor', () => ({
  ReqoreRichTextEditor: (props: Record<string, any>) => {
    editor.props = props;
    return null;
  },
}));

import { RichTextFormField } from '../src/components/form/fields/rich-text/RichText';
import { ReadOnlyTemplateTag } from '../src/components/form/fields/template/ReadOnlyTemplateTag';
import { TemplateText } from '../src/components/form/fields/template/TemplateText';

const TEMPLATES = { items: [{ label: 'Customer Name', value: '$local:name' }] } as never;

const chipFontSize = (container: HTMLElement): string | undefined =>
  container.querySelector<HTMLElement>('.reqore-tag')?.style.fontSize;

beforeEach(() => {
  editor.props = undefined;
});

describe('the same template reference chip in every view', () => {
  it('the read summary chip takes the font it sits in', () => {
    const { container } = render(
      <ReqoreUIProvider>
        <TemplateText
          segments={[{ kind: 'tag', value: '$local:name', text: 'Customer Name' } as never]}
          templates={TEMPLATES}
        />
      </ReqoreUIProvider>
    );
    expect(chipFontSize(container)).toBe('inherit');
  });

  it('the read-only chip takes the font it sits in', () => {
    const { container } = render(
      <ReqoreUIProvider>
        <ReadOnlyTemplateTag value='$local:name' templates={TEMPLATES} />
      </ReqoreUIProvider>
    );
    expect(chipFontSize(container)).toBe('inherit');
  });

  it('the expression editor chip is a tiny chip that takes the font it sits in', () => {
    render(
      <RichTextFormField
        valueFormat='text'
        templates={TEMPLATES}
        allowTemplates
        value='Dear $local:name'
        onChange={vi.fn()}
      />
    );
    const [paragraph] = editor.props?.value;
    const props = editor.props?.getTagProps(paragraph.children[1]);
    expect(props.size).toBe('tiny');
    expect(props.style?.fontSize).toBe('inherit');
  });
});
