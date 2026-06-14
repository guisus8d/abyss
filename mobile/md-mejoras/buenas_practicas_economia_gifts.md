# Buenas Prácticas — Economía Virtual, Gifts y Sistema de Recompensas
> Extraído de `app-projz-20240512.apk` — Tercera parte del análisis

---

## 1. Arquitectura de la Economía Virtual — Dos Monedas

### 1.1 El sistema de doble moneda
La app opera con **dos monedas distintas** con roles completamente diferentes:

```
COIN (Z-Coin)
├── Moneda de interacción social
├── Se gana: check-in diario, rewards de video ads, gifting history
├── Se gasta: enviar gifts, comprar en shop, participar en eventos
├── Ícono: icon_wallet_coin.png / icon_wallet_coin_big.png
├── Versión ultra: icon_wallet_coin_ultra.png (para cantidades grandes)
└── Versión gris: icon_z_coin_gray.png (estado inactivo/insuficiente)

DIAMOND
├── Moneda premium / de mayor valor
├── Se obtiene: compra directa (top-up), conversión desde coins
├── Se gasta: compras premium, pay_rest_with_diamond, merch
├── Ícono: icon_wallet_diamond.png / icon_wallet_diamond_big.png
├── Versión gris: icon_z_diamond_gray.png (estado inactivo)
└── Swap: fragment_coin_swap_diamond.xml + fragment_coin_swap_summery.xml
```

**Por qué dos monedas:** Las coins son fáciles de ganar (retención diaria) pero de bajo valor real. Los diamonds son la puerta de entrada al gasto real. El swap Coin→Diamond tiene un resumen (`summery`) antes de confirmar — fricción intencional para que el usuario vea exactamente qué está haciendo.

**Para Abyss:** Ya tienes coins. La evolución natural es añadir una segunda moneda premium que se compre con dinero real, manteniendo los coins como moneda de engagement gratuito. Tus coins actuales serían equivalentes a los Z-Coins.

---

## 2. Sistema de Gift Box — La Lógica Completa

### 2.1 Los tres estados visuales de una gift box en chat
```
gift_box_message_start.png    → caja cerrada, disponible para abrir
gift_box_message_opened.png   → caja abierta, ya reclamada
gift_box_message_expired.png  → caja vencida, tiempo expirado
```

**Este es el flujo completo de un gift en chat:**
```
ENVIADOR                          RECEPTOR
    │                                 │
    ├─ fragment_compose_gift_box      │
    │  (elige tipo y monto)           │
    │                                 │
    ├─ fragment_fast_gift             │
    │  (envío rápido sin compose)     │
    │                                 │
    └─ [mensaje en burbuja]──────────>│
                                      │
                          gift_box_message_start
                                      │
                              [toca para abrir]
                                      │
                          dialog_gift_box_received
                          (animación open_gift_box.webp)
                                      │
                          dialog_gift_box_claimed
                          (confirmación de lo recibido)
                                      │
                    icon_gift_box_received_{tipo}.png
```

### 2.2 Los tipos de contenido de un gift box
Cada tipo tiene su ícono de "resultado recibido":
```
icon_gift_box_received_coin.png         → recibiste coins
icon_gift_box_received_diamond.png      → recibiste diamonds
icon_gift_box_received_cash.png         → recibiste dinero real
icon_gift_box_received_nft.png          → recibiste un NFT
icon_gift_box_received_ring.png         → recibiste un anillo (item virtual)
icon_gift_box_received_coupon.png       → recibiste un cupón
icon_gift_box_received_prime_coupon.png → cupón de membresía premium
icon_gift_box_received_match_pass.png   → pase para matching
icon_gift_box_received_snacks.png       → snacks virtuales
icon_gift_box_received_ticks.png        → ticks/verificaciones
icon_gift_box_received_empty.png        → caja vacía (perdiste / mala suerte)
```

**El `_empty` es clave:** Es un sistema de gift con elemento de **azar/gacha**. No sabes exactamente qué vas a recibir. La caja puede estar vacía. Esto crea anticipación y engagement.

**Para Abyss:** Tu sistema de gifts actual es determinístico (envías X coins, el otro recibe X coins). Puedes evolucionar a gift boxes con contenido variable — el sender escoge el valor total y el receiver tiene la experiencia de "abrir" sin saber exactamente qué hay dentro.

### 2.3 Tres tipos de gift box a crear
```
banner_create_coin_gift.png     → crear gift con coins
banner_create_diamond_gift.png  → crear gift con diamonds (mayor valor)
banner_create_nft_gift.png      → crear gift con NFT
```
Cada tipo tiene su banner de creación distinto. No es un formulario genérico — cada tipo tiene su propia pantalla de compose.

