import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, Animated,
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
    bg: 'rgba(0,229,204,0.10)',
    border: 'rgba(0,229,204,0.25)',
    active: true,
  },
  {
    key: 'image',
    icon: 'image',
    label: 'Post imagen',
    hint: 'Foto + descripción',
    color: 'rgba(167,139,250,1)',
    bg: 'rgba(147,51,234,0.10)',
    border: 'rgba(147,51,234,0.25)',
    active: true,
  },
  {
    key: 'news',
    icon: 'newspaper',
    label: 'Noticia',
    hint: 'Título + cuerpo',
    color: 'rgba(251,191,36,1)',
    bg: 'rgba(234,179,8,0.10)',
    border: 'rgba(234,179,8,0.25)',
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

// Tamaño fijo cuadrado para cada card
const CARD_SIZE = 100;

export default function CreatePostMenu({ visible, onClose, onSelect }) {
  const slideAnim = useRef(new Animated.Value(400)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const insets    = useSafeAreaInsets();
  const bottomPad = insets.bottom > 0 ? insets.bottom : 12;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, friction: 9, tension: 60, useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 400, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 0,   duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  function handleSelect(opt) {
    if (!opt.active) return;
    onClose();
    setTimeout(() => onSelect(opt.key), 250);
  }

  function renderCard(opt) {
    return (
      <TouchableOpacity
        key={opt.key}
        style={[
          s.card,
          { borderColor: opt.border, backgroundColor: opt.bg },
          !opt.active && s.cardDisabled,
        ]}
        onPress={() => handleSelect(opt)}
        activeOpacity={opt.active ? 0.7 : 1}
      >
        <View style={[s.iconWrap, { borderColor: opt.border }]}>
          <Ionicons name={opt.icon} size={20} color={opt.active ? opt.color : colors.textDim} />
        </View>
        <Text style={[s.cardLabel, { color: opt.active ? opt.color : colors.textDim }]}>
          {opt.label}
        </Text>
        <Text style={s.cardHint}>{opt.hint}</Text>
        {!opt.active && (
          <View style={s.soonBadge}>
            <Text style={s.soonTxt}>PRONTO</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View style={[s.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />

        <Animated.View style={[s.sheet, { paddingBottom: bottomPad, transform: [{ translateY: slideAnim }] }]}>
          <View style={s.handle} />
          <Text style={s.title}>CREAR</Text>

          {/* Las 5 cards en una sola fila envolvente centrada */}
          <View style={s.grid}>
            {OPTIONS.map(renderCard)}
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
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 12,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  handle: {
    width: 32, height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 9, letterSpacing: 5,
    color: colors.c1, fontWeight: '900',
    textAlign: 'center', marginBottom: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 4,
  },
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    position: 'relative',
  },
  cardDisabled: { opacity: 0.4 },
  iconWrap: {
    width: 34, height: 34,
    borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  cardLabel: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  cardHint:  { fontSize: 8, color: colors.textDim, textAlign: 'center' },
  soonBadge: {
    position: 'absolute', top: 5, right: 5,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 4, paddingHorizontal: 3, paddingVertical: 2,
  },
  soonTxt:   { fontSize: 6, color: colors.textDim, letterSpacing: 1, fontWeight: '700' },
  cancelBtn: { marginTop: 10, alignItems: 'center' },
  cancelTxt: { color: colors.textDim, fontSize: 13, paddingVertical: 8 },
});
