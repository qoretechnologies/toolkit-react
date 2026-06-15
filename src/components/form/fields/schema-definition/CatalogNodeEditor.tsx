/**
 * The recursive heart of the schema-definition editor.
 *
 * The qorus#225 catalogue is a tree of four node kinds — leaf, group,
 * map, list. The rendering strategy mirrors the IDE's interface detail
 * pages:
 *
 *   - **leaf** fields → the shared `<Options>` form (`CatalogLeafForm`).
 *   - **group** → `CatalogGroupBody` — the leaf form plus each nested
 *     child in its own labelled section.
 *   - **map** (columns, indexes, constraints, sequences, …) → a
 *     `ReqoreTable` overview, one row per entry, with the full editor
 *     opening in a side **drawer** on row-click.
 *   - **list** (migration steps) → the same table + drawer, with
 *     reorder controls.
 *
 * Tables-of-rows + edit-in-a-drawer is the established detail-page
 * vocabulary: the operator scans the overview, drills into one entry
 * at a time on a focused surface.
 */
import {
  ReqoreButton,
  ReqoreControlGroup,
  ReqoreDrawer,
  ReqoreInput,
  ReqoreP,
  ReqorePanel,
  ReqoreTable,
  ReqoreTag,
  useReqoreProperty,
  useReqoreTheme,
} from '@qoretechnologies/reqore';
import { getReadableColor } from '@qoretechnologies/reqore/dist/helpers/colors';
import { IReqoreTableColumn } from '@qoretechnologies/reqore/dist/components/Table';
import { memo, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import {
  isCatalogGroup,
  isCatalogList,
  isCatalogMap,
  partitionCatalogOptions,
  seedNewEntry,
} from './catalog';
import {
  CatalogLeafForm,
  ICatalogLeafFormNameField,
} from './CatalogLeafForm';
import {
  moveItem,
  removeKey,
  renameKey,
  SECTION_ICONS,
  setKey,
  uniqueKey,
} from './helpers';
import { ICatalogLeaf, ICatalogNode, ICatalogOptions } from './types';

/** Translucent, blurred drawer styling — matches the IDE's detail-page drawers. */
const DRAWER_STYLE = { opacity: 0.6, contentEffect: { backgroundBlur: 20 } } as const;

const asHash = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asList = (value: unknown): Array<Record<string, unknown>> =>
  Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];

/** Best-effort singular of a section's display name for "Add X" copy. */
const singularize = (label: string): string => {
  if (/(xes|ses|zes|ches|shes)$/i.test(label)) return label.slice(0, -2);
  if (label.endsWith('s')) return label.slice(0, -1);
  return label;
};

/** `true` when a cell value is worth showing in the overview table. */
const hasCellValue = (value: unknown): boolean =>
  value !== undefined &&
  value !== null &&
  value !== '' &&
  !(Array.isArray(value) && value.length === 0);

/**
 * Chooses which leaf fields become overview-table columns. Leaves are
 * ranked required → boolean flags → rest, then a column is kept only
 * if it is required or *some* row actually has a value for it — so a
 * migration-step table never shows an all-empty "Step ID" column.
 * Capped at `max` so wide entry shapes stay scannable.
 */
const visibleColumnKeys = (
  leaves: ICatalogOptions,
  rows: Array<Record<string, unknown>>,
  max = 5
): string[] => {
  const entries = Object.entries(leaves) as Array<[string, ICatalogLeaf]>;
  const required = entries.filter(([, n]) => n.required);
  const bools = entries.filter(([, n]) => !n.required && /bool/.test(n.type));
  const rest = entries.filter(([, n]) => !n.required && !/bool/.test(n.type));
  return [...required, ...bools, ...rest]
    .filter(
      ([key, node]) =>
        node.required || rows.some((row) => hasCellValue(row[key]))
    )
    .slice(0, max)
    .map(([key]) => key);
};

const MONO_FONT =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

/**
 * A monospace pill for enumerated tokens — a column type reads as
 * `VARCHAR` / `TIMESTAMP`, the way a DBA expects, not the catalogue's
 * prose display name.
 */
