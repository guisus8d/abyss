# Buenas Prácticas — Performance y Animaciones
> Extraído de `app-projz-20240512.apk` + comparación directa con Abyss — Junio 2026

---

## 1. Performance — ProyectZ vs Abyss

### 1.1 Caché de Imágenes

**ProyectZ:**
- Usa **Fresco** (Facebook) como pipeline principal de imágenes en feeds y listas
- `LruBitmapPool` — recicla bitmaps en memoria en lugar de crearlos/destruirlos
- `BufferedDiskCache` — caché en disco con escritura buffereada
- `MemoryCacheParams` — parámetros configurables de tamaño de caché en RAM
- `BitmapPoolBackend` y `BucketsBitmapPool` — pools de bitmaps por tamaño
- Glide para imágenes estáticas (íconos, drawables)

**Abyss:**
- Usa `expo-image` (~3.0.11) que internamente usa **Glide en Android** y
  **SDWebImage en iOS** — mismo nivel que ProyectZ para imágenes estáticas
- Sin configuración explícita de tamaño de caché en memoria o disco
- Caché manual de dimensiones en `ChatRoomScreen` y `GroupRoomScreen`
  con `_imgDimCache` — patrón correcto y eficiente

**Gap:** expo-image ya da caché automático. El gap real es que Abyss
no configura los límites de caché de expo-image explícitamente,
dejándolo en los defaults que pueden ser conservadores en dispositivos
con poca RAM.

---

### 1.2 Baseline Profile

**ProyectZ:**
- `assets/dexopt/baseline.prof` + `baseline.profm` incluidos en el APK
- Le dice a Android qué clases y métodos compilar AOT al instalar la app
- Resultado: arranque inicial y primeras interacciones significativamente
  más rápidas porque el código ya está compilado a nativo

**Abyss:**
- Sin Baseline Profile configurado
- El JS bundle se interpreta en el primer arranque
- `newArchEnabled: true` en app.json — Nueva Arquitectura activa
  con JSI y Fabric renderer (esto es equivalente moderno y muy valioso)

**Gap menor:** Expo SDK 50+ soporta Baseline Profiles con EAS Build.
Se puede configurar en `eas.json` con `android.buildType: "apk"` y
el plugin `@react-native/gradle-plugin`. No es crítico dado que
la Nueva Arquitectura ya da gran parte del beneficio.

---

### 1.3 Virtualización de Listas

**ProyectZ:**
- `DiffListAdapter` propio basado en `DiffUtil` de AndroidX
- `AsyncDiffer` para calcular diferencias en background thread
- `FixedListAdapter` para listas de tamaño fijo
- `ManualListAdapter` para control manual de updates
- Solo re-renderiza los items que cambiaron, no toda la lista

**Abyss:**
- `FlatList` de React Native en la mayoría de pantallas
- `ScrollView + posts.map()` en ProfileScreen y PublicProfileScreen
  — renderiza todos los items en memoria (el freeze confirmado)
- Sin `React.memo` confirmado en PostCard
- Sin `getItemLayout` en las FlatLists del perfil

**Gap crítico:** El freeze de 1-2s en el perfil con muchas
publicaciones es directamente este problema. Fix ya documentado
en memorias: reemplazar con FlatList + getItemLayout +
removeClippedSubviews + maxToRenderPerBatch=5.

---

### 1.4 El Culpable de la Transición del Compose Bar

**Confirmado en app.json de Abyss:**
```json
"softwareKeyboardLayoutMode": "resize"
```

Esto le dice al SO Android que haga resize de toda la Activity
cuando sube el teclado. El resultado es un salto brusco e
instantáneo de toda la pantalla — no hay animación, es un
reflow del layout completo.

**Cómo lo maneja ProyectZ:**
No usa `adjustResize`. Tienen `adjustEditTextWithKeyboard`,
`adjustShowKeyboard` y `adjustHideKeyboard` como métodos propios
que cachean la altura del teclado (`getLastKeyboardHeight`,
`getMinLimitOpenKeyboardHeight`) y animan manualmente con la
duración exacta del teclado del OS.

