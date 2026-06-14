# Buenas Prácticas — Chat, Feed, Emojis y Reacciones
> Extraído de `app-projz-20240512.apk` — Segunda parte del análisis

---

## 1. Sistema de Chat — Arquitectura de Burbujas

### 1.1 Separación por tipo de mensaje
La app no usa un layout genérico para todos los mensajes. Cada tipo tiene su propio XML:

```
message_bubble_text_start.xml       → mensaje de texto (enviado)
message_bubble_text_content.xml     → contenido de texto (recibido)
message_bubble_image_start.xml      → imagen
message_bubble_video_start.xml      → video
message_bubble_voice_start.xml      → nota de voz
message_bubble_sticker_start.xml    → sticker
message_bubble_gift_box_start.xml   → gift/regalo
message_bubble_dice_start.xml       → dado (juego de azar)
message_bubble_poll_start.xml       → encuesta
message_bubble_announcement.xml     → anuncio del sistema
message_bubble_avatar_start.xml     → burbuja con avatar
message_bubble_name_start.xml       → burbuja con nombre
message_bubble_reply_content.xml    → respuesta/quote
message_bubble_share_object.xml     → objeto compartido
message_bubble_time.xml             → separador de tiempo
```

**Principio:** Una burbuja = un layout. No condiciones `if` dentro del mismo XML para cambiar la vista según tipo. Cada tipo es su propia View y su propio ViewHolder.

**Aplicación en Abyss:** Crear un ViewHolder separado por cada tipo de mensaje en `ChatRoomScreen`. Ya tienes gifts y texto — añadir stickers y voice notes con su propio componente, no parcheando el existente.

### 1.2 Burbujas personalizables (Bubble Styles)
Tienen un sistema completo de personalización de burbujas:

```
fragment_chat_bubble_preview.xml         → preview en tiempo real del estilo
view_holder_chat_bubble_style.xml        → item del selector de estilos
holder_chat_bubble_asset.xml             → asset de burbuja
pretty_bubble_assets_builder.xml         → constructor de burbujas decoradas
cell_add_bubble_color.xml                → selector de color
cell_bubble_color.xml                    → color individual
cell_settings_bubble.xml                 → configuración de burbuja
fragment_storyboard_paragraph_bubble_edit.xml        → edición
fragment_storyboard_paragraph_bubble_style_setting.xml → selección de estilo
```

**Patrón:** El sistema de burbujas es un feature premium/de personalización. Los usuarios pueden cambiar el color, forma y estilo de sus burbujas. Esto es un diferenciador fuerte de identidad personal dentro del chat.

**Aplicación en Abyss:** Implementar bubble styles como parte del sistema de personalización de perfil. Los marcos animados (frames) que ya tienes en Cloudinary pueden complementarse con estilos de burbuja custom como feature de pago.

### 1.3 Chats Fijados (Pinned Chats)
Ya lo tienes en Abyss (`ChatsScreen.js`) pero la app usa layouts dedicados:

```
fragment_pinned_chats.xml    → pantalla de lista de pinned
pinned_chat_list_view.xml    → lista
pinned_chat_list.xml         → contenedor
pinned_chat_view.xml         → item individual
item_pinned_chat.xml         → celda de pin
```

**Patrón:** El pinned no es un bool en la lista principal — es una sección completamente separada con su propio fragment y scroll independiente.

### 1.4 Modos de chat especializados
```
fragment_companion_fast_chat.xml     → chat rápido con companion (IA)
fragment_ai_chat.xml                 → chat dedicado de IA
layout_ai_chat_header.xml            → header especial para chat IA
fragment_meet_conversation.xml       → chat dentro de sesión de meet
fragment_meet_text_conversation.xml  → texto en meet
fragment_meet_voice_conversation.xml → voz en meet
fragment_direct_mini_room.xml        → mini sala privada
fragment_group_mini_room.xml         → mini sala grupal
```

**Patrón:** Cada contexto de conversación tiene su propia UI. El chat de IA no es el mismo componente que el chat P2P — tiene header diferente, compose diferente, y comportamiento diferente.

---

## 2. Sistema de Feed / Publicaciones

### 2.1 Layouts de tarjeta por contexto
Cada "card" es específica al contexto donde aparece:

```
USUARIO:
small_user_card.xml          → búsqueda / sugerencias
large_user_card_view.xml     → perfil / detalle
user_card_with_mood.xml      → card con estado de ánimo activo
cell_user_card.xml           → celda en lista
z_card.xml                   → Z-Card (formato especial de perfil)
z_card_user_icon.xml         → ícono dentro de Z-Card
z_card_user_newly.xml        → Z-Card de usuario nuevo

CÍRCULOS/COMUNIDADES:
circle_card.xml              → card principal de círculo
mini_circle_card.xml         → compacta
small_circle_card.xml        → mínima (búsqueda)
more_circle_card.xml         → "ver más círculos"
fan_circle_card.xml          → círculo de fans
super_small_circle_card.xml  → ultra compacta (inline en texto)

PUBLICACIONES:
item_post_compact.xml        → feed estándar
item_post_gallery.xml        → modo galería
item_post_masonry.xml        → modo masonry (Pinterest-style)
post_detail_view_part1.xml   → detalle parte 1 (cabecera)
post_detail_view_part2.xml   → detalle parte 2 (contenido)
post_detail_view_part3.xml   → detalle parte 3 (acciones/comentarios)

SHARE CARDS (para compartir):
share_card_post.xml
share_card_user.xml
share_card_circle.xml
share_card_chat.xml
share_card_event.xml
share_card_nft.xml
share_card_shop.xml
share_card_tag.xml
share_card_treasures.xml
share_card_operation_post.xml
share_card_icode.xml (código de invitación)
```

**Principio crítico:** No existe una "card universal". Cada entidad (usuario, post, círculo, NFT) tiene su representación small/mini/large/share. La misma entidad se ve diferente según el contexto donde aparece.

### 2.2 Storyboard — Editor de publicaciones rico
Tienen un sistema de publicaciones tipo "storyboard" con múltiples tipos de párrafo:

```
fragment_storyboard_compose.xml           → editor principal
storyboard_canvas_area.xml                → área de canvas
storyboard_safe_area_banner.xml           → indicador de safe area

TIPOS DE PÁRRAFO:
view_holder_storyboard_paragraph_text.xml          → texto
view_holder_storyboard_paragraph_bubble.xml         → burbuja de texto
view_holder_storyboard_paragraph_rendered.xml       → renderizado final
view_holder_storyboard_paragraph_visible_media.xml  → media visible
view_holder_storyboard_audio.xml                    → audio embebido
fragment_storyboard_audio_style_setting.xml         → estilo de audio
fragment_storyboard_paragraph_bubble_edit.xml       → edición de burbuja
```

**Patrón:** El composer no es un `<EditText>` simple — es un canvas con bloques heterogéneos (texto, burbuja, media, audio). Cada bloque tiene su propio ViewHolder dentro del editor.

### 2.3 Feed filters
```
feed_filter_flexbox.xml      → contenedor flex de filtros
feed_filter_tab_item.xml     → tab individual
feed_filter_tab_list.xml     → lista de tabs
feed_section_header.xml      → header de sección
```
**Patrón:** El feed tiene filtros como chips/tabs horizontales con FlexboxLayout, no BottomNavigation ni Drawer.

---

## 3. Sistema de Emojis Custom — El hallazgo más importante

### 3.1 Emojis temáticos propios (NO son del sistema)
Encontrado en `res/drawable-xhdpi-v4/`:

```
emoji_apple.png
emoji_birthday.png
emoji_candy.png
emoji_chicken.png
emoji_christmas.png
emoji_corn.png
emoji_egg.png
emoji_fire.png
emoji_ghost.png
emoji_heart.png
emoji_love.png
emoji_miss.png
emoji_moon.png
emoji_new_year.png
emoji_popcorn.png
emoji_pumpkin.png
emoji_rabbit.png
emoji_rabbit2.png
emoji_rose.png
emoji_snow.png
emoji_star.png
emoji_tree.png
emoji_turkey.png
```

**Lo que esto significa:** Son emojis completamente custom, dibujados a mano con la identidad visual de la app. No son los emojis genéricos del sistema operativo ni de Twemoji. Están organizados por temáticas estacionales:

- **Halloween:** ghost, pumpkin, candy
- **Navidad:** christmas, tree, snow
- **Año Nuevo:** new_year, firework
- **San Valentín:** heart, love, rose
- **Pascua:** rabbit, rabbit2, egg
- **Comida/casual:** apple, corn, popcorn, chicken, turkey
- **Universales:** fire, star, moon, miss (nostalgia)