const MonoTag = styled.span<{ $color: string; $bg: string }>`
  display: inline-block;
  font-family: ${MONO_FONT};
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 2px 7px;
  border-radius: 4px;
  background: ${({ $bg }) => $bg};
  color: ${({ $color }) => $color};
`;

/** Monospace inline text for numeric / scalar table cells. */
const MonoText = styled.span<{ $color: string }>`
  font-family: ${MONO_FONT};
  font-size: 12px;
  color: ${({ $color }) => $color};
`;

/** Renders one leaf value as a table cell. */
const renderCell = (
  leaf: ICatalogLeaf,
  value: unknown,
  mono: { color: string; bg: string }
): ReactNode => {
  if (value === undefined || value === null || value === '') {
    return (
      <ReqoreP size='small' effect={{ opacity: 0.3 }}>
        —
      </ReqoreP>
    );
  }
  if (typeof value === 'boolean') {
    return (
      <ReqoreTag
        size='small'
        minimal
        asBadge
        intent={value ? 'success' : 'muted'}
        label={value ? 'yes' : 'no'}
      />
    );
  }
  // Enumerated tokens (column type, FK action, …) read as the raw
  // DB-ish token in a monospace pill — `VARCHAR`, not "Variable-length
  // string".
  if (leaf.allowed_values && typeof value === 'string') {
    return (
      <MonoTag $color={mono.color} $bg={mono.bg}>
        {value.toUpperCase()}
      </MonoTag>
    );
  }
  if (typeof value === 'number') {
    return <MonoText $color={mono.color}>{value}</MonoText>;
  }
  if (Array.isArray(value)) {
    return <MonoText $color={mono.color}>{value.join(', ')}</MonoText>;
  }
  return <ReqoreP size='small'>{String(value)}</ReqoreP>;
};

export interface ICatalogGroupBodyProps {
  /** Stable name prefix for nested form fields. */
  name: string;
  /** The catalogue `options` hash to render. */
  options: ICatalogOptions;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  readOnly?: boolean;
  /** Folds a "Name" field into the leaf form (map entries). */
  nameField?: ICatalogLeafFormNameField;
}

/**
 * Renders an `options` hash: its leaf fields as one form, then each
 * nested group / map / list child as its own labelled section.
 */
export const CatalogGroupBody = memo(
  ({
    name,
    options,
    value,
    onChange,
    readOnly,
    nameField,
  }: ICatalogGroupBodyProps) => {
    const { leaves, nested } = partitionCatalogOptions(options);

    const handleNestedChange = useCallback(
      (key: string, next: unknown) => {
        onChange({ ...value, [key]: next });
      },
      [value, onChange]
    );

    return (
      <ReqoreControlGroup vertical fluid gapSize='big'>
        <CatalogLeafForm
          name={`${name}-leaves`}
          leaves={leaves}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          nameField={nameField}
        />
        {nested.map(([key, child]) => {
          const childValue = value?.[key];
          const count = isCatalogMap(child)
            ? Object.keys(asHash(childValue)).length
            : isCatalogList(child)
            ? asList(childValue).length
            : undefined;
          const badge = [
            count !== undefined ? String(count) : undefined,
            child.required ? 'required' : undefined,
          ].filter(Boolean) as string[];
          return (
            <ReqorePanel
              key={key}
              minimal
              collapsible
              isCollapsed
              size='small'
              label={child.display_name}
              badge={badge.length ? badge : undefined}
              tooltip={child.short_desc}
              icon={SECTION_ICONS[key]}
            >
              <CatalogNodeEditor
                name={`${name}-${key}`}
                node={child}
                value={childValue}
                onChange={(next) => handleNestedChange(key, next)}
                readOnly={readOnly}
              />
            </ReqorePanel>
          );
        })}
      </ReqoreControlGroup>
    );
  }
);

export interface ICatalogNodeEditorProps {
  name: string;
  /** A group, map, or list node — leaves are handled by `CatalogLeafForm`. */
  node: ICatalogNode;
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly?: boolean;
}

