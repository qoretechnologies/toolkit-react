// Copyright 2026 Qore Technologies, s.r.o.
import { createContext, ReactNode, useContext } from 'react';
import { builtInTypeSentenceForm, TTypeSentenceForm } from '../../helpers/qorusTypeCatalogue';
import { useQorusTypes } from '../../hooks/useQorusTypes';

/**
 * What a type is called inside a sentence, for what a form draws: a reference chip's hover says its type with it
 * ("A whole number.", qorus#646). The server's catalogue, in the language it was asked for, where a form has
 * fetched it (`TypeSentenceFormProvider`, which `FormEngine` puts around everything it draws); the built-in one
 * elsewhere. A chip drawn on its own fetches nothing: a fetch needs the host's fetch context, which a chip
 * rendered outside a form (a template preview, a test) does not have.
 */
const TypeSentenceFormContext = createContext<TTypeSentenceForm>(builtInTypeSentenceForm);

/** What a type is called inside a sentence, by the catalogue the surrounding form has. */
export const useTypeSentenceForm = (): TTypeSentenceForm => useContext(TypeSentenceFormContext);

/** Gives what it draws the server's catalogue's words for each type (`useQorusTypes`). */
export const TypeSentenceFormProvider = ({ children }: { children: ReactNode }) => {
  const { getTypeSentenceForm } = useQorusTypes();
  return (
    <TypeSentenceFormContext.Provider value={getTypeSentenceForm}>
      {children}
    </TypeSentenceFormContext.Provider>
  );
};
