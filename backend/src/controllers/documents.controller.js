function createDocumentController({ documentService }) {
  function requireUserId(req, res, next) {
    const owner = req.get('X-User-Id');

    if (!owner || !owner.trim() || owner.length > 128 || /[\u0000-\u001f\u007f]/.test(owner)) {
      return res.status(400).json({
        error: {
          code: 'USER_ID_REQUIRED',
          message: 'Informe um identificador de usuário válido no cabeçalho X-User-Id.',
        },
      });
    }

    req.owner = owner.trim();
    return next();
  }

  async function upload(req, res, next) {
    if (!req.file) {
      return res.status(400).json({
        error: { code: 'FILE_REQUIRED', message: 'Envie um arquivo.' },
      });
    }

    try {
      const document = await documentService.createDocument({
        file: req.file,
        owner: req.owner,
      });
      return res.status(201).json(document);
    } catch (error) {
      return next(error);
    }
  }

  async function list(req, res, next) {
    try {
      const documents = await documentService.listDocuments({ owner: req.owner });
      return res.status(200).json(documents);
    } catch (error) {
      return next(error);
    }
  }

  async function download(req, res, next) {
    try {
      const { document, filePath } = await documentService.getDownload({
        id: req.params.id,
        owner: req.owner,
      });

      res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
      return res.download(filePath, document.originalName, (error) => {
        if (error) {
          return next(error);
        }
      });
    } catch (error) {
      return next(error);
    }
  }

  return { requireUserId, upload, list, download };
}

module.exports = { createDocumentController };