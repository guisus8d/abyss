import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import api from '../services/api';

const PROJECT_ID = 'd78a617e-08c4-4798-ad2c-1a1bdff1a95a';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications() {
  console.log('[Push] Iniciando registro...');
  console.log('[Push] isDevice:', Device.isDevice);
  console.log('[Push] Android version:', Platform.Version);

  if (!Device.isDevice) {
    console.log('[Push] No es dispositivo físico, abortando');
    return null;
  }

  // Canal Android PRIMERO, antes de pedir el token
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00e5cc',
    });
    console.log('[Push] Canal Android creado');
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  console.log('[Push] Permiso actual:', existingStatus);
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    // Sin parámetros — las opciones android no son válidas y pueden silenciar el diálogo
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
    console.log('[Push] Permiso tras solicitar:', finalStatus);
  }

  if (finalStatus !== 'granted') {
    console.log('[Push] Permiso denegado, abortando');
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    const token = tokenData.data;
    console.log('[Push] Token obtenido:', token);

    await api.post('/users/push-token', { token });
    console.log('[Push] Token guardado en backend');

    return token;
  } catch (e) {
    console.error('[Push] Error obteniendo token:', e.message);
    return null;
  }
}
