# Buenas Prácticas Visuales — Análisis APK
> Extraído de `app-projz-20240512.apk` para aplicación a proyectos propios

---

## 1. Sistema de Animaciones WEBP

### Patrón observado
La app usa WEBP animado como formato principal para **todas las animaciones de UI**. No usa Lottie para todo — divide responsabilidades:

| Tipo de contenido | Formato usado |
|---|---|
| Animaciones cortas de UI (loading, flash, wave) | WEBP animado en `/res/raw/` |
| Animaciones complejas con datos dinámicos | JSON Lottie (`audio_wave_ani.json`, `say_hi.json`) |
| Íconos estáticos de interfaz | WEBP estático en `/res/drawable/` |
| Íconos de app (launcher) | WEBP en `/res/mipmap-*/` |

### Casos de uso identificados

**Loading states:**
- `ai_loading.webp` — pantalla de espera para respuestas de IA
- `ic_aigc_loading.webp` — loading para contenido generado por IA
- `matching_small_animation.webp` — matching en curso (inline, pequeño)

**Feedback de acciones (recompensa visual):**
- `open_gift_box.webp` — animación al abrir regalo
- `check_in_claim.webp` — confirmación de check-in diario
- `mint_claim.webp` — confirmación de claim de NFT
- `minting.webp` — proceso de minting en curso
- `to_be_claimed.webp` — estado pendiente de reclamar
- `icon_fingerprint_succeed.webp` — éxito de autenticación biométrica

**Ambientación / atmósfera:**
- `star_flash.webp`, `conversation_star_flash_left/right.webp` — destellos en chat
- `matched_stars.webp` — efecto al hacer match
- `white_wave.webp`, `yellow_wave.webp`, `disk_wave.webp` — fondos animados suaves
- `disk_tone.webp` — visualizador de audio

**Íconos de tab animados (marketplace):**
- `tab_item_marketplace_selected.webp` — tab activo con animación
- `tab_item_marketplace_unselected.webp` — tab inactivo
- `tab_item_nft_first_frame.webp` — primer frame para transición suave

**Backgrounds con movimiento sutil:**
- `bg_home_compose_ai.webp`
- `bg_home_compose_merch.webp`
- `home_merch_bg.webp`, `home_merch_bg_4.webp`

### Aplicación práctica (Abyss)
```
Reemplazar GIFs o Lottie pesados por WEBP animado para:
- Loading de mensajes / respuestas
- Animación al enviar un gift (ya tienes el sistema de gifts)
- Animación de marcos de perfil (frames) — ya usas Cloudinary
- Efecto visual al ganar coins / completar transacción
- Tab bar icons animados al seleccionar
```

---

## 2. Sistema de Íconos de App por Temporada/Tema

### Patrón observado
La app incluye **10 variantes del ícono de launcher**, cada una con sus versiones `normal`, `round` y `foreground`, en las 5 densidades estándar de Android (`hdpi` → `xxxhdpi`).

**Temas identificados:**
- `z_autumn` — Otoño
- `z_christmas` — Navidad
- `z_zeif_christmas` — variante especial Navidad
- `z_cristal` — Cristal / minimalista
- `z_glory` — Glory (dorado/premium)
- `z_navi` — Navi (azul/espacial)
- `z_spring` — Primavera
- `z_summer` — Verano
- `z_winter` — Invierno

### Patrón de nomenclatura
```
ic_launcher_{tema}.webp          → ícono cuadrado
ic_launcher_{tema}_round.webp    → ícono circular
ic_launcher_{tema}_foreground.webp → capa foreground (adaptive icon)
```

### Cómo funciona en Android
Los XML en `/res/mipmap-anydpi-v26/` definen **Adaptive Icons** (API 26+):
```xml
<!-- ic_launcher_z_autumn.xml -->
<adaptive-icon>
    <background android:drawable="@color/..."/>
    <foreground android:drawable="@mipmap/ic_launcher_z_autumn_foreground"/>
</adaptive-icon>
```
El sistema puede cambiar el ícono activo desde código o desde el servidor, sin actualizar la app en Play Store.

### Aplicación práctica (Abyss)
```
Implementar App Icon Aliases en AndroidManifest para eventos:
- Ícono especial en fechas como Día de Muertos, Navidad, San Valentín
- Ícono premium/dorado para usuarios con suscripción activa
- Cambio de ícono como recompensa (unlock) para usuarios top

Código Android para cambiar ícono:
PackageManager.setComponentEnabledSetting(
    ComponentName(context, "com.tuapp.MainActivityAlias_Christmas"),
    PackageManager.COMPONENT_ENABLED_STATE_ENABLED, 
    PackageManager.DONT_KILL_APP
)
```

---

## 3. Assets de UI — Patrones por Sección

### 3.1 Voice / Audio
```
ic_voice_chat.webp       → ícono animado de chat de voz
ic_voice_roleplay.webp   → modo roleplay
voice_black.webp         → visualizador oscuro
voice_black40.webp       → visualizador oscuro 40% opacidad
voice_white.webp         → visualizador claro
voice_white60.webp       → visualizador claro 60% opacidad
disk_tone.webp           → disco girando (visualizador musical)
disk_wave.webp           → onda de disco
musiccover.webp          → portada musical animada
```
**Patrón:** Para cada componente de audio hay versión clara + oscura + versión semitransparente. Esto permite usar el mismo asset sobre cualquier fondo sin reemplazo manual.

