# Sprint de Mejoras — Abyss Social
> Documento de trabajo para Claude Code. Ordenado de menor a mayor complejidad/riesgo.
> Generado a partir de `mejoras.md` + `buenas_practicas_notificaciones.md` — Junio 2026

---

## ⚠️ LEE ESTO ANTES DE TOCAR CÓDIGO

1. **Lee primero `CLAUDE.md`** (en `mobile/md-mejoras/`). `ARCHITECTURE.md` y `DATABASE_RELATIONS.md` **no existen todavía** (pendientes de crear). No asumas nada sobre la arquitectura sin confirmarlo en el código o en `CLAUDE.md`.
2. **El documento `buenas_practicas_notificaciones.md` es un análisis comparativo**, no un diagnóstico 100% confirmado del estado actual de Abyss. Antes de implementar cualquier fix de notificaciones (Fase 5 de este documento), **verifica directamente en el código** (modelo `Notification`, `gift.routes.js`, `market.routes.js`, `post.controller.js`) si los gaps descritos siguen vigentes. Si encuentras diferencias entre el md y el código real, **repórtalas antes de modificar nada**.
3. **No se permite romper el patrón ya establecido** en áreas críticas:
   - Chat FlatList: `inverted={true}` + `unshift` para nuevos mensajes. **Nunca** agregar `scrollToOffset`, `scrollToEnd`, ni `maintainVisibleContentPosition`.
   - Railway monitorea la rama `main`. Los pushes se hacen con `git push origin master:main`.
   - Cloudinary maneja todos los medios (imágenes/video). WEBP animado usa `resource_type: 'video'`.
4. **Antes de cualquier cambio grande** (todo lo marcado como Fase 4+), ejecutar:
   ```bash
   git add -A && git commit -m "backup: antes de [nombre de la fase]"
   ```
5. **Estas features quedan FUERA de este sprint** (se documentan aparte más adelante):
   - Círculos / Clubes / Fiestas (co-admins, club público) — la pieza más grande, md propio pendiente.
   - Migración a FCM V1 directo (canales nativos de Android, abandonar Expo Push SDK) — md propio pendiente.
   - Limpieza visual de "Mi Colección" (símbolos sueltos) — se aborda después de estabilizar todo lo demás.
6. Si cualquier tarea de este documento entra en conflicto con la arquitectura actual o requiere un cambio estructural no previsto aquí, **detente y reporta antes de continuar**.

---

## FASE 0 — Assets nuevos

8 fotos de perfil predefinidas para el flujo de registro (carrusel horizontal).

**Ruta local de staging (temporal — no es la ruta de producción):** `mobile/md-mejoras/ImagenesPerfil/`
**Ruta en Cloudinary:** `abyss/profile-presets/`

**Nomenclatura:**
```
preset_avatar_01.png
preset_avatar_02.png
preset_avatar_03.png
preset_avatar_04.png
preset_avatar_05.png
preset_avatar_06.png
preset_avatar_07.png
preset_avatar_08.png
```

El modelo `User` guarda la **URL completa de Cloudinary** en el campo de foto de perfil (mismo patrón que fotos subidas por el usuario). No se guarda índice ni referencia separada — un preset seleccionado se trata exactamente igual que una foto subida.

---

## FASE 1 — Fixes triviales (bajo riesgo, alto impacto inmediato)

### 1.1 Bug de password field (doble carácter visible)
El campo de contraseña en login muestra 2 caracteres antes de ocultarlos, en vez de 1 (comportamiento estándar). Revisar el componente de input de contraseña — probablemente un timeout/delay custom mal calibrado en `secureTextEntry` o lógica de enmascarado manual.
**Fix esperado:** que se comporte como el estándar nativo (1 carácter visible, luego se oculta).

### 1.2 Tab "Invitaciones" en el menú de chat (sin lógica)
En el menú de chat (`Privado | Círculos | Game`), agregar una pestaña nueva llamada **Invitaciones**.
- Solo UI — sin funcionalidad, sin endpoints, sin lógica detrás.
- Se reserva para una implementación futura (relacionada con Fase 6, sistema de invitaciones).

### 1.3 Bug de notificaciones de gift (confirmar primero, luego corregir)
Según el análisis de notificaciones: `gift.routes.js` llamaría a `sendPush` al reclamar un gift, pero no crearía el documento correspondiente en la colección `Notification`, y el tipo `gift` no existiría en el enum.