### 2.4 APIs de gift confirmadas en el DEX
```
POST /biz/v2/gift-boxes/{boxId}/claim          → reclamar un gift box
GET  /biz/v1/gift-boxes/parse-claim-code       → parsear código de claim
POST /biz/v1/gift-boxes/{boxId}/withdrawn      → retirar/cancelar un gift
POST /biz/v1/membership/monthly-gifts/claim-all        → reclamar todos los gifts mensuales
POST /biz/v1/membership/monthly-gifts/{giftId}/claim   → reclamar gift mensual individual
```

**El endpoint `/withdrawn`** confirma que los gifts tienen lógica de escrow en el servidor — el dinero no se transfiere inmediatamente al enviarlo, sino que se mantiene en custodia hasta que el receptor lo reclama o hasta que expira.

**Para Abyss:** Ya tienes escrow y expiración implementados. Lo que podrías añadir es el endpoint de `withdrawn` — que el sender pueda cancelar un gift no abierto y recuperar sus coins antes de que expire.

---

## 3. Sistema de Treasures — Inventario Personal

### 3.1 Qué son los Treasures
Un inventario visual de todo lo que el usuario ha recibido o acumulado:
```
fragment_treasures.xml           → pantalla principal del inventario
cell_see_my_treasures.xml        → CTA de "ver mis treasures" (desde otros lados)
layout_share_my_treasures.xml    → card para compartir tu inventario
item_treasure_display.xml        → item individual en el grid

FONDOS con/sin NFTs:
bg_treasures_has_nft.png         → fondo cuando tienes NFTs
bg_treasures_no_nft.png          → fondo cuando no tienes NFTs (estado vacío distinto)

BACKGROUNDS:
bg_treasure.9.png                → nine-patch para contenedor escalable
bg_treasure_bg.png               → fondo de la sección
bg_treasure_cover.png            → cover decorativo
bg_treasure_item.png             → fondo de cada item
bg_treasure_mask.png             → máscara para efecto visual
bg_treasure_title.9.png          → título escalable
bg_manage_treasures.9.png        → modo de gestión
bg_my_treasures_border.9.png     → borde del panel
```

**Patrón importante:** El estado vacío de Treasures tiene dos variantes según si tienes o no NFTs. No es un solo "empty state" genérico — el contexto cambia el mensaje y el visual.

**Para Abyss:** El equivalente sería un "inventario de items" — frames comprados, stickers desbloqueados, items recibidos como gifts. Que el usuario pueda ver y compartir su colección crea un loop de vanidad social.

---

## 4. Sistema de Rewards — Múltiples Fuentes de Coins

### 4.1 Reward Center
```
holder_rewards_center.xml        → hub principal de recompensas
holder_max_rewards.xml           → estado de recompensas máximas alcanzadas
rewards_center_bg.png            → fondo del centro
rewards_center_beginner_bg.png   → fondo para usuarios nuevos (distinto)
```

### 4.2 Fuentes de coins identificadas
```
1. CHECK-IN DIARIO
   icon_check_in_got_coins.png     → recompensa recibida
   ic_power_double_checkin_rewards → check-in doble (bonus por streak)
   check_in_claim.webp             → animación de claim

2. VIDEO ADS (rewarded)
   ad_reward_cell.xml              → celda de ad recompensado
   reward_coin_option_layout.xml   → opciones de cantidad a ganar
   rewarded_coins_picker.xml       → selector de coins del ad
   rewarded_video_earn_coins_amount → string de cantidad ganada
   view_get_5_coins.xml            → micro-reward de 5 coins

3. MEMBERSHIP MENSUAL
   ic_monthly_gift.png             → gift mensual de membresía
   ic_power_monthly_gifts.png      → gifts premium de poder
   dialog_gifts_claim_all.xml      → reclamar todos los gifts del mes de una vez

4. NUEVOS USUARIOS (onboarding rewards)
   new_user_gift_chat.png          → reward por hacer primer chat
   new_user_gift_follow.png        → reward por hacer primer follow
   new_user_gift_name_card.png     → reward por completar name card
   new_user_gift_finished.png      → todos los rewards de onboarding completados
   new_user_gift_title.png         → título del panel de onboarding rewards
   fragment_common_new_user_gift   → fragment completo

5. GIFTING HISTORY (recibir gifts)
   icon_wallet_gifting_history.png → historial de gifts recibidos
   icon_gift_from_check_in.png     → gift originado desde check-in
```

**El onboarding rewards es crítico:** Tienen assets específicos para cada acción del onboarding (chat, follow, name card). No es un progress bar genérico — cada paso tiene su propia imagen de recompensa. Esto hace que el onboarding se sienta como un juego.

**Para Abyss:** El onboarding de Abyss puede tener un sistema de "primeras acciones recompensadas" con coins — primer mensaje, primer follow, completar perfil, subir foto. Cada acción tiene su animación propia al completarse.

---

## 5. Wallet — Arquitectura de la Billetera

