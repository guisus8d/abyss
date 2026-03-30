import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { disconnectSocket } from '../services/socket';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://abyss-production-7171.up.railway.app/api';

export const useAuthStore = create((set) => ({
  user: null,
  token: null,
  isLoading: false,
  isRestoring: true,

  restoreSession: async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) { set({ isRestoring: false }); return; }
      await AsyncStorage.setItem('token', token);
      const refresh = await api.get('/users/me');
      const freshUser = refresh.data.user;
      set({ user: freshUser, token, isRestoring: false });
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const stored = JSON.parse(localStorage.getItem('auth-storage') || '{}');
          if (stored.state) { stored.state.user = freshUser; localStorage.setItem('auth-storage', JSON.stringify(stored)); }
        } catch (_) {}
      }
    } catch {
      await AsyncStorage.removeItem('token');
      set({ user: null, token: null, isRestoring: false });
    }
  },

  setAuth: async (token, user) => {
    await AsyncStorage.setItem('token', token);
    set({ user, token, isLoading: false });
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/auth/login', { email, password });
      await AsyncStorage.setItem('token', data.token);
      set({ user: data.user, token: data.token, isLoading: false });
      return { success: true };
    } catch (err) {
      set({ isLoading: false });
      return { success: false, error: err.response?.data?.error || 'Error de conexión' };
    }
  },

  // ✅ FIX: fetch nativo — axios rompe FormData en React Native (mismo bug que las imágenes)
  register: async (formData) => {
    set({ isLoading: true });
    try {
      const response = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        // ⚠️ NO poner Content-Type — fetch lo agrega solo con el boundary correcto
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        set({ isLoading: false });
        return { success: false, error: data.error || 'Error al registrar' };
      }
      await AsyncStorage.setItem('token', data.token);
      set({ user: data.user, token: data.token, isLoading: false });
      return { success: true };
    } catch (err) {
      set({ isLoading: false });
      return { success: false, error: 'Error de conexión' };
    }
  },

  logout: async () => {
    disconnectSocket();
    await AsyncStorage.removeItem('token');
    set({ user: null, token: null });
  },

  updateUser: (user) => set({ user }),
}));
