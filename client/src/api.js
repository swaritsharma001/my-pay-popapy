async function request(path, options = {}) {
  const { auth = true, ...fetchOptions } = options;
  const headers = {
    ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}),
    ...fetchOptions.headers,
  };
  const token = auth ? sessionStorage.getItem('poppay:token') : null;
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(path, {
    ...fetchOptions,
    headers,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }
  return payload;
}

export function getPublicCheckout(orderId) {
  return request(`/api/v1/checkout/${encodeURIComponent(orderId)}`, { auth: false });
}

export function getCheckoutStatus(orderId) {
  return request(`/api/v1/checkout/${encodeURIComponent(orderId)}/status`, { auth: false });
}

function jsonPost(body, method = 'POST') {
  return { method, body: JSON.stringify(body) };
}

export function signup(body) {
  return request('/api/v1/auth/signup', jsonPost(body));
}

export function login(body) {
  return request('/api/v1/auth/login', jsonPost(body));
}

export function getMe() {
  return request('/api/v1/me');
}

export function updateUpi(upiId) {
  return request('/api/v1/merchant/upi', jsonPost({ upiId }, 'PUT'));
}

export function getGmailConnectUrl() {
  return request('/api/v1/merchant/gmail/connect');
}

export function disconnectGmail() {
  return request('/api/v1/merchant/gmail/disconnect', jsonPost({}));
}

export function updateAllowedSenders(allowedSenders) {
  return request(
    '/api/v1/merchant/gmail/allowed-senders',
    jsonPost({ allowedSenders }, 'PUT'),
  );
}

export function updateWebhook(webhookUrl) {
  return request('/api/v1/merchant/webhook', jsonPost({ webhookUrl }, 'PUT'));
}

export function regenerateKeys() {
  return request('/api/v1/merchant/keys/regenerate', jsonPost({}));
}

export function getDashboardStats() {
  return request('/api/v1/dashboard/stats');
}

export function getDashboardOrders(params = {}) {
  return request(`/api/v1/dashboard/orders${toQuery(params)}`);
}

export function getPayments(params = {}) {
  return request(`/api/v1/payments${toQuery(params)}`);
}

export function getUnmatched(params = {}) {
  return request(`/api/v1/unmatched${toQuery(params)}`);
}

export function claimUnmatched(id, orderId) {
  return request(
    `/api/v1/unmatched/${encodeURIComponent(id)}/claim`,
    jsonPost({ order_id: orderId }),
  );
}

export function getWebhookLogs() {
  return request('/api/v1/webhooks/logs');
}

export function retryWebhook(id) {
  return request(`/api/v1/webhooks/${encodeURIComponent(id)}/retry`, jsonPost({}));
}

function toQuery(params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  }
  const encoded = query.toString();
  return encoded ? `?${encoded}` : '';
}

export function saveSession(token) {
  sessionStorage.setItem('poppay:token', token);
}

export function clearSession() {
  sessionStorage.removeItem('poppay:token');
}

export function hasSession() {
  return Boolean(sessionStorage.getItem('poppay:token'));
}

export { request };
