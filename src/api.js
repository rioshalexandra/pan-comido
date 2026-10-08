const TOKEN_KEY = 'pan_comido_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Error de red');
    err.overlap = Boolean(data.overlap); // turno superpuesto: la pantalla puede preguntar si guardar igual
    err.status = res.status;
    throw err;
  }
  return data;
}

async function requestForm(path, form) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { method: 'POST', headers, body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error de red');
  return data;
}

export async function downloadFile(path, fallbackName) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo descargar el archivo');
  }
  const blob = await res.blob();
  const match = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '');
  const filename = match?.[1] || fallbackName;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  login: (body) => request('/api/auth/login', { method: 'POST', body }),
  me: () => request('/api/auth/me'),
  logout: () => request('/api/auth/logout', { method: 'POST', body: {} }),
  settings: () => request('/api/settings'),
  saveSettings: (body) => request('/api/settings', { method: 'PUT', body }),
  dashboard: (today) => request(`/api/dashboard${today ? `?today=${today}` : ''}`),
  products: (params = '') => request(`/api/products${params}`),
  product: (id) => request(`/api/products/${id}`),
  saveProduct: (id, body) =>
    id ? request(`/api/products/${id}`, { method: 'PUT', body }) : request('/api/products', { method: 'POST', body }),
  deleteProduct: (id) => request(`/api/products/${id}`, { method: 'DELETE' }),
  adjustStock: (id, body) => request(`/api/products/${id}/adjust-stock`, { method: 'POST', body }),
  categories: () => request('/api/products/categories'),
  saveCategory: (body) => request('/api/products/categories', { method: 'POST', body }),
  deleteCategory: (id) => request(`/api/products/categories/${id}`, { method: 'DELETE' }),
  customers: (params = '') => request(`/api/customers${params}`),
  customer: (id) => request(`/api/customers/${id}`),
  saveCustomer: (id, body) =>
    id ? request(`/api/customers/${id}`, { method: 'PUT', body }) : request('/api/customers', { method: 'POST', body }),
  deleteCustomer: (id) => request(`/api/customers/${id}`, { method: 'DELETE' }),
  // Cobro en un solo paso en el mostrador (venta + confirmación + pago)
  quickSale: (body) => request('/api/sales/quick', { method: 'POST', body }),
  // Ingredientes y productos en stock crítico, para armar el pedido al proveedor
  reorderList: () => request('/api/products/reorder'),
  // Receta de un producto: { yield, items: [{ ingredientId, qty }] }
  saveRecipe: (id, body) => request(`/api/products/${id}/recipe`, { method: 'PUT', body }),
  // Producción
  production: () => request('/api/production'),
  productionPlan: (today, days = 2) => request(`/api/production/plan?today=${today}&days=${days}`),
  produce: (body) => request('/api/production', { method: 'POST', body }),
  deleteProduction: (id) => request(`/api/production/${id}`, { method: 'DELETE' }),
  // Encargos
  orders: (params = '') => request(`/api/orders${params}`),
  order: (id) => request(`/api/orders/${id}`),
  saveOrder: (id, body) =>
    id ? request(`/api/orders/${id}`, { method: 'PUT', body }) : request('/api/orders', { method: 'POST', body }),
  setOrderStatus: (id, status) => request(`/api/orders/${id}/status`, { method: 'POST', body: { status } }),
  addDeposit: (id, body) => request(`/api/orders/${id}/deposit`, { method: 'POST', body }),
  deliverOrder: (id, body) => request(`/api/orders/${id}/deliver`, { method: 'POST', body }),
  deleteOrder: (id) => request(`/api/orders/${id}`, { method: 'DELETE' }),

  suppliers: (params = '') => request(`/api/suppliers${params}`),
  supplier: (id) => request(`/api/suppliers/${id}`),
  saveSupplier: (id, body) =>
    id ? request(`/api/suppliers/${id}`, { method: 'PUT', body }) : request('/api/suppliers', { method: 'POST', body }),
  deleteSupplier: (id) => request(`/api/suppliers/${id}`, { method: 'DELETE' }),
  sales: (params = '') => request(`/api/sales${params}`),
  sale: (id) => request(`/api/sales/${id}`),
  saveSale: (id, body) =>
    id ? request(`/api/sales/${id}`, { method: 'PUT', body }) : request('/api/sales', { method: 'POST', body }),
  confirmSale: (id) => request(`/api/sales/${id}/confirm`, { method: 'POST', body: {} }),
  cancelSale: (id) => request(`/api/sales/${id}/cancel`, { method: 'POST', body: {} }),
  deleteSale: (id) => request(`/api/sales/${id}`, { method: 'DELETE' }),
  paySale: (id, body) => request(`/api/sales/${id}/payments`, { method: 'POST', body }),
  purchases: (params = '') => request(`/api/purchases${params}`),
  purchase: (id) => request(`/api/purchases/${id}`),
  savePurchase: (id, body) =>
    id
      ? request(`/api/purchases/${id}`, { method: 'PUT', body })
      : request('/api/purchases', { method: 'POST', body }),
  confirmPurchase: (id, body = {}) => request(`/api/purchases/${id}/confirm`, { method: 'POST', body }),
  cancelPurchase: (id) => request(`/api/purchases/${id}/cancel`, { method: 'POST', body: {} }),
  deletePurchase: (id) => request(`/api/purchases/${id}`, { method: 'DELETE' }),
  payPurchase: (id, body) => request(`/api/purchases/${id}/payments`, { method: 'POST', body }),
  payments: (params = '') => request(`/api/payments${params}`),
  movements: (params = '') => request(`/api/movements${params}`),
  previewPrices: (body) => request('/api/prices/preview', { method: 'POST', body }),
  applyPrices: (body) => request('/api/prices/apply', { method: 'POST', body }),
  priceAdjustments: () => request('/api/prices'),
  priceAdjustment: (id) => request(`/api/prices/${id}`),
  exportFile: (entity, format) => downloadFile(`/api/io/export/${entity}?format=${format}`, `${entity}.${format}`),
  importFile: (entity, file) => {
    const form = new FormData();
    form.append('file', file);
    return requestForm(`/api/io/import/${entity}`, form);
  },
  uploadAttachment: (entityType, entityId, file) => {
    const form = new FormData();
    form.append('file', file);
    form.append('entityType', entityType);
    form.append('entityId', String(entityId));
    return requestForm('/api/attachments', form);
  },
  deleteAttachment: (id) => request(`/api/attachments/${id}`, { method: 'DELETE' }),
};

export function attachmentFileUrl(id) {
  const token = encodeURIComponent(getToken() || '');
  return `/api/attachments/${id}/file?token=${token}`;
}
