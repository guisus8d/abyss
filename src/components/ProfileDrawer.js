import React, { useEffect, useRef, useState } from 'react';
import { Image } from 'react-native';
import {
  View, Text, Animated, TouchableOpacity, TouchableWithoutFeedback,
  StyleSheet, Dimensions, ScrollView, Alert,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../theme/colors';
import api from '../services/api';
import AvatarWithFrame from './AvatarWithFrame';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(width * 0.62, 320);

export default function ProfileDrawer({ visible, onClose, user, onLogout, onNavigate, onAvatarUpdate }) {
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

          <View style={s.drawerHeader}>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Text style={s.closeTxt}>✕</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { onClose(); onNavigate('Profile'); }} style={s.avatarArea}>
              <AvatarWithFrame
                size={64}
                avatarUrl={avatarUrl}
                username={user?.username}
                profileFrame={user?.profileFrame}
                frameUrl={user?.profileFrameUrl}
                bgColor={colors.surface}
              />
              <View style={s.photoBtn}>
                <Ionicons name={uploading ? 'time-outline' : 'camera'} size={12} color={colors.textMid} />
              </View>
            </TouchableOpacity>

            <Text style={s.drawerUsername}>{user?.username}</Text>
            <Text style={s.drawerEmail}>{user?.email}</Text>
          </View>

          <View style={s.statsRow}>
            <View style={s.stat}>
              <Text style={s.statVal}>{user?.xp || 0}</Text>
              <Text style={s.statLbl}>XP</Text>
            </View>
            <View style={s.statDiv} />
            <View style={s.stat}>
              <Text style={s.statVal}>{daysSince}</Text>
              <Text style={s.statLbl}>DÍAS</Text>
            </View>
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>MONEDAS</Text>
            <View style={s.coinsRow}>
              <View style={s.coinIcon}><Text style={s.coinEmoji}>✦</Text></View>
              <Text style={s.coinsAmt}>{user?.coins ?? 50}</Text>
            </View>
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>MENÚ</Text>
            <TouchableOpacity style={s.menuItem} onPress={() => { onClose(); onNavigate('Collection'); }}>
              <Ionicons name='albums-outline' size={18} color={colors.textMid} style={s.menuIconV} />
              <Text style={s.menuTxt}>Mi Colección</Text>
              <Ionicons name='chevron-forward' size={16} color={colors.textDim} />
            </TouchableOpacity>
            <TouchableOpacity style={s.menuItem} onPress={() => { onClose(); onNavigate('Top'); }}>
              <Ionicons name='trophy-outline' size={18} color={colors.textMid} style={s.menuIconV} />
              <Text style={s.menuTxt}>Top Semanal</Text>
              <Ionicons name='chevron-forward' size={16} color={colors.textDim} />
            </TouchableOpacity>
            <TouchableOpacity style={s.menuItem} onPress={() => { onClose(); onNavigate('Chats'); }}>
              <Ionicons name='create-outline' size={18} color={colors.textMid} style={s.menuIconV} />
              <Text style={s.menuTxt}>Crear</Text>
              <Ionicons name='chevron-forward' size={16} color={colors.textDim} />
            </TouchableOpacity>
            <TouchableOpacity style={s.menuItem} onPress={() => { onClose(); onNavigate('Settings'); }}>
              <Ionicons name='settings-outline' size={18} color={colors.textMid} style={s.menuIconV} />
              <Text style={s.menuTxt}>Ajustes</Text>
              <Ionicons name='chevron-forward' size={16} color={colors.textDim} />
            </TouchableOpacity>
          </View>

          {(user?.role === 'mod' || user?.role === 'admin') && (
            <TouchableOpacity style={s.modPanelBtn} onPress={() => { onClose(); onNavigate('ModPanel'); }}>
              <Ionicons name='shield-checkmark-outline' size={16} color='rgba(251,191,36,1)' />
              <Text style={s.modPanelTxt}>Panel de Moderación</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={s.logoutBtn} onPress={onLogout}>
            <Text style={s.logoutTxt}>Cerrar sesión</Text>
          </TouchableOpacity>

          <View style={{ height: 30 }} />
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
  },
  drawerHeader: { paddingHorizontal: 18, paddingTop: 40, paddingBottom: 18, alignItems: 'center', backgroundColor: colors.deep },
  closeBtn:     { position: 'absolute', top: 40, right: 12, padding: 6 },
  closeTxt:     { color: colors.textDim, fontSize: 14 },
  avatarArea:   { position: 'relative', marginBottom: 10 },
  photoBtn: {
    position: 'absolute', bottom: 0, right: -2,
    backgroundColor: colors.deep, borderRadius: 10,
    borderWidth: 1, borderColor: colors.borderC,
    width: 22, height: 22, alignItems: 'center', justifyContent: 'center',
  },
  drawerUsername: { color: colors.textHi, fontSize: 16, fontWeight: '700', marginBottom: 1 },
  drawerEmail:    { color: colors.textDim, fontSize: 10, marginBottom: 12 },
  coinsRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, marginBottom: 4 },
  coinIcon:  { width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(251,191,36,0.2)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.5)', alignItems: 'center', justifyContent: 'center' },
  coinEmoji: { fontSize: 9, color: 'rgba(251,191,36,1)' },
  coinsAmt:  { color: 'rgba(251,191,36,1)', fontWeight: '800', fontSize: 13 },
  statsRow: {
    flexDirection: 'row', marginHorizontal: 12, marginVertical: 10,
    backgroundColor: colors.card,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 10,
  },
  stat:    { flex: 1, alignItems: 'center' },
  statVal: { color: colors.textHi, fontSize: 16, fontWeight: '700' },
  statLbl: { color: colors.textDim, fontSize: 7, letterSpacing: 2, marginTop: 2 },
  statDiv: { width: 1, backgroundColor: colors.border },
  section:      { marginHorizontal: 12, marginBottom: 14 },
  sectionTitle: { fontSize: 8, letterSpacing: 3, color: colors.textDim, marginBottom: 8 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10,
  },
  menuIconV: { width: 22 },
  menuTxt:   { flex: 1, color: colors.textMid, fontSize: 13 },
  logoutBtn: {
    marginHorizontal: 12, marginTop: 4, padding: 12, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', alignItems: 'center',
  },
  logoutTxt: { color: 'rgba(239,68,68,0.8)', fontSize: 12, letterSpacing: 1 },
  modPanelBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginBottom: 10, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)', backgroundColor: 'rgba(251,191,36,0.07)' },
  modPanelTxt: { color: 'rgba(251,191,36,1)', fontSize: 12, fontWeight: '700' },
});
