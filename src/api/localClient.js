const SESSION_KEY = 'analytics_session';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const token = sessionStorage.getItem(SESSION_KEY);
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (body !== undefined && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(path, {
    method,
    headers,
    credentials: 'same-origin',
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body)
  });
  if (!response.ok) {
    const data = await response.json();
    if (response.status === 401 && !path.startsWith('/api/auth/')) {
      window.dispatchEvent(new Event('analytics:session-expired'));
    }
    throw new ApiError(data.error || data.message || `Request failed (${response.status})`, response.status);
  }
  return response.status === 204 ? null : response.json();
}

function collection(name) {
  const path = `/api/entities/${name}`;
  const filter = (query = {}, sort = '-created_date', limit = 1000, skip = 0) => {
    const params = new URLSearchParams({
      filter: JSON.stringify(query), sort, limit: String(limit), skip: String(skip)
    });
    return request(`${path}?${params}`);
  };
  return {
    filter,
    list: (sort = '-created_date', limit = 1000, skip = 0) => filter({}, sort, limit, skip),
    get: (id) => request(`${path}/${encodeURIComponent(id)}`),
    create: (data) => request(path, { method: 'POST', body: data }),
    bulkCreate: (data) => request(`${path}/bulk`, { method: 'POST', body: data }),
    update: (id, data) => request(`${path}/${encodeURIComponent(id)}`, { method: 'PUT', body: data }),
    bulkUpdate: (data) => request(`${path}/bulk-update`, { method: 'POST', body: data }),
    delete: (id) => request(`${path}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    subscribe: (callback) => {
      let stopped = false;
      let timer;
      let previous = null;
      const poll = async () => {
        try {
          const rows = await filter({}, '-updated_date', 10000);
          if (stopped) return;
          const current = new Map(rows.map((row) => [row.id, row]));
          if (previous) {
            for (const [id, row] of current) {
              if (!previous.has(id)) callback({ type: 'create', data: row });
              else if (JSON.stringify(previous.get(id)) !== JSON.stringify(row)) callback({ type: 'update', data: row });
            }
            for (const [id, row] of previous) {
              if (!current.has(id)) callback({ type: 'delete', data: row });
            }
          }
          previous = current;
        } catch (error) {
          if (!stopped) {
            console.error(`Could not refresh ${name}`, error);
            window.dispatchEvent(new CustomEvent('analytics:error', { detail: error.message }));
          }
        } finally {
          if (!stopped) timer = setTimeout(poll, 3000);
        }
      };
      poll();
      return () => { stopped = true; clearTimeout(timer); };
    }
  };
}

const upload = async ({ file }) => {
  const body = new FormData();
  body.append('file', file);
  return request('/api/files', { method: 'POST', body });
};

async function signIn(path, body) {
  const result = await request(path, { method: 'POST', body });
  sessionStorage.setItem(SESSION_KEY, result.access_token);
  return result;
}

export const localClient = {
  entities: Object.fromEntries([
    'Alert', 'Connection', 'Document', 'Entity', 'Manifest', 'Mention',
    'Notification', 'RiskProfile', 'Setting', 'User', 'Workspace'
  ].map((name) => [name, collection(name)])),
  functions: {
    invoke: async (name, body = {}) => ({
      data: await request(`/api/functions/${encodeURIComponent(name)}`, { method: 'POST', body })
    })
  },
  integrations: { Core: { UploadFile: upload, UploadPublicFile: upload } },
  auth: {
    me: () => request('/api/auth/me'),
    setup: () => request('/api/auth/setup'),
    loginViaEmailPassword: (email, password) => signIn('/api/auth/login', { email, password }),
    register: (body) => signIn('/api/auth/register', body),
    resetPassword: (body) => request('/api/auth/reset-password', { method: 'POST', body }),
    changePassword: (body) => request('/api/auth/change-password', { method: 'POST', body }),
    logout: async () => {
      await request('/api/auth/logout', { method: 'POST', body: {} });
      sessionStorage.removeItem(SESSION_KEY);
    }
  },
  status: () => request('/api/status'),
  backup: {
    export: () => request('/api/backup'),
    import: (data) => request('/api/backup', { method: 'POST', body: data })
  }
};
