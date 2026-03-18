import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';

export interface IUseTemplates {
  loading: boolean;
  error?: Error;
  retry: () => void;
  value?: IReqoreFormTemplates;
}

// Empty cache kept for API compatibility with consumers expecting it
export const TemplatesCache = new Map<string, IReqoreFormTemplates>();

/**
 * Returns templates passed in directly — no API call.
 * Consumers are responsible for fetching templates and passing them as `localTemplates`.
 */
export const useTemplates = (
  allow?: boolean,
  localTemplates: IReqoreFormTemplates = {}
): IUseTemplates => ({
  loading: false,
  error: undefined,
  retry: () => {},
  value: allow ? localTemplates : undefined,
});
