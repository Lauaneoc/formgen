import { useMemo, useState } from 'react';
import {
  Braces,
  CheckCircle2,
  Code2,
  Download,
  FileCode2,
  Monitor,
  RotateCcw,
  Smartphone,
  TriangleAlert,
} from 'lucide-react';
import { compileDsl } from './compile-dsl';
import { DslEditor } from './components/DslEditor';
import { PreviewForm } from './components/PreviewForm';
import { examples } from './examples';

type ViewMode = 'preview' | 'json';
type DeviceMode = 'desktop' | 'mobile';

export default function App() {
  const [selectedExample, setSelectedExample] = useState(examples[0].id);
  const [source, setSource] = useState(examples[0].source);
  const [view, setView] = useState<ViewMode>('preview');
  const [device, setDevice] = useState<DeviceMode>('desktop');
  const result = useMemo(() => compileDsl(source), [source]);

  function loadExample(id: string) {
    const example = examples.find((candidate) => candidate.id === id);
    if (!example) return;
    setSelectedExample(id);
    setSource(example.source);
  }

  function downloadJson() {
    if (!result.ok) return;
    const blob = new Blob([`${JSON.stringify(result.definition, null, 2)}\n`], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${result.definition.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand" aria-label="FormGen">
          <span className="brand-mark" aria-hidden="true">
            <Braces size={21} />
          </span>
          <span>FormGen</span>
        </div>

        <div
          className={`compile-status ${result.ok ? 'compile-status--valid' : 'compile-status--invalid'}`}
        >
          {result.ok ? <CheckCircle2 size={16} /> : <TriangleAlert size={16} />}
          <span>
            {result.ok
              ? `${result.definition.fields.length} campos válidos`
              : 'Erro na especificação'}
          </span>
        </div>

        <div className="header-actions">
          <label className="sr-only" htmlFor="example-select">
            Exemplo
          </label>
          <select
            id="example-select"
            className="example-select"
            value={selectedExample}
            onChange={(event) => loadExample(event.target.value)}
          >
            {examples.map((example) => (
              <option key={example.id} value={example.id}>
                {example.name}
              </option>
            ))}
          </select>
          <button
            className="icon-button"
            type="button"
            title="Restaurar exemplo"
            aria-label="Restaurar exemplo"
            onClick={() => loadExample(selectedExample)}
          >
            <RotateCcw size={18} />
          </button>
          <button
            className="icon-button"
            type="button"
            title="Baixar JSON"
            aria-label="Baixar JSON"
            disabled={!result.ok}
            onClick={downloadJson}
          >
            <Download size={18} />
          </button>
        </div>
      </header>

      <main className="workspace">
        <section className="workspace-panel editor-panel" aria-labelledby="editor-title">
          <div className="panel-toolbar">
            <div className="panel-title">
              <FileCode2 size={17} aria-hidden="true" />
              <h2 id="editor-title">Especificação</h2>
            </div>
            <span className="file-name">formulario.form</span>
          </div>
          <div className="editor-surface">
            <DslEditor value={source} onChange={setSource} />
          </div>
          <div
            className={`diagnostic ${result.ok ? 'diagnostic--valid' : 'diagnostic--error'}`}
            role="status"
          >
            {result.ok ? (
              <>
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>Estrutura válida</span>
              </>
            ) : (
              <>
                <TriangleAlert size={16} aria-hidden="true" />
                <span>{result.message}</span>
              </>
            )}
          </div>
        </section>

        <section className="workspace-panel output-panel" aria-labelledby="output-title">
          <div className="panel-toolbar output-toolbar">
            <div className="panel-title">
              <Monitor size={17} aria-hidden="true" />
              <h2 id="output-title">Resultado</h2>
            </div>
            <div className="toolbar-groups">
              <div className="segmented-control" aria-label="Visualização do resultado">
                <button
                  type="button"
                  className={view === 'preview' ? 'is-active' : ''}
                  aria-pressed={view === 'preview'}
                  onClick={() => setView('preview')}
                >
                  <Monitor size={15} /> Prévia
                </button>
                <button
                  type="button"
                  className={view === 'json' ? 'is-active' : ''}
                  aria-pressed={view === 'json'}
                  onClick={() => setView('json')}
                >
                  <Code2 size={15} /> JSON
                </button>
              </div>
              {view === 'preview' && (
                <div className="icon-segment" aria-label="Largura da prévia">
                  <button
                    type="button"
                    title="Visualização desktop"
                    aria-label="Visualização desktop"
                    aria-pressed={device === 'desktop'}
                    className={device === 'desktop' ? 'is-active' : ''}
                    onClick={() => setDevice('desktop')}
                  >
                    <Monitor size={16} />
                  </button>
                  <button
                    type="button"
                    title="Visualização celular"
                    aria-label="Visualização celular"
                    aria-pressed={device === 'mobile'}
                    className={device === 'mobile' ? 'is-active' : ''}
                    onClick={() => setDevice('mobile')}
                  >
                    <Smartphone size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="output-surface">
            {!result.ok ? (
              <div className="empty-output" role="status">
                <TriangleAlert size={28} aria-hidden="true" />
                <p>Corrija a especificação para atualizar o resultado.</p>
              </div>
            ) : view === 'json' ? (
              <pre className="json-output">
                <code>{JSON.stringify(result.definition, null, 2)}</code>
              </pre>
            ) : (
              <div className={`preview-canvas preview-canvas--${device}`}>
                <PreviewForm
                  key={`${result.definition.name}-${result.definition.fields.map((field) => field.id).join('-')}`}
                  definition={result.definition}
                />
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
