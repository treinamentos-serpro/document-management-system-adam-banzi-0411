// Seed do servidor backend do Document Management System.
//
// Este arquivo é apenas um ponto de partida mínimo. Ao longo do workshop você
// vai usar o Agent Mode do GitHub Copilot para construir as camadas:
//   - routes/       (definição das rotas)
//   - controllers/  (entrada HTTP e validação)
//   - services/     (regras de negócio)
//   - repositories/ (persistência: arquivos locais + metadados em memória)
//
// Restrição do projeto: uploads são gravados no filesystem local da aplicação
// usando multer com diskStorage. Não utilize provedores externos.

const path = require('node:path');
const express = require('express');
const { createDocumentRepository } = require('./repositories/documents.repository');
const { createDocumentService } = require('./services/documents.service');
const { createDocumentController } = require('./controllers/documents.controller');
const { createDocumentRouter } = require('./routes/documents.routes');

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const app = express();
const port = positiveInteger(process.env.PORT, 3000);
const storageDirectory = path.resolve(
  process.env.STORAGE_DIR || path.join(__dirname, '../storage'),
);
const maxFileSizeBytes = positiveInteger(process.env.MAX_FILE_SIZE_BYTES, 10 * 1024 * 1024);
const maxStorageBytes = positiveInteger(process.env.MAX_STORAGE_BYTES, 1024 * 1024 * 1024);
const maxUploadsPerMinute = positiveInteger(process.env.MAX_UPLOADS_PER_MINUTE, 30);
const maxConcurrentUploads = positiveInteger(process.env.MAX_CONCURRENT_UPLOADS, 4);

const documentRepository = createDocumentRepository({ storageDirectory, maxStorageBytes });
const documentService = createDocumentService({ documentRepository });
const documentController = createDocumentController({
  documentService,
  allowUntrustedIdentity: process.env.NODE_ENV !== 'production',
});

app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use(createDocumentRouter({
  documentController,
  storageDirectory,
  maxFileSizeBytes,
  maxUploadsPerMinute,
  maxConcurrentUploads,
}));

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: { code: 'FILE_TOO_LARGE', message: 'O arquivo excede o tamanho máximo permitido.' },
    });
  }

  if (error.code === 'STORAGE_QUOTA_EXCEEDED') {
    return res.status(413).json({
      error: { code: 'STORAGE_QUOTA_EXCEEDED', message: 'O limite de armazenamento local foi atingido.' },
    });
  }

  if (['LIMIT_UNEXPECTED_FILE', 'LIMIT_FIELD_COUNT', 'LIMIT_PART_COUNT', 'LIMIT_FIELD_KEY'].includes(error.code)) {
    return res.status(400).json({
      error: { code: 'MULTIPART_INVALID', message: 'Envie somente um arquivo no campo "file".' },
    });
  }

  const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
  const code = statusCode < 500 ? error.code || 'REQUEST_FAILED' : 'INTERNAL_ERROR';
  const message = statusCode < 500 ? error.message : 'Não foi possível concluir a operação.';
  return res.status(statusCode).json({ error: { code, message } });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`DMS backend ouvindo na porta ${port}`);
  });
}

module.exports = app;
