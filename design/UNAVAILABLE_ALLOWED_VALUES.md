# An offered value that cannot be picked

**As-built.**
`src/components/form/engine/OptionFieldMessages.tsx` —
`getAllowedValueAvailability`, `useAllowedValueAvailability`,
`ALLOWED_VALUE_AVAILABLE`;
`src/helpers/options.ts` — `getRefusalMessage`,
`UNAVAILABLE_VALUE_FALLBACK_REASON`;
`src/components/form/fields/select/SelectCollection.tsx` —
`getSelectItemUnavailability`, `UNAVAILABLE_ITEM_CLASS`,
`getSelectItemTitleActions`;
`src/helpers/validations.ts` — `parseDependency`, `isDependencyFulfilled`.

## The rule

A value that is offered and cannot be picked is **disabled and says why**. It
is never hidden, and it is never silently inert.

Hiding it is worse than either: a choice that vanishes takes its own
explanation with it, and leaves the reader looking for something they were
told exists.

The rule already existed one level up, on whole FIELDS — a field whose
`depends_on` is unmet renders locked with the dependency named. A VALUE had no
such grammar: a picker could mark a choice `disabled`, and the result was a row
that ignored clicks and explained nothing.

## The two sources, and why they render identically

Two things can refuse a value:

- **the predicate** — the value's own `depends_on`, judged against the form it
  is standing in. Whatever the form itself can decide.
- **the pre-resolved refusal** — `disabled: true` with `messages`, from whoever
  already knows: the server, for a sandbox or permission context, a capability
  of the selected kind, or a requirement in a scope `depends_on` deliberately
  cannot reach.

They render identically, because a reader has no way to tell them apart and no
reason to care. The predicate is checked first when both could speak: it names
a field in this very form, so the reader can act on it without leaving the row,
while a served reason is a statement about somewhere else.

`getAllowedValueAvailability` is the one place that decides, and
`getRefusalMessage` is the one place that decides WHICH of a value's messages
is the reason — `danger`, then `warning`, then the first. Without that, the
picker and the form's own resolver could word the same refusal differently.

A refusal with no message at all still says something
(`UNAVAILABLE_VALUE_FALLBACK_REASON`, "This value is not available"). Silence
over a value that will not respond is the defect this exists to remove.

### Never reqore's `disabled`

A refused VALUE is never handed to reqore's `disabled`. That applies
`DisabledElement`, which is `pointer-events: none` — and it takes the row's
tooltip and any control in its title bar with it, which are the two places the
reason can be read. What makes a row inert is **having no handler**: reqore
derives `interactive` from the handlers a panel or a button was given, so a row
with none gets no pointer cursor and no hover lift while keeping every pointer
event it had.

The FIELD's own `disabled` still goes through reqore. A field nobody may edit
has no explanation to protect.

The dimming lands on the **title**, never on the row: `opacity` creates a
stacking context, so dimming the row would dim the reason inside it.

## The `!name` grammar

`depends_on` on a value is the same grammar, the same parser and the same
evaluator a FIELD's `depends_on` uses, one level down. Top-level entries are an
AND; a nested array is an OR of its own entries. Four entry forms:

| Entry         | Holds when                                      |
| ------------- | ----------------------------------------------- |
| `name`        | the sibling has a value                         |
| `!name`       | the sibling has **no** value                     |
| `name=value`  | the sibling holds exactly that value            |
| `name!=value` | the sibling is answered, and not with that value |

`!name` is the form `name!=value` cannot make. "Not X" is a statement about an
answer, so `!=` requires the sibling to be answered; two options that exclude
one another each apply only while the OTHER has not been answered at all.
`!` binds to the whole entry, so `!name` never carries a value, and `!=` is
parsed first — which is what keeps `name!=value` from being read as a leading
`!`.

An absent sibling satisfies `!name`, exactly as it fails the bare form: neither
has an answer to judge, and a mutual exclusion that locked both halves until
one of them was materialised would offer the author no way in.

`!name` also gets a sentence of its own when it is named to the reader
(`"Session Cookie Name" must have no value`). Run through the comparison
template it would have read `must not be "undefined"`.

## Which paths are converted

Every single-value picker reqraft draws carries the full shape — **no reqore
`disabled`, no handler, the reason printed in the row and readable on hover,
the name dimmed, a padlock**:

| Path                                                  | Refused by                | Notes                                                                                    |
| ----------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------- |
| `SelectFieldCollection` (the dialog picker)           | no row handler            | reason ABOVE the description, padlock title action, tooltip, and folded into `searchString` so the reason is searchable |
| `SelectFormField` → `reqoreItems` (anchored dropdown) | no row handler            | reason leads the description; `effect` dims                                                |
| `SelectFormField` → `asMenu`                          | no row handler            | `readOnly` for the cursor, `effect` dims                                                   |
| `SelectFormField` → `creatableItems` (`ReqoreSelect`) | `handleCreatableChange`   | reqore owns this list's selection — see below                                              |
| `FieldAllowedValuesCheckGroup` (≤3 values)            | no row handler            | `labelEffect` + `readOnly`; the reason is the checkbox `description`                        |
| `FormField`'s own ≤3 checkbox group                   | no row handler            | same                                                                                       |
| `MultiSelectFormField`                                | `onValueChange`           | reqore owns this list's selection — see below                                               |

On a checkbox the reason is IN the row rather than only on its hover: a
checkbox has no body to bury it in, and a hover is the one affordance a touch
screen and a keyboard never reach. The dimming there is `labelEffect`, not
`effect` — a non-switch `ReqoreCheckbox` destructures `effect` out and never
applies it, so a row that asked for `effect` got the padlock, the cursor and
**no dimming at all**. `labelEffect` reaches the label's `ReqoreTextEffect`,
which is also the right thing to dim, since the `description` beside it carries
the reason.

