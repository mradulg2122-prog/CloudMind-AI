// =============================================================================
// CloudMind AI – lib/api.ts  (v2)
//
// Extended to support:
//   - JWT authentication (login, register, token storage)
//   - Authenticated axios interceptor (attaches Bearer token automatically)
//   - Historical predictions fetch
//   - Alerts and logs fetch
// =============================================================================

import axios from 'axios';

// ─── Types matching FastAPI v2 Pydantic models ────────────────────────────────

export interface TelemetryInput {
  requests_per_minute: number;
  cpu_usage_percent: number;
  memory_usage_percent: number;
  active_servers: number;
  hour: number;
  minute: number;
  response_time_ms: number;
  cost_per_server: number;
}

export interface PredictionOutput {
  predicted_requests: number;
  recommended_servers: number;
  action: 'SCALE UP' | 'SCALE DOWN' | 'KEEP SAME';
  load_per_server: number;
}

export interface HealthResponse {
  status: string;
  service: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserOut {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface AlertOut {
  id: number;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  source: string;
  dismissed: boolean;
  created_at: string;
}

export interface LogOut {
  id: number;
  method: string;
  path: string;
  status_code: number;
  duration_ms: number | null;
  created_at: string;
}

// ─── Token storage helpers (localStorage) ────────────────────────────────────

const TOKEN_KEY = 'cloudmind_token';

export function saveToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function loadToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(TOKEN_KEY);
  }
  return null;
}

export function clearToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function isLoggedIn(): boolean {
  return !!loadToken();
}

// Alias — convenience shorthand used by components that only need to read the token
export const getToken = loadToken;


// ─── Axios client (auto-attaches token on every request) ─────────────────────

const apiClient = axios.create({
  baseURL : process.env.NEXT_PUBLIC_API_URL || 'https://cloudmind-ai.onrender.com',
  timeout : 10000,
  headers : { 'Content-Type': 'application/json' },
});

// Request interceptor — attach Bearer token if available
apiClient.interceptors.request.use((config) => {
  const token = loadToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — auto-logout on 401, always throw plain string errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — clear it so the login page shows
      clearToken();
    }

    // Sanitize Pydantic / FastAPI error detail into a plain string
    const detail = error.response?.data?.detail;
    let message: string;
    if (Array.isArray(detail)) {
      // 422 Pydantic validation error — array of {type, loc, msg, input, ctx}
      message = detail
        .map((d: { msg?: string; loc?: string[] }) => {
          const field = d.loc ? d.loc.filter((l) => l !== 'body').join('.') : '';
          return field ? `${field}: ${d.msg}` : (d.msg ?? JSON.stringify(d));
        })
        .join('; ');
    } else if (typeof detail === 'string') {
      message = detail;
    } else {
      message = error.message ?? 'An unexpected error occurred.';
    }

    // Re-throw as a plain Error so pages just get err.message as a string
    return Promise.reject(new Error(message));
  }
);

// ─── Auth API calls ───────────────────────────────────────────────────────────

export async function registerUser(
  username: string,
  email: string,
  password: string
): Promise<UserOut> {
  const { data } = await apiClient.post<UserOut>('/auth/register', {
    username,
    email,
    password,
  });
  return data;
}

export async function loginUser(
  username: string,
  password: string
): Promise<string> {
  const { data } = await apiClient.post<TokenResponse>('/auth/login', {
    username,
    password,
  });
  saveToken(data.access_token);
  return data.access_token;
}

export async function getMe(): Promise<UserOut> {
  const { data } = await apiClient.get<UserOut>('/auth/me');
  return data;
}

export function logoutUser(): void {
  clearToken();
}

// ─── Core prediction API ──────────────────────────────────────────────────────

export async function runPrediction(payload: TelemetryInput): Promise<PredictionOutput> {
  const { data } = await apiClient.post<PredictionOutput>('/predict', payload);
  return data;
}

export async function checkHealth(): Promise<HealthResponse> {
  const { data } = await apiClient.get<HealthResponse>('/health');
  return data;
}

// ─── Historical data ──────────────────────────────────────────────────────────

export async function fetchPredictionHistory(limit = 50): Promise<PredictionOutput[]> {
  const { data } = await apiClient.get<PredictionOutput[]>('/predictions/history', {
    params: { limit },
  });
  return data;
}

export async function fetchAlerts(limit = 50): Promise<AlertOut[]> {
  const { data } = await apiClient.get<AlertOut[]>('/alerts', {
    params: { limit },
  });
  return data;
}

export async function fetchLogs(limit = 100): Promise<LogOut[]> {
  const { data } = await apiClient.get<LogOut[]>('/logs', {
    params: { limit },
  });
  return data;
}
