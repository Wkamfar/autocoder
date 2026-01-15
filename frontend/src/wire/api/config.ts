// API Configuration - Switch between mock and real backend
export const API_CONFIG = {
  // Set to 'mock' to use mock data, 'real' to use backend API
  mode: (import.meta.env.VITE_API_MODE || 'real') as 'mock' | 'real',
  
  // Backend API base URL (use proxy in dev, direct URL in production)
  // Default to same-origin. In dev, Vite can proxy `/api` to the backend.
  baseUrl: (() => {
    const envBase = import.meta.env.VITE_API_BASE_URL;
    // Safety: never ship a production build that points at localhost (common dev env leak).
    if (!import.meta.env.DEV && envBase && /localhost|127\.0\.0\.1/i.test(envBase)) {
      return '';
    }
    return envBase || '';
  })(),
  
};

// Helper to check if we're in mock mode
export const isMockMode = () => API_CONFIG.mode === 'mock';

// Helper to get API base URL
export const getApiBaseUrl = () => API_CONFIG.baseUrl;
