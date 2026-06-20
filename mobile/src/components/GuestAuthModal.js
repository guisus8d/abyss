import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';

export default function GuestAuthModal({ visible, onClose }) {
  const { exitGuestMode } = useAuthStore();

  function handleAction() {
    onClose();
    exitGuestMode();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.box}>
          <View style={s.iconWrap}>
            <Ionicons name="lock-closed" size={28} color={colors.c1} />
          </View>
          <Text style={s.title}>Inicia sesión para continuar</Text>
          <Text style={s.sub}>
            Crea una cuenta gratuita para interactuar con la comunidad de Abyss
          </Text>
          <TouchableOpacity style={s.btnPrimary} onPress={handleAction} activeOpacity={0.85}>
            <Ionicons name="log-in-outline" size={17} color="#001a18" />
            <Text style={s.btnPrimaryTxt}>Iniciar sesión</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btnSecondary} onPress={handleAction} activeOpacity={0.85}>
            <Ionicons name="person-add-outline" size={17} color={colors.c1} />
            <Text style={s.btnSecondaryTxt}>Crear cuenta gratis</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btnCancel} onPress={onClose} activeOpacity={0.7}>
            <Text style={s.btnCancelTxt}>Seguir explorando</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  box: {
    backgroundColor: '#0b1521', borderRadius: 24,
    padding: 28, width: '100%', maxWidth: 360,
    borderWidth: 1, borderColor: 'rgba(0,229,204,0.2)',
    alignItems: 'center',
  },
  iconWrap: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(0,229,204,0.08)',
    borderWidth: 1, borderColor: 'rgba(0,229,204,0.25)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    color: colors.textHi, fontSize: 18, fontWeight: '700',
    textAlign: 'center', marginBottom: 8,
  },
  sub: {
    color: 'rgba(232,244,248,0.5)', fontSize: 13,
    textAlign: 'center', lineHeight: 19, marginBottom: 24,
  },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.c1, borderRadius: 14, paddingVertical: 14,
    width: '100%', marginBottom: 10,
  },
  btnPrimaryTxt: { color: '#001a18', fontSize: 14, fontWeight: '800' },
  btnSecondary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, paddingVertical: 14, width: '100%', marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(0,229,204,0.35)',
    backgroundColor: 'rgba(0,229,204,0.06)',
  },
  btnSecondaryTxt: { color: colors.c1, fontSize: 14, fontWeight: '700' },
  btnCancel: { paddingVertical: 8 },
  btnCancelTxt: { color: 'rgba(232,244,248,0.35)', fontSize: 13 },
});
