# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Abyss Social — a React Native/Expo mobile app (Android/iOS, no web feature parity) with a Node.js/Express backend. The two workspaces are `mobile/` and `backend/`, connected by REST (`/api`) and Socket.IO.

## Commands

### Mobile (`mobile/`)
```bash
npx expo start           # metro bundler (scan QR con Expo Go)
npx expo start --android # lanzar en emulador Android directamente
npx expo start --web     # build web (soporte limitado — algunos componentes son platform-guarded)
```
No hay suite de tests configurada.

### Backend (`backend/`)
```bash
npm run dev   # nodemon — recarga en caliente
npm start     # producción
```

### Infraestructura local (Docker)
```bash
docker-compose up -d   # levanta MongoDB 7 + Redis 7 + mongo-express (puerto 8081)
```
Variables de entorno necesarias en `backend/.env`: `MONGO_URI`, `REDIS_URL`, `JWT_SECRET`, `CLOUDINARY_*`, `RESEND_API_KEY`.

Variable de entorno del cliente en `mobile/.env`: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SOCKET_URL`.

## Architecture

### Mobile — capas principales

| Capa | Ruta | Descripción |
|---|---|---|
| Navegación | `src/navigation/AppNavigator.js` | Único `NavigationContainer`. Bifurca en stacks autenticado/no-autenticado según `useAuthStore().user`. El stack de registro es solo nativo (no web). |
| Estado global | `src/store/` | Zustand. `authStore` maneja sesión (token en AsyncStorage), `appStore` maneja badges de chat no leídos y flag de actualización requerida. |
| API HTTP | `src/services/api.js` | Axios con interceptores de token y versión. Para `multipart/form-data` usar `postFormData()` del mismo módulo — Axios rompe FormData en React Native. |
| Sockets | `src/services/socket.js` | Singleton de socket.io-client. Conectar con `connectSocket()`, desconectar con `disconnectSocket()`. Los listeners globales de notificaciones de chat viven en `AppNavigator`. |
| Tema | `src/theme/colors.js` | Paleta única. `c1=#00e5cc` es el acento principal. |

### Mobile — reglas de UI

1. **Safe area**: usar siempre `useSafeAreaInsets()` o `<SafeAreaView>` de `react-native-safe-area-context`, nunca del core de React Native. Los insets manuales con `paddingTop: insets.top` son el patrón habitual en este proyecto.
2. **Platform guards**: componentes nativos como AdMob (`react-native-google-mobile-ads`), `expo-blur` y `MeetTextScreen` están guardados con `Platform.OS !== 'web'` para no romper el build web.
3. **Uploads de medios**: siempre usar `postFormData()` o `fetch` nativo con `FormData` — nunca `api.post()` para multipart.
4. **Chat (FlatList + KeyboardAvoidingView)**: no modificar la estructura de layout de `ChatRoomScreen` ni `GroupRoomScreen` — el KAV está ajustado con precisión para Android/iOS.

### Backend — estructura

- `src/index.js` — entry point: helmet, cors, mongo-sanitize, rate limit global (1000 req/min) y estricto en `/auth` (100/min), rutas, sockets, crons.
- `src/routes/index.js` — agrega todos los routers bajo `/api`.
- `src/sockets/index.js` — toda la lógica en tiempo real: chat privado, grupos, Sala de Cine (cinema sync), Meet de Texto. Autenticación por JWT en el handshake.
- `src/config/cloudinary.js` — configuración de Cloudinary + storage de Multer. Imágenes y vídeos van a Cloudinary.
- Moderación solo por web (`abyss.social/mod`) con JWT de corta duración — `ModPanelScreen` fue eliminado intencionalmente del cliente móvil.

### Autenticación

- JWT almacenado en `AsyncStorage` (`token`).
- `authStore.restoreSession()` valida el token contra `/users/me` al arrancar.
- `authStore.register()` usa `fetch` nativo (no Axios) porque envía `FormData` con avatar.
- Los sockets se autentican con el mismo JWT en `socket.handshake.auth.token`.
- 426 en cualquier respuesta HTTP activa `updateRequired` en `appStore` y bloquea la UI.

### Moneda y anuncios

- Los usuarios tienen `coins` (empiezan con 50). La economía pasa por `/wallet`.
- `RewardedAdSection` permite ganar coins viendo anuncios (límite `DAILY_LIMIT=5`/día). En builds de desarrollo muestra un Alert; requiere EAS build nativo para AdMob real (`IS_DEV_BUILD = true`).

### Imágenes de perfil y frames

- `AvatarWithFrame` es el componente canónico para mostrar avatar + marco decorativo.
- Los marcos (`Frame`) se compran en el mercado y se asignan al perfil; `profileFrame` y `profileFrameUrl` en el modelo de usuario.
- La Abyss Card (tarjeta de perfil en el drawer) usa `@react-native-masked-view/masked-view` para aplicar la máscara PNG sobre el fondo personalizable del usuario.
