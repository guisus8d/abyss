import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import CoinIcon from './CoinIcon';

export default function GiftBubble({ giftData, giftId, isMe, onGiftAction }) {
  const { monedas = 0, items = [], mensaje = '', estado = 'pendiente' } = giftData || {};

  const isPending  = estado === 'pendiente';
  const isAccepted = estado === 'aceptado';
  const isRejected = estado === 'rechazado';
  const isExpired  = estado === 'expirado';
  const isDone     = !isPending;

  const borderColor = isAccepted ? 'rgba(0,229,204,0.4)'
    : isRejected ? 'rgba(239,68,68,0.4)'
    : isExpired  ? 'rgba(255,255,255,0.12)'
    : 'rgba(168,85,247,0.55)';

  const bgColor = isAccepted ? 'rgba(0,229,204,0.06)'
    : isRejected ? 'rgba(239,68,68,0.06)'
    : isExpired  ? 'rgba(255,255,255,0.03)'
    : 'rgba(168,85,247,0.08)';

  const headerLabel = isAccepted ? 'ACEPTADO'
    : isRejected ? 'RECHAZADO'
    : isExpired  ? 'EXPIRADO'
    : 'REGALO';

  const headerColor = isAccepted ? colors.c1
    : isRejected ? 'rgba(239,68,68,0.8)'
    : isExpired  ? colors.textDim
    : colors.c3;

  return (
    <View style={[s.card, { borderColor, backgroundColor: bgColor }]}>

      {/* Header */}
      <View style={s.header}>
        <Text style={s.emoji}>{isDone && !isAccepted ? '📦' : '🎁'}</Text>
        <Text style={[s.label, { color: headerColor }]}>{headerLabel}</Text>
      </View>

      {/* Coins */}
      {monedas > 0 && (
        <View style={s.row}>
          <CoinIcon size={14} />
          <Text style={[s.coinsVal, isDone && s.faded]}>{monedas} coins</Text>
          {!isMe && isPending && (
            <Text style={s.coinsNote}> · {Math.round(monedas * 0.85)} al aceptar</Text>
          )}
        </View>
      )}

      {/* Items */}
      {items.map((it, i) => (
        <View key={i} style={s.row}>
          <Ionicons name="image-outline" size={13} color={isDone ? colors.textDim : colors.textMid} />
          <Text style={[s.frameName, isDone && s.faded]}>
            {it.name || 'Marco'}{it.cantidad > 1 ? ` ×${it.cantidad}` : ''}
          </Text>
        </View>
      ))}

      {/* Message */}
      {!!mensaje && (
        <Text style={[s.msg, isDone && s.faded]}>"{mensaje}"</Text>
      )}

      {/* Actions — only if receiver + pending */}
      {!isMe && isPending && !!giftId && (
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

      {isMe && isPending && (
        <View style={s.pendingRow}>
          <Ionicons name="time-outline" size={11} color={colors.textDim} />
          <Text style={s.pendingTxt}>Esperando aceptación...</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    minWidth: 210,
    maxWidth: 265,
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
  emoji:     { fontSize: 17 },
  label:     { fontSize: 10, fontWeight: '900', letterSpacing: 1.8 },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  coinsVal:  { color: 'rgba(251,191,36,1)', fontSize: 14, fontWeight: '800' },
  coinsNote: { color: 'rgba(251,191,36,0.55)', fontSize: 10 },
  frameName: { color: colors.textHi, fontSize: 12, fontWeight: '600' },
  faded:     { opacity: 0.45 },
  msg:       { color: colors.textDim, fontSize: 11, fontStyle: 'italic', marginTop: 6 },
  actions:   { flexDirection: 'row', gap: 8, marginTop: 12 },
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
  rejectTxt:  { color: 'rgba(239,68,68,0.85)', fontSize: 12, fontWeight: '700' },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, justifyContent: 'center' },
  pendingTxt: { color: colors.textDim, fontSize: 10 },
});