**Fix para Abyss:**
1. Cambiar `softwareKeyboardLayoutMode` de `"resize"` a `"pan"`
   o eliminarlo completamente del app.json
2. Manejar el teclado manualmente en ChatRoomScreen con
   `Keyboard.addListener('keyboardWillShow')` cacheando la altura
3. Animar con `useNativeDriver: true` usando la duración real
   del evento del teclado — no una duración fija hardcodeada

---

### 1.5 Preloader de Contenido

**ProyectZ:**
- Librería custom `com.bykv.vk.openvk.preload` con ~20 clases
- Calcula `mTargetPreloadSize` y `mPreloadedSize`
- `ALGO_CONFIG_STRING_SMART_PRELOAD` — preload inteligente
  basado en velocidad de scroll del usuario
- Carga contenido antes de que el usuario llegue a ese item

**Abyss:**
- Sin preloader — carga al llegar al threshold de `onEndReached`
- `onEndReachedThreshold={0.4}` en algunas FlatLists

**Gap menor para MVP:** El preloader importa más en apps con
video pesado. Para Abyss el threshold de 0.4-0.5 es suficiente
por ahora. Cuando haya video en el feed sería relevante.

---

### 1.6 Metro Config

**Abyss:**
```js
// metro.config.js — config default sin optimizaciones
const config = getDefaultConfig(__dirname);
module.exports = config;
```

**Optimización disponible:**
```js
config.transformer.getTransformOptions = async () => ({
  transform: {
    inlineRequires: true, // carga módulos solo cuando se necesitan
  },
});
```
`inlineRequires: true` reduce el tiempo de arranque cargando
módulos de forma lazy en lugar de todos al inicio.

---

## 2. Sistema de Animaciones — ProyectZ

### 2.1 Transiciones entre pantallas

ProyectZ tiene un sistema completo de transiciones con 4 tipos:

```
Horizontal (push/pop):
  h_slide_enter.xml      → entra desde la derecha
  h_slide_exit.xml       → sale hacia la izquierda
  h_slide_popenter.xml   → regresa desde la izquierda
  h_slide_popexit.xml    → sale hacia la derecha

Vertical (modal/sheet):
  v_slide_enter.xml      → entra desde abajo
  v_slide_exit.xml       → sale hacia arriba
  v_slide_enter_slowly.xml  → versión lenta (modales importantes)
  v_slide_exit_slowly.xml

Bottom sheet específico:
  bottom_slide_enter_anim.xml
  bottom_slide_exit_anim.xml

Fade:
  fade_in.xml / fade_out.xml
  slow_fade_in.xml / slow_fade_out.xml
  more_slow_fade_in.xml / more_slow_fade_out.xml

Dialog:
  dialog_enter_anim.xml
  dialog_exit_anim.xml
```

**Patrón clave:** Tienen versiones `_slowly` de las animaciones
para contextos de mayor peso emocional (confirmaciones,
transacciones, modales importantes). La velocidad de la
animación comunica la importancia de la acción.

### 2.2 Animaciones de componentes

```
bounce_like.xml          → rebote al dar like
button_press_alpha.xml   → fade al presionar botón
button_press_scale.xml   → escala al presionar botón
user_icon_press_alpha.xml → fade en avatar al presionar
scale_with_alpha.xml     → escala + fade combinados
popup_show.xml / popup_hide.xml → popups
breath.xml / breath_scale.xml  → animación de "respiración" (pulsing)
wiggle.xml               → wiggle para errores de validación
wiggle_for_password_check.xml → wiggle específico de contraseña
speaking_animation.xml   → animación de voz activa
tab_bar_enter.xml / tab_bar_exit.xml → tab bar
```

**Patrones importantes:**

`bounce_like` — el like no es solo un cambio de color, tiene
un rebote físico. Es la animación más usada en redes sociales
porque da satisfacción táctil.

`wiggle` y `wiggle_for_password_check` — los errores de
validación sacuden el campo en lugar de solo cambiar de color.
Mucho más efectivo para comunicar error.