**Solo están en xhdpi** (lo cual indica que se muestran a tamaño fijo, no escalados — probablemente 24-32dp en pantalla).

### 3.2 Sistema de reacciones (separado de emojis)
```
ESTADOS DE LIKE:
ic_small_like.png / ic_small_unlike.png        → like pequeño (feed)
ic_widget_like.png / ic_widget_liked.png        → like en widget
ic_auto_like_liked2.png / ic_auto_like_not_yet_liked2.png → auto-like
icon_raction_like_true.png                      → reacción activa
icon_raction_like_false.xml                     → reacción inactiva
ic_reaction_like_selector.xml                   → selector animado
reaction_like.png                               → base
reaction_unlike.png                             → unlike
reaction_add_comment.png                        → "añadir reacción" en comentario

TEMAS dark/light:
ic_reaction_add_dark.png / ic_reaction_add_light.png
reaction_background_dark.xml / reaction_background_light.xml
common_reaction_background.xml

ESTADOS:
ic_reaction.png          → base del sistema de reacciones
ic_reaction_disable.png  → reacción deshabilitada
ic_input_reaction.png    → botón de reacción en input
```

**Patrón del sistema de reacciones:**
1. Cada acción de reacción tiene su ícono por estado (activo/inactivo/disable)
2. Versión dark y light de cada background
3. Versión small para uso inline en feed y versión grande para detalle
4. Selector animado (`ic_reaction_like_selector.xml`) para la transición like → unlike

### 3.3 Layouts del sistema de reacciones en mensajes
```
message_reaction_item.xml         → reacción individual en burbuja
message_reaction_add_item.xml     → botón "+" para añadir reacción
message_reaction_remain_item.xml  → "+N más" cuando hay muchas reacciones
reaction_detail_header.xml        → header del modal de detalle
reaction_detail_user.xml          → usuario que reaccionó
common_reaction_detail_user.xml   → versión común
small_like_reaction.xml           → like pequeño inline
```

**Patrón clave — "remain item":** Cuando hay más de N reacciones, en lugar de mostrarlas todas usan un componente `_remain` que muestra "+3" o "+10". Esto mantiene la burbuja limpia.

### 3.4 Stickers — Integración con GIPHY
```
gph_ic_emoji.png       → ícono de emoji en el panel de GIPHY
gph_ic_sticker.png     → ícono de sticker en GIPHY
gph_sticker_bg.png / gph_sticker_bg_light.png  → fondos del panel
gph_sticker_bg_drawable.xml (dark/light)
panel_sticker_input.xml    → panel principal de stickers
chat_menu_stickers.xml     → menú de stickers en chat
ic_pick_sticker.png        → botón selector
ic_sticker_placeholder.png → placeholder mientras carga
user_mood_sticker_view.xml → sticker de estado de ánimo en perfil
```

**Patrón:** Usan GIPHY SDK para stickers externos + emojis propios temáticos para reacciones internas. No reinventan el catálogo de stickers — lo delegan a GIPHY — pero sí controlan los emojis de reacción con assets propios.

---

## 4. El hallazgo extra — Beauty Filters con Shaders propios

### 4.1 Qué encontramos en assets/basic_beauty/
```
assets/basic_beauty/ComposeMakeup/beauty_Android_lite/
├── config.json
├── event.lua
└── GeneralEffect_huoshan_live/
    ├── content.json
    ├── generalEffect/
    │   ├── generalEffect.json
    │   ├── resource/
    │   │   └── lookUpCustom.png    ← LUT de color personalizado
    │   └── shader/
    │       ├── alpha_boxblur.frag  ← blur con alpha
    │       ├── boxblur1.frag       ← blur paso 1
    │       ├── boxblur2.frag       ← blur paso 2
    │       ├── boxblur.vert        ← vertex shader de blur
    │       ├── epm_smooth.frag     ← suavizado de piel
    │       ├── epm_smooth.vert
    │       ├── fshader_whiten.frag ← shader de blanqueamiento
    │       └── vshader_whiten.vert
```

**Origen:** `huoshan_live` es el SDK de efectos de ByteDance (la empresa de TikTok). Tienen integrado el motor de beauty filters de ByteDance con:
- Suavizado de piel (`epm_smooth`)
- Blanqueamiento (`whiten`)
- Box blur multipass
- LUT custom (`lookUpCustom.png`) para grading de color propio

