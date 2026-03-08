// API Types matching the FastAPI Pydantic models
import axios from 'axios';

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

// Axios client
const apiClient = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

export async function runPrediction(payload: TelemetryInput): Promise<PredictionOutput> {
  const { data } = await apiClient.post<PredictionOutput>('/predict', payload);
  return data;
}

export async function checkHealth(): Promise<HealthResponse> {
  const { data } = await apiClient.get<HealthResponse>('/health');
  return data;
}
