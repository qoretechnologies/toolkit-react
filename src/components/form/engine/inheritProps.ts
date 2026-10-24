// Copyright 2026 Qore Technologies, s.r.o.
import { IQorusFormField, TQorusForm } from '@qoretechnologies/ts-toolkit';

/**
 * Resolve a field's `inherit_props` map against the current available
 * options (plus any values inherited from an outer FormEngine scope),
 * producing a `{ propName: siblingValue }` hash suitable for spreading
 * onto the field's renderer.
 *
 * For each entry `<prop-name-on-renderer> -> <sibling-field-name>`, the
 * sibling's current value is forwarded under the receiving prop name.
 * Lookup order:
 *   1. `availableOptions[siblingName]?.value` — the field's local scope.
 *   2. `inheritedFromParent[siblingName]` — the bag threaded in by an
 *      outer FormEngine (see the `inheritedFromParent` prop). Used when
 *      a composite field's `arg_schema` sub-form needs to reach a value
 *      on an ancestor scope — e.g. a service-method row's `body` picking
 *      up `language` from the parent service form.
 * Missing siblings emit `undefined`, which the renderer's prop type can
 * treat as "no hint".
 *
 * Designed to be JSON-pure: no closures, no transformations. Renderers
 * decide how to use the forwarded value (e.g. the consumer-injected
 * `code-editor` renderer maps a `language: "qore"` prop to its
 * highlighter mode).
 *
 * Mirrored in qorus-ide `src/components/Field/systemOptions.tsx`; keep
 * the two in sync (see qorus-ide's `.claude/CLAUDE.md`).
 */
export const resolveInheritProps = (
  inheritProps: Record<string, string> | undefined,
  availableOptions: TQorusForm | undefined,
  inheritedFromParent?: Record<string, unknown>
): Record<string, unknown> => {
  if (!inheritProps) return {};
  const out: Record<string, unknown> = {};
  for (const propName in inheritProps) {
    const siblingName = inheritProps[propName];
    const localValue = (availableOptions?.[siblingName] as IQorusFormField | undefined)?.value;
    out[propName] = localValue !== undefined ? localValue : inheritedFromParent?.[siblingName];
  }
  return out;
};
