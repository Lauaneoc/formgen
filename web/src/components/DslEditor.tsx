import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';

interface DslEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function DslEditor({ value, onChange }: DslEditorProps) {
  return (
    <CodeMirror
      aria-label="Editor da especificação do formulário"
      value={value}
      height="100%"
      minHeight="320px"
      extensions={[
        EditorView.contentAttributes.of({
          'aria-label': 'Editor da especificação do formulário',
        }),
      ]}
      onChange={onChange}
      basicSetup={{
        bracketMatching: true,
        closeBrackets: true,
        foldGutter: false,
        highlightActiveLine: true,
        highlightActiveLineGutter: true,
        lineNumbers: true,
      }}
    />
  );
}
