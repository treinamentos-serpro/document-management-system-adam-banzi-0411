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

const app = express();
const port = Number(process.env.PORT) || 3000;
const storageDirectory = path.resolve(
  process.env.STORAGE_DIR || path.join(__dirname, '../storage'),
);
const maxFileSizeBytes = Number(process.env.MAX_FILE_SIZE_BYTES) || 10 * 1024 * 1024;

const documentRepository = createDocumentRepository({ storageDirectory });
const documentService = createDocumentService({ documentRepository });
const documentController = createDocumentController({ documentService });

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use(createDocumentRouter({ documentController, storageDirectory, maxFileSizeBytes }));

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: { code: 'FILE_TOO_LARGE', message: 'O arquivo excede o tamanho máximo permitido.' },
    });
  }
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      error: { code: 'FILE_INVALID', message: 'Envie um arquivo no campo "file".' },
    });
  }

  const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
  return res.status(statusCode).json({
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: statusCode === 500 ? 'Não foi possível concluir a operação.' : error.message,
    },
  });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`DMS backend ouvindo na porta ${port}`);
  });
}

module.exports = app;
