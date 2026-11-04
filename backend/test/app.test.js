const { after, before, test } = require('node:test');
const { EventEmitter } = require('node:events');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const previousEnvironment = {
  nodeEnv: process.env.NODE_ENV,
  storageDirectory: process.env.STORAGE_DIR,
  maxFileSizeBytes: process.env.MAX_FILE_SIZE_BYTES,
  maxStorageBytes: process.env.MAX_STORAGE_BYTES,
};
const storageDirectory = fsSync.mkdtempSync(path.join(os.tmpdir(), 'dms-test-'));
process.env.NODE_ENV = 'test';
process.env.STORAGE_DIR = storageDirectory;
process.env.MAX_FILE_SIZE_BYTES = '8';
process.env.MAX_STORAGE_BYTES = '6';

const app = require('../src/app');
const { createDocumentController } = require('../src/controllers/documents.controller');
const { createDocumentRepository } = require('../src/repositories/documents.repository');
const { createUploadProtection } = require('../src/routes/documents.routes');
let server;
let baseUrl;

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
  if (previousEnvironment.nodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousEnvironment.nodeEnv;
  if (previousEnvironment.storageDirectory === undefined) delete process.env.STORAGE_DIR;
  else process.env.STORAGE_DIR = previousEnvironment.storageDirectory;
  if (previousEnvironment.maxFileSizeBytes === undefined) delete process.env.MAX_FILE_SIZE_BYTES;
  else process.env.MAX_FILE_SIZE_BYTES = previousEnvironment.maxFileSizeBytes;
  if (previousEnvironment.maxStorageBytes === undefined) delete process.env.MAX_STORAGE_BYTES;
  else process.env.MAX_STORAGE_BYTES = previousEnvironment.maxStorageBytes;
});

test('mantém o health check e exporta o app Express', async () => {
  assert.equal(typeof app, 'function');
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('upload, listagem, isolamento e download funcionam com storage privado', async () => {
  const form = new FormData();
  form.append('file', new Blob(['hello']), '../hello.txt');
  const uploadResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'user-a' },
    body: form,
  });
  assert.equal(uploadResponse.status, 201);

  const document = await uploadResponse.json();
  assert.match(document.id, /^[0-9a-f-]{36}$/i);
  assert.equal(document.size, 5);
  assert.equal(document.owner, 'user-a');
  assert.equal(Object.hasOwn(document, 'storageName'), false);

  const storedFiles = await fs.readdir(storageDirectory);
  assert.deepEqual(storedFiles, [document.id]);
  const directoryMode = (await fs.stat(storageDirectory)).mode & 0o777;
  assert.equal(directoryMode, 0o700);

  const ownerList = await fetch(`${baseUrl}/documents`, { headers: { 'X-User-Id': 'user-a' } });
  assert.equal(ownerList.status, 200);
  assert.equal((await ownerList.json()).length, 1);

  const otherUserList = await fetch(`${baseUrl}/documents`, { headers: { 'X-User-Id': 'user-b' } });
  assert.deepEqual(await otherUserList.json(), []);

  const deniedDownload = await fetch(`${baseUrl}/documents/${document.id}/download`, {
    headers: { 'X-User-Id': 'user-b' },
  });
  assert.equal(deniedDownload.status, 404);

  const download = await fetch(`${baseUrl}/documents/${document.id}/download`, {
    headers: { 'X-User-Id': 'user-a' },
  });
  assert.equal(download.status, 200);
  assert.match(download.headers.get('content-disposition'), /^attachment;/);
  assert.equal(await download.text(), 'hello');
});

