const path = require('node:path');
const express = require('express');
const { createDocumentRepository } = require('./repositories/documentRepository');
const { createDocumentService } = require('./services/documentService');
const { createDocumentController } = require('./controllers/documentController');
const { createDocumentRouter } = require('./routes/documentRoutes');

const app = express();
const port = Number(process.env.PORT) || 3000;
const storageDirectory = path.resolve(
  process.env.STORAGE_DIR || path.join(__dirname, '../storage'),
);
const configuredFileSize = Number.parseInt(process.env.MAX_FILE_SIZE_BYTES, 10);
const maxFileSizeBytes = Number.isSafeInteger(configuredFileSize) && configuredFileSize > 0
  ? configuredFileSize
  : 10 * 1024 * 1024;

const documentRepository = createDocumentRepository({ storageDirectory });
const documentService = createDocumentService({ documentRepository });
const documentController = createDocumentController({ documentService });

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use(createDocumentRouter({
  documentController,
  storageDirectory,
  maxFileSizeBytes,
}));

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: {
        code: 'FILE_TOO_LARGE',
        message: 'O arquivo excede o tamanho máximo permitido.',
      },
    });
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      error: {
        code: 'FILE_INVALID',
        message: 'Envie um único arquivo no campo "file".',
      },
    });
  }

  const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
  const code = error.code || 'INTERNAL_ERROR';
  const message = statusCode === 500
    ? 'Não foi possível concluir a operação.'
    : error.message;

  return res.status(statusCode).json({ error: { code, message } });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`DMS backend ouvindo na porta ${port}`);
  });
}

module.exports = app;
