const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const multer = require('multer');
const express = require('express');

function createDocumentRouter({ documentController, storageDirectory, maxFileSizeBytes }) {
  const router = express.Router();
  const upload = multer({
    storage: multer.diskStorage({
      destination(req, file, callback) {
        fs.mkdir(storageDirectory, { recursive: true })
          .then(() => callback(null, storageDirectory), callback);
      },
      filename(req, file, callback) {
        callback(null, randomUUID());
      },
    }),
    limits: { fileSize: maxFileSizeBytes, files: 1 },
  });

  router.post('/upload', documentController.requireUserId, upload.single('file'), documentController.upload);
  router.get('/documents', documentController.requireUserId, documentController.list);
  router.get('/documents/:id/download', documentController.requireUserId, documentController.download);

  return router;
}

module.exports = { createDocumentRouter };