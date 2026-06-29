import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, Animated, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

const SCREEN_W  = Dimensions.get('window').width;
const CARD_SIZE = 80;

const OPTIONS = [
  { key: 'news',    icon: 'newspaper', label: 'Noticia', color: colors.c1 },
  { key: 'image',   icon: 'image',     label: 'Imagen',  color: '#f472b6' },
  { key: 'quick',   icon: 'flash',     label: 'Rapido',  color: '#facc15' },
  { key: 'video',   icon: 'videocam',  label: 'Video',   color: colors.c4 },
  { key: 'channel', icon: 'radio',     label: 'Fiestas', color: '#a855f7' },
];

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

  function handleSelect(key) {
    onClose();
    setTimeout(() => onSelect(key), 250);
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
          <Text style={s.title}>Crear</Text>

          <View style={s.grid}>
            {OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={s.card}
                onPress={() => handleSelect(opt.key)}
                activeOpacity={0.7}
              >
                <Ionicons name={opt.icon} size={28} color={opt.color} />
                <Text style={[s.cardLabel, { color: opt.color }]}>{opt.label}</Text>
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
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  handle: {
    width: 32, height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 16, fontWeight: '700',
    color: colors.textHi,
    textAlign: 'center',
    marginBottom: 18,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 4,
    justifyContent: 'center',
  },
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  cardLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  cancelBtn: { marginTop: 10, alignItems: 'center' },
  cancelTxt: { color: colors.textDim, fontSize: 13, paddingVertical: 8 },
});
