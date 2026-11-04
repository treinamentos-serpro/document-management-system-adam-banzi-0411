const fs = require('node:fs/promises');
const path = require('node:path');

function createDocumentRepository({ storageDirectory, maxStorageBytes = Number.MAX_SAFE_INTEGER }) {
  const resolvedStorageDirectory = path.resolve(storageDirectory);
  const documents = new Map();

  function getStoragePath(storageName) {
    if (typeof storageName !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(storageName)) {
      throw new Error('Nome de armazenamento inválido.');
    }

    const filePath = path.resolve(resolvedStorageDirectory, storageName);
    const relativePath = path.relative(resolvedStorageDirectory, filePath);
    if (!relativePath || relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
      throw new Error('Caminho fora do diretório de armazenamento.');
    }
    return filePath;
  }

  async function getStoredBytes() {
    let totalBytes = 0;
    const entries = await fs.readdir(resolvedStorageDirectory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const fileStats = await fs.stat(path.join(resolvedStorageDirectory, entry.name));
      totalBytes += fileStats.size;
    }
    return totalBytes;
  }

  return {
    async add(document) {
      if (await getStoredBytes() > maxStorageBytes) {
        const error = new Error('O limite de armazenamento local foi atingido.');
        error.statusCode = 413;
        error.code = 'STORAGE_QUOTA_EXCEEDED';
        throw error;
      }
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