/** Dispatches a single non-leaf catalogue node to its editor. */
export const CatalogNodeEditor = memo(
  ({ name, node, value, onChange, readOnly }: ICatalogNodeEditorProps) => {
    if (isCatalogGroup(node)) {
      return (
        <CatalogGroupBody
          name={name}
          options={node.options}
          value={asHash(value)}
          onChange={onChange}
          readOnly={readOnly}
        />
      );
    }
    if (isCatalogMap(node)) {
      return (
        <CatalogMapEditor
          name={name}
          title={node.display_name}
          options={node.options}
          value={asHash(value)}
          onChange={onChange}
          readOnly={readOnly}
        />
      );
    }
    if (isCatalogList(node)) {
      return (
        <CatalogListEditor
          name={name}
          title={node.display_name}
          options={node.options}
          value={asList(value)}
          onChange={onChange}
          readOnly={readOnly}
        />
      );
    }
    return null;
  }
);

interface ICatalogEntryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Stable name prefix for the drawer's form fields. */
  name: string;
  title: string;
  /** Singular noun for the remove button ("Remove column"). */
  noun: string;
  options: ICatalogOptions;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  readOnly?: boolean;
  /** Removes the entry and closes the drawer. */
  onRemove?: () => void;
  /** Map entries support renaming via a folded-in Name field. */
  onRename?: (next: string) => void;
}

/** Focused side-drawer for editing one map entry / list element. */
const CatalogEntryDrawer = memo(
  ({
    isOpen,
    onClose,
    name,
    title,
    noun,
    options,
    value,
    onChange,
    readOnly,
    onRemove,
    onRename,
  }: ICatalogEntryDrawerProps) => {
    const confirmAction = useReqoreProperty('confirmAction');
    const handleRemove = useCallback(() => {
      if (!onRemove) return;
      confirmAction({
        title: `Remove ${noun}`,
        description: `Remove the ${noun} "${title}"? This cannot be undone from inside the editor — re-add or revert the form to restore it.`,
        confirmLabel: `Remove ${noun}`,
        intent: 'danger',
        onConfirm: () => {
          onRemove();
          onClose();
        },
      });
    }, [confirmAction, noun, title, onRemove, onClose]);

    return (
    <ReqoreDrawer
      {...DRAWER_STYLE}
      isOpen={isOpen}
      onClose={onClose}
      position='right'
      size='560px'
      minimal
      label={title}
      icon='EditLine'
      closeButtonProps={{ flat: true, transparent: true }}
      contentStyle={{ padding: '16px 20px', overflowY: 'auto' }}
    >
      <ReqoreControlGroup vertical fluid gapSize='big'>
        <CatalogGroupBody
          name={name}
          options={options}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          nameField={
            onRename && !readOnly
              ? { value: title, label: 'Name', onRename }
              : undefined
          }
        />
        {onRemove && !readOnly ? (
          <ReqoreButton
            icon='DeleteBinLine'
            intent='danger'
            minimal
            fixed
            onClick={handleRemove}
          >
            Remove {noun}
          </ReqoreButton>
        ) : null}
      </ReqoreControlGroup>
    </ReqoreDrawer>
    );
  }
);

interface ICatalogMapEditorProps {
  name: string;
  /** The map's display name — drives the "Add X" copy. */
  title: string;
  options: ICatalogOptions;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  readOnly?: boolean;
}

/**
 * A name-keyed map — a `ReqoreTable` overview with one row per entry;
 * the full editor opens in a side drawer on row-click.
 */
