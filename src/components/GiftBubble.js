import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export default function GiftBubble({ giftData, giftId, isMe, myId, onGiftAction, onGiftClaim }) {
  const mensaje = giftData?.mensaje?.trim() || '';
  const display = mensaje || '¡Con mis mejores deseos! 🎁';

  return (
    <TouchableOpacity style={s.card} activeOpacity={0.75}>
      <Ionicons name="gift" size={22} color={colors.c2} />
      <Text style={[s.msg, !mensaje && s.fallback]} numberOfLines={2}>{display}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(41,121,255,0.28)',
    backgroundColor: 'rgba(41,121,255,0.07)',
    minWidth: 160,
    maxWidth: 240,
  },
  msg: {
    color: colors.textHi,
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  fallback: {
    color: colors.textMid,
    fontStyle: 'italic',
  },
});
