import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '../store/appStore';

const BASE_URL    = process.env.EXPO_PUBLIC_API_URL || 'https://abyss-production-7171.up.railway.app/api';
const APP_VERSION = '1.0.0'; // debe coincidir con app.json expo.version

const api = axios.create({ baseURL: BASE_URL });

// ── Request: añade token de auth + versión de la app ──────────────────────────
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['x-app-version'] = APP_VERSION;
  return config;
});

// ── Response: detecta 426 y activa el bloqueo global de actualización ─────────
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 426) {
      useAppStore.getState().setUpdateRequired();
    }
    return Promise.reject(err);
  }
);

// ── postFormData: fetch nativo para multipart (axios rompe FormData en RN) ────
// Úsalo así en los screens:
//   import api, { postFormData } from '../services/api';
//   const data = await postFormData('/posts', formData);
export async function postFormData(path, formData, timeoutMs = 60000) {
  const token      = await AsyncStorage.getItem('token');
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        // SIN Content-Type — fetch lo pone automáticamente con el boundary correcto
        'x-app-version': APP_VERSION,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body:   formData,
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 426) useAppStore.getState().setUpdateRequired();
      throw { response: { data, status: response.status } };
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export default api;
