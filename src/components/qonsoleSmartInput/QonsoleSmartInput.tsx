// Copyright 2026 Qore Technologies, s.r.o.
// QonsoleSmartInput — Qorus Qonsole-flavored wrapper around the generic
// SmartEditor primitive. Provides predictive text + diagnostics for
// Qonsole command and natural-language input by pointing `LspClient` at
// the server's `/lsp` endpoint with `languageId: 'qonsole'` and the
// server-advertised trigger characters from the live spike.

import { forwardRef, useCallback, useImperativeHandle } from 'react';
import { RenderLeafProps } from 'slate-react/dist/components/editable';
import { SmartEditor } from '../smartEditor/SmartEditor';
import {
  IQonsoleSmartInputProps,
  IQonsoleSmartInputRef,
  TQonsoleAssistFeature,
} from './types';
import { useQonsoleSession } from './useQonsoleSession';

export type { IQonsoleSmartInputProps, IQonsoleSmartInputRef };

/**
 * Trigger characters that open the autocomplete dropdown. Sourced from
 * the server's `initialize` response under
 * `capabilities.experimental.qonsole.completionTriggerCharacters` — see
 * `QONSOLE_LSP_REFERENCE.md` and the spike transcript section 1 in
 * `QONSOLE_LSP_RESPONSES.txt`.
 */
const QONSOLE_TRIGGERS = new Set(['/', ' ', '-', '=', '.']);

/**
 * Minimal leaf renderer — returns a plain `<span>` with Slate's
 * attributes. Sidesteps the React-warning chain in Reqore's default
 * `Leaf` → `ReqoreSpan` → `ReqoreTooltipComponent` (which currently
 * types `Component: React.FC<any>` and triggers the
 * "function components cannot be given refs" warning even though
 * styled-components do auto-forward at runtime). Tracked as a Reqore
 * follow-up; suppressing here keeps the QonsoleSmartInput console clean.
 */
const qonsoleRenderLeaf = (props: RenderLeafProps) => (
  <span {...props.attributes}>{props.children}</span>
);

export const QonsoleSmartInput = forwardRef<
  IQonsoleSmartInputRef,
  IQonsoleSmartInputProps
>(
  (
    { value, onChange, useContext, readOnly = false, height = '40px', onBlur },
    ref
  ) => {
    const qonsole = useQonsoleSession({
      useContext,
      initialText: value,
    });

    const assist = useCallback(
      (
        position: { line: number; character: number },
        features?: TQonsoleAssistFeature[]
      ) => qonsole.assist(position, features),
      [qonsole]
    );

    useImperativeHandle(
      ref,
      (): IQonsoleSmartInputRef => ({
        validate: qonsole.validate,
        assist,
      }),
      [qonsole, assist]
    );

    return (
      <SmartEditor
        session={qonsole.session}
        value={value}
        onChange={onChange}
        triggerCharacters={QONSOLE_TRIGGERS}
        customRenderLeaf={qonsoleRenderLeaf}
        height={height}
        readOnly={readOnly}
        onBlur={onBlur}
      />
    );
  }
);

QonsoleSmartInput.displayName = 'QonsoleSmartInput';
