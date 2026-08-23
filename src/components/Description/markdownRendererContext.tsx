import { createContext, ReactNode, useContext } from 'react';

/**
 * Draws a markdown string.
 *
 * `compact` asks for a constrained container — a row inset, a callout, a hover
 * card — rather than a page: markdown authored as a document routinely opens
 * with `##`, and at document scale that heading outgrows the title above it.
 */
export type TMarkdownRenderer = (args: { value: string; compact?: boolean }) => ReactNode;

/**
 * The renderer `Description` draws markdown with, when a host supplies one.
 *
 * This package renders markdown in exactly one place — a field's description —
 * but an application that has field descriptions has markdown everywhere else
 * too: on its object pages, in its catalogues, in its chat transcripts. When
 * reqraft draws descriptions with its own dialect and the host draws everything
 * else with its own, the same text renders two different ways depending on which
 * surface it landed on, and neither side can tell which one the reader saw.
 *
 * So the host's renderer wins where there is one. The built-in is a fallback for
 * hosts that have no renderer of their own, not a second opinion.
 */
export const MarkdownRendererContext = createContext<TMarkdownRenderer | undefined>(undefined);

/** Returns the host-supplied markdown renderer, or `undefined` for the built-in. */
export const useMarkdownRenderer = (): TMarkdownRenderer | undefined =>
  useContext(MarkdownRendererContext);
