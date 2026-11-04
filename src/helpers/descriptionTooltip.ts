// Copyright 2026 Qore Technologies, s.r.o.
import { IReqoreTooltip, TReqoreTooltipProp } from '@qoretechnologies/reqore/dist/types/global';
import { useMemo } from 'react';
import {
  TMarkdownRenderer,
  useMarkdownRenderer,
} from '../components/Description/markdownRendererContext';
import { useCoarsePointer } from '../hooks/useCoarsePointer';
import { plainTextNode } from './markdownText';

/**
 * How wide a description's card grows: as wide as what it says, up to a readable line (about 80 characters of
 * the card's text), and never wider than the screen. At 360px a one-sentence description broke onto two lines on
 * any screen.
 */
export const DESCRIPTION_TOOLTIP_MAX_WIDTH = 'min(560px, calc(100vw - 24px))';

/** How a surface shows a description's card: see `useDescriptionTooltips`. */
export interface IDescriptionTooltipOptions {
  /** The host's markdown renderer, when it has one. */
  render?: TMarkdownRenderer;
  /** The pointer cannot hover (a finger): the card opens on a tap instead. */
  tapToOpen?: boolean;
}

/**
 * How this surface shows a description's card: drawn by the host's markdown renderer, and opened by a tap
 * where there is no hover.
 *
 * A hover card does not open on a touch screen. Reqore opens it on `mouseenter` and closes it on any click,
 * and a tap is both, so the card closed the moment it opened and what it says was out of a finger's reach.
 * Where the pointer is a finger (`useCoarsePointer`, as the color field and the expression builder ask), the
 * card opens on a tap of what it describes and closes on the next tap, there or anywhere else.
 */
export const useDescriptionTooltips = (): IDescriptionTooltipOptions => {
  const render = useMarkdownRenderer();
  const tapToOpen = useCoarsePointer();
  return useMemo(() => ({ render, tapToOpen }), [render, tapToOpen]);
};

/** A description drawn as a hover draws it: by the host's renderer, compact, else as its plain text. */
export const describedContent = (description: string, { render }: IDescriptionTooltipOptions) =>
  render ? render({ value: description, compact: true }) : plainTextNode(description);

/**
 * A description from the server as the hover of whatever it describes: a template chip, a choice, a
 * section of a schema.
 *
 * A description is markdown, written by the same author as the field descriptions and the template list
 * this package already draws through the host's renderer (`useMarkdownRenderer`). A hover that took the
 * same string as plain content printed its `**` and backticks at the reader, beside a list that drew them.
 * So every hover of a description is made here, drawn by the same renderer, `compact` as a hover card is.
 *
 * Without a host renderer it reads as the plain text its markdown renders to - the words and the paragraph
 * breaks, none of the marks (`markdownToPlainText`) - as the template list's rows do: reqraft draws in no dialect
 * the host never chose, and prints no `**` either.
 *
 * `title` heads the card - a template's name, say. Returns the title alone when there is no description,
 * and undefined when there is neither.
 */
export const descriptionTooltip = (
  description: unknown,
  { render, tapToOpen }: IDescriptionTooltipOptions,
  title?: string
): TReqoreTooltipProp | undefined => {
  const touch: Partial<IReqoreTooltip> = tapToOpen ? { handler: 'click' } : {};
  if (typeof description !== 'string' || !description.trim()) {
    // a title alone says what the thing it is on already says: nothing for a finger to open
    return title || undefined;
  }
  const content = describedContent(description, { render }) as IReqoreTooltip['content'];
  if (typeof content === 'string' && !title && !tapToOpen) {
    return content;
  }
  return {
    ...(title ? { title } : {}),
    content,
    maxWidth: DESCRIPTION_TOOLTIP_MAX_WIDTH,
    ...touch,
  };
};