**Aplicación en Abyss:** Para video/voz con cámara en vivo, si quieres beauty filters puedes integrar el SDK de ByteDance Effect o una alternativa open source como `GPUImage` con shaders GLSL similares.

### 4.2 Video de onboarding y transacciones
```
assets/signup_anim/signup_anim_video.mp4  → animación del flujo de registro
assets/circle_welcome.mp4                 → video de bienvenida a círculo/comunidad
assets/transaction_success.mp4            → animación de transacción exitosa
```

**Patrón:** Para momentos de alto impacto emocional (registro, éxito de pago) usan **MP4 en lugar de Lottie o WEBP**. El MP4 permite más calidad visual y cinematografía real. No todo tiene que ser Lottie.

### 4.3 Fondos de "Drifting Meet"
```
assets/drifting_meet_bg/
img_0.png → img_9.png   (10 fondos)
```
Son 10 fondos intercambiables para el modo de encuentro aleatorio ("drifting"). Se cargan por índice, probablemente asignados aleatoriamente o por preferencia del usuario.

---

## 5. Principios Consolidados

### 5.1 Regla de los estados de reacción
Cada elemento interactivo de reacción necesita exactamente estos assets:
```
{nombre}.png          → estado base
{nombre}_active.png   → estado activo/seleccionado
{nombre}_disable.png  → estado deshabilitado
{nombre}_dark.png     → variante oscura (si aplica)
{nombre}_light.png    → variante clara (si aplica)
{nombre}_small.png    → variante inline/compacta
```

### 5.2 Emojis custom: solo lo que tiene identidad en tu app
No recrean los 3,000 emojis del estándar Unicode. Solo tienen ~23 emojis que reflejan:
- Los momentos de la app (fiestas, temporadas, estados emocionales clave)
- La identidad visual de la marca (estilo de ilustración consistente)
- Los contextos de uso más frecuentes de sus usuarios

**Para Abyss:** Define los 15-20 momentos emocionales clave de tu app y diseña emojis propios solo para esos. El resto usa el sistema del OS.

### 5.3 Jerarquía de formatos para momentos de alto impacto
```
Animación corta de UI (< 3s, loop)  → WEBP animado
Animación con datos (Lottie)        → JSON Lottie
Momento de alta calidad (onboarding, éxito de pago) → MP4
Fondo ambiental intercambiable      → PNG estático en array
Beauty filters en tiempo real       → GLSL shaders + LUT
```

### 5.4 Cards: el principio de contexto
Misma entidad, distinto contexto = distinto componente:
```
Usuario en búsqueda    → small_user_card
Usuario en feed        → user_card_with_mood
Usuario en perfil      → large_user_card
Usuario compartido     → share_card_user
```
No adaptar un componente a todos los contextos con props. Crear componentes específicos.

---

## 6. Checklist de Implementación para Abyss (parte 2)

**Chat:**
- [ ] Un ViewHolder por tipo de mensaje (texto, imagen, voice, gift, sticker)
- [ ] Layout separado para bubble styles como feature premium
- [ ] Pinned chats como sección propia, no flag en lista principal
- [ ] Chat IA con header y compose propios, diferente al chat P2P

**Feed:**
- [ ] Cards distintas por contexto (small/large/share) para User y Post
- [ ] 3 layouts de feed: compact, gallery, masonry
- [ ] Feed filters como chips horizontales (FlexboxLayout o ScrollView con Row en RN)
- [ ] Post detail dividido en secciones (header / contenido / acciones)

**Emojis y Reacciones:**
- [ ] Definir los 15-20 emojis propios de Abyss (no recrear Unicode completo)
- [ ] Sistema de reacciones en mensajes con: item + add_item + remain_item
- [ ] Estados explícitos: base / active / disable / dark / light / small
- [ ] Integrar GIPHY SDK para stickers externos (ya hay precedente en el mercado)
- [ ] Selector de reacción con animación de transición (like → unlike)

**Otros:**
- [ ] MP4 para momentos de alto impacto: registro exitoso, primera transacción con coins
- [ ] Fondos intercambiables para salas/modos especiales (array de PNGs por índice)
- [ ] Investigar GPUImage o similar para beauty filter básico en videollamadas

---

*Análisis basado en: `app-projz-20240512.apk` — Junio 2026*
