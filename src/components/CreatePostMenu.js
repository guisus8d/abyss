import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, Animated, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

const OPTIONS = [
  {
    key: 'quick',
    icon: 'flash-outline',
    label: 'Post rápido',
    hint: 'Texto o imagen simple',
    color: colors.c1,
    bg: 'rgba(0,229,204,0.12)',
    border: 'rgba(0,229,204,0.3)',
    active: true,
  },
  {
    key: 'image',
    icon: 'image-outline',
    label: 'Post imagen',
    hint: 'Foto con descripción',
    color: 'rgba(167,139,250,1)',
    bg: 'rgba(147,51,234,0.12)',
    border: 'rgba(147,51,234,0.3)',
    active: true,
  },
  {
    key: 'news',
    icon: 'newspaper-outline',
    label: 'Post noticia',
    hint: 'Título, imagen y cuerpo',
    color: 'rgba(251,191,36,1)',
    bg: 'rgba(234,179,8,0.12)',
    border: 'rgba(234,179,8,0.3)',
    active: true,
  },
  {
    key: 'frame',
    icon: 'sparkles-outline',
    label: 'Agregar marco',
    hint: 'Próximamente',
    color: 'rgba(244,114,182,1)',
    bg: 'rgba(236,72,153,0.08)',
    border: 'rgba(236,72,153,0.2)',
    active: false,
  },
  {
    key: 'channel',
    icon: 'radio-outline',
    label: 'Crear canal',
    hint: 'Próximamente',
    color: 'rgba(96,165,250,1)',
    bg: 'rgba(41,121,255,0.08)',
    border: 'rgba(41,121,255,0.2)',
    active: false,
  },
];

export default function CreatePostMenu({ visible, onClose, onSelect }) {
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 300, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[s.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={s.handle} />
          <Text style={s.title}>CREAR</Text>

          <View style={s.grid}>
            {OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[s.card, { borderColor: opt.border, backgroundColor: opt.bg }, !opt.active && s.cardDisabled]}
                onPress={() => {
                  if (!opt.active) return;
                  onClose();
                  setTimeout(() => onSelect(opt.key), 250);
                }}
                activeOpacity={opt.active ? 0.7 : 1}
              >
                <View style={[s.iconWrap, { borderColor: opt.border }]}>
                  <Ionicons name={opt.icon} size={24} color={opt.active ? opt.color : colors.textDim} />
                </View>
                <Text style={[s.cardLabel, { color: opt.active ? opt.color : colors.textDim }]}>{opt.label}</Text>
                <Text style={s.cardHint}>{opt.hint}</Text>
                {!opt.active && (
                  <View style={s.soonBadge}>
                    <Text style={s.soonTxt}>PRONTO</Text>
                  </View>
                )}
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

const W = Dimensions.get('window').width;
const CARD_W = (W - 48 - 12) / 3;

const s = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet:     { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 44, borderTopWidth: 1, borderTopColor: colors.border },
  handle:    { width: 44, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title:     { fontSize: 11, letterSpacing: 5, color: colors.c1, fontWeight: '900', textAlign: 'center', marginBottom: 24 },

  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  card:      { width: CARD_W, borderRadius: 18, borderWidth: 1, padding: 14, alignItems: 'center', gap: 8, position: 'relative' },
  cardDisabled: { opacity: 0.5 },
  iconWrap:  { width: 52, height: 52, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  cardLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  cardHint:  { fontSize: 10, color: colors.textDim, textAlign: 'center' },

  soonBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  soonTxt:   { fontSize: 7, color: colors.textDim, letterSpacing: 1, fontWeight: '700' },

  cancelBtn: { marginTop: 20, alignItems: 'center' },
  cancelTxt: { color: colors.textDim, fontSize: 14, paddingVertical: 6 },
});
