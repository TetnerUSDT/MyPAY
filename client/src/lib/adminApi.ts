// Get admin URL from server
let cachedAdminUrl: string | null = null;

export const getAdminPath = async (): Promise<string> => {
  if (cachedAdminUrl) {
    return cachedAdminUrl;
  }
  
  try {
    const response = await fetch('/api/config/admin-url');
    const data = await response.json();
    cachedAdminUrl = data.adminUrl;
    return cachedAdminUrl;
  } catch (error) {
    return 'admin'; // fallback
  }
};

export const getAdminPathSync = () => {
  return cachedAdminUrl || 'admin';
};

// Store admin credentials
let adminCredentials: { username: string; password: string } | null = null;

export const setAdminCredentials = (username: string, password: string) => {
  adminCredentials = { username, password };
  localStorage.setItem('admin_credentials', btoa(`${username}:${password}`));
};

export const getAdminCredentials = () => {
  if (adminCredentials) return adminCredentials;
  
  const stored = localStorage.getItem('admin_credentials');
  if (stored) {
    const decoded = atob(stored);
    const [username, password] = decoded.split(':');
    adminCredentials = { username, password };
    return adminCredentials;
  }
  
  return null;
};

export const clearAdminCredentials = () => {
  adminCredentials = null;
  localStorage.removeItem('admin_credentials');
};

// Admin API request helper
export const adminRequest = async (endpoint: string, options: RequestInit = {}) => {
  const creds = getAdminCredentials();
  if (!creds) {
    throw new Error('Not authenticated');
  }

  const adminPath = getAdminPath();
  const url = `/${adminPath}/api${endpoint}`;
  
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Basic ${btoa(`${creds.username}:${creds.password}`)}`);
  headers.set('Content-Type', 'application/json');

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearAdminCredentials();
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || 'Request failed');
  }

  return response.json();
};