### 5.1 Secciones del wallet identificadas
```
fragment_my_wallet.xml           → pantalla principal

SECCIONES:
icon_wallet_coin.png             → balance de coins
icon_wallet_diamond.png          → balance de diamonds
icon_wallet_coupons.png          → cupones disponibles
icon_wallet_my_props.png         → mis propiedades/items
icon_wallet_send_gift.png        → acceso directo a enviar gift
icon_wallet_gifting_history.png  → historial de gifts enviados/recibidos
icon_wallet_purchase_orders.png  → órdenes de compra
icon_wallet_other_orders.png     → otras órdenes
icon_wallet_more.png             → más opciones

ESTADOS:
wallet_inactive_foreground.xml   → overlay cuando wallet está inactiva
dialog_activate_wallet.xml       → activación de wallet
dialog_activate_wallet_agreement.xml → acuerdo de términos al activar
dialog_no_wallet.xml             → estado sin wallet configurada
```

**El `wallet_inactive_foreground`** es un overlay que bloquea el wallet hasta que el usuario lo activa. La wallet no está activa por default — el usuario tiene que activarla explícitamente (con aceptación de términos). Esto es importante legalmente en apps con economía virtual real.

### 5.2 Wallet externa (Web3)
```
cell_external_wallet_selection.xml   → selector de wallet externa
dialog_external_wallet.xml           → conectar wallet externa
link_wallet_confirm.xml              → confirmación de vinculación
fragment_store_account_transfer.xml  → transferencia entre cuentas de store
transaction_store_account_transfer.xml → transacción de transferencia
fragment_recharge.xml                → recarga de saldo
```

**Patrón:** Tienen wallet interna (coins/diamonds) Y soporte para wallet externa crypto (MetaMask, Coinbase). Son sistemas paralelos que coexisten.

### 5.3 Shop Levels — Gamificación de vendedores
```
icon_shop_level_a.png   → nivel A (más alto)
icon_shop_level_b.png   → nivel B
icon_shop_level_c.png   → nivel C
icon_shop_level_d.png   → nivel D (más bajo)
dialog_shop_level_hint.xml   → explicación del sistema de niveles
layout_shop_level_card.xml   → card del nivel actual
layout_shop_level.xml        → detalle del nivel
```

Los shops tienen un sistema de niveles (A/B/C/D) que probablemente afecta visibilidad, comisiones o features disponibles. Es gamificación aplicada al lado vendedor del marketplace.

---

## 6. Comparación Directa con Abyss

### Lo que ya tienes bien ✅
```
✅ Escrow de gifts en el servidor
✅ Lógica de expiración
✅ Sistema de coins básico
✅ Gift en contexto de chat
✅ Animación de apertura (open_gift_box.webp equivalente)
```

### Gaps identificados ❌
```
❌ Solo una moneda (coins) — falta moneda premium (diamonds)
❌ Gift determinístico — no hay elemento de sorpresa/gacha
❌ No hay gift box con múltiples tipos de contenido
❌ No hay endpoint de withdrawn (cancelar gift no abierto)
❌ No hay Reward Center centralizado
❌ No hay onboarding rewards por primeras acciones
❌ No hay check-in diario con streak y double reward
❌ No hay inventario visual de items recibidos (treasures)
❌ No hay gift boxes mensuales por membresía
❌ No hay fast_gift (envío rápido sin compose)
❌ No hay share de wallet/treasures como contenido social
```

### Roadmap sugerido para Abyss (por impacto)

**Fase 1 — Quick wins de retención:**
- Check-in diario con streak + double reward al día 7
- Onboarding rewards: primer chat, primer follow, completar perfil
- Endpoint de withdrawn para gifts no abiertos

**Fase 2 — Gift experience:**
- Gift box con contenido variable (coin/item/empty para misterio)
- Fast gift: envío directo desde el chat sin compose largo
- Estados visuales: start → opened → expired en la burbuja

**Fase 3 — Economía expandida:**
- Segunda moneda premium (diamonds) comprable con dinero real
- Swap coins ↔ diamonds con pantalla de resumen antes de confirmar
- Wallet con activación explícita y aceptación de términos
- Inventario visual (treasures) compartible como contenido social

---

## 7. El Patrón Meta — Por qué esto mejora Abyss

La diferencia entre una app con economía plana y una con economía profunda no es la cantidad de features — es la **densidad de loops de engagement**:

```
SIN estos sistemas:
Usuario abre app → chatea → cierra app

CON estos sistemas:
Usuario abre app
  → check-in diario (+coins, streak visual)
  → notificación de gift sin abrir (+urgencia)
  → abre gift → animación → sorpresa del contenido
  → coins suficientes para comprar frame premium
  → frame nuevo visible en perfil → amigos lo ven
  → amigos envían gifts de vuelta
  → ciclo se repite con más usuarios
```

Cada sistema (check-in, gifts, treasures, rewards center) no es una feature aislada — es un punto de entrada al loop que hace que el usuario vuelva mañana.

---

*Análisis basado en: `app-projz-20240512.apk` — Junio 2026*
