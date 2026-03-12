import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, StatusBar, SafeAreaView, ActivityIndicator,
  Animated, Alert, Modal, TextInput, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import AvatarWithFrame from '../components/AvatarWithFrame';

const W         = Dimensions.get('window').width;
const POST_TILE = (W - 32 - 4) / 3;

const TABS = [
  { key: 'profile',  icon: 'person-outline'   },
  { key: 'posts',    icon: 'grid-outline'      },
  { key: 'badges',   icon: 'ribbon-outline'    },
  { key: 'settings', icon: 'settings-outline'  },
];

export default function ProfileScreen({ navigation }) {
  const { user, logout, updateUser } = useAuthStore();
  const [profile, setProfile]       = useState(null);
  const [posts, setPosts]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [uploading, setUploading]   = useState(false);
  const [tab, setTab]               = useState('profile');
  const [frameModal, setFrameModal] = useState(false);
  const [equipping, setEquipping]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [editMode, setEditMode]     = useState(false);
  const [editBio, setEditBio]       = useState('');

  const tabIndicator = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Promise.all([
      api.get('/users/me'),
      api.get('/posts/user/me').catch(() => ({ data: { posts: [] } })),
    ]).then(([profileRes, postsRes]) => {
      const u = profileRes.data.user;
      setProfile(u);
      setEditBio(u.bio || '');
      setPosts(postsRes.data.posts || []);
    }).finally(() => setLoading(false));
  }, []);

  function switchTab(key) {
    const idx = TABS.findIndex(t => t.key === key);
    Animated.spring(tabIndicator, { toValue: idx, friction: 8, useNativeDriver: true }).start();
    setTab(key);
    setEditMode(false);
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
    } catch {
      Alert.alert('Error', 'No se pudo subir la imagen');
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveBio() {
    setSaving(true);
    try {
      const { data } = await api.patch('/users/me/profile', { bio: editBio });
      setProfile(data.user);
      if (updateUser) updateUser(data.user);
      setEditMode(false);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleEquipFrame() {
    const xp = profile?.xp || 0;
    if (xp < 10) {
      Alert.alert('XP insuficiente', `Necesitas 10 XP.\nTienes ${xp} XP.`);
      return;
    }
    setEquipping(true);
    try {
      const newFrame = profile?.profileFrame === 'frame_001' ? 'default' : 'frame_001';
      const { data } = await api.patch('/users/me/profile', { profileFrame: newFrame });
      setProfile(data.user);
      if (updateUser) updateUser(data.user);
      setFrameModal(false);
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el marco');
    } finally {
      setEquipping(false);
    }
  }

  if (loading) return (
    <View style={s.root}><ActivityIndicator color={colors.c1} style={{ marginTop: 80 }} /></View>
  );

  const xpProgress = Math.min((profile?.xp || 0) % 100, 100);
  const hasFrame   = profile?.profileFrame === 'frame_001';
  const canUnlock  = (profile?.xp || 0) >= 10;
  const TAB_W      = (W - 32) / TABS.length;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.black} />
      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.c1} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>PERFIL</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <LinearGradient colors={['rgba(0,110,100,0.2)','rgba(2,5,9,1)']} style={s.hero}>
          <TouchableOpacity onPress={handlePickAvatar} disabled={uploading} style={s.avatarWrap}>
            <AvatarWithFrame
              size={88}
              avatarUrl={profile?.avatarUrl}
              username={profile?.username}
              profileFrame={profile?.profileFrame}
              bgColor="rgba(0,229,204,0.12)"
            />
            <View style={s.cameraBtn}>
              {uploading
                ? <ActivityIndicator size="small" color={colors.c1} />
                : <Ionicons name="camera" size={13} color={colors.c1} />}
            </View>
          </TouchableOpacity>

          <Text style={s.username}>{profile?.username}</Text>

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
        </LinearGradient>

        {/* Stats */}
        <View style={s.statsRow}>
          <TouchableOpacity style={s.stat} onPress={() => navigation.navigate('FollowList', { username: profile?.username, type: 'following' })}>
            <Text style={s.statVal}>{profile?.following?.length || 0}</Text>
            <Text style={s.statLbl}>SIGUIENDO</Text>
          </TouchableOpacity>
          <View style={s.statDiv} />
          <View style={s.stat}>
            <Text style={[s.statVal, { color: colors.c1 }]}>{posts.length}</Text>
            <Text style={s.statLbl}>POSTS</Text>
          </View>
          <View style={s.statDiv} />
          <TouchableOpacity style={s.stat} onPress={() => navigation.navigate('FollowList', { username: profile?.username, type: 'followers' })}>
            <Text style={s.statVal}>{profile?.followers?.length || 0}</Text>
            <Text style={s.statLbl}>SEGUIDORES</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={[s.tabBar, { marginHorizontal: 16 }]}>
          {TABS.map((t, i) => (
            <TouchableOpacity key={t.key} style={[s.tabBtn, { width: TAB_W }]} onPress={() => switchTab(t.key)}>
              <Ionicons name={t.icon} size={20} color={tab === t.key ? colors.c1 : colors.textDim} />
            </TouchableOpacity>
          ))}
          <Animated.View style={[s.tabIndicator, {
            width: TAB_W,
            transform: [{ translateX: tabIndicator.interpolate({
              inputRange: [0,1,2,3],
              outputRange: [0, TAB_W, TAB_W*2, TAB_W*3],
            })}],
          }]} />
        </View>

        {/* Tab: Perfil */}
        {tab === 'profile' && (
          <View style={s.padded}>
            <View style={s.bioCard}>
              {/* Bio contenido */}
              {!editMode ? (
                <>
                  <Text style={s.bioCardLabel}>BIO</Text>
                  <Text style={s.bioText}>
                    {profile?.bio || <Text style={{ color: colors.textDim, fontStyle: 'italic' }}>Sin bio todavía...</Text>}
                  </Text>
                  {/* Botón lápiz */}
                  <TouchableOpacity style={s.editFab} onPress={() => setEditMode(true)}>
                    <Ionicons name="pencil" size={16} color={colors.black} />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={s.bioCardLabel}>EDITANDO BIO</Text>
                  <TextInput
                    style={s.bioInput}
                    value={editBio}
                    onChangeText={setEditBio}
                    placeholder="Cuéntale algo al mundo..."
                    placeholderTextColor={colors.textDim}
                    multiline
                    maxLength={160}
                    autoFocus
                  />
                  <Text style={s.charCount}>{editBio.length}/160</Text>
                  <View style={s.editActions}>
                    <TouchableOpacity style={s.cancelBtn} onPress={() => { setEditBio(profile?.bio || ''); setEditMode(false); }}>
                      <Text style={s.cancelBtnTxt}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.saveBtn} onPress={handleSaveBio} disabled={saving}>
                      <LinearGradient colors={['#006b63','#00e5cc']} style={s.saveBtnGrad} start={{x:0,y:0}} end={{x:1,y:0}}>
                        <Text style={s.saveBtnTxt}>{saving ? 'Guardando...' : 'Guardar'}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        )}

        {/* Tab: Posts */}
        {tab === 'posts' && (
          <View style={s.postsGrid}>
            {posts.length === 0 ? (
              <View style={s.emptyTab}>
                <Ionicons name="document-text-outline" size={40} color={colors.textDim} />
                <Text style={s.emptyTxt}>Aún no has publicado nada</Text>
              </View>
            ) : posts.map(p => (
              <TouchableOpacity
                key={p._id}
                style={[s.postTile, { width: POST_TILE, height: POST_TILE }]}
                onPress={() => navigation.navigate('PostDetail', { postId: p._id })}
              >
                {p.imageUrl ? (
                  <Image source={{ uri: p.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : (
                  <Text style={s.postTileTxt} numberOfLines={4}>{p.content}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Tab: Badges */}
        {tab === 'badges' && (
          <View style={s.padded}>
            {profile?.badges?.length === 0 ? (
              <View style={s.emptyTab}>
                <Ionicons name="ribbon-outline" size={40} color={colors.textDim} />
                <Text style={s.emptyTxt}>Aún no tienes emblemas</Text>
                <Text style={s.emptyHint}>Publica, interactúa y sube de XP</Text>
              </View>
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
        )}

        {/* Tab: Ajustes */}
        {tab === 'settings' && (
          <View style={s.padded}>
            <View style={s.settingsGroup}>
              <Text style={s.settingsGroupLabel}>CUENTA</Text>
              <TouchableOpacity style={s.settingsRow} onPress={handlePickAvatar}>
                <Ionicons name="camera-outline" size={20} color={colors.textMid} />
                <Text style={s.settingsRowTxt}>Cambiar foto de perfil</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
              </TouchableOpacity>
              <TouchableOpacity style={s.settingsRow} onPress={() => setFrameModal(true)}>
                <Ionicons name="sparkles-outline" size={20} color={colors.textMid} />
                <Text style={s.settingsRowTxt}>Marco de perfil</Text>
                <View style={[s.frameStatus, hasFrame && s.frameStatusOn]}>
                  <Text style={{ color: hasFrame ? colors.c1 : colors.textDim, fontSize: 10 }}>
                    {hasFrame ? 'Activo' : 'Inactivo'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
              </TouchableOpacity>
              <TouchableOpacity style={s.settingsRow} onPress={() => navigation.navigate('Top')}>
                <Ionicons name="trophy-outline" size={20} color={colors.textMid} />
                <Text style={s.settingsRowTxt}>Top Semanal</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
              </TouchableOpacity>
            </View>

            <View style={[s.settingsGroup, { marginTop: 20 }]}>
              <Text style={s.settingsGroupLabel}>SESIÓN</Text>
              <TouchableOpacity style={s.settingsRow} onPress={logout}>
                <Ionicons name="log-out-outline" size={20} color="rgba(239,68,68,0.8)" />
                <Text style={[s.settingsRowTxt, { color: 'rgba(239,68,68,0.8)' }]}>Cerrar sesión</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Modal Marco */}
      <Modal visible={frameModal} transparent animationType="fade" onRequestClose={() => setFrameModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>MARCOS DE PERFIL</Text>
            <View style={{ marginBottom: 20 }}>
              <AvatarWithFrame
                size={90}
                avatarUrl={profile?.avatarUrl}
                username={profile?.username}
                profileFrame="frame_001"
              />
            </View>
            <Text style={s.frameName}>Marco Estelar</Text>
            <Text style={s.frameDesc}>
              {canUnlock
                ? (hasFrame ? 'Marco equipado actualmente.' : 'Desbloqueado. Tienes suficiente XP.')
                : `Requiere 10 XP — tienes ${profile?.xp || 0}`}
            </Text>
            <TouchableOpacity
              style={[s.equipBtn, !canUnlock && s.equipBtnLocked]}
              onPress={handleEquipFrame}
              disabled={equipping || !canUnlock}
            >
              <Text style={s.equipBtnTxt}>
                {equipping ? 'Guardando...' : hasFrame ? 'Quitar marco' : canUnlock ? 'Equipar marco' : 'Bloqueado'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setFrameModal(false)}>
              <Text style={s.closeBtnTxt}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.black },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn:     { width: 40 },
  headerTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 6, color: colors.c1 },

  hero:       { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 24 },
  avatarWrap: { position: 'relative', marginBottom: 14 },
  cameraBtn:  { position: 'absolute', bottom: 2, right: 2, backgroundColor: colors.deep, borderRadius: 12, borderWidth: 1, borderColor: colors.borderC, width: 26, height: 26, alignItems: 'center', justifyContent: 'center', zIndex: 20 },
  username:   { color: colors.textHi, fontSize: 22, fontWeight: '700', marginBottom: 16 },
  xpRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' },
  xpLabel:    { color: colors.textDim, fontSize: 10, letterSpacing: 2, width: 24 },
  xpBarBg:    { flex: 1, height: 5, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' },
  xpBarFill:  { height: '100%', borderRadius: 3, minWidth: 4 },
  xpVal:      { color: colors.c1, fontSize: 12, fontWeight: '700', width: 36, textAlign: 'right' },

  statsRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 18 },
  stat:     { flex: 1, alignItems: 'center' },
  statVal:  { color: colors.textHi, fontSize: 20, fontWeight: '700' },
  statLbl:  { color: colors.textDim, fontSize: 8, letterSpacing: 2, marginTop: 3 },
  statDiv:  { width: 1, backgroundColor: colors.border },

  tabBar:       { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 16, overflow: 'hidden', position: 'relative' },
  tabBtn:       { alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  tabIndicator: { position: 'absolute', bottom: 0, height: 2, backgroundColor: colors.c1, borderRadius: 1 },

  padded: { paddingHorizontal: 16 },

  bioCard: {
    backgroundColor: colors.card, borderRadius: 16, borderWidth: 1,
    borderColor: colors.border, padding: 20, position: 'relative', minHeight: 120,
  },
  bioCardLabel: { color: colors.textDim, fontSize: 9, letterSpacing: 3, marginBottom: 12 },
  bioText:      { color: colors.textHi, fontSize: 14, lineHeight: 22 },
  editFab: {
    position: 'absolute', bottom: 14, right: 14,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.c1,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.c1, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4,
  },
  bioInput:    { color: colors.textHi, fontSize: 14, lineHeight: 22, minHeight: 80, textAlignVertical: 'top' },
  charCount:   { color: colors.textDim, fontSize: 10, textAlign: 'right', marginTop: 6 },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  cancelBtn:   { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingVertical: 10, alignItems: 'center' },
  cancelBtnTxt:{ color: colors.textDim, fontSize: 13 },
  saveBtn:     { flex: 1, borderRadius: 10, overflow: 'hidden' },
  saveBtnGrad: { paddingVertical: 11, alignItems: 'center' },
  saveBtnTxt:  { color: '#001a18', fontWeight: '800', fontSize: 13 },

  postsGrid:   { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 2 },
  postTile:    { backgroundColor: colors.card, borderRadius: 6, overflow: 'hidden', justifyContent: 'center', padding: 6 },
  postTileTxt: { color: colors.textDim, fontSize: 10, lineHeight: 14 },

  emptyTab:  { alignItems: 'center', paddingVertical: 48, gap: 12, width: '100%' },
  emptyTxt:  { color: colors.textDim, fontSize: 14 },
  emptyHint: { color: colors.textDim, fontSize: 11, opacity: 0.6 },

  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeCard:  { alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.borderC, padding: 14, width: (W - 52) / 3 },
  badgeIcon:  { fontSize: 28, marginBottom: 6 },
  badgeName:  { color: colors.c1, fontSize: 9, letterSpacing: 1, textAlign: 'center' },
  badgeDesc:  { color: colors.textDim, fontSize: 9, textAlign: 'center', marginTop: 2 },

  settingsGroup:      { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  settingsGroupLabel: { color: colors.textDim, fontSize: 9, letterSpacing: 3, padding: 14, paddingBottom: 8 },
  settingsRow:        { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
  settingsRowTxt:     { flex: 1, color: colors.textMid, fontSize: 14 },
  frameStatus:        { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: colors.border },
  frameStatusOn:      { borderColor: colors.c1, backgroundColor: 'rgba(0,229,204,0.08)' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
  modalBox:     { backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.borderC, padding: 28, width: '82%', alignItems: 'center' },
  modalTitle:   { fontSize: 12, letterSpacing: 4, color: colors.c1, fontWeight: '800', marginBottom: 24 },
  frameName:    { color: colors.textHi, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  frameDesc:    { color: colors.textDim, fontSize: 12, textAlign: 'center', marginBottom: 24 },
  equipBtn:     { backgroundColor: colors.c1, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 36, marginBottom: 12, width: '100%', alignItems: 'center' },
  equipBtnLocked: { backgroundColor: 'rgba(255,255,255,0.08)' },
  equipBtnTxt:  { color: colors.black, fontWeight: '800', fontSize: 14 },
  closeBtnTxt:  { color: colors.textDim, fontSize: 13, paddingVertical: 10 },
});
