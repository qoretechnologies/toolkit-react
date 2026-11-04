// Copyright 2026 Qore Technologies, s.r.o.
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { size } from 'lodash';
import { createContext, useContext } from 'react';
import { catalogueValues } from '../../../../helpers/templateText';
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
  /**
   * What a reference the host knows but does not list is: its hover's description. A host that names a reference
   * and says nothing of it leaves its hover saying there is no description (`noDescription`).
   */
  describe?: (reference: string) => string | undefined;
  /** Why a reference's hover has no description, in the host's words; "No description was given for this value." */
  noDescription?: string;
  /** What the chip of a reference nothing names says on hover (the IDE: "Not a value this case captures"). */
  unlistedHint?: string;
}

/** What a reference's hover says of it beyond the catalogue: the host's name, description and reason for none. */
export const hostSaysOf = (reference: string, names: ITemplateReferenceNames) => ({
  label: names.label?.(reference),
  description: names.describe?.(reference),
  noDescription: names.noDescription,
});

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
 * The context a reference is in: `$record:` for `$record:{orders[*].id}`, `$._case` for `$._case.attempt` (a host's
 * own grammar, its root).
 */
export const referenceContext = (reference: string): string =>
  /^\$[\w-]*:/.exec(reference)?.[0] ?? /^\$\.?[^.[{]+/.exec(reference)?.[0] ?? reference;

/**
 * Whether anything names a reference: the catalogue, else the host. A reference is said to be unlisted only against
 * a catalogue that speaks for its context - one that lists something in it (`$._case.mode` for `$._case.attempt`):
 * a catalogue of templates says nothing of a record's fields (`$record:`, the record's own), nor of a context it
 * lists nothing in, and one with nothing in it (not loaded yet, or a field that offers none) tells nothing apart.
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
  if (!size(templates?.items)) {
    return { unlisted: false };
  }
  // (a walk into a listed value is that value's: `describeTemplateReference` names it)
  const context = referenceContext(reference);
  return {
    unlisted: catalogueValues(templates).some((value) => referenceContext(value) === context),
  };
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
