// Copyright 2026 Qore Technologies, s.r.o.
import { createContext, ReactNode, useContext, useMemo } from 'react';
import {
  builtInTypeLabel,
  builtInTypeName,
  builtInTypeSentenceForm,
  qorusTypeDisplayName,
  qorusTypeKnownName,
  TTypeLabel,
  TTypeName,
  TTypeSentenceForm,
} from '../../helpers/qorusTypeCatalogue';
import { useQorusTypes } from '../../hooks/useQorusTypes';

/**
 * The words a form draws types in (qorus#646): a type inside a sentence, as a reference chip's hover says it ("A
 * whole number."), and a type's name as a label, as an open option's type tag shows it ("Whole number"). The
 * server's catalogue, in the language it was asked for, where a form has fetched it (`TypeSentenceFormProvider`,
 * which `FormEngine` puts around everything it draws); the built-in one elsewhere. A chip drawn on its own
 * fetches nothing: a fetch needs the host's fetch context, which a chip rendered outside a form (a template
 * preview, a test) does not have.
 */
const TypeWordsContext = createContext<{
  sentenceForm: TTypeSentenceForm;
  name: TTypeName;
  label: TTypeLabel;
}>({
  sentenceForm: builtInTypeSentenceForm,
  name: builtInTypeName,
  label: builtInTypeLabel,
});

/** What a type is called inside a sentence, by the catalogue the surrounding form has. */
export const useTypeSentenceForm = (): TTypeSentenceForm =>
  useContext(TypeWordsContext).sentenceForm;

/** A type's name as a label where the catalogue lists it, by the catalogue the surrounding form has. */
export const useTypeName = (): TTypeName => useContext(TypeWordsContext).name;

/**
 * A type's name as a label that is never its code, by the catalogue the surrounding form has: what a list of
 * templates badges a template with (`qorusTypeDisplayName`: a user type with no base type by its path, any other
 * unknown type "Unknown type").
 */
export const useTypeLabel = (): TTypeLabel => useContext(TypeWordsContext).label;

/** Gives what it draws the server's catalogue's words for each type (`useQorusTypes`). */
export const TypeSentenceFormProvider = ({ children }: { children: ReactNode }) => {
  const { getTypeSentenceForm, value } = useQorusTypes();
  const words = useMemo(
    () => ({
      sentenceForm: getTypeSentenceForm,
      // a type the catalogue does not list, by its base type (`qorusTypeEntry`)
      name: (typeName: string | undefined, baseType?: string) =>
        qorusTypeKnownName(value, typeName, baseType),
      label: (typeName: string | undefined, baseType?: string) =>
        qorusTypeDisplayName(value, typeName, baseType),
    }),
    [getTypeSentenceForm, value]
  );
  return <TypeWordsContext.Provider value={words}>{children}</TypeWordsContext.Provider>;
};
