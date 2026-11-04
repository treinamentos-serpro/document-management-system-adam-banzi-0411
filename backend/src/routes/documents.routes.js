const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const express = require('express');
const multer = require('multer');

function createUploadProtection({ maxUploadsPerMinute, maxConcurrentUploads }) {
  const requestWindows = new Map();
  let activeUploads = 0;

  return function protectUpload(req, res, next) {
    const now = Date.now();
    for (const [client, window] of requestWindows) {
      if (window.expiresAt <= now) requestWindows.delete(client);
    }

    const client = req.ip || req.socket.remoteAddress || 'unknown';
    let window = requestWindows.get(client);
    if (!window || window.expiresAt <= now) {
      window = { count: 0, expiresAt: now + 60_000 };
      requestWindows.set(client, window);
    }

    if (window.count >= maxUploadsPerMinute) {
      return res.status(429).json({
        error: { code: 'UPLOAD_RATE_LIMITED', message: 'Limite de uploads atingido. Tente novamente em um minuto.' },
      });
    }
    if (activeUploads >= maxConcurrentUploads) {
      return res.status(503).json({
        error: { code: 'UPLOAD_CAPACITY_REACHED', message: 'O serviço está processando muitos uploads.' },
      });
    }

    window.count += 1;
    activeUploads += 1;
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        activeUploads -= 1;
      }
    };
    res.once('finish', release);
    res.once('close', release);
    return next();
  };
}

function createDocumentRouter({
  documentController,
  storageDirectory,
  maxFileSizeBytes,
  maxUploadsPerMinute,
  maxConcurrentUploads,
}) {
  const router = express.Router();
  const protectUpload = createUploadProtection({ maxUploadsPerMinute, maxConcurrentUploads });
  const upload = multer({
    storage: multer.diskStorage({
      destination(req, file, callback) {
        fs.mkdir(storageDirectory, { recursive: true, mode: 0o700 })
          .then(() => fs.chmod(storageDirectory, 0o700))
          .then(() => callback(null, storageDirectory), callback);
      },
      filename(req, file, callback) {
        callback(null, randomUUID());
      },
    }),
    limits: {
      fileSize: maxFileSizeBytes,
      files: 1,
      fields: 0,
      parts: 2,
      fieldNameSize: 100,
      headerPairs: 100,
    },
  });

  router.post('/upload', documentController.requireUserId, protectUpload, upload.single('file'), documentController.upload);
  router.get('/documents', documentController.requireUserId, documentController.list);
  router.get('/documents/:id/download', documentController.requireUserId, documentController.download);

  return router;
}

module.exports = { createDocumentRouter, createUploadProtection };
