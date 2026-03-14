import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

let socket = null;

export async function connectSocket() {
  if (socket?.connected) return socket;
  const token = await AsyncStorage.getItem('token');
  socket = io(process.env.EXPO_PUBLIC_SOCKET_URL || 'https://abyss-production-7171.up.railway.app', {
    auth: { token },
    transports: ['websocket'],
  });
  socket.on('connect', () => console.log('🔌 Socket conectado'));
  socket.on('connect_error', (e) => console.error('Socket error:', e.message));
  return socket;
}

export function getSocket() { return socket; }
export function disconnectSocket() { socket?.disconnect(); socket = null; }
