import DownloadButton from './DownloadButton.jsx';
import formatFileSize from '../utils/formatFileSize.js';

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data indisponível';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default function DocumentList({ documents, owner, loading, error }) {
  if (loading) return <p className="list-state" role="status">Carregando documentos...</p>;
  if (error) return <p className="list-state list-error" role="alert">{error}</p>;

  if (!documents.length) {
    return (
      <div className="empty-state">
        <span className="empty-state-mark" aria-hidden="true">—</span>
        <p>Nenhum documento encontrado.</p>
      </div>
    );
  }

  return (
    <div className="document-table" role="table" aria-label="Documentos enviados">
      <div className="document-row document-row-header" role="row">
        <span role="columnheader">Nome</span>
        <span role="columnheader">Enviado</span>
        <span role="columnheader">Tamanho</span>
        <span className="action-column" role="columnheader">Ação</span>
      </div>
      {documents.map((document) => (
        <div className="document-row" role="row" key={document.id}>
          <div className="document-name-cell" role="cell">
            <span className="document-file-mark" aria-hidden="true">DOC</span>
            <span className="document-name" title={document.originalName}>{document.originalName}</span>
          </div>
          <span className="document-date" role="cell">{formatDate(document.uploadedAt)}</span>
          <span className="document-size" role="cell">{formatFileSize(document.size)}</span>
          <span className="document-action" role="cell">
            <DownloadButton owner={owner} document={document} />
          </span>
        </div>
      ))}
    </div>
  );
}
