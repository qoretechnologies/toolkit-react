// Copyright 2026 Qore Technologies, s.r.o.
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { size } from 'lodash';
import { createContext, useContext } from 'react';
import { describeTemplateReference } from '../../../../helpers/templates';

/**
 * SEAM (reqraft): what a host knows of the references its values mention beyond its catalogue of templates.
 *
 * A chip names a reference from the catalogue. One the catalogue does not list drew its raw spelling
 * (`$._case.attempt`) as if it were a name, in the same style as a named one, so nothing said it was not a value on
 * offer (qorus#646, David: "the chips / templates / etc were meant to abstract the technical format from our
 * users"). It now says so, and a host can name the ones it knows.
 */
export interface ITemplateReferenceNames {
  /** A name for a reference the host knows but does not list (the IDE: a value every case has). */
  label?: (reference: string) => string | undefined;
  /** What the chip of a reference nothing names says on hover (the IDE: "Not a value this case captures"). */
  unlistedHint?: string;
}

/** What the chip of a reference nothing names says on hover, where the host says nothing of its own. */
export const DEFAULT_UNLISTED_REFERENCE_HINT = 'Not one of the values offered here';

const TemplateReferenceNamesContext = createContext<ITemplateReferenceNames>({});

/** The host's names for references, for every chip under it: the read row's and the editor's alike. */
export const TemplateReferenceNamesProvider = TemplateReferenceNamesContext.Provider;

/** The class of a chip whose reference nothing names. */
export const UNLISTED_REFERENCE_CLASS = 'reqraft-reference-unlisted';

/** How a reference's chip draws, beside what the catalogue says of it. */
export interface IReferenceStanding {
  /** The host's name for it, where the catalogue has none. */
  label?: string;
  /** Nothing names it: the catalogue does not list it and the host does not know it. */
  unlisted: boolean;
}

/**
 * Whether anything names a reference: the catalogue, else the host. A catalogue with nothing in it (not loaded yet,
 * or a field that offers none) tells nothing apart, so nothing is said to be unlisted against it.
 */
export const referenceStanding = (
  templates: IReqoreFormTemplates | undefined,
  reference: string,
  names: ITemplateReferenceNames = {}
): IReferenceStanding => {
  if (describeTemplateReference(templates, reference).item) {
    return { unlisted: false };
  }
  const label = names.label?.(reference);
  if (typeof label === 'string' && label) {
    return { label, unlisted: false };
  }
  return { unlisted: size(templates?.items) > 0 };
};

/** The chip props a reference nothing names draws with: a warning, and the host's hint on hover. */
export const unlistedReferenceChipProps = (names: ITemplateReferenceNames) => ({
  intent: 'warning' as const,
  tooltip: names.unlistedHint || DEFAULT_UNLISTED_REFERENCE_HINT,
  className: UNLISTED_REFERENCE_CLASS,
});

/** The host's names for references, as the nearest provider gives them. */
export const useTemplateReferenceNames = (): ITemplateReferenceNames =>
  useContext(TemplateReferenceNamesContext);