### Where the refusal is not on the row

`ReqoreSelect` and `ReqoreMultiSelect` own their own selection: their rows take
no per-item handler this code could withhold. Against the reqore we pin
(`^0.74.1`) the only per-row prop that refuses is `disabled`, which is the one
prop the rule forbids — so for those two the row is *marked* (reason,
tooltip, padlock, dimming, `readOnly` cursor) and the refusal lands in the one
handler this code does own:

- `handleCreatableChange` drops an offered value that is unavailable. A
  creatable field can reach the same value by typing its text, which is the
  same value by another route and is refused as one. Clearing (`undefined`) is
  the author's own act and is never refused.
- `MultiSelectFormField`'s `onValueChange` drops a newly added refused value
  and **keeps** any value the selection already held (see "A value that becomes
  unavailable", below).

reqore 0.76.0 makes a `readOnly` dropdown / select item unchoosable by click
and by keyboard. When reqraft's pin moves to it, those rows refuse themselves
and the two handler guards become a second lock on the same door.

## What is deliberately NOT converted

- **The `*` wildcard in `MultiSelectFormField`** still uses reqore's
  `disabled` for the other items while `*` is selected. That is a state of the
  SELECTION, not a refusal of the value, and it has no reason of its own to
  protect.
- **`MultiSelectFormField` does not judge `depends_on` on a value.** It is
  handed the raw `allowed_values` rather than the mapped items the single-value
  pickers build, so only a server-resolved refusal (`disabled` + `messages`)
  reaches it. Closing this means calling `useAllowedValueAvailability` inside
  that component; it is a behaviour extension rather than a fix, and it is not
  in this change.
- **Keyboard navigation still stops on a refused dropdown row.** reqore 0.74.1
  excludes `disabled` rows from a dropdown's arrow-key walk, and it has no
  notion of a row that merely carries no handler. So the arrows land on a
  refused row and Enter silently does nothing. The row is fully readable there,
  which is the point, but the keyboard gives no other signal. reqore 0.76.0
  excludes a `readOnly` row from the same walk, so this closes when the pin
  moves.
- **The resolver and the hook are not exported.**
  `getAllowedValueAvailability`, `useAllowedValueAvailability`,
  `UNAVAILABLE_VALUE_FALLBACK_REASON` and `getRefusalMessage` are not in
  `src/index.tsx` or `src/components/form/index.tsx`, so a host cannot reach
  any of them today. Only `getSelectItemUnavailability` and
  `UNAVAILABLE_ITEM_CLASS` are public, through the `SelectCollection` barrel
  entry. A host that wants to resolve availability itself needs the exports
  added — this is a deliberate hold, not an oversight: the shape of
  `IAllowedValueAvailabilityInput` is provisional until ts-toolkit publishes
  `depends_on` on `IQorusAllowedValue` and `IReqraftAllowedValue` collapses
  into it.

## Two behaviour changes worth knowing about

### A bare `disabled` item with no message

`getSelectItemUnavailability` treats ANY `disabled` item as a refusal, and
gives it the fallback reason when it carries no message. A caller who marked an
item `disabled` purely to grey it out now gets a row that is dimmed, padlocked,
carries the words "This value is not available", and — in the collection and
dropdown paths — keeps its pointer events instead of being `pointer-events:
none`. That is the intended treatment: a value that will not respond and says
nothing is exactly the defect this mechanism removes. A caller who wants the
old deadening on an offered value has no way to ask for it.

### `metadata` woke a dead branch

`mapAllowedValue` used to be an eleven-key whitelist, and `metadata` was not
one of the keys. `SelectFormField`'s `hasItemsWithWarning` / `hasWarning`
(`Select.tsx`, ≈L243 and ≈L256) read `item.metadata?.needs_auth` and colour the
control and its item-count badge `warning` — a branch that could never fire for
items built by `mapAllowedValue`. Forwarding `metadata` activated it: a field
offering a connection that needs authentication now shows a warning intent
where it previously showed none. This is the branch doing what it was written
to do, but it is a visible change, and it arrived as a side effect of widening
the whitelist rather than as its own decision.

## A value that becomes unavailable while it is selected

**Deliberately left alone.** An already-selected value that later becomes
unavailable is neither cleared nor flagged as an error: the picker refuses it,
and the form goes on holding it and reporting it valid.

Clearing it would destroy an answer the author gave, on an edit to a *sibling*
field — which is a far worse failure than holding a value the form can no
longer offer. The author can still see the value, and still change or remove it
themselves; in the multi-select they can still remove its chip. The refusal
only ever prevents a NEW selection, which is why
`MultiSelectFormField.onValueChange` compares against the values it already
holds rather than filtering the refused list wholesale.

Two consequences to know:

- Validation does not object. `validateField` has no general notion of an
  allowed value being unavailable. The one exception is a `connection`-typed
  field, which has always rejected a value whose allowed-value entry carries
  `disabled` or `metadata.needs_auth` — and that check reads the SCHEMA's own
  `disabled`, so a value refused only by its `depends_on` still validates.
- In the creatable and multi-select pickers the selected chip is built by
  spreading the item, so a held value that is now refused shows dimmed and
  padlocked. That is the only place the state is visible on the value itself.

If a held-but-refused value should ever become an error, it belongs in
`validateField` beside the `connection` case, and it needs the resolved
availability — not the schema's `disabled` — to be correct.