const CatalogMapEditor = memo(
  ({ name, title, options, value, onChange, readOnly }: ICatalogMapEditorProps) => {
    const singular = singularize(title);
    const { leaves } = partitionCatalogOptions(options);
    const addNotification = useReqoreProperty('addNotification');
    const [openKey, setOpenKey] = useState<string | null>(null);
    const theme = useReqoreTheme();
    const mono = useMemo(
      () => ({
        color: getReadableColor(theme, undefined, undefined, true),
        bg: `${getReadableColor(theme)}14`,
      }),
      [theme]
    );

    const addEntry = useCallback(() => {
      const key = uniqueKey(
        value,
        `new_${singular.toLowerCase().replace(/\s+/g, '_')}`
      );
      onChange(setKey(value, key, seedNewEntry(options)));
      setOpenKey(key);
    }, [value, onChange, options, singular]);

    const rows = useMemo(
      () =>
        Object.entries(value).map(([key, entryValue]) => ({
          _selectId: key,
          _name: key,
          ...asHash(entryValue),
        })),
      [value]
    );

    const columnKeys = useMemo(
      () => visibleColumnKeys(leaves, rows),
      [leaves, rows]
    );

    const columns = useMemo<IReqoreTableColumn[]>(
      () => [
        {
          dataId: '_name',
          header: { label: 'Name' },
          grow: 2,
          minWidth: 160,
          sortable: true,
          cell: {
            content: (data) => (
              <ReqoreP size='small' effect={{ weight: 'bold' }}>
                {data._name}
              </ReqoreP>
            ),
          },
        },
        ...columnKeys.map((key): IReqoreTableColumn => {
          const leaf = leaves[key] as ICatalogLeaf;
          return {
            dataId: key,
            header: { label: leaf.display_name },
            grow: 1,
            minWidth: 110,
            cell: { content: (data) => renderCell(leaf, data[key], mono) },
          };
        }),
      ],
      [columnKeys, leaves, mono]
    );

    const openEntry =
      openKey !== null ? asHash(value[openKey]) : undefined;

    return (
      <ReqoreControlGroup vertical fluid gapSize='normal'>
        {rows.length === 0 ? (
          <ReqoreP size='small' effect={{ opacity: 0.5 }}>
            No {title.toLowerCase()} defined yet.
          </ReqoreP>
        ) : (
          <ReqoreTable
            raised
            rounded
            striped
            size='small'
            rowHeight={40}
            height={Math.min(52 + rows.length * 40, 440)}
            columns={columns}
            data={rows}
            onRowClick={(data) => setOpenKey(data._name as string)}
          />
        )}
        {!readOnly ? (
          <ReqoreButton
            icon='AddLine'
            intent='info'
            minimal
            fixed
            onClick={addEntry}
          >
            Add {singular.toLowerCase()}
          </ReqoreButton>
        ) : null}

        {openKey !== null && openEntry ? (
          <CatalogEntryDrawer
            isOpen
            onClose={() => setOpenKey(null)}
            name={`${name}-${openKey}`}
            title={openKey}
            noun={singular.toLowerCase()}
            options={options}
            value={openEntry}
            onChange={(next) => onChange(setKey(value, openKey, next))}
            readOnly={readOnly}
            onRemove={() => onChange(removeKey(value, openKey))}
            onRename={(next) => {
              if (!next || next === openKey) return;
              if (value[next] !== undefined) {
                addNotification({
                  intent: 'warning',
                  title: 'Name already in use',
                  content: `A ${singular.toLowerCase()} named "${next}" already exists in this section.`,
                  id: `schema-rename-collision-${next}`,
                  duration: 4000,
                });
                return;
              }
              onChange(renameKey(value, openKey, next));
              setOpenKey(next);
            }}
          />
        ) : null}
      </ReqoreControlGroup>
    );
  }
);

interface ICatalogListEditorProps {
  name: string;
  title: string;
  options: ICatalogOptions;
  value: Array<Record<string, unknown>>;
  onChange: (value: Array<Record<string, unknown>>) => void;
  readOnly?: boolean;
}

/**
 * An ordered list of hashes — a `ReqoreTable` overview with reorder
 * controls; the full editor opens in a side drawer on row-click.
 */
