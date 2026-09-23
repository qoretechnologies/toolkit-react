import { IQorusFormSchema, TQorusForm } from '@qoretechnologies/ts-toolkit';
import { createContext } from 'use-context-selector';

/** The form a field is standing in: what it declares, and what it currently holds. */
export interface IOptionsContext {
  schema?: IQorusFormSchema;
  value?: TQorusForm;
}

/**
 * The surrounding form, for a renderer that has to judge one field against its
 * SIBLINGS — an allowed value gated on another field's answer, for instance.
 *
 * It lives in a module of its own rather than in `FormEngine`, which imports
 * the field renderers that read it: a renderer importing the engine back would
 * close a cycle around a value created at module scope, and the context would
 * be `undefined` for whichever module happened to be evaluated first.
 *
 * An empty default is load-bearing. `value` is `undefined` only when there is
 * no form around the renderer at all — a picker mounted on its own, a story, a
 * test — and a predicate about siblings has nothing to say there. Inside a form
 * it is always an object, empty or not.
 */
export const OptionsContext = createContext<IOptionsContext>({});
