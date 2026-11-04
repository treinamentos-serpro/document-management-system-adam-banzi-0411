const fs = require('node:fs/promises');
const path = require('node:path');

function createDocumentRepository({ storageDirectory }) {
  const documents = new Map();

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

    getStoragePath(storageName) {
      const filePath = path.resolve(storageDirectory, storageName);
      if (!filePath.startsWith(`${storageDirectory}${path.sep}`)) {
        throw new Error('Nome de armazenamento inválido.');
      }
      return filePath;
    },

    async fileExists(storageName) {
      try {
        await fs.access(this.getStoragePath(storageName));
        return true;
      } catch (error) {
        if (error.code === 'ENOENT') {
          return false;
        }
        throw error;
      }
    },

    async removeStoredFile(storageName) {
      try {
        await fs.unlink(this.getStoragePath(storageName));
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    },
  };
}

module.exports = { createDocumentRepository };