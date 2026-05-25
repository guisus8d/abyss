import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';

export default function GiftBubble({ giftData, giftId, isMe, myId, onGiftAction, onGiftClaim }) {
  const [visible, setVisible] = useState(false);

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
    ? Math.floor(monedas / Math.max(slots, 1))
    : Math.round(monedas * 0.85);

  const contentLine = monedas > 0
    ? `Recibirás ${coinsForReceiver} coins`
    : items.length > 0
    ? `Recibirás el marco "${items[0]?.name || 'Marco'}"`
    : 'Regalo especial';

  const canAccept = isPending && !yaReclame && !agotado;
  const canReject = !isMe && isPending && !isGrupal;

  const statusBadge = !isPending
    ? (estado === 'aceptado' ? 'Aceptado' : estado === 'rechazado' ? 'Rechazado' : 'Expirado')
    : yaReclame ? 'Ya reclamaste'
    : agotado   ? 'Sin unidades disponibles'
    : null;

  function handleAccept() {
    setVisible(false);
    if (!canAccept) return;
    if (isGrupal) onGiftClaim?.(giftId);
    else onGiftAction?.(giftId, 'accept');
  }

  function handleReject() {
    setVisible(false);
    if (canReject) onGiftAction?.(giftId, 'reject');
  }

  return (
    <>
      <TouchableOpacity onPress={() => setVisible(true)} activeOpacity={0.8}>
        <LinearGradient
          colors={['#0e2040', '#060f1e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.card}
        >
          {/* Left accent bar */}
          <View style={s.accentBar} />

          <View style={s.iconWrap}>
            <Ionicons name="gift" size={36} color={colors.c2} />
          </View>

          <View style={s.info}>
            <Text style={s.msg} numberOfLines={2}>{displayMsg}</Text>
            <Text style={s.sub}>
              {statusBadge || 'Toca para ver el contenido'}
            </Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={s.overlay} onPress={() => setVisible(false)}>
          <Pressable style={s.sheet} onPress={() => {}}>

            <View style={s.modalIconRow}>
              <View style={s.modalIconCircle}>
                <Ionicons name="gift" size={32} color={colors.c2} />
              </View>
              <Text style={s.modalTitle}>Regalo</Text>
            </View>

            <View style={s.divider} />

            <Text style={s.contentLine}>{contentLine}</Text>

            {isGrupal && (
              <View style={s.slotsRow}>
                <Ionicons name="people-outline" size={13} color={colors.textDim} />
                <Text style={s.slotsTxt}>{slotsReclamados}/{slots} reclamados</Text>
              </View>
            )}

            {statusBadge && (
              <Text style={s.statusTxt}>{statusBadge}</Text>
            )}

            <View style={s.btnRow}>
              {!isGrupal && (
                <TouchableOpacity style={s.rejectBtn} onPress={handleReject}>
                  <Text style={s.rejectTxt}>Rechazar</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[s.acceptBtn, !canAccept && s.btnDisabled]}
                onPress={handleAccept}
                disabled={!canAccept}
              >
                <Text style={s.acceptTxt}>{isGrupal ? 'Reclamar' : 'Aceptar'}</Text>
              </TouchableOpacity>
            </View>

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
  accentBar: {
    width: 3,
    alignSelf: 'stretch',
    backgroundColor: colors.c2,
    borderRadius: 2,
    marginLeft: 12,
    marginVertical: 4,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(41,121,255,0.13)',
    alignItems: 'center',
    justifyContent: 'center',
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

  // ── Modal ────────────────────────────────────────────────────────────────────
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
  modalTitle: {
    color: colors.textHi,
    fontSize: 18,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginBottom: 16,
  },
  contentLine: {
    color: colors.textHi,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
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
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
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
  acceptTxt: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  btnDisabled: {
    opacity: 0.35,
  },
});
