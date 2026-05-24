import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import CoinIcon from './CoinIcon';

export default function GiftBubble({ giftData, giftId, isMe, myId, onGiftAction, onGiftClaim }) {
  const {
    monedas = 0, items = [], mensaje = '', estado = 'pendiente',
    tipo = 'privado', slots = 1, slotsReclamados = 0, reclamadoPor = [],
  } = giftData || {};

  const isGrupal   = tipo === 'grupal';
  const isPending  = estado === 'pendiente';
  const isAccepted = estado === 'aceptado';
  const isRejected = estado === 'rechazado';
  const isExpired  = estado === 'expirado';
  const isDone     = !isPending;

  const agotado    = isGrupal && isPending && slotsReclamados >= slots;
  const yaReclame  = isGrupal && myId && (reclamadoPor || []).map(String).includes(String(myId));

  const borderColor = isAccepted ? 'rgba(0,229,204,0.4)'
    : isRejected ? 'rgba(239,68,68,0.4)'
    : isExpired  ? 'rgba(255,255,255,0.1)'
    : agotado    ? 'rgba(255,255,255,0.15)'
    : isGrupal   ? 'rgba(251,191,36,0.5)'
    : 'rgba(168,85,247,0.55)';

  const bgColor = isAccepted ? 'rgba(0,229,204,0.06)'
    : isRejected ? 'rgba(239,68,68,0.06)'
    : isExpired  ? 'rgba(255,255,255,0.02)'
    : agotado    ? 'rgba(255,255,255,0.04)'
    : isGrupal   ? 'rgba(251,191,36,0.07)'
    : 'rgba(168,85,247,0.08)';

  const headerLabel = isExpired  ? 'EXPIRADO'
    : isRejected ? 'RECHAZADO'
    : isAccepted && !isGrupal ? 'ACEPTADO'
    : isGrupal   ? 'LLUVIA DE REGALOS'
    : 'REGALO';

  const headerColor = isExpired  ? colors.textDim
    : isRejected ? 'rgba(239,68,68,0.8)'
    : isAccepted && !isGrupal ? colors.c1
    : isGrupal   ? 'rgba(251,191,36,0.9)'
    : colors.c3;

  return (
    <View style={[s.card, { borderColor, backgroundColor: bgColor }]}>

      {/* Header */}
      <View style={s.header}>
        <Text style={s.emoji}>
          {isDone && !isGrupal && !isAccepted ? '📦' : isGrupal ? '🎁' : '🎁'}
        </Text>
        <Text style={[s.label, { color: headerColor }]}>{headerLabel}</Text>

        {/* Group counter */}
        {isGrupal && (
          <View style={s.counter}>
            <Text style={[s.counterTxt, agotado && { color: colors.textDim }]}>
              {slotsReclamados}/{slots}
            </Text>
            <Text style={s.counterSub}> reclamados</Text>
          </View>
        )}
      </View>

      {/* Coins */}
      {monedas > 0 && (
        <View style={s.row}>
          <CoinIcon size={14} />
          <Text style={[s.coinsVal, isDone && s.faded]}>
            {isGrupal
              ? `${monedas} coins · ${Math.floor(monedas / slots)} por usuario`
              : `${monedas} coins`}
          </Text>
          {!isMe && !isGrupal && isPending && (
            <Text style={s.coinsNote}> · {Math.round(monedas * 0.85)} al aceptar</Text>
          )}
        </View>
      )}

      {/* Frames */}
      {items.map((it, i) => (
        <View key={i} style={s.row}>
          <Ionicons name="image-outline" size={13} color={isDone ? colors.textDim : colors.textMid} />
          <Text style={[s.frameName, isDone && s.faded]}>
            {it.name || 'Marco'}
            {isGrupal ? ` · ${it.cantidad} unidades` : it.cantidad > 1 ? ` ×${it.cantidad}` : ''}
          </Text>
        </View>
      ))}

      {/* Message */}
      {!!mensaje && (
        <Text style={[s.msg, isDone && !isGrupal && s.faded]}>"{mensaje}"</Text>
      )}

      {/* ── Private gift actions ── */}
      {!isGrupal && !isMe && isPending && !!giftId && (
        <View style={s.actions}>
          <TouchableOpacity style={s.acceptBtn} onPress={() => onGiftAction?.(giftId, 'accept')} activeOpacity={0.8}>
            <Ionicons name="checkmark" size={13} color={colors.black} />
            <Text style={s.acceptTxt}>Aceptar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.rejectBtn} onPress={() => onGiftAction?.(giftId, 'reject')} activeOpacity={0.8}>
            <Ionicons name="close" size={13} color="rgba(239,68,68,0.9)" />
            <Text style={s.rejectTxt}>Rechazar</Text>
          </TouchableOpacity>
        </View>
      )}
      {!isGrupal && isMe && isPending && (
        <View style={s.pendingRow}>
          <Ionicons name="time-outline" size={11} color={colors.textDim} />
          <Text style={s.pendingTxt}>Esperando aceptación...</Text>
        </View>
      )}

      {/* ── Group gift actions ── */}
      {isGrupal && !isMe && isPending && !agotado && !yaReclame && !!giftId && (
        <TouchableOpacity style={s.claimBtn} onPress={() => onGiftClaim?.(giftId)} activeOpacity={0.8}>
          <Text style={s.claimTxt}>🎁 Reclamar</Text>
        </TouchableOpacity>
      )}
      {isGrupal && !isMe && isPending && yaReclame && (
        <View style={s.statusRow}>
          <Ionicons name="checkmark-circle-outline" size={13} color={colors.c1} />
          <Text style={[s.statusTxt, { color: colors.c1 }]}>Ya reclamaste</Text>
        </View>
      )}
      {isGrupal && !isMe && (agotado || isAccepted) && !yaReclame && (
        <View style={s.statusRow}>
          <Ionicons name="close-circle-outline" size={13} color={colors.textDim} />
          <Text style={s.statusTxt}>Sin unidades disponibles</Text>
        </View>
      )}
      {isGrupal && isMe && isPending && !agotado && (
        <View style={s.pendingRow}>
          <Ionicons name="time-outline" size={11} color={colors.textDim} />
          <Text style={s.pendingTxt}>Esperando reclamaciones...</Text>
        </View>
      )}
      {isExpired && (
        <View style={s.statusRow}>
          <Ionicons name="timer-outline" size={13} color={colors.textDim} />
          <Text style={s.statusTxt}>Regalo expirado</Text>
        </View>
      )}
      {isRejected && !isGrupal && (
        <View style={s.statusRow}>
          <Ionicons name="close-circle-outline" size={13} color="rgba(239,68,68,0.7)" />
          <Text style={[s.statusTxt, { color: 'rgba(239,68,68,0.7)' }]}>Rechazado</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    minWidth: 215,
    maxWidth: 270,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    paddingBottom: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  emoji:      { fontSize: 16 },
  label:      { fontSize: 9, fontWeight: '900', letterSpacing: 1.6, flex: 1 },
  counter:    { flexDirection: 'row', alignItems: 'baseline' },
  counterTxt: { color: 'rgba(251,191,36,0.9)', fontSize: 12, fontWeight: '800' },
  counterSub: { color: colors.textDim, fontSize: 9 },

  row:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  coinsVal:  { color: 'rgba(251,191,36,1)', fontSize: 13, fontWeight: '800' },
  coinsNote: { color: 'rgba(251,191,36,0.55)', fontSize: 10 },
  frameName: { color: colors.textHi, fontSize: 12, fontWeight: '600' },
  faded:     { opacity: 0.45 },
  msg:       { color: colors.textDim, fontSize: 11, fontStyle: 'italic', marginTop: 6, marginBottom: 2 },

  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  acceptBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, backgroundColor: colors.c1, borderRadius: 10, paddingVertical: 9,
  },
  acceptTxt: { color: colors.black, fontSize: 12, fontWeight: '800' },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 10, paddingVertical: 9,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
  },
  rejectTxt: { color: 'rgba(239,68,68,0.85)', fontSize: 12, fontWeight: '700' },

  claimBtn: {
    marginTop: 12, backgroundColor: 'rgba(251,191,36,0.15)', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.4)',
  },
  claimTxt: { color: 'rgba(251,191,36,1)', fontSize: 13, fontWeight: '800' },

  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, justifyContent: 'center' },
  pendingTxt: { color: colors.textDim, fontSize: 10 },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  statusTxt: { color: colors.textDim, fontSize: 11 },
});
