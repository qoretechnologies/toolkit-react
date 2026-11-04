// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreFonts } from '@qoretechnologies/reqore';
import { TSizes } from '@qoretechnologies/reqore/dist/constants/sizes';
import { ChangeEvent, CSSProperties, Fragment, ReactNode } from 'react';

/**
 * A stand-in for a host's code editor, for the stories.
 *
 * reqraft ships no code editor: the Qorus IDE gives its own (Monaco, with its language server) through
 * `componentOverrides['code-editor']`, and the form draws a read-only preview with it as well. This draws code as
 * such an editor does - a line per line, numbered, its keywords, strings, comments and numbers in their colours, in
 * the language the field inherits - so a story shows code as the host would, not flattened into a one-line input
 * at 12px (qorus#646, David: "is this meant to be a source code display?"). It is not an editor: no completion and
 * no hover, which the host's own has.
 */
export interface ICodeEditorStandinProps {
  value?: unknown;
  onChange?: (value: string) => void;
  language?: unknown;
  size?: TSizes;
  readOnly?: boolean;
  disabled?: boolean;
  /** Says the language it was given above the code, as `syntax: qore`: what a story checks it inherited. */
  showsLanguage?: boolean;
}

const KEYWORDS: Record<string, string[]> = {
  qore: [
    'abstract',
    'auto',
    'binary',
    'bool',
    'break',
    'case',
    'catch',
    'class',
    'const',
    'continue',
    'date',
    'default',
    'do',
    'else',
    'float',
    'for',
    'foreach',
    'hash',
    'if',
    'in',
    'inherits',
    'int',
    'list',
    'my',
    'namespace',
    'new',
    'nothing',
    'number',
    'object',
    'our',
    'private',
    'public',
    'return',
    'self',
    'static',
    'string',
    'sub',
    'switch',
    'synchronized',
    'throw',
    'try',
    'while',
    'True',
    'False',
    'NOTHING',
    'NULL',
  ],
  python: [
    'and',
    'as',
    'class',
    'def',
    'elif',
    'else',
    'except',
    'False',
    'for',
    'from',
    'if',
    'import',
    'in',
    'is',
    'None',
    'not',
    'or',
    'pass',
    'raise',
    'return',
    'self',
    'True',
    'try',
    'while',
    'with',
  ],
  java: [
    'boolean',
    'class',
    'else',
    'extends',
    'false',
    'final',
    'for',
    'if',
    'import',
    'int',
    'new',
    'null',
    'package',
    'private',
    'protected',
    'public',
    'return',
    'static',
    'String',
    'this',
    'throws',
    'true',
    'void',
  ],
};

const COLORS = {
  text: '#d4d4d4',
  keyword: '#569cd6',
  string: '#ce9178',
  comment: '#6a9955',
  number: '#b5cea8',
  directive: '#c586c0',
  gutter: '#858585',
  background: '#1e1e1e',
  border: '#3c3c3c',
};

/** One line drawn in its colours. */
const highlightLine = (line: string, language: string): ReactNode[] => {
  const keywords = new Set(KEYWORDS[language] ?? KEYWORDS.qore);
  const comment = language === 'java' ? /^\/\/.*/ : /^#.*/;
  const parts: ReactNode[] = [];
  let rest = line;
  let key = 0;
  const push = (text: string, color: string) =>
    parts.push(
      <span key={key++} style={{ color }}>
        {text}
      </span>
    );
  if (language === 'qore' && /^\s*%/.test(rest)) {
    push(rest, COLORS.directive);
    return parts;
  }
  while (rest) {
    const match =
      comment.exec(rest) ??
      /^("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?)/.exec(rest) ??
      /^\d+(\.\d+)?/.exec(rest) ??
      /^[A-Za-z_][\w]*/.exec(rest) ??
      /^[^A-Za-z_\d"'#/]+|^./.exec(rest);
    const text = match![0];
    const color =
      text.startsWith('#') || text.startsWith('//') ? COLORS.comment
      : text.startsWith('"') || text.startsWith("'") ? COLORS.string
      : /^\d/.test(text) ? COLORS.number
      : keywords.has(text) ? COLORS.keyword
      : COLORS.text;
    push(text, color);
    rest = rest.slice(text.length);
  }
  return parts;
};

const LINE_HEIGHT = 19;
const FONT_SIZE = 13;
const PADDING = 8;

export const CodeEditorStandin = ({
  value,
  onChange,
  language,
  readOnly,
  disabled,
  showsLanguage = true,
}: ICodeEditorStandinProps) => {
  const code = typeof value === 'string' ? value : '';
  const lang = typeof language === 'string' && language ? language.toLowerCase() : 'qore';
  const lines = code.replace(/\n$/, '').split('\n');
  const text: CSSProperties = {
    fontFamily: ReqoreFonts.mono,
    fontSize: FONT_SIZE,
    lineHeight: `${LINE_HEIGHT}px`,
    padding: PADDING,
    margin: 0,
    whiteSpace: 'pre',
    tabSize: 4,
  };
  const editable = !readOnly && !disabled;
  return (
    <div data-testid='code-editor-mock' className='code-editor-standin' style={{ width: '100%' }}>
      {showsLanguage ?
        <div
          // the preview's own: a story counts the editors that say what they inherited
          data-testid={readOnly ? 'code-preview-language' : 'code-editor-language'}
          style={{ fontFamily: ReqoreFonts.mono, fontSize: 12, marginBottom: 4, opacity: 0.8 }}
        >
          syntax: {String(language ?? 'plain')}
        </div>
      : null}
      <div
        style={{
          display: 'flex',
          background: COLORS.background,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 4,
          overflow: 'auto',
        }}
      >
        <div
          aria-hidden='true'
          style={{
            ...text,
            color: COLORS.gutter,
            textAlign: 'right',
            userSelect: 'none',
            minWidth: 28,
          }}
        >
          {lines.map((_line, index) => (
            <div key={index}>{index + 1}</div>
          ))}
        </div>
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <pre className='code-editor-standin-code' style={{ ...text, color: COLORS.text }}>
            {lines.map((line, index) => (
              <Fragment key={index}>
                {highlightLine(line, lang)}
                {'\n'}
              </Fragment>
            ))}
          </pre>
          {editable ?
            <textarea
              aria-label='Source code'
              spellCheck={false}
              value={code}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange?.(event.target.value)}
              style={{
                ...text,
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                resize: 'none',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: 'transparent',
                caretColor: COLORS.text,
                overflow: 'hidden',
              }}
            />
          : null}
        </div>
      </div>
    </div>
  );
};

/** The stand-in where the row draws a Language control above it: it does not say the language again. */
export const CodeEditorStandinNoSyntax = (props: ICodeEditorStandinProps) => (
  <CodeEditorStandin {...props} showsLanguage={false} />
);
