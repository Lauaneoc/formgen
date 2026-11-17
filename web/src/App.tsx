import { useMemo, useState } from 'react';
import {
  Braces,
  CheckCircle2,
  Code2,
  Download,
  FileArchive,
  FileCode2,
  Monitor,
  RotateCcw,
  Sparkles,
  Smartphone,
  TriangleAlert,
  X,
} from 'lucide-react';
import {
  applyAssistanceSuggestions,
  detectAssistanceGaps,
  type AssistanceSuggestion,
} from '../../src/ai/form-assistance.js';
import { serializeFormDefinition } from '../../src/compiler/serialize-form.js';
import { requestAiAssistance } from './ai-assistance';
import { compileDsl } from './compile-dsl';
import { DslEditor } from './components/DslEditor';
import { PreviewForm } from './components/PreviewForm';
import { examples } from './examples';
import { requestReactArchive } from './react-download';

type ViewMode = 'preview' | 'json';
type DeviceMode = 'desktop' | 'mobile';
type AiState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; suggestions: AssistanceSuggestion[] };

export default function App() {
  const [selectedExample, setSelectedExample] = useState(examples[0].id);
  const [source, setSource] = useState(examples[0].source);
  const [view, setView] = useState<ViewMode>('preview');
  const [device, setDevice] = useState<DeviceMode>('desktop');
  const [aiState, setAiState] = useState<AiState>({ status: 'idle' });
  const [selectedSuggestionKeys, setSelectedSuggestionKeys] = useState<Set<string>>(new Set());
  const [isDownloadingReact, setIsDownloadingReact] = useState(false);
  const result = useMemo(() => compileDsl(source), [source]);
  const assistanceGaps = result.ok ? detectAssistanceGaps(result.definition) : [];
  const gapsByKey = new Map(assistanceGaps.map((gap) => [gap.key, gap]));

  function updateSource(nextSource: string) {
    setSource(nextSource);
    setAiState({ status: 'idle' });
    setSelectedSuggestionKeys(new Set());
  }

  function loadExample(id: string) {
    const example = examples.find((candidate) => candidate.id === id);
    if (!example) return;
    setSelectedExample(id);
    updateSource(example.source);
  }

  async function suggestWithAi() {
    if (!result.ok || assistanceGaps.length === 0) return;
    setAiState({ status: 'loading' });

    try {
      const suggestions = await requestAiAssistance(result.definition);
      setSelectedSuggestionKeys(new Set(suggestions.map((suggestion) => suggestion.key)));
      setAiState({ status: 'ready', suggestions });
    } catch (error) {
      setAiState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Não foi possível consultar a IA.',
      });
    }
  }

  function toggleSuggestion(key: string) {
    setSelectedSuggestionKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function applySelectedSuggestions() {
    if (!result.ok || aiState.status !== 'ready') return;
    const selected = aiState.suggestions.filter((suggestion) =>
      selectedSuggestionKeys.has(suggestion.key),
    );
    const assisted = applyAssistanceSuggestions(result.definition, selected);
    updateSource(serializeFormDefinition(assisted));
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

  async function downloadReact() {
    if (!result.ok || isDownloadingReact) return;
    setIsDownloadingReact(true);

    try {
      const blob = await requestReactArchive(result.definition);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const slug = result.definition.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      link.href = url;
      link.download = `${slug || 'formulario'}-react.zip`;
      link.click();
      globalThis.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      globalThis.alert(error instanceof Error ? error.message : 'Não foi possível gerar o ZIP.');
    } finally {
      setIsDownloadingReact(false);
    }
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
          <button
            className="download-react-button"
            type="button"
            disabled={!result.ok || isDownloadingReact}
            onClick={downloadReact}
          >
            <FileArchive size={17} aria-hidden="true" />
            <span>{isDownloadingReact ? 'Gerando ZIP' : 'Baixar React'}</span>
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
            <div className="editor-actions">
              <span className="file-name">formulario.form</span>
              <button
                className="ai-button"
                type="button"
                disabled={!result.ok || assistanceGaps.length === 0 || aiState.status === 'loading'}
                onClick={suggestWithAi}
              >
                <Sparkles size={15} aria-hidden="true" />
                {aiState.status === 'loading' ? 'Analisando' : 'Sugerir com IA'}
              </button>
            </div>
          </div>
          <div className="editor-surface">
            <DslEditor value={source} onChange={updateSource} />
          </div>
          {aiState.status !== 'idle' && aiState.status !== 'loading' && (
            <section className="ai-panel" aria-labelledby="ai-panel-title">
              <header className="ai-panel-header">
                <div>
                  <Sparkles size={16} aria-hidden="true" />
                  <h3 id="ai-panel-title">Sugestões da IA</h3>
                </div>
                <button
                  className="panel-close-button"
                  type="button"
                  title="Fechar sugestões"
                  aria-label="Fechar sugestões"
                  onClick={() => setAiState({ status: 'idle' })}
                >
                  <X size={17} />
                </button>
              </header>

              {aiState.status === 'error' ? (
                <p className="ai-panel-error" role="alert">
                  {aiState.message}
                </p>
              ) : aiState.suggestions.length === 0 ? (
                <p className="ai-panel-empty" role="status">
                  A IA não apresentou sugestões aplicáveis.
                </p>
              ) : (
                <>
                  <ul className="ai-suggestion-list">
                    {aiState.suggestions.map((suggestion) => (
                      <li key={suggestion.key}>
                        <label>
                          <input
                            type="checkbox"
                            checked={selectedSuggestionKeys.has(suggestion.key)}
                            onChange={() => toggleSuggestion(suggestion.key)}
                          />
                          <span>
                            <strong>{gapsByKey.get(suggestion.key)?.label}</strong>
                            <span>{suggestion.value}</span>
                            <small>{suggestion.reason}</small>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  <footer className="ai-panel-footer">
                    <span>{selectedSuggestionKeys.size} selecionadas</span>
                    <button
                      type="button"
                      disabled={selectedSuggestionKeys.size === 0}
                      onClick={applySelectedSuggestions}
                    >
                      Aplicar selecionadas
                    </button>
                  </footer>
                </>
              )}
            </section>
          )}
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
