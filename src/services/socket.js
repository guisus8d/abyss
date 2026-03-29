import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

let socket = null;
let activeToken = null;  // ← trackea el token actual

export async function connectSocket() {
  const token = await AsyncStorage.getItem('token');

  // Si el socket está conectado pero el token cambió (cambio de cuenta) → reconectar
  if (socket?.connected && activeToken === token) return socket;
  if (socket) { socket.disconnect(); socket = null; }  // ← mata el socket viejo

  activeToken = token;
  socket = io(process.env.EXPO_PUBLIC_SOCKET_URL || 'https://abyss-production-7171.up.railway.app', {
    auth: { token },
    transports: ['websocket'],
  });
  socket.on('connect', () => console.log('🔌 Socket conectado'));
  socket.on('connect_error', (e) => console.error('Socket error:', e.message));
  return socket;
}

export function getSocket() { return socket; }

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  activeToken = null;  // ← limpia el token también
}