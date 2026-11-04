const API_PREFIX = '/api';

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_PREFIX}${path}`, options);
  } catch {
    throw new Error('Não foi possível conectar ao servidor.');
  }

  if (!response.ok) {
    let message = 'Não foi possível concluir a operação.';
    try {
      const payload = await response.json();
      message = payload.error?.message || message;
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  return response;
}

function userHeaders(owner) {
  return { 'X-User-Id': owner };
}

export async function listDocuments(owner) {
  const response = await request('/documents', { headers: userHeaders(owner) });
  return response.json();
}

export async function uploadDocument(owner, file) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await request('/upload', {
    method: 'POST',
    headers: userHeaders(owner),
    body: formData,
  });
  return response.json();
}

export async function downloadDocument(owner, documentId) {
  const response = await request(`/documents/${encodeURIComponent(documentId)}/download`, {
    headers: userHeaders(owner),
  });
  return response.blob();
}
