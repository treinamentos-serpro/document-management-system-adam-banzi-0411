const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const express = require('express');
const multer = require('multer');

function createDocumentRouter({ documentController, storageDirectory, maxFileSizeBytes }) {
  const router = express.Router();
  const upload = multer({
    storage: multer.diskStorage({
      destination(req, file, callback) {
        fs.mkdir(storageDirectory, { recursive: true, mode: 0o700 })
          .then(() => callback(null, storageDirectory), callback);
      },
      filename(req, file, callback) {
        callback(null, randomUUID());
      },
    }),
    limits: { fileSize: maxFileSizeBytes, files: 1, fields: 0, parts: 2 },
  });

  router.post('/upload', documentController.requireOwner, upload.single('file'), documentController.upload);
  router.get('/documents', documentController.requireOwner, documentController.list);
  router.get('/documents/:id/download', documentController.requireOwner, documentController.download);

  return router;
}

module.exports = { createDocumentRouter };