`breath` — animación de pulsing suave para elementos que
requieren atención pero no son urgentes (botones CTA,
avatares en espera de respuesta).

### 2.3 Shared Element Transitions

Confirmado en DEX:
```
getSharedElementReturnTransition
SharedElementFirstOutViews
SharedElementLastInViews
postponeEnterTransition / startPostponedEnterTransition
```

ProyectZ usa Shared Element Transitions para navegar entre
pantallas — el elemento clickeado (avatar, imagen, marco)
vuela animado hacia la pantalla de destino. Esto elimina
el corte abrupto entre pantallas relacionadas.

### 2.4 Lottie

Solo 3 archivos Lottie reales confirmados:
```
assets/anim/loading.json      → loading genérico
res/raw/audio_wave_ani.json   → onda de audio
res/raw/user_head_party_on.json → cabeza con fiesta (celebración)
res/raw/say_hi.json           → saludo
```

El resto de animaciones son WEBP animado o XML animator.
Lottie es minoría — lo usan solo para animaciones que
genuinamente necesitan datos dinámicos o son muy complejas
para WEBP.

### 2.5 Gestos

```
GestureHandler     → gestos base
isPanGesture       → detección de pan/drag
OverScroller       → sobredesplazamiento elástico
setupCoverScrollListener → scroll con cover (parallax)
```

El `setupCoverScrollListener` en `PostDetailFragment` es el
parallax del banner de perfil — cuando scrolleas, el banner
se mueve más lento que el contenido, creando profundidad.
Abyss no tiene este efecto en los perfiles.

---

## 3. Comparación de Animaciones Abyss vs ProyectZ

### Lo que Abyss tiene
- `Animated.spring` en el tab indicator del ProfileScreen
- `LinearGradient` para botones y backgrounds
- Transiciones de navigation (las default de React Navigation)
- `ActivityIndicator` como loading state

### Gaps de Abyss en animaciones

**Sin bounce en likes:** El like en PostCard cambia de estado
pero sin animación. Agregar un `Animated.sequence` con
scale 1→1.3→1 con spring al hacer like tarda 10 líneas y
el impacto en engagement es real.

**Sin wiggle en errores:** Los campos con error solo cambian
de color/borde. Un wiggle con `Animated.sequence` de
translateX comunica el error mucho mejor.

**Sin shared element transitions:** Al navegar al perfil
de un usuario, el avatar hace un corte abrupto. Con
`react-native-shared-element` o la API nativa de
React Navigation 6 se puede animar el avatar volando
a su nueva posición.

**Sin animación de teclado manual:** Ya confirmado —
`softwareKeyboardLayoutMode: "resize"` causa el salto
brusco. Fix: eliminarlo y animar manualmente.

**Sin parallax en banners de perfil:** El hero del perfil
es estático mientras scrolleas. ProyectZ lo mueve a
velocidad reducida con `setupCoverScrollListener`.

---

## 4. Checklist de Performance y Animaciones para Abyss

**Crítico — fix inmediato:**
- [ ] Eliminar `softwareKeyboardLayoutMode: "resize"` de app.json
- [ ] Reemplazar ScrollView+map por FlatList en ProfileScreen
      y PublicProfileScreen (ya documentado en memorias)

**Alto impacto — corto plazo:**
- [ ] Añadir bounce animation al like en PostCard
- [ ] Añadir wiggle animation a campos con error de validación
- [ ] Añadir `inlineRequires: true` en metro.config.js
- [ ] Configurar límites explícitos de caché en expo-image

**Medio plazo:**
- [ ] Animaciones de transición horizontales/verticales
      personalizadas en React Navigation
- [ ] Parallax en hero de perfil con Animated onScroll
- [ ] `React.memo` en PostCard y otros componentes de lista
- [ ] Shared element transition en navegación al perfil

**Largo plazo:**
- [ ] Baseline Profile con EAS Build
- [ ] Preloader de imágenes para el feed

---

*Análisis basado en: `app-projz-20240512.apk` + código fuente de Abyss — Junio 2026*