const CatalogListEditor = memo(
  ({ name, title, options, value, onChange, readOnly }: ICatalogListEditorProps) => {
    const singular = singularize(title);
    const { leaves } = partitionCatalogOptions(options);
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    const theme = useReqoreTheme();
    const mono = useMemo(
      () => ({
        color: getReadableColor(theme, undefined, undefined, true),
        bg: `${getReadableColor(theme)}14`,
      }),
      [theme]
    );

    const addItem = useCallback(() => {
      onChange([...value, seedNewEntry(options)]);
      setOpenIndex(value.length);
    }, [value, onChange, options]);

    const rows = useMemo(
      () =>
        value.map((item, index) => ({
          _selectId: index,
          _index: index,
          ...item,
        })),
      [value]
    );

    const columnKeys = useMemo(
      () => visibleColumnKeys(leaves, rows),
      [leaves, rows]
    );

    const columns = useMemo<IReqoreTableColumn[]>(() => {
      const cols: IReqoreTableColumn[] = [
        {
          dataId: '_pos',
          header: { label: '#' },
          width: 48,
          align: 'center',
          cell: {
            content: (data) => (
              <ReqoreP size='small' effect={{ opacity: 0.55 }}>
                {(data._index as number) + 1}
              </ReqoreP>
            ),
          },
        },
        ...columnKeys.map((key): IReqoreTableColumn => {
          const leaf = leaves[key] as ICatalogLeaf;
          return {
            dataId: key,
            header: { label: leaf.display_name },
            grow: 1,
            minWidth: 110,
            cell: { content: (data) => renderCell(leaf, data[key], mono) },
          };
        }),
      ];
      if (!readOnly) {
        cols.push({
          dataId: '_actions',
          header: { label: 'Order' },
          width: 84,
          align: 'right',
          cell: {
            actions: (data) => {
              const i = data._index as number;
              return [
                {
                  icon: 'ArrowUpLine',
                  minimal: true,
                  flat: true,
                  size: 'small',
                  tooltip: 'Move up',
                  disabled: i === 0,
                  onClick: () => onChange(moveItem(value, i, i - 1)),
                },
                {
                  icon: 'ArrowDownLine',
                  minimal: true,
                  flat: true,
                  size: 'small',
                  tooltip: 'Move down',
                  disabled: i === value.length - 1,
                  onClick: () => onChange(moveItem(value, i, i + 1)),
                },
              ];
            },
          },
        });
      }
      return cols;
    }, [columnKeys, leaves, readOnly, onChange, value, mono]);

    return (
      <ReqoreControlGroup vertical fluid gapSize='normal'>
        {rows.length === 0 ? (
          <ReqoreP size='small' effect={{ opacity: 0.5 }}>
            No {title.toLowerCase()} defined yet.
          </ReqoreP>
        ) : (
          <ReqoreTable
            raised
            rounded
            striped
            size='small'
            rowHeight={40}
            height={Math.min(52 + rows.length * 40, 440)}
            columns={columns}
            data={rows}
            onRowClick={(data) => setOpenIndex(data._index as number)}
          />
        )}
        {!readOnly ? (
          <ReqoreButton
            icon='AddLine'
            intent='info'
            minimal
            fixed
            onClick={addItem}
          >
            Add {singular.toLowerCase()}
          </ReqoreButton>
        ) : null}

        {openIndex !== null && value[openIndex] ? (
          <CatalogEntryDrawer
            isOpen
            onClose={() => setOpenIndex(null)}
            name={`${name}-${openIndex}`}
            title={`${singular} ${openIndex + 1}`}
            noun={singular.toLowerCase()}
            options={options}
            value={value[openIndex]}
            onChange={(next) =>
              onChange(value.map((v, i) => (i === openIndex ? next : v)))
            }
            readOnly={readOnly}
            onRemove={() =>
              onChange(value.filter((_, i) => i !== openIndex))
            }
          />
        ) : null}
      </ReqoreControlGroup>
    );
  }
);

export interface IRenameFieldProps {
  value: string;
  /** Returns `true` when the proposed name collides with a sibling. */
  taken?: (next: string) => boolean;
  onRename: (next: string) => void;
  /** Eyebrow label for the field. Defaults to "Name". */
  label?: string;
}

/**
 * Inline rename control. Edits a local draft and commits on blur —
 * renaming the key on every keystroke would yank focus mid-type.
 */
export const RenameField = memo(
  ({ value, taken, onRename, label = 'Name' }: IRenameFieldProps) => {
    const [draft, setDraft] = useState(value);
    useEffect(() => setDraft(value), [value]);

    const commit = useCallback(() => {
      const next = draft.trim();
      if (next && next !== value && !taken?.(next)) {
        onRename(next);
      } else {
        setDraft(value);
      }
    }, [draft, value, taken, onRename]);

    return (
      <ReqoreControlGroup verticalAlign='center' gapSize='small' fixed>
        <ReqoreTag fixed minimal size='small' icon='EditLine' label={label} />
        <ReqoreInput
          value={draft}
          size='small'
          width={360}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setDraft(e.target.value)
          }
          onBlur={commit}
        />
      </ReqoreControlGroup>
    );
  }
);
