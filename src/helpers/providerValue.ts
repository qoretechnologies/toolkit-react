import { TQorusForm } from '@qoretechnologies/ts-toolkit';

export type TRecordType = 'search' | 'search-single' | 'create' | 'update' | 'delete';
export type TRealRecordType = 'read' | 'create' | 'update' | 'delete';

export type TProviderTypeSupports = {
  [key in `supports_${TRealRecordType}`]?: boolean;
};

export type TProviderTypeArgs = {
  [key in `${TRecordType}_args`]?: TQorusForm | TQorusForm[];
};

/**
 * A data-provider selection, in the shape the form holds it.
 *
 * The `supports_*` flags say which record operations the selected provider can
 * perform; validation reads them to decide whether a provider is a legitimate
 * target for the operation the field was configured for.
 */
export interface IProviderType extends TProviderTypeSupports, TProviderTypeArgs {
  type: string;
  name: string;
  path?: string;
  options?: TQorusForm;
  subtype?: 'request' | 'response';
  hasApiContext?: boolean;
  optionsChanged?: boolean;
  searchOptionsChanged?: boolean;
  desc?: string;
  use_args?: boolean;
  args?: any;
  up?: boolean;
  supports_request?: boolean;
  supports_messages?: 'ASYNC' | 'SYNC' | 'NONE';
  supports_observable?: boolean;
  transaction_management?: boolean;
  record_requires_search_options?: boolean;
  create_args_freeform?: TQorusForm[];
  is_api_call?: boolean;
  search_options?: TQorusForm;
  descriptions?: string[];
  message_id?: string;
  message?: {
    type: string;
    value: any;
  };
}

/**
 * A provider value as an object, from either representation a caller may hold.
 *
 * A provider reaches the form either already expanded into `IProviderType`, or
 * as the flat path string the server stores — `"factory/db{driver=pgsql}/table"`
 * or the plain `"type/name/path"`. Returns `null` for anything that is neither,
 * so a caller reports an invalid value rather than reading fields off nothing.
 */
export const maybeBuildOptionProvider = (provider: unknown): IProviderType | null => {
  if (!provider) {
    return null;
  }
  if (typeof provider === 'object') {
    return provider as IProviderType;
  }
  if (typeof provider !== 'string') {
    return null;
  }

  if (provider.startsWith('factory')) {
    const fixedProvider = provider.endsWith('/') ? provider : `${provider}/`;
    const [factoryType] = fixedProvider.split('/');
    const factoryName = fixedProvider.substring(
      fixedProvider.indexOf('/') + 1,
      fixedProvider.lastIndexOf('{')
    );
    const options = fixedProvider.substring(
      fixedProvider.indexOf('{') + 1,
      fixedProvider.lastIndexOf('}')
    );
    const optionsObject = options
      .split(',')
      .filter(Boolean)
      .reduce<Record<string, string>>((result, option) => {
        const [key, value] = option.split('=');
        result[key] = value;
        return result;
      }, {});
    const result: IProviderType = {
      type: factoryType,
      name: factoryName,
      path: fixedProvider.substring(fixedProvider.lastIndexOf('}/') + 2),
      options: optionsObject as unknown as TQorusForm,
    };
    if (provider.includes('?options_changed')) {
      result.optionsChanged = true;
    }
    return result;
  }

  const [type, name, ...path] = provider.split('/');
  return { type, name, path: path.join('/') };
};

/**
 * An FSM variable action — which variable, and what is done to it.
 *
 * The provider half is `Partial<IProviderType>` because the action's own
 * `action_type` decides which provider fields have to be there; validation
 * re-runs the matching provider validator over the merged value rather than
 * duplicating those rules here.
 */
export type TVariableActionValue = {
  var_type: 'globalvar' | 'localvar' | 'autovar';
  var_name: string;
  transaction_action?: 'commit' | 'rollback' | 'begin-transaction';
  action_type?:
    | 'search'
    | 'search-single'
    | 'update'
    | 'create'
    | 'delete'
    | 'transaction'
    | 'send-message'
    | 'apicall';
} & Partial<IProviderType>;