**Antes de tocar código:**
- Verificar en `gift.routes.js` si efectivamente falta la creación del documento `Notification`.
- Verificar el enum actual de `Notification` (ya sabemos por contexto previo que se agregaron `gift_received` y `gift_claimed` en una sesión anterior — confirmar si ya están o si el md está desactualizado en este punto).

**Si el gap sigue vigente:**
- Asegurar que `gift_received` y `gift_claimed` estén en el enum del modelo `Notification`.
- Crear el documento de `Notification` en `gift.routes.js` al momento del claim, siguiendo el mismo patrón usado en `market.routes.js` y `post.controller.js`.

### 1.4 Tipos de notificación faltantes (si aplica tras verificación)
Revisar si faltan en el enum: `frame_like`, `frame_comment`, `coin_received`. Agregar solo los que falten y crear el documento `Notification` correspondiente donde ya exista un `sendPush` sin su contraparte de registro.

---

## FASE 2 — Límites y anti-abuso

### 2.1 Rate limiting de publicaciones
**Límite: 3 publicaciones cada 5 minutos por usuario.**
- Validación en el endpoint de creación de post.
- Responder con mensaje claro al usuario cuando se alcance el límite (ej. "Has alcanzado el límite de publicaciones, intenta de nuevo en X minutos").

### 2.2 Rate limiting + detección de spam en comentarios
**Rate limit duro:** máximo 5 comentarios por minuto por usuario (ajustable, pero no usar el método de "primeros 2 + últimos 2 caracteres" — ver razón abajo).

**Detección de spam (contenido repetido o casi idéntico):**
- Normalizar el contenido del comentario (lowercase, trim, remover emojis repetidos/exceso de signos de puntuación).
- Generar un hash del contenido normalizado.
- Si el mismo usuario envía el mismo hash 3+ veces dentro de una ventana de tiempo (ej. 10 minutos) → bloqueo temporal de comentarios para ese usuario.
- Para detectar variaciones leves (ej. "hola", "hola.", "hola!!"), usar similarity score (librería tipo `string-similarity` o Levenshtein distance) contra los últimos N comentarios del mismo usuario. Si similitud > 85% y se repite 3+ veces → mismo tratamiento de spam.

**Por qué no usar el método de ProyectZ (primeros 2 + últimos 2 caracteres):**
Es un fingerprint parcial que genera falsos positivos (ej. "jajaja" vs "jajajaja" comparten extremos pero son distintos) y falsos negativos (mensajes con contenido opuesto pueden compartir los mismos caracteres en los extremos). Además no detecta variaciones leves, que es exactamente la técnica que usa un spammer real para evadir filtros simples. El método de hash + similarity es más robusto y no significativamente más costoso de implementar.

### 2.3 Límite de grupos privados
**Límite: 10 grupos privados por usuario** (como creador/admin).
- Validación antes de permitir la creación de un nuevo grupo.
- Mensaje claro al usuario al alcanzar el límite.

---

## FASE 3 — Reacciones, permisos y moderación de contenido

### 3.1 Ver quién reaccionó, filtrado por tipo de emoji
En las 3 vistas donde se muestran publicaciones (home/feed, detalle de post, perfil de usuario):
- Long-press sobre el contador de reacciones (o sobre un emoji específico) abre una pantalla/modal con la lista de usuarios que reaccionaron.
- **Filtrado por tipo:** si 5 usuarios reaccionaron con ❤️ y otros 5 con 😂, deben mostrarse como dos listas independientes — no mezcladas.
- Si las 3 vistas ya comparten un componente de reacciones, centralizar la lógica ahí para que el cambio se propague automáticamente a las 3, en vez de duplicar código.

### 3.2 Reacciones a comentarios
Extender el sistema de reacciones que ya existe en posts para que también aplique a comentarios individuales. Reusar el modelo y lógica existente en la medida de lo posible (no crear un sistema paralelo).

### 3.3 Permisos de quién puede comentar
Nuevo campo en el modelo `Post`, configurable por el creador de la publicación al momento de publicar (o editar):
- `commentPermission`: `everyone | friends | following | nobody`
  - `everyone`: cualquiera puede comentar (default actual).
  - `friends`: solo amigos del autor del post pueden comentar.
  - `following`: solo usuarios que el autor del post sigue pueden comentar.
  - `nobody`: nadie puede comentar (comentarios deshabilitados).
- Validar este permiso en el endpoint de creación de comentario, antes de insertar.

