import React, { useEffect, useRef, useState } from 'react';
import { Image } from 'react-native';
import {
  View, Text, Animated, TouchableOpacity, TouchableWithoutFeedback,
  StyleSheet, Dimensions, ScrollView, Alert,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
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

  const daysSince  = Math.floor((Date.now() - new Date(user?.createdAt)) / 86400000);
  const xpProgress = Math.min((user?.xp || 0) % 100, 100);

  return (
    <View style={s.root}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[s.overlay, { opacity }]} />
      </TouchableWithoutFeedback>

      <Animated.View style={[s.drawer, { transform: [{ translateX }] }]}>
        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

          <LinearGradient
            colors={['rgba(0,110,100,0.35)', 'rgba(2,5,9,1)']}
            style={s.drawerHeader}
          >
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Text style={s.closeTxt}>✕</Text>
            </TouchableOpacity>

            {/* Avatar con marco */}
            <TouchableOpacity onPress={() => { onClose(); onNavigate('Profile'); }} style={s.avatarArea}>
              <AvatarWithFrame
                size={64}
                avatarUrl={avatarUrl}
                username={user?.username}
                profileFrame={user?.profileFrame}
                bgColor={colors.surface}
              />
              <View style={s.photoBtn}>
                <Ionicons name={uploading ? 'time-outline' : 'camera'} size={12} color={colors.textMid} />
              </View>
            </TouchableOpacity>

            <Text style={s.drawerUsername}>{user?.username}</Text>
            <Text style={s.drawerEmail}>{user?.email}</Text>

            <View style={s.xpRow}>
              <Text style={s.xpLbl}>XP</Text>
              <View style={s.xpBarBg}>
                <LinearGradient
                  colors={['#006b63','#00e5cc']}
                  style={[s.xpBarFill, { width: `${xpProgress}%` }]}
                  start={{x:0,y:0}} end={{x:1,y:0}}
                />
              </View>
              <Text style={s.xpVal}>{user?.xp}</Text>
            </View>
          </LinearGradient>

          <View style={s.statsRow}>
            <View style={s.stat}>
              <Text style={s.statVal}>{user?.xp || 0}</Text>
              <Text style={s.statLbl}>XP</Text>
            </View>
            <View style={s.statDiv} />
            <View style={s.stat}>
              <Text style={s.statVal}>{user?.badges?.length || 0}</Text>
              <Text style={s.statLbl}>BADGES</Text>
            </View>
            <View style={s.statDiv} />
            <View style={s.stat}>
              <Text style={s.statVal}>{daysSince}</Text>
              <Text style={s.statLbl}>DÍAS</Text>
            </View>
          </View>

          {user?.badges?.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>EMBLEMAS</Text>
              <View style={s.badgesRow}>
                {user.badges.map((b, i) => (
                  <View key={i} style={s.badgePill}>
                    <Text style={s.badgeIcon}>{b.icon}</Text>
                    <Text style={s.badgeName}>{b.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={s.section}>
            <Text style={s.sectionTitle}>MENÚ</Text>
            <TouchableOpacity style={s.menuItem}>
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
    borderRightWidth: 1, borderRightColor: colors.borderC,
    shadowColor: colors.c1, shadowOpacity: 0.15, shadowRadius: 20, elevation: 20,
  },
  drawerHeader: { paddingHorizontal: 18, paddingTop: 40, paddingBottom: 18, alignItems: 'center' },
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
  xpRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, width: '100%' },
  xpLbl:    { color: colors.textDim, fontSize: 8, letterSpacing: 2 },
  xpBarBg:  { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' },
  xpBarFill:{ height: '100%', borderRadius: 2, minWidth: 4 },
  xpVal:    { color: colors.c1, fontSize: 10, fontWeight: '700' },
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
  badgesRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badgePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,229,204,0.07)',
    borderWidth: 1, borderColor: colors.borderC,
    borderRadius: 16, paddingHorizontal: 8, paddingVertical: 4,
  },
  badgeIcon: { fontSize: 12 },
  badgeName: { color: colors.c1, fontSize: 10 },
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
});
