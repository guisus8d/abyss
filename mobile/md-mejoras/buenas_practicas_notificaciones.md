# Buenas Prácticas — Sistema de Notificaciones Push
> Extraído de `app-projz-20240512.apk` + comparación directa con Abyss — Junio 2026

---

## 1. Arquitectura — ProyectZ vs Abyss

### ProyectZ
- FCM V1 directo sin intermediario
- 7 canales nativos de Android registrados
- Íconos específicos por tipo de notificación
- Control granular por canal desde configuración del sistema

### Abyss (estado actual)
- Expo Push SDK como intermediario entre backend y FCM/APNs
- 1 canal `default` para todo
- Sin íconos por tipo
- Silenciar = silenciar todo o nada

---

## 2. Los 7 Canales de ProyectZ

```
com.supersymlab.mercury.notificationchannel.chatmessage    → mensajes de chat
com.supersymlab.mercury.notificationchannel.chatactivity   → reacciones, menciones en chat
com.supersymlab.mercury.notificationchannel.posts          → likes, comentarios en posts
com.supersymlab.mercury.notificationchannel.users          → follows, visitas de perfil
com.supersymlab.mercury.notificationchannel.circles        → actividad en círculos
com.supersymlab.mercury.notificationchannel.alert          → alertas del sistema
com.supersymlab.mercury.notificationchannel.announcements  → comunicados oficiales
```

**Por qué importa:** Android permite al usuario silenciar canales individualmente
desde Configuración del sistema. Sin canales separados, el usuario silencia
todo o nada. Con canales, puede silenciar posts pero seguir recibiendo mensajes.
Esto impacta directamente en retención.

---

## 3. Íconos de Push por Tipo

ProyectZ tiene íconos específicos para cada categoría de push:

```
icon_push_gift.png          → push de regalo recibido
icon_push_top_up.png        → push de recarga de saldo/coins
icon_push_notifications.png → push genérico del sistema
push_in_app_ic_message.png  → notificación in-app de mensaje
push_in_app_ic_post.png     → notificación in-app de post
push_in_app_ic_user.png     → notificación in-app de usuario
```

Esto requiere FCM directo — Expo Push no permite personalizar el ícono
por notificación desde el backend.

---

## 4. Sistema de Badges en Perfil

```
ic_verified_badge.png        → cuenta verificada
ic_ai_badge.png              → badge de funciones IA
ic_power_profile_badge.png   → badge de perfil premium/power
ic_vote_badge_1/2/3.png      → top 3 en votaciones
badge_welcome_team.png       → equipo de bienvenida (moderadores)
```

Badges visuales en el avatar que se otorgan por logros o roles.
Abyss tiene `badges` en el modelo de User pero sin representación
visual en el avatar — solo en la tab de badges del perfil.

---

## 5. Notificaciones In-App (Banner interno)

ProyectZ tiene un sistema de notificaciones dentro de la app
separado del push del sistema:

```
app_push_holder_layout.xml       → contenedor del push in-app
push_notification_card.xml       → card visual del push
fragment_push_notice.xml         → pantalla de avisos
fragment_push_enforce.xml        → push de alta prioridad (forzado)
alert_banner.xml                 → banner de alerta
alert_banner_cell.xml            → celda dentro del banner
mercury_toast.xml                → toast personalizado
mercury_alert.xml                → alert personalizado
announcement_push_notification_edit.xml → edición de anuncios push
```

**Patrón:** Tienen dos capas de notificación:
1. Push del sistema (cuando la app está cerrada/background)
2. Banner/toast interno (cuando la app está abierta)

El banner interno usa íconos distintos según el tipo
(message, post, user) para que el usuario identifique
de un vistazo de qué se trata sin leer el texto.

---

## 6. Configuración de Notificaciones por Usuario

```
fragment_notification_settings_layout.xml → pantalla de configuración
fragment_notification_likes_info_layout.xml → info sobre likes
NotificationSettingsFragment → fragment dedicado con ViewModel propio
NotificationStatusType → enum de estados por tipo
```

Cada usuario puede configurar qué tipos de notificación recibe.
No es solo on/off global — es granular por tipo.

---

## 7. Comparación de Tipos de Notificación

### Abyss (modelo actual)
```javascript
enum: [
  'like',
  'comment', 
  'follow',
  'chat_accepted',
  'group_invite',
  'mention',
  'admin_transfer',
  'admin_transfer_declined'
]
```

### ProyectZ (inferido de assets + DEX)
```
like / comment / follow       → social básico
chat_message / chat_mention   → chat
gift_received / gift_claimed  → gifts
top_up                        → economía
circle_activity               → círculos
match                         → matching
announcement                  → sistema
frame_like / frame_comment    → marketplace
```

---

## 8. Bug Identificado en Abyss

`gift.routes.js` llama a `sendPush` cuando se reclama un gift,
pero **no crea un documento en la colección Notification**.
El push llega al dispositivo pero no aparece en el centro
de notificaciones de la app. El tipo `gift` tampoco existe
en el enum del modelo.

Fix necesario:
- Añadir `'gift_received'` y `'gift_claimed'` al enum de Notification
- Crear el documento de Notification en gift.routes.js al momento
  del claim, igual que se hace en market.routes.js y post.controller.js

---

## 9. Gaps de Abyss vs ProyectZ

### Gap crítico — Canal único
Abyss usa un solo canal `default` para todas las notificaciones.
ProyectZ tiene 7 canales. El impacto en retención es directo:
usuarios que silencian notifications por spam de likes
también dejan de recibir mensajes de chat.

**Fix:** Migrar a FCM V1 directo (ya tienes las credenciales
desde la implementación de FCM V1 con EAS) y registrar
mínimo 3 canales: `chat`, `social`, `system`.

### Gap menor — Tipos faltantes
Faltan en el enum: `gift_received`, `gift_claimed`,
`frame_like`, `frame_comment`, `coin_received`.
Ya tienes los sendPush para algunos de estos pero
sin el documento de Notification correspondiente.

### Gap visual — Badges en avatar
Los badges del perfil solo aparecen en la tab de badges.
ProyectZ los muestra directamente sobre el avatar en
todas las vistas donde aparece el usuario.

### Gap UX — Notificación in-app
Abyss no tiene banner interno cuando la app está abierta.
Si llegas un mensaje mientras estás en el feed, no hay
indicación visual. ProyectZ muestra un banner tipo
toast con ícono del tipo de notificación.

---

## 10. Roadmap de Notificaciones para Abyss

**Fase 1 — Quick fixes (bajo esfuerzo, alto impacto):**
- Añadir tipos `gift_received`, `gift_claimed`, `frame_like`,
  `frame_comment`, `coin_received` al enum de Notification
- Crear documento Notification en gift.routes.js al hacer claim
- Añadir badges visuales en AvatarWithFrame para cuentas verificadas

**Fase 2 — Canales separados:**
- Migrar de Expo Push a FCM V1 directo para Android
- Registrar 3 canales mínimos: `chat`, `social`, `system`
- Canal `chat` con alta prioridad y sonido propio
- Canales `social` y `system` con prioridad normal

**Fase 3 — Experiencia completa:**
- Banner in-app cuando la app está abierta (con ícono por tipo)
- Pantalla de configuración de notificaciones por tipo
- Íconos específicos por tipo de push (`push_ic_gift`,
  `push_ic_message`, `push_ic_post`)
- Notificaciones de check-in diario y onboarding rewards

---

*Análisis basado en: `app-projz-20240512.apk` + código fuente de Abyss — Junio 2026*
