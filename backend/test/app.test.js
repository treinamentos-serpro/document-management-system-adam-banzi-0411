const { after, before, test } = require('node:test');
const assert = require('node:assert');
const fsSync = require('node:fs');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const previousStorageDirectory = process.env.STORAGE_DIR;
const previousMaxFileSize = process.env.MAX_FILE_SIZE_BYTES;
const storageDirectory = fsSync.mkdtempSync(path.join(os.tmpdir(), 'dms-test-'));
let server;
let baseUrl;

process.env.STORAGE_DIR = storageDirectory;
process.env.MAX_FILE_SIZE_BYTES = '8';

const app = require('../src/app');

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await fs.rm(storageDirectory, { recursive: true, force: true });

  if (previousStorageDirectory === undefined) {
    delete process.env.STORAGE_DIR;
  } else {
    process.env.STORAGE_DIR = previousStorageDirectory;
  }

  if (previousMaxFileSize === undefined) {
    delete process.env.MAX_FILE_SIZE_BYTES;
  } else {
    process.env.MAX_FILE_SIZE_BYTES = previousMaxFileSize;
  }
});

test('o app backend é exportado', () => {
  assert.ok(app, 'o app deve estar definido');
  assert.strictEqual(typeof app, 'function', 'o app Express deve ser uma função');
});

test('upload, listagem, isolamento e download funcionam', async () => {
  const form = new FormData();
  form.append('file', new Blob(['hello']), 'hello.txt');

  const uploadResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'user-a' },
    body: form,
  });
  assert.strictEqual(uploadResponse.status, 201);

  const document = await uploadResponse.json();
  assert.strictEqual(document.originalName, 'hello.txt');
  assert.strictEqual(document.size, 5);
  assert.strictEqual(document.owner, 'user-a');
  assert.strictEqual(Object.hasOwn(document, 'storageName'), false);

  const ownerList = await fetch(`${baseUrl}/documents`, {
    headers: { 'X-User-Id': 'user-a' },
  });
  assert.strictEqual(ownerList.status, 200);
  assert.strictEqual((await ownerList.json()).length, 1);

  const otherUserList = await fetch(`${baseUrl}/documents`, {
    headers: { 'X-User-Id': 'user-b' },
  });
  assert.deepStrictEqual(await otherUserList.json(), []);

  const deniedDownload = await fetch(`${baseUrl}/documents/${document.id}/download`, {
    headers: { 'X-User-Id': 'user-b' },
  });
  assert.strictEqual(deniedDownload.status, 404);

  const download = await fetch(`${baseUrl}/documents/${document.id}/download`, {
    headers: { 'X-User-Id': 'user-a' },
  });
  assert.strictEqual(download.status, 200);
  assert.strictEqual(await download.text(), 'hello');
});

test('valida identidade, arquivo e limite de tamanho', async () => {
  const missingIdentity = await fetch(`${baseUrl}/documents`);
  assert.strictEqual(missingIdentity.status, 400);
  assert.strictEqual((await missingIdentity.json()).error.code, 'USER_ID_REQUIRED');

  const missingFile = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'user-a' },
    body: new FormData(),
  });
  assert.strictEqual(missingFile.status, 400);
  assert.strictEqual((await missingFile.json()).error.code, 'FILE_REQUIRED');

  const oversizedForm = new FormData();
  oversizedForm.append('file', new Blob(['123456789']), 'large.txt');
  const oversized = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'user-a' },
    body: oversizedForm,
  });
  assert.strictEqual(oversized.status, 413);
  assert.strictEqual((await oversized.json()).error.code, 'FILE_TOO_LARGE');
});
