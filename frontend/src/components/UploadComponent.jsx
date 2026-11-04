import { useRef, useState } from 'react';
import formatFileSize from '../utils/formatFileSize.js';

export default function UploadComponent({ onUpload, uploading }) {
  const [file, setFile] = useState(null);
  const inputRef = useRef(null);

  function clearFile() {
    setFile(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (file && !uploading && await onUpload(file)) clearFile();
  }

  function handleDrop(event) {
    event.preventDefault();
    if (!uploading) setFile(event.dataTransfer.files[0] || null);
  }

  return (
    <form className="upload-form" onSubmit={handleSubmit}>
      <label
        className={`dropzone${file ? ' dropzone-selected' : ''}${uploading ? ' dropzone-disabled' : ''}`}
        htmlFor="document-file"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <span className="dropzone-symbol" aria-hidden="true">+</span>
        <span className="dropzone-title">{file ? 'Arquivo selecionado' : 'Escolha um arquivo'}</span>
        <span className="dropzone-hint">ou arraste até aqui</span>
        <input
          ref={inputRef}
          id="document-file"
          type="file"
          disabled={uploading}
          onChange={(event) => setFile(event.target.files[0] || null)}
        />
      </label>

      {file ? (
        <div className="selected-file" aria-live="polite">
          <span className="file-indicator" aria-hidden="true" />
          <span className="selected-file-name" title={file.name}>{file.name}</span>
          <span className="selected-file-size">{formatFileSize(file.size)}</span>
          <button
            className="remove-file"
            type="button"
            onClick={clearFile}
            disabled={uploading}
            aria-label="Remover arquivo selecionado"
            title="Remover arquivo"
          >
            ×
          </button>
        </div>
      ) : <div className="upload-empty-space" aria-hidden="true" />}

      <button className="primary-button upload-button" type="submit" disabled={!file || uploading}>
        {uploading ? 'Enviando...' : 'Enviar documento'}
      </button>
    </form>
  );
}
