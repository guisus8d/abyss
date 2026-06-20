import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://abyss-production-7171.up.railway.app/api';

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ✅ FIX DEFINITIVO: axios rompe FormData en React Native siempre.
// Usamos fetch nativo para cualquier subida multipart.
// Úsalo así en los screens:
//   import api, { postFormData } from '../services/api';
//   const data = await postFormData('/posts', formData);
export async function postFormData(path, formData, timeoutMs = 60000) {
  const token = await AsyncStorage.getItem('token');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        // SIN Content-Type — fetch lo pone automáticamente con el boundary correcto
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok) throw { response: { data } };
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export default api;