### 3.4 Eliminar comentarios (moderación del autor del post)
- El autor de un comentario puede eliminar su propio comentario (ya debería existir o es trivial si no existe).
- **Adicional:** el autor del post puede eliminar cualquier comentario hecho en su propio post (moderación de su contenido).
- Loguear quién eliminó qué (autor del comentario vs autor del post) para evitar abuso y tener trazabilidad.

### 3.5 Bloqueo de enlaces externos en comentarios (whitelist)
- Detectar URLs dentro del contenido de un comentario (regex o librería de parsing de URLs).
- **Whitelist:** solo permitir enlaces de `abyss.social` y rutas de invitación propias de la app. Cualquier otro dominio (Facebook, Instagram, TikTok, etc.) se bloquea.
- Aplica a comentarios en: publicaciones, grupos privados, grupos públicos y fiestas (donde ya existan estas superficies).
- **Excepción explícita:** los enlaces de invitación de Abyss deben funcionar correctamente como links clicables dentro de comentarios (no deben ser bloqueados por el mismo filtro).

### 3.6 Reportes para grupos privados y para círculos/grupos públicos
Actualmente solo existen reportes para usuario y para publicaciones. Agregar:
- Modelo/endpoint de reporte para grupos privados.
- Modelo/endpoint de reporte para grupos públicos (la base de lo que después será "círculos").
- Seguir el mismo patrón ya usado en los reportes existentes (de usuario y de post) para mantener consistencia.

### 3.7 Símbolo de género junto al nombre
El campo de género ya existe en el modelo de usuario (hombre / mujer / prefiero no decirlo), pero no se muestra visualmente.
- Agregar un ícono/símbolo junto al nombre del usuario, **solo en pantallas específicas** (a definir contigo cuáles — feed, perfil público, lista de comentarios, etc. No se muestra en todas las pantallas).

---

## FASE 4 — Pantalla de bienvenida y flujo de registro multi-pantalla

> ⚠️ Esta fase reestructura el flujo de entrada completo de la app. Hacer backup antes de empezar y avanzar pantalla por pantalla, probando cada una antes de seguir con la siguiente.

### 4.1 Pantalla de bienvenida (reemplaza login como pantalla inicial)
Nueva pantalla principal al abrir la app (antes de login):
- Pantalla completa.
- Parte inferior: dos botones apilados verticalmente — "Iniciar sesión" y "Registrarse".
- Parte superior (del bloque de botones): checkbox/campo "¿Aceptas las políticas de privacidad?" — un solo tap para aceptar.
- Debajo de los dos botones, centrado: link en azul (estilo ya usado en la app) hacia la pantalla de políticas de privacidad ya existente.

### 4.2 Registro dividido en pantallas secuenciales
Reestructurar el registro actual (todo en una pantalla) en el siguiente flujo:

1. **Usuario + foto de perfil**
   - Campo de nombre de usuario.
   - Carrusel horizontal de las 8 fotos preset (Fase 0) — scroll horizontal, efecto de sombra/degradado en ambos extremos para indicar que hay más opciones al deslizar.
   - Opción de subir foto propia en lugar de elegir un preset.
2. **Género**
   - 3 opciones: Hombre / Mujer / Prefiero no decirlo.
3. **Correo electrónico**
   - Captura de correo.
   - Envío de correo de verificación (la lógica de envío de correos ya existe en el proyecto).
   - El usuario no puede avanzar hasta verificar el correo (ver 4.3).
4. **Contraseña**
   - Una vez verificado el correo, el usuario regresa a la app y define su contraseña.
5. **Invitación (opcional)**
   - Si el usuario llegó vía un enlace de invitación, se asocia aquí (ver Fase 6).

**Decisión arquitectónica a confirmar antes de implementar:** ¿el usuario se crea como documento "incompleto" en MongoDB desde el paso 1 y se va completando en cada pantalla, o se mantiene todo en estado local de React Native hasta que se complete el flujo y se envíe todo junto al backend? Esto afecta cómo se maneja el caso de que el usuario cierre la app a medio registro. Recomendado: documento incompleto en backend con un campo `registrationStep` o similar, para poder reanudar el flujo si la app se cierra. Confirmar con Jesús antes de implementar esta parte.

### 4.3 Verificación de correo obligatoria
- Bloquear acceso a funciones de la cuenta hasta que `emailVerified` sea `true`.
- Reusar la lógica de envío de correos ya existente en el proyecto.

---

