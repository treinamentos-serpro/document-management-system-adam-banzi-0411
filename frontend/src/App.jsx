// Seed do componente raiz do Document Management System.
//
// Este é apenas um ponto de partida mínimo. Durante o Passo 3 você vai usar o
// Agent Mode do GitHub Copilot para construir os componentes:
//   - components/UploadComponent
//   - components/DocumentList
//   - components/DownloadButton
// e o serviço services/ que consome a API do backend via fetch.

import { useEffect, useState } from 'react';
import DocumentList from './components/DocumentList.jsx';
import UploadComponent from './components/UploadComponent.jsx';
import { listDocuments, uploadDocument } from './services/documentsApi.js';
import './App.css';

function getSavedOwner() {
  return window.localStorage.getItem('dms-user-id') || 'usuario-local';
}

export default function App() {
  const [owner, setOwner] = useState(getSavedOwner);
  const [ownerDraft, setOwnerDraft] = useState(getSavedOwner);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [listError, setListError] = useState('');
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setListError('');

    listDocuments(owner)
      .then((result) => {
        if (!Array.isArray(result)) throw new Error('Resposta inválida do servidor.');
        if (active) setDocuments(result);
      })
      .catch((error) => {
        if (active) setListError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [owner, refreshVersion]);

  function applyOwner(event) {
    event.preventDefault();
    const nextOwner = ownerDraft.trim();
    if (!nextOwner) {
      setFeedback({ type: 'error', message: 'Informe um identificador de usuário.' });
      return;
    }

    window.localStorage.setItem('dms-user-id', nextOwner);
    setOwnerDraft(nextOwner);
    setFeedback(null);
    if (nextOwner === owner) setRefreshVersion((version) => version + 1);
    else setOwner(nextOwner);
  }

  async function handleUpload(file) {
    const uploadOwner = owner;
    setUploading(true);
    setFeedback(null);
    try {
      await uploadDocument(uploadOwner, file);
      setFeedback({ type: 'success', message: 'Documento enviado.' });
      setRefreshVersion((version) => version + 1);
      return true;
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
      return false;
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="#inicio" aria-label="Arquivo, início">
          <span className="wordmark-mark" aria-hidden="true">A</span>
          <span>ARQUIVO<span className="wordmark-divider">/</span></span>
        </a>
        <form className="owner-switcher" onSubmit={applyOwner}>
          <label htmlFor="owner-id">Usuário</label>
          <input
            id="owner-id"
            value={ownerDraft}
            onChange={(event) => setOwnerDraft(event.target.value)}
            maxLength={128}
            autoComplete="off"
            disabled={uploading}
          />
          <button type="submit" disabled={uploading}>Abrir</button>
        </form>
      </header>

      <main id="inicio" className="workspace">
        <div className="page-heading">
          <div>
            <p className="eyebrow">ESPAÇO PESSOAL</p>
            <h1>Documentos</h1>
          </div>
          <div className="document-total" aria-live="polite">
            <span className="total-value">{documents.length.toString().padStart(2, '0')}</span>
            <span className="total-label">ARQUIVOS</span>
          </div>
        </div>

        <div className="workspace-grid">
          <section className="upload-section" aria-labelledby="upload-heading">
            <div className="section-heading">
              <span className="section-index">01</span>
              <h2 id="upload-heading">Adicionar arquivo</h2>
            </div>
            <UploadComponent onUpload={handleUpload} uploading={uploading} />
          </section>

          <section className="documents-section" aria-labelledby="documents-heading">
            <div className="section-heading documents-heading">
              <div className="heading-title">
                <span className="section-index">02</span>
                <h2 id="documents-heading">Seus arquivos</h2>
              </div>
              <button
                className="text-button refresh-button"
                type="button"
                onClick={() => setRefreshVersion((version) => version + 1)}
                disabled={loading}
              >
                Atualizar
              </button>
            </div>
            {feedback && (
              <p className={`feedback feedback-${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>
                {feedback.message}
              </p>
            )}
            <DocumentList documents={documents} owner={owner} loading={loading} error={listError} />
          </section>
        </div>

        <footer className="workspace-footer">
          <span>ARQUIVO LOCAL</span>
          <span>SESSÃO: {owner}</span>
        </footer>
      </main>
    </div>
  );
}
