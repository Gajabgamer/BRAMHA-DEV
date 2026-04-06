import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";
export const AUTH_TOKEN_KEY = "bugpredictor_auth_token";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000
});

apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const bugPredictorApi = {
  async signup(payload) {
    const response = await apiClient.post("/auth/signup", payload);
    return response.data;
  },

  async login(payload) {
    const response = await apiClient.post("/auth/login", payload);
    return response.data;
  },

  async getMe() {
    const response = await apiClient.get("/auth/me");
    return response.data;
  },

  async getProjects() {
    const response = await apiClient.get("/projects");
    return response.data;
  },

  async getDashboard() {
    const response = await apiClient.get("/dashboard");
    return response.data;
  },

  async analyze(payload) {
    const response = await apiClient.post("/analyze", payload);
    return response.data;
  },

  async connectGitHub(payload) {
    const response = await apiClient.post("/github/connect", payload);
    return response.data;
  },

  async simulateGitHubEvent(payload) {
    const response = await apiClient.post("/github/simulate", payload);
    return response.data;
  },

  async askAssistant(payload) {
    const response = await apiClient.post("/assistant/chat", payload);
    return response.data;
  },

  async addComment(projectId, payload) {
    const response = await apiClient.post(`/projects/${projectId}/comments`, payload);
    return response.data;
  },

  async addAssignment(projectId, payload) {
    const response = await apiClient.post(`/projects/${projectId}/assignments`, payload);
    return response.data;
  }
};

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}
