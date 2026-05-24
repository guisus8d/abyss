import React, { useEffect, useRef, useState } from 'react';
import { Image } from 'react-native';
import {
  View, Text, Animated, TouchableOpacity, TouchableWithoutFeedback,
  StyleSheet, Dimensions, ScrollView, Alert,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import api from '../services/api';
import AvatarWithFrame from './AvatarWithFrame';
import CoinIcon from './CoinIcon';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(width * 0.72, 300);

// MenuItem con ícono en contenedor coloreado (estilo Telegram/Discord)
function MenuItem({ icon, label, color, onPress, badge }) {
  const bg     = color + '1A'; // ~10% opacity
  const border = color + '30'; // ~19% opacity
  return (
    <TouchableOpacity style={s.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={[s.iconBox, { backgroundColor: bg, borderColor: border }]}>
        <Ionicons name={icon} size={19} color={color} />
      </View>
      <Text style={s.menuLabel}>{label}</Text>
      {badge != null && badge > 0 ? (
        <View style={s.badge}>
          <Text style={s.badgeTxt}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={15} color={colors.textDim} />
      )}
    </TouchableOpacity>
  );
}

function SectionDivider({ label }) {
  return (
    <View style={s.dividerWrap}>
      {label
        ? <Text style={s.dividerLabel}>{label}</Text>
        : <View style={s.dividerLine} />}
    </View>
  );
}

export default function ProfileDrawer({ visible, onClose, user, onLogout, onNavigate, onAvatarUpdate }) {
  const insets     = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const [rendered, setRendered]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || null);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.parallel([
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, { toValue: -DRAWER_WIDTH, duration: 260, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]).start(() => setRendered(false));
    }
  }, [visible]);

  async function handlePickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    setUploading(true);
    try {
      const asset = result.assets[0];
      const formData = new FormData();
      if (asset.uri.startsWith('data:') || asset.uri.startsWith('blob:') || asset.uri.startsWith('http')) {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        formData.append('avatar', blob, 'avatar.jpg');
      } else {
        formData.append('avatar', { uri: asset.uri, type: 'image/jpeg', name: 'avatar.jpg' });
      }
      const { data } = await api.post('/users/me/avatar', formData);
      setAvatarUrl(data.avatarUrl);
      if (onAvatarUpdate) onAvatarUpdate(data.user);
      Alert.alert('✅', 'Foto de perfil actualizada');
    } catch (err) {
      Alert.alert('Error', 'No se pudo subir la imagen');
    } finally {
      setUploading(false);
    }
  }

  if (!rendered) return null;

  const daysSince = Math.floor((Date.now() - new Date(user?.createdAt)) / 86400000);

  return (
    <View style={s.root}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[s.overlay, { opacity }]} />
      </TouchableWithoutFeedback>

      <Animated.View style={[s.drawer, { transform: [{ translateX }] }]}>
        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

          {/* ── Perfil ── */}
          <View style={[s.header, { paddingTop: insets.top + 32 }]}>
            <TouchableOpacity
              onPress={() => { onClose(); onNavigate('Profile'); }}
              style={s.avatarWrap}
              activeOpacity={0.85}
            >
              <AvatarWithFrame
                size={68}
                avatarUrl={avatarUrl}
                username={user?.username}
                profileFrame={user?.profileFrame}
                frameUrl={user?.profileFrameUrl}
                bgColor={colors.surface}
              />
              <View style={s.cameraBtn}>
                <Ionicons name={uploading ? 'time-outline' : 'camera-outline'} size={13} color={colors.textMid} />
              </View>
            </TouchableOpacity>

            <Text style={s.username}>{user?.username}</Text>
            <Text style={s.email}>{user?.email}</Text>

            {/* Píldoras stats */}
            <View style={s.pillRow}>
              <View style={s.pill}>
                <Ionicons name="flash-outline" size={11} color={colors.c1} />
                <Text style={s.pillTxt}>{user?.xp || 0} XP</Text>
              </View>
              <View style={s.pillDot} />
              <View style={s.pill}>
                <Ionicons name="calendar-outline" size={11} color={colors.textDim} />
                <Text style={s.pillTxt}>{daysSince}d</Text>
              </View>
              <View style={s.pillDot} />
              <View style={s.pill}>
                <CoinIcon size={11} />
                <Text style={[s.pillTxt, { color: 'rgba(251,191,36,1)' }]}>{user?.coins ?? 50}</Text>
              </View>
            </View>
          </View>

          {/* ── Sección principal ── */}
          <View style={s.section}>
            <SectionDivider label="COMUNIDAD" />
            <MenuItem
              icon="albums-outline"
              label="Mi Colección"
              color={colors.c5}
              onPress={() => { onClose(); onNavigate('Collection'); }}
            />
            <MenuItem
              icon="storefront-outline"
              label="Mi Tienda"
              color={colors.c1}
              onPress={() => { onClose(); onNavigate('Store', { username: user?.username }); }}
            />
            <MenuItem
              icon="trophy-outline"
              label="Top Semanal"
              color={colors.c4}
              onPress={() => { onClose(); onNavigate('Top'); }}
            />
          </View>

          {/* ── Sección finanzas ── */}
          <View style={s.section}>
            <SectionDivider label="FINANZAS" />
            <MenuItem
              icon="gift-outline"
              label="Regalos Recibidos"
              color={colors.c3}
              onPress={() => { onClose(); onNavigate('GiftsReceived'); }}
            />
            <MenuItem
              icon="receipt-outline"
              label="Historial de Coins"
              color="rgba(251,191,36,1)"
              onPress={() => { onClose(); onNavigate('Transactions'); }}
            />
          </View>

          {/* ── Sección cuenta ── */}
          <View style={s.section}>
            <SectionDivider label="CUENTA" />
            <MenuItem
              icon="settings-outline"
              label="Ajustes"
              color={colors.textMid}
              onPress={() => { onClose(); onNavigate('Settings'); }}
            />
          </View>

          {/* ── Cerrar sesión ── */}
          <View style={s.logoutWrap}>
            <SectionDivider />
            <TouchableOpacity style={s.logoutBtn} onPress={onLogout} activeOpacity={0.8}>
              <View style={s.logoutIconBox}>
                <Ionicons name="log-out-outline" size={19} color="#ef4444" />
              </View>
              <Text style={s.logoutTxt}>Cerrar sesión</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: insets.bottom + 24 }} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.65)' },
  drawer: {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    width: DRAWER_WIDTH, backgroundColor: colors.deep,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, elevation: 20,
  },

  // Header / perfil
  header: {
    paddingHorizontal: 20, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    marginBottom: 8,
  },
  avatarWrap: { position: 'relative', alignSelf: 'flex-start', marginBottom: 14 },
  cameraBtn: {
    position: 'absolute', bottom: 0, right: -4,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderC,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
  },
  username: { color: colors.textHi, fontSize: 17, fontWeight: '700', marginBottom: 2 },
  email:    { color: colors.textDim, fontSize: 11, marginBottom: 14 },

  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  pill:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: colors.border },
  pillTxt: { color: colors.textMid, fontSize: 11, fontWeight: '600' },
  pillCoin:{ color: 'rgba(251,191,36,1)', fontSize: 11, fontWeight: '800' },
  pillDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.border },

  // Secciones
  section: { marginBottom: 4 },

  dividerWrap:  { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
  dividerLabel: { fontSize: 9, letterSpacing: 2.5, color: colors.textDim, fontWeight: '700' },
  dividerLine:  { height: 1, backgroundColor: colors.border, marginTop: 4 },

  // Ítems de menú
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  iconBox: {
    width: 38, height: 38, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  menuLabel: { flex: 1, color: colors.textHi, fontSize: 14, fontWeight: '500' },
  badge:     { backgroundColor: colors.c3, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeTxt:  { color: '#fff', fontSize: 10, fontWeight: '800' },

  // Logout
  logoutWrap: { marginTop: 4 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  logoutIconBox: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoutTxt: { color: '#ef4444', fontSize: 14, fontWeight: '600' },
});
