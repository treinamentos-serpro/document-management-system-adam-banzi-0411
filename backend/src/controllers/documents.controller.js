function createDocumentController({ documentService, allowUntrustedIdentity = false }) {
  function requireUserId(req, res, next) {
    const authenticatedOwner = req.user?.id;
    const headerOwner = allowUntrustedIdentity ? req.get('X-User-Id') : null;
    const owner = authenticatedOwner || headerOwner;

    if (!owner) {
      const status = allowUntrustedIdentity ? 400 : 401;
      return res.status(status).json({
        error: {
          code: allowUntrustedIdentity ? 'USER_ID_REQUIRED' : 'AUTHENTICATION_REQUIRED',
          message: allowUntrustedIdentity
            ? 'Informe um identificador de usuário no cabeçalho X-User-Id.'
            : 'É necessário autenticar o usuário.',
        },
      });
    }

    if (typeof owner !== 'string' || !owner.trim() || owner.length > 128 || /[\u0000-\u001f\u007f]/.test(owner)) {
      return res.status(400).json({
        error: { code: 'USER_ID_INVALID', message: 'O identificador do usuário é inválido.' },
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
      const document = await documentService.createDocument({ file: req.file, owner: req.owner });
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
      const { document, filePath } = await documentService.getDownload({ id: req.params.id, owner: req.owner });
      res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
      return res.download(filePath, document.originalName, (error) => {
        if (error) next(error);
      });
    } catch (error) {
      return next(error);
    }
  }

  return { requireUserId, upload, list, download };
}

module.exports = { createDocumentController };
