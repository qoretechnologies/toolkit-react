// Copyright 2026 Qore Technologies, s.r.o.
/**
 * Is this expression argument SUPPLIED, or is it still missing?
 *
 * DPQL has a null literal: `null` parses to `{exp: "value", args: [null]}` and
 * round-trips, and an author writing it in the text editor means *"this is the
 * value — nothing"*. It is the only way to assert that a call returned no
 * value, which is how it was reported.
 *
 * The rule, stated once here because three different places had drawn it
 * differently: **an argument that is explicitly null is supplied; one that is
 * absent or `undefined` is still missing.**
 *
 * The builder used to ask `size(arg) === 0`, and lodash answers `0` for `null`
 * as readily as for `{}`. So an explicit null was read as a missing argument
 * and reset from the catalogue's declaration — which is how a saved draft ended
 * up holding `{"type": "any", "required": true}`, an argument DEFINITION where
 * its value should be, with the author's `null` gone and `required` (a schema
 * key, never a value key) left behind to give it away.
 */

/**
 * True when `arg` carries no value yet — `undefined`, the `{}` the builder
 * writes when a type change resets an argument, or any envelope with no
 * `value` in it.
 *
 * `null` is NOT missing: it is the null literal.
 *
 * The rule used to be "an object with no keys at all", which let an envelope
 * holding nothing but SCHEMA keys pass as a supplied value. That is how a saved
 * draft kept `{type: 'any', required: true}` — an argument DEFINITION where the
 * author's value belonged — and why re-opening the expression never repaired
 * it: the builder looked at those two keys, concluded the argument was already
 * supplied, and left the definition in place as data. `required` is a schema
 * key; nothing ever reads it back off a stored value.
 *
 * Asking for the `value` instead makes the question the one that was always
 * meant: has the author put something here?
 *
 * @param arg one entry of an expression's `args`
 */
export const isExpressionArgumentMissing = (arg: unknown): boolean => {
  if (arg === null) {
    return false;
  }

  if (arg === undefined) {
    return true;
  }

  if (typeof arg !== 'object') {
    // a raw scalar argument — `0`, `false` and `''` are values too
    return false;
  }

  return (arg as { value?: unknown }).value === undefined;
};

/**
 * The shape the builder stores an argument in: `{type, value}`.
 *
 * A parse result carries its arguments RAW — `args: [null]`, `args: [3]` —
 * because that is what the grammar produced. The builder's editors read
 * `arg.value`, so a raw argument has to be widened before it is stored, and
 * widening `null` is the whole point: dropped instead, the author's null
 * becomes an argument with no `value` key at all, which every later reader
 * treats as an empty field.
 *
 * An argument that is already an envelope is returned untouched.
 *
 * @param arg one entry of an expression's `args`
 * @param uiType the type the catalogue declares for that position
 */
export const asExpressionArgumentEnvelope = (arg: unknown, uiType?: string): unknown => {
  if (arg !== null && (arg === undefined || typeof arg === 'object')) {
    return arg;
  }

  return { value: arg, ...(uiType ? { type: uiType } : {}) };
};

/**
 * Does this value still look like an expression AST?
 *
 * `{exp, args}` is the shape the builder and `dpql/parse` both produce. The
 * check is structural on purpose: the flag that marks an option as holding an
 * expression describes its VALUE, so the value is what should decide whether
 * the flag survives a change that said nothing about it.
 */
export const looksLikeExpressionAst = (value: unknown): boolean =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  typeof (value as { exp?: unknown }).exp === 'string';

/**
 * Whether an option should still be marked as holding an expression.
 *
 * The form engine used to delete the flag on ANY change that did not re-assert
 * it, and most changes do not: an editor re-mounting, a revert, a validation
 * pass. The value stayed the AST while the flag went, so the option degraded
 * into a plain hash — which is how an assertion's Expected Value came back
 * from a saved draft as a two-field object showing `exp` and `args`, and why
 * `encodeTestValue` then stored it with `source: "literal"`.
 *
 * @param isFunction what the caller said: `true` sets the flag, `false` clears
 * it deliberately (choosing a concrete type does this), `undefined` is no
 * opinion at all
 * @param value the option's new value
 * @param wasExpression whether the option was marked before this change
 */
export const shouldMarkAsExpression = (
  isFunction: boolean | undefined,
  value: unknown,
  wasExpression: boolean | undefined
): boolean => {
  if (isFunction === true) {
    return true;
  }

  if (isFunction === false) {
    return false;
  }

  // No opinion: the flag belongs to the value, so it survives exactly as long
  // as the value is still an expression.
  return !!wasExpression && looksLikeExpressionAst(value);
};

/**
 * Fill in an expression's missing arguments, leaving the supplied ones alone.
 *
 * Extracted from the builder so the decision it makes can be tested directly:
 * a component test of the same behaviour passed just as happily with the defect
 * in place, because the builder normalises on an interaction the harness never
 * performed. A test that cannot fail is worse than none.
 *
 * @param expressions the served expression catalogue
 * @param expression the chosen expression's `name`
 * @param args the arguments so far — raw from a parse, or envelopes from the
 * builder's own editors
 */
export const addMissingExpressionArgs = (
  expressions: any[] | undefined,
  expression: string,
  args: any[] = []
): any[] => {
  const newArgs = [...args];
  const selected = expressions?.find((exp) => exp?.name === expression);

  if (!selected) {
    return newArgs;
  }

  if (selected.varargs) {
    if (selected.subtype === 2) {
      newArgs.push({ is_expression: true, value: { args: [] } });
    } else {
      newArgs.push(
        ...Array.from({ length: (selected.min_args ?? 1) - 1 }, () => ({
          type:
            selected.args[0].ui_type === 'richtext' || selected.args[0].ui_type === 'number'
              ? selected.args[0].ui_type
              : undefined,
        }))
      );
    }

    return newArgs;
  }

  selected.args.forEach((arg: any, index: number) => {
    /* A RAW argument, as `dpql/parse` produces it — `args: [null]`, `args: [3]`
       — is widened into the `{type, value}` envelope the editors read. Widening
       the null is the point: dropped instead, the author's `null` became an
       argument with no `value` key, and the branch below then filled the gap
       from the catalogue's DECLARATION, which is how a saved draft came back
       holding `{type: "any", required: true}` where its value belonged. */
    newArgs[index] = asExpressionArgumentEnvelope(newArgs[index], arg.ui_type);

    /* "Missing" already means "carries no value", so an argument waiting for
       its catalogue default is simply a missing one — it needs no separate
       test. */
    if (!isExpressionArgumentMissing(newArgs[index])) {
      return;
    }

    newArgs[index] =
      arg.default_value ?
        { value: arg.default_value, type: arg.ui_type }
      : {
          type:
            arg.ui_type === 'richtext' || arg.ui_type === 'number' || arg.ui_type === 'bool' ?
              arg.ui_type
            : undefined,
        };
  });

  return newArgs;
};
