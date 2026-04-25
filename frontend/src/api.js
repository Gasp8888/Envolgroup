import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;
export const TOKEN_KEY = "envol_token";

export const api = axios.create({ baseURL: API });
api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem(TOKEN_KEY);
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

export const PLAN_RANK = { Bronze: 1, Silver: 2, Gold: 3 };
export const PLAN_PRICES = { Bronze: 49, Silver: 99, Gold: 199 };
