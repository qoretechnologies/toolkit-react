# Form field extras — bucket-1 portable fields

Follow-on to the field migration (see
[`design/FORM_ENGINE_FIELD_MIGRATION.md`](../design/FORM_ENGINE_FIELD_MIGRATION.md)).
Picks off the **cleanly portable** bucket-1 fields one at a time, and
records an evidence-based triage of the ones that are *not* a quick port
(so "deferred" stays honest, not vague).

**Status:** `byte-size`, `url`, `multi-select`/`select-array` done pending
user verify — uncommitted, 2026-06-09. 3 new Field stories pass
(`test-storybook`), jest 267/267, prod typecheck + eslint clean. The rest
remain triaged below.

## Done this pass

| Type | What | How |
|---|---|---|
| `byte-size` | **new** `byte-size/ByteSize.tsx` | amount `NumberFormField` + unit `SelectFormField` (KiB/MiB/GiB/TiB); value is the combined `"512MiB"` string. `splitByteSize` reimplemented (3 lines). No app deps. |
| `url` | **new** `url/Url.tsx` | thin `ReqoreInput type="url"` + `new URL()` validity hint. Built fresh — qorus-ide's `URLField` imports `context/init` (app-coupled); a URL field doesn't need it. |
| `multi-select` / `select-array` | wired existing `MultiSelectFormField` | reqraft already had the component; added a `renderField` branch **before** the single-value `allowed_values` short-circuit (multi-select owns its options + is always an array), and a `renderAllowedValues` guard so the picker isn't doubled. |

> **Superseded 2026-06-10 (FIELD_STACK_REPORT phase 3):** the `url` and
> `byte-size` rows above describe the original from-scratch versions — both
> were replaced by verbatim IDE ports (url: protocol select + `://` + address;
> byte-size: KiB/MiB only). Descriptions kept for history; see
> FIELD_STACK_REPORT for the current implementations.

Surface area: `src/components/form/fields/byte-size/ByteSize.tsx` (new),
`src/components/form/fields/url/Url.tsx` (new),
`src/components/form/fields/Field.tsx` (3 cases + multi-select branch +
allowed-values guard + 2 imports), `src/components/form/index.tsx`
(exports), `src/components/form/fields/Field.stories.tsx` (`ByteSize`,
`Url`, `MultiSelect` stories).

## Triage of the remaining bucket-1 / bucket-2 fields

Evidence is the qorus-ide source's size + its outside-`Field/` imports
(the portability tell — app context can't come to the toolkit).

| Type | qorus-ide source | Blocker / verdict |
|---|---|---|
| `option_hash` | `optionHash.tsx` (129) | imports `../../App`, `context/init`, `withTextContext` — **app-coupled**; needs a rewrite, not a port. |
| `array-of-pairs` | `multiPair.tsx` (207) | imports `../../App`, `withTextContext` — app-coupled; moderate rewrite. |
| `enum`-as-radio | `radioField.tsx` (127) | imports `../../App`, two HOCs, **image assets**. Reqraft already has `RadioGroup`; `enum` currently routes to `Select`. Switching is a UX decision, low value. |
| `code-editor` | `CodeEditor/` | **Monaco** — a heavy new runtime dependency reqraft doesn't carry. A dependency call for the maintainers, not something to add unilaterally. |
| `data-provider` | `connectors/` | connection-management + **OAuth2** + instance context — squarely bucket-3 (app integration), excluded by the design. |
| `options` | `systemOptions.tsx` (1500+) | this *is* `FormEngine`, which reqraft already has. Exposing a `type: 'options'` wrapper is possible but needs option-set value-shape decisions; defer until a consumer needs it. |
| `tool-catalog` | `toolCatalog/` (434) | server-driven feature editor (All/Some/None per source). Schema-editor-sized; own task. |
| `active-windows` | `activeWindows/` (290) | server-driven cron-window editor. Own task. |
| `collection-documents` | `collectionDocuments.tsx` (347) | managed uploads tied to AI-collection APIs. Own task. |
| `test-cases` | `testCases/` (**1469**) | large server-driven editor (`/tests/step-kinds`, `/tests/assertions`). Its own multi-day task. |
| `processor-mappings` | `ProcessorMappingPanel` | processor field-mapping editor; feature-specific. Own task. |

**Principle:** small + dependency-free → done now; app-coupled or
server-driven feature editors → their own task, pulled when a real
consumer needs them so they can be verified against that use (the lesson
from the schema editor's `ui_type` path).

## Tasks

- [x] `ByteSizeFormField` + `case 'byte-size'` + export + story
- [x] `UrlFormField` + `case 'url'` + export + story
- [x] `multi-select`/`select-array` branch + allowed-values guard + story
- [x] Prod typecheck, eslint, jest (267), form play tests (only the
      pre-existing `OnValidityChange` fails)
- [ ] **STOP — user verifies in browser** before commit

## Out of scope

- Everything in the triage table marked "own task" / "app-coupled" /
  "dependency call" — see the per-row verdicts above.
- Bucket-3 interface selectors (excluded by the design doc).
