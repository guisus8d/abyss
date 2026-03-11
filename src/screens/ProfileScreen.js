import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, StatusBar, SafeAreaView, ActivityIndicator,
  Animated, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

export default function ProfileScreen({ navigation }) {
  const { user, logout, updateUser } = useAuthStore();
  const [profile, setProfile]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [uploading, setUploading]   = useState(false);
  const [menuOpen, setMenuOpen]     = useState(false);
  const menuAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    api.get('/users/me')
      .then(({ data }) => setProfile(data.user))
      .finally(() => setLoading(false));
  }, []);

  function toggleMenu() {
    if (menuOpen) {
      Animated.timing(menuAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setMenuOpen(false));
    } else {
      setMenuOpen(true);
      Animated.timing(menuAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    }
  }

  async function handlePickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1,1], quality: 0.8,
    });
    if (result.canceled) return;
    setUploading(true);
    try {
      const asset = result.assets[0];
      const formData = new FormData();
      if (asset.uri.startsWith('blob:') || asset.uri.startsWith('data:') || asset.uri.startsWith('http')) {
        const res  = await fetch(asset.uri);
        const blob = await res.blob();
        formData.append('avatar', blob, 'avatar.jpg');
      } else {
        formData.append('avatar', { uri: asset.uri, type: 'image/jpeg', name: 'avatar.jpg' });
      }
      const { data } = await api.post('/users/me/avatar', formData);
      setProfile(prev => ({ ...prev, avatarUrl: data.avatarUrl }));
      if (updateUser) updateUser(data.user);
      toggleMenu();
    } catch {
      Alert.alert('Error', 'No se pudo subir la imagen');
    } finally {
      setUploading(false);
    }
  }

  if (loading) return (
    <View style={s.root}>
      <ActivityIndicator color={colors.c1} style={{ marginTop: 80 }} />
    </View>
  );

  const xpProgress = Math.min((profile?.xp || 0) % 100, 100);
  const daysSince  = Math.floor((Date.now() - new Date(profile?.createdAt)) / 86400000);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.black} />
      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.back}>←</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>PERFIL</Text>
          <TouchableOpacity onPress={toggleMenu} style={s.settingsBtn}>
            <Ionicons name='ellipsis-horizontal' size={22} color={colors.textHi} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Menú desplegable ajustes */}
      {menuOpen && (
        <Animated.View style={[s.dropMenu, {
          opacity: menuAnim,
          transform: [{ translateY: menuAnim.interpolate({ inputRange: [0,1], outputRange: [-10, 0] }) }]
        }]}>
          <TouchableOpacity style={s.dropItem} onPress={handlePickAvatar} disabled={uploading}>
            <Ionicons name='camera-outline' size={16} color={colors.textMid} />
            <Text style={s.dropTxt}>{uploading ? 'Subiendo...' : 'Cambiar foto'}</Text>
          </TouchableOpacity>
          <View style={s.dropDivider} />
          <TouchableOpacity style={s.dropItem} onPress={() => { toggleMenu(); }}>
            <Ionicons name='settings-outline' size={16} color={colors.textMid} />
            <Text style={s.dropTxt}>Ajustes</Text>
          </TouchableOpacity>
          <View style={s.dropDivider} />
          <TouchableOpacity style={s.dropItem} onPress={logout}>
            <Ionicons name='log-out-outline' size={16} color='rgba(239,68,68,0.8)' />
            <Text style={[s.dropTxt, { color: 'rgba(239,68,68,0.8)' }]}>Cerrar sesión</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Overlay para cerrar menú */}
      {menuOpen && (
        <TouchableOpacity style={s.menuOverlay} onPress={toggleMenu} activeOpacity={1} />
      )}

      <ScrollView>
        <View style={s.heroBox}>
          {/* Avatar clickeable */}
          <TouchableOpacity onPress={handlePickAvatar} disabled={uploading} style={s.avatarArea}>
            <LinearGradient colors={['#00e5cc','#2979ff']} style={s.avatarRing}>
              <View style={s.avatar}>
                {profile?.avatarUrl ? (
                  <Image source={{ uri: profile.avatarUrl }} style={s.avatarImg} />
                ) : (
                  <Text style={s.avatarTxt}>{profile?.username?.[0]?.toUpperCase()}</Text>
                )}
              </View>
            </LinearGradient>
            <View style={s.photoBtn}>
              <Text style={s.photoBtnTxt}>{uploading ? '⏳' : '📷'}</Text>
            </View>
          </TouchableOpacity>

          <Text style={s.username}>{profile?.username}</Text>
          <Text style={s.email}>{profile?.email}</Text>

          <View style={s.xpRow}>
            <Text style={s.xpLabel}>XP</Text>
            <View style={s.xpBarBg}>
              <LinearGradient
                colors={['#006b63','#00e5cc']}
                style={[s.xpBarFill, { width: `${xpProgress}%` }]}
                start={{x:0,y:0}} end={{x:1,y:0}}
              />
            </View>
            <Text style={s.xpVal}>{profile?.xp}</Text>
          </View>
        </View>

        <View style={s.statsRow}>
          <TouchableOpacity style={s.stat} onPress={() => navigation.navigate('FollowList', { username: profile?.username, type: 'following' })}>
            <Text style={s.statVal}>{profile?.following?.length || 0}</Text>
            <Text style={s.statLbl}>SIGUIENDO</Text>
          </TouchableOpacity>
          <View style={s.statDivider} />
          <View style={s.stat}>
            <Text style={[s.statVal, { color: colors.c1 }]}>{profile?.xp || 0}</Text>
            <Text style={s.statLbl}>XP</Text>
          </View>
          <View style={s.statDivider} />
          <TouchableOpacity style={s.stat} onPress={() => navigation.navigate('FollowList', { username: profile?.username, type: 'followers' })}>
            <Text style={s.statVal}>{profile?.followers?.length || 0}</Text>
            <Text style={s.statLbl}>SEGUIDORES</Text>
          </TouchableOpacity>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>EMBLEMAS</Text>
          {profile?.badges?.length === 0 ? (
            <Text style={s.emptyTxt}>Aún no tienes emblemas. ¡Publica algo!</Text>
          ) : (
            <View style={s.badgesGrid}>
              {profile?.badges?.map((b, i) => (
                <View key={i} style={s.badgeCard}>
                  <Text style={s.badgeIcon}>{b.icon}</Text>
                  <Text style={s.badgeName}>{b.name}</Text>
                  <Text style={s.badgeDesc}>{b.description}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn:     { padding: 4, width: 40 },
  back:        { color: colors.c1, fontSize: 22 },
  headerTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 6, color: colors.c1 },
  settingsBtn: { width: 40, alignItems: 'flex-end' },
  settingsTxt: { fontSize: 20 },

  // Dropdown menu
  dropMenu: {
    position: 'absolute', top: 60, right: 16, zIndex: 999,
    backgroundColor: colors.surface,
    borderRadius: 14, borderWidth: 1, borderColor: colors.borderC,
    minWidth: 180, overflow: 'hidden',
    shadowColor: colors.c1, shadowOpacity: 0.15, shadowRadius: 12, elevation: 10,
  },
  dropItem:    { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  dropIcon:    { fontSize: 16 },
  dropTxt:     { color: colors.textMid, fontSize: 14 },
  dropDivider: { height: 1, backgroundColor: colors.border },
  menuOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 },

  heroBox:    { alignItems: 'center', padding: 32 },
  avatarArea: { position: 'relative', marginBottom: 16 },
  avatarRing: { padding: 3, borderRadius: 55 },
  avatar: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.black, overflow: 'hidden',
  },
  avatarImg:   { width: 90, height: 90, borderRadius: 45 },
  avatarTxt:   { color: colors.c1, fontSize: 36, fontWeight: 'bold' },
  photoBtn: {
    position: 'absolute', bottom: 0, right: -2,
    backgroundColor: colors.deep, borderRadius: 12,
    borderWidth: 1, borderColor: colors.borderC,
    width: 26, height: 26, alignItems: 'center', justifyContent: 'center',
  },
  photoBtnTxt: { fontSize: 13 },

  username:  { color: colors.textHi, fontSize: 22, fontWeight: '700', marginBottom: 4 },
  email:     { color: colors.textDim, fontSize: 12, marginBottom: 20 },

  xpRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' },
  xpLabel:  { color: colors.textDim, fontSize: 10, letterSpacing: 2, width: 24 },
  xpBarBg:  { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' },
  xpBarFill:{ height: '100%', borderRadius: 3, minWidth: 4 },
  xpVal:    { color: colors.c1, fontSize: 12, fontWeight: '700', width: 36, textAlign: 'right' },

  statsRow: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 24,
    backgroundColor: colors.card, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, padding: 20,
  },
  stat:        { flex: 1, alignItems: 'center' },
  statVal:     { color: colors.textHi, fontSize: 22, fontWeight: '700' },
  statLbl:     { color: colors.textDim, fontSize: 9, letterSpacing: 2, marginTop: 4 },
  statDivider: { width: 1, backgroundColor: colors.border },

  section:      { marginHorizontal: 16 },
  sectionTitle: { fontSize: 10, letterSpacing: 3, color: colors.textDim, marginBottom: 16 },
  emptyTxt:     { color: colors.textDim, fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  badgesGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,229,204,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 6, borderWidth: 1, borderColor: colors.borderC },
  badgeCard: { alignItems: 'center', width: 70 },
  badgeIcon: { fontSize: 32, marginBottom: 8 },
  badgeName: { color: colors.textMid, fontSize: 9, textAlign: 'center', letterSpacing: 1 },
  badgeDesc: { color: colors.textDim, fontSize: 10, textAlign: 'center' },
});
