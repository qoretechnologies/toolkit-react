/**
 * The Migrations tab — an ordered timeline of version blocks (the
 * locked "ordered timeline of version blocks" decision).
 *
 * Each block is a collapsible panel labelled with its version; the body
 * delegates to the generic `CatalogGroupBody`, which renders the
 * block's `version` / `description` leaves plus the `pre_align` /
 * `post_align` step lists. Blocks can be reordered so the timeline
 * always reads oldest-to-newest.
 */
import {
  ReqoreButton,
  ReqoreCallout,
  ReqoreControlGroup,
  ReqorePanel,
  useReqoreProperty,
} from '@qoretechnologies/reqore';
import { memo, useCallback } from 'react';
import { Hint } from './Hint';
import { CatalogGroupBody } from './CatalogNodeEditor';
import { moveItem } from '../../../../helpers/common';
import { useReqraftLabels } from '../../../../helpers/reqraftLabels';
import { ICatalogList } from './types';

export interface IMigrationsTabProps {
  /** The `migrations` list node from the catalogue. */
  node: ICatalogList;
  value: Array<Record<string, unknown>>;
  onChange: (value: Array<Record<string, unknown>>) => void;
  readOnly?: boolean;
}

/** A blank migration block seeded with the given version. */
export const createMigrationBlock = (
  version: string
): Record<string, unknown> => ({ version });

export const MigrationsTab = memo(
  ({ node, value, onChange, readOnly }: IMigrationsTabProps) => {
    const blocks = value ?? [];
    const confirmAction = useReqoreProperty('confirmAction');
    const words = useReqraftLabels().schemaDefinition;

    const addBlock = useCallback(() => {
      onChange([...blocks, createMigrationBlock('')]);
    }, [blocks, onChange]);

    const confirmRemoveBlock = useCallback(
      (index: number) => {
        const block = blocks[index];
        const version =
          typeof block?.version === 'string' && block.version
            ? block.version
            : undefined;
        confirmAction({
          title: words.removeMigrationBlock,
          description: words.removeMigrationBlockDescription(version, index + 1),
          confirmLabel: words.removeBlock,
          intent: 'danger',
          onConfirm: () =>
            onChange(blocks.filter((_, i) => i !== index)),
        });
      },
      [blocks, onChange, confirmAction, words]
    );

    if (blocks.length === 0) {
      return (
        <ReqoreControlGroup vertical fluid gapSize='normal'>
          <ReqoreCallout intent='info' flat icon='GitBranchLine'>
            {readOnly ? words.noMigrationsRead : words.noMigrations}
          </ReqoreCallout>
          {!readOnly ? (
            <ReqoreButton
              icon='AddLine'
              intent='info'
              minimal
              fixed
              onClick={addBlock}
            >
              {words.addMigrationBlock}
            </ReqoreButton>
          ) : null}
        </ReqoreControlGroup>
      );
    }

    return (
      <ReqoreControlGroup vertical fluid gapSize='small'>
        {!readOnly ? (
          <Hint
            id='hint.schema-migrations'
            title={words.migrationsHintTitle}
            icon='GitBranchLine'
            text={words.migrationsHint}
          />
        ) : null}
        {blocks.map((block, index) => {
          // undefined while the block targets no version yet
          const version =
            typeof block.version === 'string' && block.version
              ? block.version
              : undefined;
          const description =
            typeof block.description === 'string'
              ? block.description
              : undefined;
          const stepCount = (steps: unknown): number =>
            Array.isArray(steps) ? steps.length : 0;
          const totalSteps =
            stepCount(block.pre_align) + stepCount(block.post_align);
          return (
            <ReqorePanel
              key={version ?? index}
              raised
              collapsible
              isCollapsed
              icon='GitCommitLine'
              intent={index === blocks.length - 1 ? 'info' : 'success'}
              label={words.migrationBlock(version)}
              description={description}
              badge={[words.stepCount(totalSteps)]}
              actions={
                readOnly
                  ? undefined
                  : [
                      {
                        icon: 'ArrowUpLine',
                        minimal: true,
                        flat: true,
                        size: 'small',
                        tooltip: words.moveEarlier,
                        disabled: index === 0,
                        onClick: () =>
                          onChange(moveItem(blocks, index, index - 1)),
                      },
                      {
                        icon: 'ArrowDownLine',
                        minimal: true,
                        flat: true,
                        size: 'small',
                        tooltip: words.moveLater,
                        disabled: index === blocks.length - 1,
                        onClick: () =>
                          onChange(moveItem(blocks, index, index + 1)),
                      },
                      {
                        icon: 'DeleteBinLine',
                        minimal: true,
                        flat: true,
                        intent: 'danger',
                        size: 'small',
                        tooltip: words.removeMigrationBlock,
                        onClick: () => confirmRemoveBlock(index),
                      },
                    ]
              }
            >
              <CatalogGroupBody
                name={`migration-${index}`}
                options={node.options}
                value={block}
                onChange={(next) =>
                  onChange(blocks.map((b, i) => (i === index ? next : b)))
                }
                readOnly={readOnly}
              />
            </ReqorePanel>
          );
        })}
        {!readOnly ? (
          <ReqoreButton icon='AddLine' intent='info' minimal fixed onClick={addBlock}>
            {words.addMigrationBlock}
          </ReqoreButton>
        ) : null}
      </ReqoreControlGroup>
    );
  }
);
