import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { keymap } from '@codemirror/view';
import { Prec, type Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { sql, schemaCompletionSource, type SQLNamespace } from '@codemirror/lang-sql';
import { autocompletion } from '@codemirror/autocomplete';
import { TrinoSQL, trinoKeywordCompletion } from './trino-dialect';

/** Token colors come from `--cm-*` CSS variables (variables.css), so the
 *  editor re-themes with `body.dark-mode` automatically — no React re-render
 *  on theme toggle. The Lezer SQL tokenizer emits these tags. */
const highlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: 'var(--cm-keyword)' },
  { tag: [t.string, t.special(t.string)], color: 'var(--cm-string)' },
  { tag: t.number, color: 'var(--cm-number)' },
  { tag: [t.bool, t.null], color: 'var(--cm-constant)' },
  { tag: [t.lineComment, t.blockComment], color: 'var(--cm-comment)', fontStyle: 'italic' },
  { tag: t.typeName, color: 'var(--cm-type)' },
  { tag: t.standard(t.name), color: 'var(--cm-function)' }, // built-in functions
  { tag: t.special(t.name), color: 'var(--cm-variable)' },
  { tag: t.operator, color: 'var(--cm-operator)' },
  { tag: [t.punctuation, t.paren, t.brace, t.squareBracket], color: 'var(--cm-punctuation)' },
  { tag: t.name, color: 'var(--cm-name)' },
]);

/** Editor chrome (background, gutters, selection, tooltip) keyed off the app's
 *  `--db-*` design tokens so it matches the surrounding form and both themes. */
const editorTheme = EditorView.theme({
  '&': { backgroundColor: 'transparent', color: 'var(--db-text-primary)', fontSize: '13.5px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'var(--db-font-mono)',
    lineHeight: '1.6',
    minHeight: 'var(--cm-min-height, 160px)',
    maxHeight: 'var(--cm-max-height, 460px)',
  },
  '.cm-content': { caretColor: 'var(--db-primary)', padding: '10px 0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--db-primary)' },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--db-text-muted)',
    border: 'none',
    borderRight: '1px solid var(--db-border-light)',
  },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 6px 0 10px', minWidth: '28px' },
  '.cm-activeLine': { backgroundColor: 'var(--cm-active-line)' },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--cm-active-line)',
    color: 'var(--db-text-secondary)',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--cm-selection)',
  },
  '&.cm-focused .cm-matchingBracket, .cm-matchingBracket': {
    backgroundColor: 'var(--cm-bracket-match)',
    outline: '1px solid var(--db-primary-300)',
  },
  '.cm-placeholder': { color: 'var(--db-text-muted)' },
  '.cm-tooltip': {
    backgroundColor: 'var(--db-bg-elevated)',
    border: '1px solid var(--db-border-color)',
    borderRadius: 'var(--db-radius-md)',
    boxShadow: 'var(--db-shadow-lg)',
    color: 'var(--db-text-primary)',
    overflow: 'hidden',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul': {
    fontFamily: 'var(--db-font-mono)',
    fontSize: '12.5px',
    maxHeight: '15em',
  },
  '.cm-tooltip-autocomplete ul li': { padding: '3px 8px' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'var(--db-primary)',
    color: '#fff',
  },
  '.cm-completionIcon': { paddingRight: '12px', opacity: '0.7' },
  '.cm-completionMatchedText': { textDecoration: 'none', fontWeight: '700', color: 'inherit' },
});

export interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Fired on Ctrl/Cmd+Enter (e.g. run the query). */
  onSubmit?: () => void;
  /** Optional schema (catalogs/schemas/tables/columns) for context-aware
   *  completion; keyword + function completion works without it. */
  schema?: SQLNamespace;
  placeholder?: string;
  readOnly?: boolean;
  minHeight?: string;
  maxHeight?: string;
  className?: string;
  ariaLabel?: string;
}

/** A CodeMirror SQL editor (Trino dialect) with syntax highlighting and
 *  keyword/function/schema autocompletion, themed to the OKDP design tokens. */
export function SqlEditor({
  value,
  onChange,
  onSubmit,
  schema,
  placeholder,
  readOnly = false,
  minHeight = '160px',
  maxHeight,
  className,
  ariaLabel,
}: SqlEditorProps) {
  // Hold the latest submit handler in a ref so the Mod-Enter keymap — built
  // once with the extensions — always calls the current closure (with fresh
  // query/engine state) without forcing an extension rebuild on every keystroke.
  const submitRef = useRef(onSubmit);
  useEffect(() => {
    submitRef.current = onSubmit;
  }, [onSubmit]);

  const extensions = useMemo<Extension[]>(() => {
    const sqlConfig = { dialect: TrinoSQL, upperCaseKeywords: true, ...(schema ? { schema } : {}) };
    // `override` replaces the language-data completion source, so keyword and
    // schema completions are listed explicitly here (no duplicates).
    const sources = schema
      ? [schemaCompletionSource(sqlConfig), trinoKeywordCompletion]
      : [trinoKeywordCompletion];
    return [
      sql(sqlConfig),
      editorTheme,
      syntaxHighlighting(highlightStyle),
      EditorView.lineWrapping,
      autocompletion({ override: sources, activateOnTyping: true }),
      ...(ariaLabel ? [EditorView.contentAttributes.of({ 'aria-label': ariaLabel })] : []),
      Prec.highest(
        keymap.of([
          {
            key: 'Mod-Enter',
            preventDefault: true,
            run: () => {
              submitRef.current?.();
              return true;
            },
          },
        ]),
      ),
    ];
  }, [schema, ariaLabel]);

  const style = useMemo(
    () =>
      ({
        '--cm-min-height': minHeight,
        ...(maxHeight && { '--cm-max-height': maxHeight }),
      }) as CSSProperties,
    [minHeight, maxHeight],
  );

  return (
    <div className={`sql-editor-shell${className ? ` ${className}` : ''}`} style={style}>
      <CodeMirror
        value={value}
        onChange={onChange}
        theme="none"
        placeholder={placeholder}
        editable={!readOnly}
        readOnly={readOnly}
        extensions={extensions}
        basicSetup={{
          foldGutter: false,
          autocompletion: false,
          searchKeymap: false,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
        }}
      />
    </div>
  );
}
