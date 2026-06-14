# ABYSS - Proyecto MVP

App social con economía virtual, marketplace de marcos de perfil, sistema de gifts (escrow), chat en tiempo real y notificaciones FCM V1.

## Objetivo del Producto
Plataforma social móvil que monetiza la personalización del perfil (marcos) e incentiva la interacción mediante regalos virtuales y chats grupales con dinámicas de economía.

## Tecnologías Principales
- **Mobile:** React Native + Expo (SDK 54+), React 19, RN 0.81.
- **Navegación:** React Navigation 7.
- **Estado:** Zustand (authStore).
- **Backend:** Node.js (Express), MongoDB (Mongoose), Socket.io, Redis.
- **Infraestructura:** Railway (Backend), MongoDB Atlas, Cloudinary (Media), FCM V1.

## Estructura de Carpetas (Mobile)
- `src/components/`: Componentes atómicos y funcionales (AvatarWithFrame, GiftBubble).
- `src/navigation/`: Configuración de AppNavigator y rutas.
- `src/screens/`: Pantallas principales (ChatRoom, Market, Profile).
- `src/services/`: Lógica de API (axios) y Sockets.
- `src/store/`: Gestión de estado global (authStore).
- `src/theme/`: Definiciones de colores (`colors.js`) y estilos base.
- `src/utils/`: Utilidades de formateo, tiempo y notificaciones push.

## Convenciones de Código
- **API:** Usar `api.js` (Axios) para JSON. Para `FormData`, usar la función `postFormData` (fetch nativo).
- **Hooks:** Preferir `useCallback` y `useMemo` en pantallas complejas para optimizar FlatLists.
- **Sockets:** Conectar vía `src/services/socket.js`. Escuchar eventos en `useEffect` con limpieza (`off`).
- **Nomenclatura:** Archivos de pantalla con sufijo `Screen.js`. Componentes en PascalCase.

## Convenciones UI/UX
- **Paleta:** Fondo `#020509`, primario (c1) `#00e5cc`, acentos `#2979ff` (c2), `#d946ef` (c3).
- **Keyboard:** Android usa `softwareKeyboardLayoutMode: "pan"` en `app.json`.
- **FlatLists:** Usar `automaticallyAdjustKeyboardInsets={true}` y evitar `KeyboardAvoidingView` manual en Android (usar `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`).

## Comandos Frecuentes
- `npx expo start`: Iniciar desarrollo.
- `npx expo start --android`: Iniciar en Android.
- `npm run dev` (Backend): Iniciar servidor con nodemon.

## Arquitectura y Reglas
- **Notificaciones:** El backend usa el modelo `Notification.js`. Tipos permitidos definidos en su `enum`.
- **Gifts:** Sistema basado en transacciones atómicas (Mongoose Sessions). Requiere escrow en `Gift.js`.
- **Frames:** Sistema de ownership (`FrameOwnership.js`). Los marcos se aplican mediante `AvatarWithFrame`.

## Decisiones Importantes
- **Layout:** Se desactivó el modo `resize` del teclado para evitar "glitches" visuales en el chat.
- **Audio:** Uso de `expo-audio` para mensajes de voz.
- **Imágenes:** Uso de `expo-image` para caching y performance.

## NO CAMBIAR (Crítico)
- Lógica de transacciones de monedas y gifts.
- Flujo de validación de sockets.
- Configuración de FCM V1 (service account).
- Rutas de marketplace y escrow de marcos privados.
