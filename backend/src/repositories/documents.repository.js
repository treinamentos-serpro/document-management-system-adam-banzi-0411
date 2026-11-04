const fs = require('node:fs/promises');
const path = require('node:path');

function createDocumentRepository({ storageDirectory }) {
  const resolvedStorageDirectory = path.resolve(storageDirectory);
  const documents = new Map();

  function getStoragePath(storageName) {
    if (typeof storageName !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(storageName)) {
      throw new Error('Nome de armazenamento inválido.');
    }
    const filePath = path.resolve(resolvedStorageDirectory, storageName);
    const relativePath = path.relative(resolvedStorageDirectory, filePath);
    if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      throw new Error('Caminho fora do diretório de armazenamento.');
    }
    return filePath;
  }

  return {
    async add(document) {
      documents.set(document.id, document);
      return document;
    },
    async listByOwner(owner) {
      return Array.from(documents.values()).filter((document) => document.owner === owner);
    },
    async findByIdAndOwner(id, owner) {
      const document = documents.get(id);
      return document && document.owner === owner ? document : null;
    },
    getStoragePath,
    async fileExists(storageName) {
      try {
        await fs.access(getStoragePath(storageName));
        return true;
      } catch (error) {
        if (error.code === 'ENOENT') return false;
        throw error;
      }
    },
    async removeStoredFile(storageName) {
      try {
        await fs.unlink(getStoragePath(storageName));
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    },
  };
}

module.exports = { createDocumentRepository };