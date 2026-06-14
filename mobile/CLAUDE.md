# CLAUDE.md — Abyss Social App

## Contexto del proyecto
Abyss es una app social móvil estilo red social con economía virtual, marketplace de marcos de perfil, sistema de gifts, chats privados y grupos. Stack: React Native + Expo (frontend), Node.js + Express (backend), MongoDB Atlas, Railway (deploy), Cloudinary (media), Socket.io (tiempo real), FCM V1 (push notifications).

---

## Estructura de directorios

```
abyss/proyecto-mvp/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── cloudinary.js          # Configuración Cloudinary + multer
│   │   ├── controllers/
│   │   │   ├── post.controller.js     # Lógica de posts, reacciones, comentarios
│   │   │   └── social.controller.js   # Follow/unfollow/block
│   │   ├── middlewares/
│   │   │   ├── auth.js                # JWT authMiddleware
│   │   │   └── optionalAuth.js        # Auth opcional para rutas públicas
│   │   ├── models/
│   │   │   ├── Frame.js               # Marco de perfil
│   │   │   ├── FrameOwnership.js      # Ownership de marcos (user+frame+units)
│   │   │   ├── Gift.js                # Sistema de gifts con escrow
│   │   │   ├── Group.js               # Grupos/salas
│   │   │   ├── Notification.js        # Notificaciones in-app
│   │   │   ├── Post.js                # Publicaciones
│   │   │   ├── Store.js               # Tienda por usuario
│   │   │   └── User.js                # Usuario principal
│   │   ├── routes/
│   │   │   ├── frame.routes.js        # CRUD frames + publish/listing/buy legacy
│   │   │   ├── gift.routes.js         # Envío, claim, expiración de gifts
│   │   │   ├── group.routes.js        # Grupos y salas
│   │   │   ├── index.js               # Router principal
│   │   │   ├── market.routes.js       # Marketplace: buy atómico, like, comment
│   │   │   └── store.routes.js        # Tienda pública por usuario
│   │   ├── sockets/
│   │   │   └── index.js               # Socket.io: chat, grupos, push en tiempo real
│   │   └── utils/
│   │       ├── bots.js                # Bots del sistema
│   │       ├── coins.js               # transferirCoins con comisión 15%
│   │       ├── giftCron.js            # Cron de expiración de gifts
│   │       └── pushNotifications.js   # sendPush via Expo Push SDK
│   └── .env                           # Variables de entorno (no commitear)
│
└── mobile/
    ├── src/
    │   ├── components/
    │   │   ├── AudioMessage.js
    │   │   ├── AvatarWithFrame.js     # Avatar + marco animado Cloudinary
    │   │   ├── CoinIcon.js
    │   │   ├── CreatePostMenu.js
    │   │   ├── CustomTabBar.js
    │   │   ├── GiftBubble.js          # Burbuja de gift en chat
    │   │   ├── GuestAuthModal.js
    │   │   ├── OrbitUsers.js
    │   │   ├── PostCard.js            # Card de publicación con reacciones
    │   │   ├── ProfileDrawer.js
    │   │   ├── RandomUsers.js
    │   │   ├── ReportModal.js
    │   │   ├── SharePostModal.js
    │   │   └── SharedProfileBubble.js
    │   ├── navigation/
    │   │   └── AppNavigator.js        # Stack navigator principal
    │   ├── screens/
    │   │   ├── ChatRoomScreen.js      # Chat privado P2P
    │   │   ├── ChatsScreen.js         # Lista de chats + pinned
    │   │   ├── CreateStoreScreen.js
    │   │   ├── EditProfilePageScreen.js
    │   │   ├── FrameSelectorScreen.js # Selector de marcos equipados
    │   │   ├── GiftScreen.js
    │   │   ├── GroupRoomScreen.js     # Sala grupal
    │   │   ├── HomeScreen.js          # Feed principal (Para Ti / Siguiendo / Trending)
    │   │   ├── MarketFrameDetailScreen.js
    │   │   ├── PostImageScreen.js
    │   │   ├── PostNoticiaScreen.js
    │   │   ├── ProfileScreen.js       # Perfil propio
    │   │   ├── PublicProfileScreen.js # Perfil público de otro usuario
    │   │   ├── StoreScreen.js         # Tienda de un usuario
    │   │   ├── TopScreen.js
    │   │   └── TransactionsScreen.js
    │   ├── services/
    │   │   └── api.js                 # Axios instance con base URL Railway
    │   ├── store/
    │   │   └── authStore.js           # Zustand: user, token, updateUser, logout
    │   ├── theme/
    │   │   └── colors.js              # Paleta de colores de Abyss
    │   └── utils/
    │       ├── pushNotifications.js   # Registro FCM + canal default
    │       └── timeUtils.js           # getActivityStatus
    ├── App.js                         # Entry point, StatusBar, AppNavigator
    ├── app.json                       # Config Expo (newArchEnabled: true)
    ├── index.js
    └── package.json
```

