// Copyright 2026 Qore Technologies, s.r.o.
/**
 * Which options offer the per-type choices ("Integer", "Text", "Hash", …) in
 * the row's menu.
 *
 * A field that pins no concrete type has to give the author some way to say
 * what kind of value they mean, and the row menu is where that lives — the
 * alternative, a standalone *"Please select data type"* control, replaces a
 * typable field with a pick-only one.
 *
 * The rule was `ui_type === 'any'`, which is one of the three ways a schema
 * says "untyped", so the choices went missing on the other two:
 *
 *  - **`type: 'auto'` with no `ui_type` at all.** This is how the server
 *    declares an assertion's Expected Value, so that field never offered them.
 *    They appeared only inside an expression, where the OPERAND's schema does
 *    say `ui_type: 'any'` — so the same option offered them in the Visual view
 *    and not in the Text view, which reads as the menu losing items.
 *  - **A host's own untyped editor.** The IDE renders Expected Value through
 *    `test-reference`, a `ui_type` reqraft knows nothing about; the field is no
 *    less untyped for having a custom editor.
 *
 * `ui_type` is asked FIRST and on its own: a schema that names a concrete
 * editor (`ui_type: 'string'`) has pinned the field even if its storage `type`
 * is still `auto`.
 */
import { IQorusFormField } from '@qoretechnologies/ts-toolkit';

/** The spellings that mean "no concrete type" wherever they appear. */
export const BuiltInAnyLikeTypes = ['any', 'auto'];

/**
 * Does this option leave its type up to the author?
 *
 * @param option the option's schema entry
 * @param extraUiTypes host `ui_type` names that are untyped editors of their
 * own — see `FormEngine`'s `anyLikeUiTypes`
 */
export const offersTypeChoices = (
  option: Partial<IQorusFormField> | undefined,
  extraUiTypes?: string[]
): boolean => {
  if (!option) {
    return false;
  }

  const uiType = (option as { ui_type?: string }).ui_type;

  if (uiType) {
    return BuiltInAnyLikeTypes.includes(uiType) || !!extraUiTypes?.includes(uiType);
  }

  // No `ui_type`: the storage type is the only thing that can pin the field.
  return BuiltInAnyLikeTypes.includes((option as { type?: string }).type as string);
};
