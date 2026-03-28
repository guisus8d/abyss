import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, Animated, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

const OPTIONS = [
  {
    key: 'quick',
    icon: 'flash',
    label: 'Post rápido',
    hint: 'Texto o imagen',
    color: colors.c1,
    bg: 'rgba(0,229,204,0.12)',
    border: 'rgba(0,229,204,0.3)',
    active: true,
  },
  {
    key: 'image',
    icon: 'image',
    label: 'Post imagen',
    hint: 'Foto + descripción',
    color: 'rgba(167,139,250,1)',
    bg: 'rgba(147,51,234,0.12)',
    border: 'rgba(147,51,234,0.3)',
    active: true,
  },
  {
    key: 'news',
    icon: 'newspaper',
    label: 'Noticia',
    hint: 'Título + cuerpo',
    color: 'rgba(251,191,36,1)',
    bg: 'rgba(234,179,8,0.12)',
    border: 'rgba(234,179,8,0.3)',
    active: true,
  },
  {
    key: 'frame',
    icon: 'sparkles',
    label: 'Crear marco',
    hint: '200 XP mínimo',
    color: 'rgba(244,114,182,1)',
    bg: 'rgba(236,72,153,0.08)',
    border: 'rgba(236,72,153,0.2)',
    active: true,
  },
  {
    key: 'channel',
    icon: 'radio',
    label: 'Canal',
    hint: 'Próximamente',
    color: 'rgba(96,165,250,1)',
    bg: 'rgba(41,121,255,0.08)',
    border: 'rgba(41,121,255,0.2)',
    active: false,
  },
];

export default function CreatePostMenu({ visible, onClose, onSelect }) {
  const slideAnim = useRef(new Animated.Value(400)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  const { width: W } = useWindowDimensions();
  // 3 columnas con gap de 10 y padding horizontal de 20 a cada lado
  const CARD_W = (W - 40 - 20) / 3;

  const insets = useSafeAreaInsets();
  // Solo el inset real de la nav bar — sin suma extra
  const bottomPad = insets.bottom > 0 ? insets.bottom : 8;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, friction: 9, tension: 60, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 400, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[s.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            s.sheet,
            { paddingBottom: bottomPad, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={s.handle} />
          <Text style={s.title}>CREAR</Text>

          <View style={s.grid}>
            {OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[
                  s.card,
                  { width: CARD_W, borderColor: opt.border, backgroundColor: opt.bg },
                  !opt.active ? s.cardDisabled : null,
                ]}
                onPress={() => {
                  if (!opt.active) return;
                  onClose();
                  setTimeout(() => onSelect(opt.key), 250);
                }}
                activeOpacity={opt.active ? 0.7 : 1}
              >
                {/* ✅ Ícono más pequeño y compacto para reducir altura */}
                <View style={[s.iconWrap, { borderColor: opt.border }]}>
                  <Ionicons
                    name={opt.icon}
                    size={20}
                    color={opt.active ? opt.color : colors.textDim}
                  />
                </View>
                <Text style={[s.cardLabel, { color: opt.active ? opt.color : colors.textDim }]}>
                  {opt.label}
                </Text>
                <Text style={s.cardHint}>{opt.hint}</Text>
                {!opt.active ? (
                  <View style={s.soonBadge}>
                    <Text style={s.soonTxt}>PRONTO</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
            <Text style={s.cancelTxt}>Cancelar</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    // ✅ FIX ALTURA: padding reducido (20 en vez de 24), paddingBottom manejado inline
    paddingTop: 14,
    paddingHorizontal: 20,
    paddingBottom: 8,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  handle:  { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title:   { fontSize: 10, letterSpacing: 5, color: colors.c1, fontWeight: '900', textAlign: 'center', marginBottom: 16 },

  grid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },

  // ✅ Cards más compactas — padding reducido de 14 a 10, gap de 8 a 6
  card: {
    borderRadius: 16, borderWidth: 1,
    padding: 10, gap: 6,
    alignItems: 'center', position: 'relative',
  },
  cardDisabled: { opacity: 0.45 },

  // ✅ Ícono más chico — 40x40 en vez de 52x52
  iconWrap: {
    width: 40, height: 40, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  cardLabel: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  cardHint:  { fontSize: 9, color: colors.textDim, textAlign: 'center' },

  soonBadge: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 5, paddingHorizontal: 4, paddingVertical: 2,
  },
  soonTxt: { fontSize: 6, color: colors.textDim, letterSpacing: 1, fontWeight: '700' },

  cancelBtn: { marginTop: 14, alignItems: 'center' },
  cancelTxt: { color: colors.textDim, fontSize: 14, paddingVertical: 8 },
});
