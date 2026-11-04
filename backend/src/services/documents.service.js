function createDocumentService({ documentRepository }) {
  function toPublicDocument(document) {
    const { id, originalName, size, uploadedAt, owner, mimeType } = document;
    return { id, originalName, size, uploadedAt, owner, mimeType };
  }

  return {
    async createDocument({ file, owner }) {
      const document = {
        id: file.filename,
        storageName: file.filename,
        originalName: file.originalname,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        owner,
        mimeType: file.mimetype || 'application/octet-stream',
      };

      try {
        await documentRepository.add(document);
        return toPublicDocument(document);
      } catch (error) {
        await documentRepository.removeStoredFile(document.storageName);
        throw error;
      }
    },

    async listDocuments({ owner }) {
      return (await documentRepository.listByOwner(owner)).map(toPublicDocument);
    },

    async getDownload({ id, owner }) {
      const document = await documentRepository.findByIdAndOwner(id, owner);
      if (!document || !(await documentRepository.fileExists(document.storageName))) {
        const error = new Error('Documento não encontrado.');
        error.statusCode = 404;
        error.code = 'DOCUMENT_NOT_FOUND';
        throw error;
      }
      return { document: toPublicDocument(document), filePath: documentRepository.getStoragePath(document.storageName) };
    },
  };
}

module.exports = { createDocumentService };