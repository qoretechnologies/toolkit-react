/**
 * Inline validation banner — sits above the editor tabs and surfaces
 * three classes of warning (plan §1.8):
 *
 *   1. **Name mismatch** — `definition.schema.name` differs from the
 *      wrapper name. Offers a one-click "Sync name".
 *   2. **Version-bump hint** — a structural section changed since the
 *      editor mounted but `schema.version` was not bumped. Offers
 *      "Add migration block".
 *   3. **Last-save error** — the backend rejected the previous save;
 *      the exact path + message stay visible until the user fixes it.
 *
 * Renders nothing when there is nothing to flag.
 */
import {
  ReqoreButton,
  ReqoreCallout,
  ReqoreControlGroup,
  ReqoreP,
} from '@qoretechnologies/reqore';
import { memo } from 'react';
import { useReqraftLabels } from '../../../../helpers/reqraftLabels';
import { IDataSchemaDefinition, ISchemaSaveError } from './types';

export interface IInlineValidationBannerProps {
  definition: IDataSchemaDefinition;
  wrapperName?: string;
  /** `true` when a structural section changed since the editor mounted. */
  structureDirty?: boolean;
  /** `schema.version` captured at mount — compared to the current one. */
  baselineVersion?: string;
  saveError?: ISchemaSaveError;
  onSyncName: () => void;
  onAddMigration: () => void;
  readOnly?: boolean;
}

export const InlineValidationBanner = memo(
  ({
    definition,
    wrapperName,
    structureDirty,
    baselineVersion,
    saveError,
    onSyncName,
    onAddMigration,
    readOnly,
  }: IInlineValidationBannerProps) => {
    const words = useReqraftLabels().schemaDefinition;
    const schemaName = definition.schema?.name ?? '';
    const nameMismatch =
      !!wrapperName &&
      !!schemaName &&
      schemaName !== wrapperName;

    const currentVersion = definition.schema?.version ?? '';
    const versionStale =
      !!structureDirty &&
      !!baselineVersion &&
      currentVersion === baselineVersion;

    if (!nameMismatch && !versionStale && !saveError) {
      return null;
    }

    return (
      <ReqoreControlGroup vertical fluid gapSize='small'>
        {nameMismatch ? (
          <ReqoreCallout
            intent='warning'
            flat
            icon='ErrorWarningLine'
            label={words.nameMismatch}
            description={
              <ReqoreControlGroup vertical gapSize='small'>
                <ReqoreP size='small'>
                  {words.nameMismatchDescription(schemaName, wrapperName ?? '')}
                </ReqoreP>
                {!readOnly ? (
                  <ReqoreButton
                    icon='CheckLine'
                    size='small'
                    fixed
                    minimal
                    intent='warning'
                    onClick={onSyncName}
                  >
                    {words.syncName}
                  </ReqoreButton>
                ) : null}
              </ReqoreControlGroup>
            }
          />
        ) : null}

        {versionStale ? (
          <ReqoreCallout
            intent='warning'
            flat
            icon='GitBranchLine'
            label={words.versionStale}
            description={
              <ReqoreControlGroup vertical gapSize='small'>
                <ReqoreP size='small'>
                  {words.versionStaleDescription(currentVersion)}
                </ReqoreP>
                {!readOnly ? (
                  <ReqoreButton
                    icon='AddLine'
                    size='small'
                    fixed
                    minimal
                    intent='warning'
                    onClick={onAddMigration}
                  >
                    {words.addMigrationBlock}
                  </ReqoreButton>
                ) : null}
              </ReqoreControlGroup>
            }
          />
        ) : null}

        {saveError ? (
          <ReqoreCallout
            intent='danger'
            flat
            icon='CloseCircleLine'
            label={words.saveRejected}
            description={
              saveError.path
                ? `${saveError.path}: ${saveError.message}`
                : saveError.message
            }
          />
        ) : null}
      </ReqoreControlGroup>
    );
  }
);