### 3.2 Matching / Social
```
icon_bottle_match_hd.webp    → match tipo "botella" (azar)
icon_text_match_hd.webp      → match por texto
icon_voice_match_hd.webp     → match por voz
matched_stars.webp           → celebración de match
matching_small_animation.webp → spinner de matching inline
```
**Patrón:** Los assets `_hd` son versiones de alta calidad para pantallas de detalle. Versión `_small` para uso inline/compacto. Consistencia de escala intencional.

### 3.3 Marketplace / NFT / Web3
```
tab_item_marketplace_selected.webp    → tab activo
tab_item_marketplace_unselected.webp  → tab inactivo
nft_item_banner.webp                  → banner de ítem NFT
icon_merch_of_eth_chain.webp          → identificador de cadena Ethereum
tab_item_nft_first_frame.webp         → frame estático inicial antes de animar
minting.webp                          → proceso activo
mint_claim.webp                       → acción de claim
to_be_claimed.webp                    → estado pendiente
```
**Patrón clave:** `_first_frame.webp` como placeholder estático antes de reproducir la animación completa. Evita el "flash en blanco" al cargar el WEBP animado.

### 3.4 Pantallas de recompensa
```
open_gift_box.webp       → apertura de regalo
check_in_claim.webp      → check-in diario
star_flash.webp          → destello genérico de celebración
conversation_star_flash_left/right.webp → destellos posicionados en chat
```
**Patrón:** Cada acción positiva del usuario tiene su propia animación de feedback. No se reutiliza una animación genérica para todo — cada contexto tiene su propia "recompensa visual".

### 3.5 IA / Contenido generado
```
ai_loading.webp           → loading genérico de IA
ic_aigc_loading.webp      → loading de contenido generado (AIGC)
character_action.webp     → personaje de IA en acción
bg_home_compose_ai.webp   → fondo de pantalla de compose con IA
screening_room_now_playing2.webp → sala de proyección activa
ic_screening_room_small.webp    → versión pequeña
```
**Patrón:** Las funciones de IA tienen identidad visual separada del resto de la app. Assets propios, no reutilizados de otras secciones.

---

## 4. Principios Generales Extraídos

### 4.1 Jerarquía de formatos
```
WEBP animado  → animaciones de UI (loops cortos, feedback, loading)
Lottie JSON   → animaciones con datos dinámicos o muy complejas
WEBP estático → íconos y assets que no cambian
PNG           → launcher icons base y masks (compatibilidad legacy)
```

### 4.2 Nomenclatura consistente
El sistema de nombres sigue estos patrones predecibles:
```
{contexto}_{acción/estado}.webp        → icon_fingerprint_succeed
{objeto}_{variante}.webp               → voice_black40
{pantalla}_{elemento}.webp             → bg_home_compose_ai
{componente}_{tamaño}.webp             → matching_small_animation
{componente}_hd.webp                   → icon_bottle_match_hd
{tab}_{estado}.webp                    → tab_item_marketplace_selected
```
**Aplicación:** Adoptar este sistema de nombres en Abyss para que cualquier dev encuentre el asset correcto sin buscar.

### 4.3 Estados visuales explícitos
Cada componente interactivo tiene asset para cada estado:
- `selected` / `unselected`
- `active` / `inactive`
- `_small` / normal / `_hd`
- `_40` / `_60` / sin sufijo (opacidades)

### 4.4 First-frame pattern
Para cualquier WEBP animado que tarde en cargar o que se active por trigger:
1. Exportar el primer frame como WEBP estático (`_first_frame`)
2. Mostrarlo como placeholder
3. Swapear al animado cuando esté listo o cuando el usuario haga la acción

### 4.5 Assets de atmósfera separados de assets funcionales
- **Funcionales** (`/res/drawable/`): íconos de UI, botones, indicadores
- **Atmosféricos** (`/res/raw/`): animaciones de fondo, efectos ambientales, celebraciones

Mantenerlos separados permite actualizar la atmósfera visual sin tocar la lógica de UI.

---

## 5. Checklist de Implementación para Abyss

- [ ] Definir un set de WEBP animados para loading states (mensajes, gifts, coins)
- [ ] Crear variantes `_small` de los assets más usados para uso inline
- [ ] Implementar first-frame pattern en todas las animaciones con trigger
- [ ] Diseñar al menos 2 variantes de ícono de launcher (base + evento especial)
- [ ] Separar assets en `/drawable` (funcionales) vs assets de atmósfera
- [ ] Adoptar sistema de nomenclatura: `{contexto}_{estado/variante}.webp`
- [ ] Para voz/audio: crear versiones `_black`, `_white`, `_black40` de visualizadores
- [ ] Cada acción de recompensa (gift, coins, frames) tiene su propia animación

---

*Análisis basado en: `app-projz-20240512.apk` — Junio 2026*
