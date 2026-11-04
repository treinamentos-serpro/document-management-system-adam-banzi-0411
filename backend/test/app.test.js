const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const previousStorageDirectory = process.env.STORAGE_DIR;
const storageDirectory = fsSync.mkdtempSync(path.join(os.tmpdir(), 'dms-api-test-'));
process.env.STORAGE_DIR = storageDirectory;
process.env.MAX_FILE_SIZE_BYTES = String(1024 * 1024);

const app = require('../src/app');
let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  await fs.rm(storageDirectory, { recursive: true, force: true });
  if (previousStorageDirectory === undefined) delete process.env.STORAGE_DIR;
  else process.env.STORAGE_DIR = previousStorageDirectory;
  delete process.env.MAX_FILE_SIZE_BYTES;
});

test('o app Express continua exportado e o health check responde', async () => {
  assert.equal(typeof app, 'function');
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('upload, listagem e download funcionam para o proprietário', async () => {
  const form = new FormData();
  form.append('file', new Blob(['conteúdo do documento']), 'relatorio.txt');
  const uploadResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'user-a' },
    body: form,
  });
  assert.equal(uploadResponse.status, 201);

  const uploaded = await uploadResponse.json();
  assert.equal(uploaded.originalName, 'relatorio.txt');
  assert.equal(uploaded.size, Buffer.byteLength('conteúdo do documento'));
  assert.equal(uploaded.owner, 'user-a');
  assert.equal(Object.hasOwn(uploaded, 'storageName'), false);

  const listResponse = await fetch(`${baseUrl}/documents`, { headers: { 'X-User-Id': 'user-a' } });
  assert.equal(listResponse.status, 200);
  assert.deepEqual(await listResponse.json(), [uploaded]);

  const otherOwnerList = await fetch(`${baseUrl}/documents`, { headers: { 'X-User-Id': 'user-b' } });
  assert.deepEqual(await otherOwnerList.json(), []);

  const downloadResponse = await fetch(`${baseUrl}/documents/${uploaded.id}/download`, {
    headers: { 'X-User-Id': 'user-a' },
  });
  assert.equal(downloadResponse.status, 200);
  assert.match(downloadResponse.headers.get('content-disposition'), /^attachment;/);
  assert.equal(await downloadResponse.text(), 'conteúdo do documento');

  const otherOwnerDownload = await fetch(`${baseUrl}/documents/${uploaded.id}/download`, {
    headers: { 'X-User-Id': 'user-b' },
  });
  assert.equal(otherOwnerDownload.status, 404);
});

test('rejeita upload sem identidade ou arquivo e respeita o limite de tamanho', async () => {
  const missingIdentity = await fetch(`${baseUrl}/documents`);
  assert.equal(missingIdentity.status, 400);

  const missingFile = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'user-a' },
    body: new FormData(),
  });
  assert.equal(missingFile.status, 400);
  assert.equal((await missingFile.json()).error.code, 'FILE_REQUIRED');

  const oversizedForm = new FormData();
  oversizedForm.append('file', new Blob(['x'.repeat(1024 * 1024 + 1)]), 'big.txt');
  const oversized = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'user-a' },
    body: oversizedForm,
  });
  assert.equal(oversized.status, 413);
  assert.equal((await oversized.json()).error.code, 'FILE_TOO_LARGE');
});
