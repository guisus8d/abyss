import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Modal, Pressable,
  StyleSheet, Image, Animated, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { formatCoins } from '../utils/formatCoins';

const COIN_ICON = require('../../assets/icons/coins.png');

export default function GiftBubble({
  giftData, giftId, isMe, myId, onGiftAction, onGiftClaim, members,
}) {
  const [visible, setVisible] = useState(false);
  const [claimed, setClaimed] = useState(false);

  const enterAnim = useRef(new Animated.Value(0.4)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  const outerOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] });

  const {
    monedas = 0, items = [], mensaje = '', estado = 'pendiente',
    tipo = 'privado', slots = 1, slotsReclamados = 0, reclamadoPor = [],
  } = giftData || {};

  const isGrupal  = tipo === 'grupal';
  const isPending = estado === 'pendiente';
  const agotado   = isGrupal && slotsReclamados >= slots;
  const yaReclame = isGrupal && myId && (reclamadoPor || []).map(String).includes(String(myId));

  const displayMsg = mensaje.trim() || '¡Con mis mejores deseos!';

  const coinsForReceiver = isGrupal
    ? Math.round((monedas * 0.85) / Math.max(slots, 1) * 100) / 100
    : Math.round(monedas * 0.85 * 100) / 100;

  const canAccept = isPending && !yaReclame && !agotado;
  const canReject = !isMe && isPending && !isGrupal;

  // Bubble is "done" → dim the card for the current viewer
  const isDone =
    (isGrupal && (yaReclame || agotado)) ||
    (!isGrupal && !isPending);

  const bubbleSub =
    yaReclame                           ? 'Ya reclamaste este regalo' :
    agotado                             ? 'Regalo completado'          :
    !isGrupal && estado === 'aceptado'  ? 'Regalo aceptado'           :
    !isGrupal && estado === 'rechazado' ? 'Regalo rechazado'          :
    !isPending                          ? 'Regalo expirado'           :
                                          'Toca para ver el contenido';

  const statusBadge = !isPending
    ? (estado === 'aceptado' ? 'Aceptado' : estado === 'rechazado' ? 'Rechazado' : 'Expirado')
    : yaReclame ? 'Ya reclamaste'
    : agotado   ? 'Sin unidades disponibles'
    : null;

  // Deduplicate and resolve claimant info from group members list
  const uniqueIds = [...new Set((reclamadoPor || []).map(String))];
  const claimantsList = uniqueIds.map(uid => {
    const m = (members || []).find(
      mb => (mb.user?._id || mb.user)?.toString() === uid
    );
    return {
      id:        uid,
      username:  m?.user?.username  || 'Usuario',
      avatarUrl: m?.user?.avatarUrl || null,
    };
  });

  // Show info-only modal (no action buttons) for group: already claimed or exhausted
  const showInfoModal = isGrupal && (yaReclame || agotado);

  function startSuccessAnim() {
    enterAnim.setValue(0.4);
    pulseAnim.setValue(0);
    Animated.parallel([
      Animated.spring(enterAnim, {
        toValue: 1, useNativeDriver: true, friction: 5, tension: 150,
      }),
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 0.45, duration: 300, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1,    duration: 300, useNativeDriver: true }),
          ]),
          { iterations: 2 }
        ),
      ]),
    ]).start(() => {
      setTimeout(() => {
        setVisible(false);
        setClaimed(false);
      }, 120);
    });
  }

  function handleAccept() {
    if (!canAccept) return;
    if (isGrupal) onGiftClaim?.(giftId);
    else onGiftAction?.(giftId, 'accept');
    setClaimed(true);
    startSuccessAnim();
  }

  function handleReject() {
    setVisible(false);
    if (canReject) onGiftAction?.(giftId, 'reject');
  }

  function handleOverlayPress() {
    if (!claimed) setVisible(false);
  }

  return (
    <>
      <TouchableOpacity
        onPress={() => setVisible(true)}
        activeOpacity={isDone ? 0.85 : 0.8}
        style={isDone && { opacity: 0.52 }}
      >
        <LinearGradient
          colors={['#0e2040', '#060f1e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[s.card, isDone && s.cardDone]}
        >
          <View style={[s.accentBar, isDone && s.accentBarDone]} />
          <View style={[s.iconWrap, isDone && s.iconWrapDone]}>
            <Ionicons
              name={isDone ? 'gift-outline' : 'gift'}
              size={36}
              color={isDone ? 'rgba(255,255,255,0.4)' : colors.c2}
            />
          </View>
          <View style={s.info}>
            <Text style={s.msg} numberOfLines={2}>{displayMsg}</Text>
            <Text style={s.sub}>{bubbleSub}</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={handleOverlayPress}
      >
        <Pressable style={s.overlay} onPress={handleOverlayPress}>
          <Pressable style={s.sheet} onPress={() => {}}>

            {claimed ? (
              /* ── Animación de éxito ──────────────────────────────────────────── */
              (() => {
                const isFrameGift = items.length > 0 && !monedas;
                const frameItem   = items[0];
                return (
                  <View style={s.successContainer}>
                    <View style={s.glowContainer}>
                      <Animated.View style={[s.glowRingOuter, isFrameGift && s.glowRingOuterFrame, { opacity: outerOpacity }]} />
                      <Animated.View style={[s.glowRingInner, isFrameGift && s.glowRingInnerFrame, { opacity: pulseAnim }]} />
                      <Animated.View style={{ transform: [{ scale: enterAnim }] }}>
                        {isFrameGift && frameItem?.imageUrl
                          ? <Image source={{ uri: frameItem.imageUrl }} style={s.frameSuccessIcon} resizeMode="contain" />
                          : <Image source={COIN_ICON} style={s.coinSuccessIcon} />}
                      </Animated.View>
                    </View>

                    {monedas > 0 && (
                      <Animated.Text style={[s.coinSuccessAmt, { opacity: pulseAnim }]}>
                        +{formatCoins(coinsForReceiver)}
                      </Animated.Text>
                    )}

                    {isFrameGift && frameItem?.name && (
                      <Animated.Text style={[s.frameSuccessName, { opacity: pulseAnim }]}>
                        {frameItem.name}
                      </Animated.Text>
                    )}

                    <Animated.Text style={[s.successLabel, { opacity: pulseAnim }]}>
                      ¡Reclamado!
                    </Animated.Text>
                  </View>
                );
              })()

            ) : showInfoModal ? (
              /* ── Modal informativo (ya reclamó o agotado) ───────────────────── */
              <>
                <View style={s.modalIconRow}>
                  <View style={[s.modalIconCircle, s.modalIconCircleDone]}>
                    <Ionicons
                      name={agotado ? 'gift-outline' : 'checkmark-circle'}
                      size={28}
                      color={agotado ? 'rgba(255,255,255,0.45)' : '#22c55e'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.modalTitle}>
                      {agotado ? 'Regalo completado' : 'Ya reclamaste'}
                    </Text>
                    {!agotado && (
                      <Text style={s.modalSubtitle}>
                        {slots - slotsReclamados} {slots - slotsReclamados === 1 ? 'slot disponible' : 'slots disponibles'}
                      </Text>
                    )}
                  </View>
                </View>

                <View style={s.divider} />

                {monedas > 0 && (
                  <View style={s.contentRow}>
                    <Text style={s.contentLineDim}>Cada uno recibe</Text>
                    <Image source={COIN_ICON} style={s.coinInline} />
                    <Text style={s.contentLineDim}>{formatCoins(coinsForReceiver)} coins</Text>
                  </View>
                )}

                <View style={s.slotsRow}>
                  <Ionicons name="people-outline" size={13} color={colors.textDim} />
                  <Text style={s.slotsTxt}>{slotsReclamados}/{slots} reclamados</Text>
                </View>

                {claimantsList.length > 0 && (
                  <>
                    <Text style={s.claimantsLabel}>Reclamado por:</Text>
                    <ScrollView
                      style={s.claimantsList}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={false}
                    >
                      {claimantsList.map((c, i) => (
                        <View key={c.id || i} style={s.claimantRow}>
                          <View style={s.claimantAvatar}>
                            {c.avatarUrl
                              ? <Image source={{ uri: c.avatarUrl }} style={s.claimantAvatarImg} />
                              : <Text style={s.claimantAvatarLetter}>{c.username?.[0]?.toUpperCase()}</Text>}
                          </View>
                          <Text style={s.claimantName}>{c.username}</Text>
                        </View>
                      ))}
                    </ScrollView>
                  </>
                )}
              </>

            ) : (
              /* ── Modal normal (puede reclamar) ──────────────────────────────── */
              <>
                <View style={s.modalIconRow}>
                  <View style={s.modalIconCircle}>
                    <Ionicons name="gift" size={32} color={colors.c2} />
                  </View>
                  <Text style={s.modalTitle}>Regalo</Text>
                </View>

                <View style={s.divider} />

                {monedas > 0 ? (
                  <View style={s.contentRow}>
                    <Text style={s.contentLine}>Recibirás</Text>
                    <Image source={COIN_ICON} style={s.coinInline} />
                    <Text style={s.contentLine}>{formatCoins(coinsForReceiver)} coins</Text>
                  </View>
                ) : (
                  <Text style={[s.contentLine, { marginBottom: 10 }]}>
                    {items.length > 0
                      ? `Recibirás el marco "${items[0]?.name || 'Marco'}"`
                      : 'Regalo especial'}
                  </Text>
                )}

                {isGrupal && (
                  <View style={s.slotsRow}>
                    <Ionicons name="people-outline" size={13} color={colors.textDim} />
                    <Text style={s.slotsTxt}>{slotsReclamados}/{slots} reclamados</Text>
                  </View>
                )}

                {statusBadge && (
                  <Text style={s.statusTxt}>{statusBadge}</Text>
                )}

                <View style={[s.btnRow, isGrupal && s.btnRowCentered]}>
                  {!isGrupal && (
                    <TouchableOpacity style={s.rejectBtn} onPress={handleReject}>
                      <Text style={s.rejectTxt}>Rechazar</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[
                      isGrupal ? s.acceptBtnCompact : s.acceptBtn,
                      !canAccept && s.btnDisabled,
                    ]}
                    onPress={handleAccept}
                    disabled={!canAccept}
                  >
                    <Text style={s.acceptTxt}>{isGrupal ? 'Reclamar' : 'Aceptar'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  // ── Bubble card ──────────────────────────────────────────────────────────────
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingRight: 16,
    paddingLeft: 0,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(41,121,255,0.45)',
    minWidth: 230,
    overflow: 'hidden',
  },
  cardDone: {
    borderColor: 'rgba(255,255,255,0.1)',
  },
  accentBar: {
    width: 3,
    alignSelf: 'stretch',
    backgroundColor: colors.c2,
    borderRadius: 2,
    marginLeft: 12,
    marginVertical: 4,
  },
  accentBarDone: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(41,121,255,0.13)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapDone: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  info: { flex: 1 },
  msg: {
    color: colors.textHi,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  sub: {
    color: colors.textDim,
    fontSize: 10,
    marginTop: 3,
  },

  // ── Modal base ────────────────────────────────────────────────────────────────
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: '#0b1928',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(41,121,255,0.35)',
    width: '100%',
    padding: 24,
    maxHeight: '85%',
  },
  modalIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  modalIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(41,121,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(41,121,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalIconCircleDone: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  modalTitle: {
    color: colors.textHi,
    fontSize: 18,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: colors.textDim,
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginBottom: 16,
  },

  // Content line
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 10,
  },
  coinInline: {
    width: 18,
    height: 18,
  },
  contentLine: {
    color: colors.textHi,
    fontSize: 15,
    fontWeight: '700',
  },
  contentLineDim: {
    color: colors.textDim,
    fontSize: 14,
    fontWeight: '600',
  },

  slotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  slotsTxt: {
    color: colors.textDim,
    fontSize: 12,
  },
  statusTxt: {
    color: colors.textDim,
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 4,
  },

  // Claimants list
  claimantsLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 4,
    marginBottom: 8,
  },
  claimantsList: {
    maxHeight: 180,
  },
  claimantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 5,
  },
  claimantAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,229,204,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  claimantAvatarImg: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  claimantAvatarLetter: {
    color: '#00e5cc',
    fontWeight: 'bold',
    fontSize: 11,
  },
  claimantName: {
    color: colors.textHi,
    fontSize: 13,
    fontWeight: '600',
  },

  // Buttons
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  btnRowCentered: {
    justifyContent: 'center',
  },
  rejectBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  rejectTxt: {
    color: 'rgba(239,68,68,0.85)',
    fontSize: 14,
    fontWeight: '700',
  },
  acceptBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: colors.c2,
  },
  acceptBtnCompact: {
    paddingVertical: 9,
    paddingHorizontal: 44,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: colors.c2,
  },
  acceptTxt: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  btnDisabled: {
    opacity: 0.35,
  },

  // ── Success overlay ───────────────────────────────────────────────────────────
  successContainer: {
    alignItems: 'center',
    paddingVertical: 28,
  },

  // 100×100 container — rings are absolute, coin is centered child
  glowContainer: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },

  // Outer ring: fills 100×100
  glowRingOuter: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 50,
    backgroundColor: 'rgba(255,200,0,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,200,0,0.22)',
  },

  // Inner ring: inset 10px → 80×80
  glowRingInner: {
    position: 'absolute',
    top: 10, left: 10, right: 10, bottom: 10,
    borderRadius: 40,
    backgroundColor: 'rgba(255,200,0,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,200,0,0.6)',
    shadowColor: '#ffc800',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 14,
  },

  coinSuccessIcon: {
    width: 54,
    height: 54,
  },

  coinSuccessAmt: {
    color: '#ffc800',
    fontSize: 34,
    fontWeight: '900',
    marginTop: 10,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(255,200,0,0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  successLabel: {
    color: colors.textHi,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
    letterSpacing: 0.3,
  },

  // Frame success animation variants
  glowRingOuterFrame: {
    backgroundColor: 'rgba(41,121,255,0.07)',
    borderColor: 'rgba(41,121,255,0.22)',
  },
  glowRingInnerFrame: {
    backgroundColor: 'rgba(41,121,255,0.15)',
    borderColor: 'rgba(41,121,255,0.6)',
    shadowColor: '#2979ff',
  },
  frameSuccessIcon: {
    width: 62,
    height: 62,
  },
  frameSuccessName: {
    color: colors.c2,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
    letterSpacing: 0.3,
    textShadowColor: 'rgba(41,121,255,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
});
