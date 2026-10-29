// Copyright 2026 Qore Technologies, s.r.o.
// A template reference is drawn as the same chip wherever it is shown: the read summary (TemplateText), the
// read-only chip (ReadOnlyTemplateTag), the rich text editor (RichText) and the expression editor's DPQL chips
// (qorus#646).
//
// They drew the chip at different sizes — `size='tiny'` with the prose's own font, the caller's size, and the
// editor's default size — so switching a value between its Visual and Expression views made the chip jump. They
// now all draw one chip (`REFERENCE_CHIP_PROPS`): a `small` box, big enough to press, whose label takes the font of
// whatever it sits in and wraps inside it. What is drawn is measured here where jsdom can draw it; the boxes are
// measured in the browser (the TemplateText, ReadOnlyTemplateTag and DpqlEditor stories, `expectChipFits`).
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const editor = vi.hoisted(() => ({ props: undefined as Record<string, any> | undefined }));

/* A ref-taking component, as the real one is: the field hands it a ref for its completion list. */
vi.mock('@qoretechnologies/reqore/dist/components/RichTextEditor', async () => {
  const { forwardRef } = await import('react');
  return {
    ReqoreRichTextEditor: forwardRef((props: Record<string, any>, _ref) => {
      editor.props = props;
      return null;
    }),
  };
});

import { makeDpqlTagRenderer } from '../src/components/dpqlEditor/dpqlTags';
import { RichTextFormField } from '../src/components/form/fields/rich-text/RichText';
import { ReadOnlyTemplateTag } from '../src/components/form/fields/template/ReadOnlyTemplateTag';
import { TemplateText } from '../src/components/form/fields/template/TemplateText';
import { REFERENCE_CHIP_PROPS } from '../src/helpers/templates';

const TEMPLATES = { items: [{ label: 'Customer Name', value: '$local:name' }] } as never;

/** The size of the text the chip sits in: not one of a tag's own. */
const HOST_FONT = '17px';

/** The font size a chip's label is drawn at. */
const chipLabelFontSize = (container: HTMLElement): string =>
  getComputedStyle(container.querySelector<HTMLElement>('.reqore-tag .reqore-tag-content')!)
    .fontSize;

beforeEach(() => {
  editor.props = undefined;
});

describe('the same template reference chip in every view', () => {
  it('the read summary chip takes the font it sits in', () => {
    const { container } = render(
      <ReqoreUIProvider>
        <div style={{ fontSize: HOST_FONT }}>
          <TemplateText
            segments={[{ kind: 'tag', value: '$local:name', text: 'Customer Name' } as never]}
            templates={TEMPLATES}
          />
        </div>
      </ReqoreUIProvider>
    );
    expect(chipLabelFontSize(container)).toBe(HOST_FONT);
  });

  it('the read-only chip takes the font it sits in', () => {
    const { container } = render(
      <ReqoreUIProvider>
        <div style={{ fontSize: HOST_FONT }}>
          <ReadOnlyTemplateTag value='$local:name' templates={TEMPLATES} />
        </div>
      </ReqoreUIProvider>
    );
    expect(chipLabelFontSize(container)).toBe(HOST_FONT);
  });

  it('the expression editor chips are the same chip', () => {
    const renderTag = makeDpqlTagRenderer({});

    expect(renderTag({ type: 'tag', value: '@create', children: [{ text: '' }] })).toMatchObject(
      REFERENCE_CHIP_PROPS
    );
    expect(
      renderTag({ type: 'tag', value: '$local:name', children: [{ text: '' }] })
    ).toMatchObject(REFERENCE_CHIP_PROPS);
  });

  it('the rich text editor chip is the same chip', () => {
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
    expect(editor.props?.getTagProps(paragraph.children[1])).toMatchObject(REFERENCE_CHIP_PROPS);
  });
});
