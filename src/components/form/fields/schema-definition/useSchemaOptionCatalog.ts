/**
 * Fetches the schema option catalogue (`GET /schemas?action=options`).
 *
 * The catalogue is the editor's single source of truth — every form
 * field, every enum, every section is generated from it. It is static
 * per server version, so the default react-query cache is left on.
 */
import { useFetch } from '../../../../hooks/useFetch/useFetch';
import { ISchemaOptionCatalog } from './types';

export interface IUseSchemaOptionCatalogResult {
  catalog?: ISchemaOptionCatalog;
  loading: boolean;
  /** Server error — surfaced by the editor as a blocking callout. */
  error?: unknown;
  /** Re-runs the catalogue fetch. */
  reload: () => void;
}

/**
 * @param override test seam — when supplied the catalogue is returned
 *   directly and no request is made (stories / unit tests).
 * @param errorOverride test seam — when supplied the hook reports this
 *   as a fetch failure without making a request.
 */
export const useSchemaOptionCatalog = (
  override?: ISchemaOptionCatalog,
  errorOverride?: string
): IUseSchemaOptionCatalogResult => {
  const { data, loading, error, load } = useFetch<ISchemaOptionCatalog>({
    url: 'schemas?action=options',
    method: 'GET',
    loadOnMount: !override && !errorOverride,
  });

  if (errorOverride) {
    return {
      loading: false,
      error: { desc: errorOverride },
      reload: () => {},
    };
  }

  if (override) {
    return { catalog: override, loading: false, reload: () => {} };
  }

  return { catalog: data, loading, error, reload: load };
};
