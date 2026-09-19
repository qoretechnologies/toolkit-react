import { IReqorePanelAction } from '@qoretechnologies/reqore/dist/components/Panel';
import { describe, expect, it, vi } from 'vitest';
import {
  IOptionActionsContext,
  optionActionAsMenuItem,
  resolveOptionActions,
} from '../src/components/form/engine/optionActions';
import {
  BUILT_IN_RENDERER_ONLY_UI_TYPES,
  createRendererOnlyUiTypeCheck,
  isRendererOnlyUiType,
} from '../src/components/form/engine/rendererTypes';

const context: IOptionActionsContext = {
  name: 'my_option',
  schema: { type: 'string', display_name: 'My option' } as IOptionActionsContext['schema'],
  value: { type: 'string', value: 'hello' },
};

describe('resolveOptionActions', () => {
  it('returns an empty list when no actions were injected', () => {
    expect(resolveOptionActions(undefined, context)).toEqual([]);
  });

  it('passes a static list through unchanged', () => {
    const actions: IReqorePanelAction[] = [{ icon: 'MagicLine' }, { icon: 'InformationLine' }];

    expect(resolveOptionActions(actions, context)).toEqual(actions);
  });

  it('calls a factory with the option context', () => {
    const factory = vi.fn(() => [{ icon: 'MagicLine' } as IReqorePanelAction]);

    const result = resolveOptionActions(factory, context);

    expect(factory).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledWith(context);
    expect(result).toEqual([{ icon: 'MagicLine' }]);
  });

  it('drops falsy entries so a factory can return conditional actions inline', () => {
    const factory = () =>
      [
        { icon: 'MagicLine' },
        false && { icon: 'DeleteBinLine' },
        undefined,
        null,
        { icon: 'InformationLine' },
      ] as IReqorePanelAction[];

    expect(resolveOptionActions(factory, context)).toEqual([
      { icon: 'MagicLine' },
      { icon: 'InformationLine' },
    ]);
  });

  it('survives a factory that returns nothing', () => {
    expect(resolveOptionActions((() => undefined) as never, context)).toEqual([]);
  });
});

describe('createRendererOnlyUiTypeCheck', () => {
  it('recognises reqraft built-in renderer-only ui types', () => {
    expect(isRendererOnlyUiType('cron')).toBe(true);
    expect(isRendererOnlyUiType('processor-mappings')).toBe(true);
    expect(BUILT_IN_RENDERER_ONLY_UI_TYPES).toContain('code-editor');
  });

  it('does not treat storage types as renderer-only', () => {
    expect(isRendererOnlyUiType('string')).toBe(false);
    expect(isRendererOnlyUiType('hash')).toBe(false);
    expect(isRendererOnlyUiType('long-string')).toBe(false);
  });

  it('reads a ui_type the server sends as a list by its first entry', () => {
    /* An option that accepts several types is served with them as a list, and
       the row is RENDERED as the first of them (`getType`). The storage type
       has to be decided from the same entry, or the row is drawn with one
       editor and its value stored as another. This predicate used to answer
       "not a string, so no" and was the only reader that disagreed. */
    expect(isRendererOnlyUiType(['cron', 'string'] as never)).toBe(true);
    expect(isRendererOnlyUiType(['string', 'cron'] as never)).toBe(false);
    expect(isRendererOnlyUiType(undefined)).toBe(false);
  });

  it('recognises a consumer-declared renderer type without a reqraft release', () => {
    const check = createRendererOnlyUiTypeCheck(['my-custom-editor']);

    expect(check('my-custom-editor')).toBe(true);
    // built-ins still apply alongside the consumer's own
    expect(check('cron')).toBe(true);
    expect(check('string')).toBe(false);
  });

  it('keeps each instance independent — one consumer cannot leak into another', () => {
    const withExtra = createRendererOnlyUiTypeCheck(['my-custom-editor']);
    const withoutExtra = createRendererOnlyUiTypeCheck();

    expect(withExtra('my-custom-editor')).toBe(true);
    expect(withoutExtra('my-custom-editor')).toBe(false);
    expect(isRendererOnlyUiType('my-custom-editor')).toBe(false);
  });
});

describe('an injected action moved into the ⋯ menu', () => {
  it('labels it with its own label, then a text tooltip, then its position', () => {
    expect(optionActionAsMenuItem({ label: 'Reset', tooltip: 'Put it back' }, 0).label).toBe(
      'Reset'
    );
    expect(optionActionAsMenuItem({ tooltip: 'Put it back' }, 0).label).toBe('Put it back');
    expect(optionActionAsMenuItem({ icon: 'DeleteBinLine' }, 2).label).toBe('Action 3');
  });

  it('does not put a configured tooltip OBJECT where the label goes', () => {
    // `tooltip` may be an `IReqoreTooltip`; a menu row's label has to be text.
    const item = optionActionAsMenuItem(
      { icon: 'DeleteBinLine', tooltip: { content: 'Put it back', delay: 200 } },
      0
    );

    expect(item.label).toBe('Action 1');
  });
});