## FASE 5 — Notificaciones (solo Fase 1 del roadmap del md de notificaciones)

> Nota: la Fase 2 del roadmap original (migración a FCM V1 directo con canales nativos) **queda fuera de este sprint** — es un cambio de infraestructura grande que merece su propio documento y ciclo de pruebas, no se mezcla con el resto de estas mejoras.

### 5.1 Badges visuales en el avatar
Actualmente los badges (verificado, etc.) solo aparecen en la tab de badges del perfil, no sobre el avatar.
- Agregar representación visual de al menos el badge de "cuenta verificada" directamente en el componente `AvatarWithFrame` (o el componente equivalente que se use), para que aparezca en todas las vistas donde se muestra el avatar del usuario.

### 5.2 Banner in-app (notificación visual cuando la app está abierta)
Actualmente, si llega un mensaje o notificación mientras el usuario está usando la app, no hay indicación visual.
- Agregar un banner/toast interno que aparezca brevemente cuando llega una notificación con la app abierta, con un ícono distinto según el tipo (mensaje, post, usuario).
- No requiere tocar la infraestructura de push — es una capa puramente visual del lado del cliente, escuchando eventos ya existentes.

---

## FASE 6 — Sistema de invitaciones con recompensa de coins

> ⚠️ Pieza compleja — requiere tracking de actividad diaria y lógica de recompensa atómica para evitar duplicados/abuso.

### 6.1 Generación de enlace de invitación
- Cada usuario puede generar su propio enlace de invitación único.

### 6.2 Asociación al registrarse vía invitación
- El nuevo usuario que se registra a través de un enlace de invitación queda vinculado al usuario que lo invitó (ver Fase 4.2, paso 5).

### 6.3 Lógica de recompensa
- Si el usuario invitado mantiene actividad en la app durante **2 días consecutivos**, se otorgan:
  - **50 coins** al usuario invitado.
  - **100 coins** al usuario que invitó.
- Requiere:
  - Tracking de actividad diaria por usuario (puede ya existir cierta lógica de sesión/actividad — confirmar antes de crear algo nuevo).
  - Verificación de racha de 2 días consecutivos (cron job o verificación al hacer login).
  - Transacción atómica al otorgar coins, para evitar que el mismo evento dispare la recompensa más de una vez.

### 6.4 Modal de bienvenida con noticia de invitación
- Al entrar a la app por primera vez, mostrar un modal de "noticias" que incluya un anuncio de "Invita a tus amigos y gana 100 coins".
- Este modal depende de que 6.1–6.3 ya estén implementados (no tiene sentido mostrarlo antes).

---

## Resumen de orden de ejecución

```
Fase 0 → Assets (preparación, no requiere lógica)
Fase 1 → Fixes triviales
Fase 2 → Límites y anti-abuso
Fase 3 → Reacciones, permisos y moderación
Fase 4 → Bienvenida + registro multi-pantalla
Fase 5 → Notificaciones (solo quick fixes, sin tocar infraestructura de push)
Fase 6 → Sistema de invitaciones + coins
```

**Fuera de este sprint (documentos separados, pendientes):**
- Círculos / Clubes / Fiestas (co-admins, club público)
- Migración a FCM V1 directo (canales nativos de Android)
- Limpieza visual de "Mi Colección"

---

## Preguntas abiertas que Jesús aún debe confirmar antes o durante la implementación

1. ¿En qué pantallas exactas debe mostrarse el símbolo de género junto al nombre? (Fase 3.7)
2. ¿El registro multi-pantalla guarda usuario "incompleto" en backend desde el paso 1, o todo se mantiene en estado local hasta completar el flujo? (Fase 4.2)
3. ¿Ya existe alguna lógica de tracking de actividad/sesión diaria que se pueda reusar para la racha de 2 días? (Fase 6.3)

---

## Pendiente — Sprint futuro (NO implementar aún)

### Sistema de amistad / racha de chat
- Idea: mostrar en el chat privado cuántos días consecutivos han hablado dos usuarios ("racha de X días")
- Requiere: tracking de `lastChatDate` por par de usuarios en el modelo Chat o en un modelo nuevo
- Visualización: badge o indicador en el header del ChatRoomScreen
- Decidir: ¿la racha se rompe si no hay mensajes en 24h? ¿o 48h?
- Depende del campo que se elija: si se agrega a Chat.js, es una migración simple; si es modelo propio, más complejo
- **NO tocar hasta que se defina el modelo de datos con Jesús**