test('rejeita identidade ausente, multipart extra e arquivo acima do limite', async () => {
  const missingIdentity = await fetch(`${baseUrl}/documents`);
  assert.equal(missingIdentity.status, 400);

  const extraFieldForm = new FormData();
  extraFieldForm.append('note', 'unexpected');
  extraFieldForm.append('file', new Blob(['x']), 'file.txt');
  const extraField = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'user-a' },
    body: extraFieldForm,
  });
  assert.equal(extraField.status, 400);
  assert.equal((await extraField.json()).error.code, 'MULTIPART_INVALID');

  const oversizedForm = new FormData();
  oversizedForm.append('file', new Blob(['123456789']), 'large.txt');
  const oversized = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'user-a' },
    body: oversizedForm,
  });
  assert.equal(oversized.status, 413);
  assert.equal((await oversized.json()).error.code, 'FILE_TOO_LARGE');

  const overQuotaForm = new FormData();
  overQuotaForm.append('file', new Blob(['xx']), 'over-quota.txt');
  const overQuota = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'user-a' },
    body: overQuotaForm,
  });
  assert.equal(overQuota.status, 413);
  assert.equal((await overQuota.json()).error.code, 'STORAGE_QUOTA_EXCEEDED');
  const documentsResponse = await fetch(`${baseUrl}/documents`, { headers: { 'X-User-Id': 'user-a' } });
  const storedDocumentIds = (await documentsResponse.json()).map((document) => document.id).sort();
  assert.deepEqual((await fs.readdir(storageDirectory)).sort(), storedDocumentIds);
});

test('rejeita path traversal e permite storage configurado como raiz', () => {
  const repository = createDocumentRepository({ storageDirectory });
  assert.throws(() => repository.getStoragePath('../outside'), /inválido/);
  assert.throws(() => repository.getStoragePath(path.resolve(storageDirectory, '..')), /inválido/);

  const rootRepository = createDocumentRepository({ storageDirectory: path.parse(storageDirectory).root });
  const storageName = '123e4567-e89b-42d3-a456-426614174000';
  assert.equal(rootRepository.getStoragePath(storageName), path.join(path.parse(storageDirectory).root, storageName));
});

test('em produção o cabeçalho do cliente não substitui identidade autenticada', () => {
  const controller = createDocumentController({ documentService: {}, allowUntrustedIdentity: false });
  const req = { get: () => 'spoofed-user' };
  let statusCode;
  let body;
  const res = {
    status(code) { statusCode = code; return this; },
    json(payload) { body = payload; return this; },
  };

  controller.requireUserId(req, res, () => assert.fail('não deve aceitar identidade não autenticada'));
  assert.equal(statusCode, 401);
  assert.equal(body.error.code, 'AUTHENTICATION_REQUIRED');
});

test('aceita principal autenticado e normaliza seu identificador', () => {
  const controller = createDocumentController({ documentService: {}, allowUntrustedIdentity: false });
  const req = { user: { id: '  trusted-user  ' }, get: () => 'spoofed-user' };
  const res = {};
  let continued = false;

  controller.requireUserId(req, res, () => { continued = true; });
  assert.equal(continued, true);
  assert.equal(req.owner, 'trusted-user');
});

test('limita uploads por cliente e por concorrência', () => {
  const protectUpload = createUploadProtection({ maxUploadsPerMinute: 1, maxConcurrentUploads: 1 });
  const createResponse = () => {
    const response = new EventEmitter();
    response.status = (code) => { response.statusCode = code; return response; };
    response.json = (body) => { response.body = body; return response; };
    return response;
  };
  const firstResponse = createResponse();
  let firstContinued = false;

  protectUpload({ ip: 'client-a' }, firstResponse, () => { firstContinued = true; });
  assert.equal(firstContinued, true);

  const busyResponse = createResponse();
  protectUpload({ ip: 'client-b' }, busyResponse, () => assert.fail('não deve exceder concorrência'));
  assert.equal(busyResponse.statusCode, 503);

  firstResponse.emit('finish');
  const limitedResponse = createResponse();
  protectUpload({ ip: 'client-a' }, limitedResponse, () => assert.fail('não deve exceder a taxa'));
  assert.equal(limitedResponse.statusCode, 429);
});
