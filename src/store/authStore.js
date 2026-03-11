import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

export const useAuthStore = create((set) => ({
  user: null,
  token: null,
  isLoading: false,
  isRestoring: true, // true hasta verificar sesión guardada

  restoreSession: async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) { set({ isRestoring: false }); return; }
      // Verificar que el token sigue válido
      const { data } = await api.get('/users/me');
      set({ user: data.user, token, isRestoring: false });
    } catch {
      // Token expirado o inválido — limpiar
      await AsyncStorage.removeItem('token');
      set({ user: null, token: null, isRestoring: false });
    }
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

  register: async (formData) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/auth/register', formData);
      await AsyncStorage.setItem('token', data.token);
      set({ user: data.user, token: data.token, isLoading: false });
      return { success: true };
    } catch (err) {
      set({ isLoading: false });
      return { success: false, error: err.response?.data?.error || 'Error de conexión' };
    }
  },

  logout: async () => {
    await AsyncStorage.removeItem('token');
    set({ user: null, token: null });
  },

  updateUser: (user) => set({ user }),
}));
