// Llamadas al servidor. Si la sesión venció, vuelve a la pantalla de entrar.
async function request(method, url, data) {
  const res = await fetch(url, {
    method,
    headers: data ? { 'Content-Type': 'application/json' } : undefined,
    body: data ? JSON.stringify(data) : undefined,
    credentials: 'same-origin',
  });
  let json = {};
  try {
    json = await res.json();
  } catch {
    /* sin cuerpo */
  }
  if (!res.ok) {
    const err = new Error(json.error || 'No se pudo conectar. Revisá tu internet.');
    err.status = res.status;
    if (res.status === 401 && url !== '/api/login' && url !== '/api/me') window.dispatchEvent(new Event('cc:logout'));
    throw err;
  }
  return json;
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, data = {}) => request('POST', url, data),
  put: (url, data = {}) => request('PUT', url, data),
  del: (url) => request('DELETE', url),
};