---

## Variables de entorno críticas (backend)

```env
MONGODB_URI=mongodb+srv://...@abbysdb...
JWT_SECRET=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
EXPO_ACCESS_TOKEN=...          # Para sendPush via Expo SDK
```

## Variables de entorno críticas (mobile)

```env
EXPO_PUBLIC_API_URL=https://abyss-production-7171.up.railway.app/api
```

---

## Decisiones de arquitectura — NUNCA cambiar sin entender

### Git / Deploy
- Railway monitorea rama `main` del repo
- Todos los pushes al backend: `git push origin master:main`
- Vercel Root Directory: `mobile`

### Chat FlatList — regla crítica
- Patrón correcto: `inverted={true}` + unshift `[msg, ...prev]`
- NUNCA agregar: `scrollToOffset`, `scrollToEnd`, `maintainVisibleContentPosition`
- El fix del bug de FlatList en ChatRoomScreen fue eliminar `maintainVisibleContentPosition`

### Cloudinary — marcos animados
- Los marcos WEBP animados se suben como `resource_type: 'video'`
- No como `image` — los WEBP animados requieren video para preservar animación

### Transacciones monetarias
- SIEMPRE usar sesión MongoDB para cualquier operación de coins/compra
- La función `transferirCoins` en `utils/coins.js` maneja comisión del 15%
- La ruta correcta de compra es `POST /api/market/frames/:id/buy` — tiene sesión atómica
- La ruta legacy `POST /frames/:id/buy` existe solo por compatibilidad — NO la uses para nuevas features

### Gifts
- Usan escrow: el coin se descuenta al enviar, se acredita al reclamar
- `thread_id` define el contexto del gift — NO está acoplado a círculos
- El cron de expiración vive en `utils/giftCron.js`
- BUG CONOCIDO: gift.routes.js llama sendPush pero no crea documento Notification
- PENDIENTE: agregar tipos `gift_received` y `gift_claimed` al enum de Notification.js

### Push Notifications
- Usa Expo Push SDK (no FCM directo)
- Un solo canal `default` para todo — pendiente migrar a canales separados
- sendPush acepta: `(pushToken, title, body, data = {})`

---

## Modelos de datos — campos clave

### User
```js
username, email, password, avatarUrl, profileFrame, profileFrameUrl,
profileBanner, profileBannerType, profileBg, profileBgType,
profileBlocks, profilePrefs, xp, coins, collectionSlots,
followers, following, blockedUsers, badges, role,
pushToken, lastActive, emailVerified, banned
```

### Frame
```js
creator, name, description, imageUrl, publicId,
bgColor, bgType, bgGradient, bgImageUrl, logoUrl, pedestalUrl,
price, units, totalSold, unidadesTotales, status, xpRequired,
likes, likesCount, comments, commentsCount
// status: draft | active | paused | retirado | agotado
```

### FrameOwnership
```js
user, frame, units, equipped, origen
// origen: compra | regalo | creacion
```

### Store
```js
usuario, nombre, descripcion, banner, logo,
nivel (1-5), ventasTotales, ingresosTotal, marcosActivos, activa
// nivel se recalcula: 5+ ventas=2, 25+=3, 100+=4, 500+=5
```

