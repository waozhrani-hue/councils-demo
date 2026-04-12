const getAuthToken = (): string | null => {
  return localStorage.getItem('token');
};

const API_BASE = import.meta.env.VITE_API_URL || '';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  // Prepend API base URL for relative paths
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(fullUrl, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.message || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const apiClient = {
  get<T>(url: string): Promise<T> {
    return request<T>(url, { method: 'GET' });
  },

  post<T>(url: string, data?: unknown): Promise<T> {
    return request<T>(url, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  patch<T>(url: string, data?: unknown): Promise<T> {
    return request<T>(url, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  delete<T>(url: string): Promise<T> {
    return request<T>(url, { method: 'DELETE' });
  },

  async upload<T>(url: string, formData: FormData): Promise<T> {
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const uploadUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.message || `Upload failed with status ${response.status}`);
    }

    return response.json();
  },
};