### Gift
```js
// Escrow: coins descontados al enviar, acreditados al reclamar
// thread_id como contexto — no acoplado a círculos
```

### Notification
```js
to, from, type, post, frame, text, read,
groupId, groupName, groupDescription, groupImageUrl
// type enum actual: like | comment | follow | chat_accepted |
//   group_invite | mention | admin_transfer | admin_transfer_declined
// PENDIENTE agregar: gift_received | gift_claimed | frame_like | frame_comment
```

---

## Paleta de colores actual (colors.js)

```js
export const colors = {
  black:   '#020509',
  deep:    '#050c14',
  surface: '#091525',
  card:    '#111f2d',
  c1:      '#00e5cc',  // teal — color principal
  c2:      '#2979ff',  // blue
  c3:      '#d946ef',  // purple
  c4:      '#f97316',  // orange
  c5:      '#22d3ee',  // cyan
  textHi:  '#e8f4f8',
  textMid: '#7a9ab8',
  textDim: '#3a5570',
  border:  '#0d1520',
  borderC: '#0f2d45',
};
```

---

## Bugs conocidos y pendientes

### Críticos
- `ProfileScreen` y `PublicProfileScreen` usan `ScrollView + posts.map()` — causa freeze con muchos posts. Fix: reemplazar con `FlatList` + `getItemLayout` + `removeClippedSubviews` + `maxToRenderPerBatch=5` + `windowSize=5` + hero/tabs como `ListHeaderComponent`
- `Notification.js` no tiene tipos `gift_received` ni `gift_claimed` — gift.routes.js llama sendPush pero no persiste en BD

### Menores
- `ChatRoomScreen` transición del teclado pendiente de revisión — `softwareKeyboardLayoutMode` fue revertido a `resize` por conflicto con animación manual
- Canales de push: un solo canal `default` — pendiente separar en `chat`, `social`, `system`

---

## Roadmap priorizado

### Fase 1 — Quick wins
- [ ] Agregar `gift_received` y `gift_claimed` al enum de Notification.js
- [ ] Crear documento Notification en gift.routes.js al hacer claim
- [ ] Fix FlatList en ProfileScreen y PublicProfileScreen
- [ ] Bounce animation en likes de PostCard

### Fase 2 — Gift experience
- [ ] Gift box con contenido variable (gacha — puede salir vacío)
- [ ] Fast gift: envío rápido desde chat sin compose
- [ ] Estados visuales en burbuja: start → opened → expired
- [ ] Endpoint `/withdrawn` para cancelar gift no abierto

### Fase 3 — Retención
- [ ] Check-in diario con streak y double reward al día 7
- [ ] Onboarding rewards por primeras acciones (chat, follow, completar perfil)
- [ ] Canales FCM separados: chat / social / system
- [ ] Bubble styles de chat como feature premium

### Fase 4 — Economía expandida
- [ ] Segunda moneda premium (diamonds) comprable con dinero real
- [ ] Swap coins ↔ diamonds con pantalla de resumen
- [ ] Inventario visual de items (treasures) compartible socialmente
- [ ] Reward Center centralizado

---

## Reglas para Claude Code

1. **Nunca tocar** el patrón `inverted={true}` + `[msg, ...prev]` en chat FlatLists
2. **Nunca agregar** `scrollToOffset`, `scrollToEnd` o `maintainVisibleContentPosition` en FlatLists de chat
3. **Siempre usar sesión MongoDB** para operaciones de coins, compras y gifts
4. **Siempre hacer backup git** antes de cambios grandes: `git add -A && git commit -m "backup: antes de X"`
5. **Los marcos WEBP animados** van a Cloudinary como `resource_type: 'video'`
6. **Círculos no implementados** — no crear modelos ni rutas relacionadas a círculos
7. **La ruta de compra correcta** es `/api/market/frames/:id/buy` — no la legacy de `/frames/:id/buy`
8. **Push siempre via** `sendPush` de `utils/pushNotifications.js` — y siempre crear documento Notification además del push

---

*Generado: Junio 2026 — basado en análisis completo del proyecto Abyss*
