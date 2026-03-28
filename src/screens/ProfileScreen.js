import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, StatusBar, ActivityIndicator,
  Animated, Alert, Modal, TextInput, Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import AvatarWithFrame from '../components/AvatarWithFrame';
import PostCard from '../components/PostCard';

const W         = Dimensions.get('window').width;
const POST_TILE = (W - 32 - 4) / 3;

const TABS = [
  { key: 'profile',  icon: 'person-outline'   },
  { key: 'posts',    icon: 'grid-outline'      },
  { key: 'badges',   icon: 'ribbon-outline'    },
  { key: 'settings', icon: 'settings-outline'  },
];

const BG_COLORS = [
  { id: 'none',    value: '',                label: 'Ninguno' },
  { id: 'teal',    value: 'rgba(0,229,204,0.12)',  label: 'Teal' },
  { id: 'purple',  value: 'rgba(147,51,234,0.15)', label: 'Púrpura' },
  { id: 'red',     value: 'rgba(239,68,68,0.12)',  label: 'Rojo' },
  { id: 'blue',    value: 'rgba(41,121,255,0.15)', label: 'Azul' },
  { id: 'orange',  value: 'rgba(249,115,22,0.15)', label: 'Naranja' },
  { id: 'pink',    value: 'rgba(236,72,153,0.15)', label: 'Rosa' },
  { id: 'green',   value: 'rgba(34,197,94,0.12)',  label: 'Verde' },
  { id: 'yellow',  value: 'rgba(234,179,8,0.15)',  label: 'Amarillo' },
  { id: 'white',   value: 'rgba(255,255,255,0.06)',label: 'Blanco' },
];

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, logout, updateUser } = useAuthStore();
  const [profile, setProfile]       = useState(null);
  const [posts, setPosts]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [uploading, setUploading]   = useState(false);
  const [tab, setTab]               = useState('profile');
  const [frameModal, setFrameModal] = useState(false);
  const [bgModal, setBgModal]       = useState(false);
  const [bgTarget, setBgTarget]     = useState('banner');
  const [equipping, setEquipping]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [openPickerId, setOpenPickerId] = useState(null);

  async function handleReact(postId, type) {
    setPosts(prev => prev.map(p => {
      if (p._id !== postId) return p;
      const already = p.reactions.find(r => (r.user?._id||r.user) === user?._id && r.type === type);
      return { ...p, reactions: already
        ? p.reactions.filter(r => !((r.user?._id||r.user) === user?._id && r.type === type))
        : [...p.reactions, { user: user?._id, type }] };
    }));
    try { await api.post(`/posts/${postId}/react`, { type }); } catch {}
  }

  async function handleComment(postId, text, replyTo, updatedComments) {
    if (updatedComments) {
      setPosts(prev => prev.map(p => p._id === postId ? { ...p, comments: updatedComments } : p));
      return;
    }
    try {
      const { data } = await api.post(`/posts/${postId}/comment`, { text, replyTo });
      setPosts(prev => prev.map(p => p._id === postId ? { ...p, comments: data.comments } : p));
    } catch {}
  }

  async function handleDelete(postId) {
    try {
      await api.delete(`/posts/${postId}`);
      setPosts(prev => prev.filter(p => p._id !== postId));
    } catch {}
  }

  const [prefs, setPrefs] = useState({ showXp: true, showFollowers: true, showFollowing: true, showPosts: true });
  const tabIndicator = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Promise.all([
      api.get('/users/me'),
      api.get('/posts/user/me').catch(() => ({ data: { posts: [] } })),
    ]).then(([profileRes, postsRes]) => {
      const u = profileRes.data.user;
      setProfile(u);
      if (u.profilePrefs) setPrefs({ showXp: true, showFollowers: true, showFollowing: true, showPosts: true, ...u.profilePrefs });
      setPosts(postsRes.data.posts || []);
    }).finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => {
    api.get('/users/me').then(r => setProfile(r.data.user)).catch(() => {});
  }, []));

  function switchTab(key) {
    const idx = TABS.findIndex(t => t.key === key);
    Animated.spring(tabIndicator, { toValue: idx, friction: 8, useNativeDriver: true }).start();
    setTab(key);
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
        const blob = await fetch(asset.uri).then(r => r.blob());
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

  async function handlePickBgImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [4,2], quality: 0.7,
    });
    if (result.canceled) return;
    try {
      const asset = result.assets[0];
      const formData = new FormData();
      if (asset.uri.startsWith('blob:') || asset.uri.startsWith('data:') || asset.uri.startsWith('http')) {
        const blob = await fetch(asset.uri).then(r => r.blob());
        formData.append('banner', blob, 'bg.jpg');
      } else {
        formData.append('banner', { uri: asset.uri, type: 'image/jpeg', name: 'bg.jpg' });
      }
      if (bgTarget === 'banner') {
        const { data } = await api.post('/users/me/banner', formData);
        setProfile(data.user);
        if (updateUser) updateUser(data.user);
      } else {
        const { data } = await api.post('/users/me/banner', formData);
        await savePatch({ profileBg: data.bannerUrl, profileBgType: 'image' });
      }
      setBgModal(false);
    } catch {
      Alert.alert('Error', 'No se pudo subir la imagen');
    }
  }

  async function savePatch(payload) {
    setSaving(true);
    try {
      const { data } = await api.patch('/users/me/profile', payload);
      setProfile(data.user);
      if (updateUser) updateUser(data.user);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleEquipFrame() {
    if ((profile?.xp || 0) < 10) {
      Alert.alert('XP insuficiente', `Necesitas 10 XP.\nTienes ${profile?.xp || 0} XP.`);
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

  const hasFrame  = profile?.profileFrame === 'frame_001';
  const canUnlock = (profile?.xp || 0) >= 10;
  const TAB_W     = (W - 32) / TABS.length;
  const hasBg     = !!profile?.profileBg;
  const isImageBg = profile?.profileBgType === 'image';

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero — paddingTop dinámico con insets */}
        <View style={[s.heroBanner, { paddingTop: insets.top + 100 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[s.backBtn, { top: insets.top + 12 }]}>
            <Ionicons name="arrow-back" size={22} color="#ffffff" />
          </TouchableOpacity>

          {profile?.profileBannerType === 'image' && profile?.profileBanner
            ? <><Image source={{ uri: profile.profileBanner }} style={StyleSheet.absoluteFill} resizeMode="cover" />
               <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]} /></>
            : profile?.profileBanner
              ? <View style={[StyleSheet.absoluteFill, { backgroundColor: profile.profileBanner }]} />
              : <LinearGradient colors={['rgba(0,110,100,0.35)','rgba(2,5,9,1)']} style={StyleSheet.absoluteFill} />
          }

          <View style={s.avatarWrap}>
            <TouchableOpacity onPress={() => navigation.navigate('FrameSelector')} activeOpacity={0.85}>
              <AvatarWithFrame
                size={88}
                avatarUrl={profile?.avatarUrl}
                username={profile?.username}
                profileFrame={profile?.profileFrame}
                frameUrl={profile?.profileFrameUrl}
                bgColor="rgba(0,229,204,0.12)"
              />
            </TouchableOpacity>
          </View>

          <Text style={s.username}>{profile?.username}</Text>
          {prefs.showXp && <Text style={s.xpSimple}>XP {profile?.xp || 0}</Text>}

          <View style={s.heroStats}>
            {prefs.showFollowing && (
              <TouchableOpacity style={s.heroStat} onPress={() => navigation.navigate('FollowList', { username: profile?.username, type: 'following' })}>
                <Text style={s.heroStatVal}>{profile?.following?.length || 0}</Text>
                <Text style={s.heroStatLbl}>SIGUIENDO</Text>
              </TouchableOpacity>
            )}
            {prefs.showFollowing && prefs.showPosts && <View style={s.heroStatDiv} />}
            {prefs.showPosts && (
              <View style={s.heroStat}>
                <Text style={s.heroStatVal}>{posts.length}</Text>
                <Text style={s.heroStatLbl}>POSTS</Text>
              </View>
            )}
            {prefs.showPosts && prefs.showFollowers && <View style={s.heroStatDiv} />}
            {prefs.showFollowers && (
              <TouchableOpacity style={s.heroStat} onPress={() => navigation.navigate('FollowList', { username: profile?.username, type: 'followers' })}>
                <Text style={s.heroStatVal}>{profile?.followers?.length || 0}</Text>
                <Text style={s.heroStatLbl}>SEGUIDORES</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Tabs */}
        <View style={[s.tabBar, { marginHorizontal: 16 }]}>
          {TABS.map((t, i) => (
            <TouchableOpacity key={t.key} style={[s.tabBtn, { width: TAB_W }]} onPress={() => switchTab(t.key)}>
              <Ionicons name={t.icon} size={20} color={tab === t.key ? '#ffffff' : colors.textDim} />
            </TouchableOpacity>
          ))}
          <Animated.View style={[s.tabIndicator, {
            width: TAB_W,
            transform: [{ translateX: tabIndicator.interpolate({ inputRange:[0,1,2,3], outputRange:[0,TAB_W,TAB_W*2,TAB_W*3] }) }],
          }]} />
        </View>

        {/* Tab: Perfil */}
        {tab === 'profile' && (
          <View style={s.padded}>
            <View style={[s.pageSection, isImageBg && { overflow: 'hidden' }, !hasBg && s.pageSectionGlass]}>
              {isImageBg && profile?.profileBg
                ? <><Image source={{ uri: profile.profileBg }} style={s.pageBgImage} resizeMode="cover" />
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 16 }]} /></>
                : null}
              {!isImageBg && hasBg
                ? <View style={[StyleSheet.absoluteFill, { backgroundColor: profile.profileBg, borderRadius: 16 }]} />
                : null}
              <View style={s.blocksContainer}>
                {(!profile?.profileBlocks || profile.profileBlocks.length === 0) && (
                  <View style={s.emptyPage}>
                    <Ionicons name="brush-outline" size={28} color={colors.textDim} />
                    <Text style={s.emptyPageTxt}>Página vacía — toca el lápiz para editar</Text>
                  </View>
                )}
                {(profile?.profileBlocks || []).map((block, i) => {
                  if (block.type === 'text') return (
                    <Text key={block.id || i} style={{ fontSize: block.fontSize || 14, fontWeight: block.bold ? '700' : '400', textAlign: block.align || 'left', color: colors.textHi, lineHeight: (block.fontSize || 14) * 1.5, marginBottom: 8 }}>
                      {block.content}
                    </Text>
                  );
                  if (block.type === 'image' && block.imageUrl) return (
                    <Image key={block.id || i} source={{ uri: block.imageUrl }} style={{ width: '100%', height: 200, borderRadius: 14, marginBottom: 8 }} resizeMode="cover" />
                  );
                  if (block.type === 'mention') return (
                    <TouchableOpacity key={block.id || i} style={s.mentionBlockView}
                      onPress={() => navigation.navigate('PublicProfile', { username: block.mentionUsername })}>
                      <View style={s.mentionBlockAv}>
                        {block.mentionAvatar
                          ? <Image source={{ uri: block.mentionAvatar }} style={{ width: '100%', height: '100%', borderRadius: 18 }} />
                          : <Text style={{ color: colors.c1, fontWeight: '700' }}>{block.mentionUsername?.[0]?.toUpperCase()}</Text>}
                      </View>
                      <Text style={s.mentionBlockAt}>@{block.mentionUsername}</Text>
                      <Ionicons name="arrow-forward" size={14} color={colors.c1} />
                    </TouchableOpacity>
                  );
                  return null;
                })}
              </View>
              <TouchableOpacity style={s.editFab} onPress={() => navigation.navigate('EditProfilePage', { profile })}>
                <Ionicons name="pencil" size={16} color={colors.black} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Tab: Posts */}
        {tab === 'posts' && (
          <View>
            {posts.length === 0 ? (
              <View style={s.emptyTab}>
                <Ionicons name="document-text-outline" size={40} color={colors.textDim} />
                <Text style={s.emptyTxt}>Aún no has publicado nada</Text>
              </View>
            ) : posts.map(p => (
              <PostCard
                key={p._id}
                post={p}
                currentUserId={user?._id}
                onReact={handleReact}
                onComment={handleComment}
                onDelete={handleDelete}
                navigation={navigation}
                openPickerId={openPickerId}
                setOpenPickerId={setOpenPickerId}
              />
            ))}
          </View>
        )}

        {/* Tab: Badges */}
        {tab === 'badges' && (
          <View style={s.padded}>
            {!profile?.badges?.length ? (
              <View style={s.emptyTab}>
                <Ionicons name="ribbon-outline" size={40} color={colors.textDim} />
                <Text style={s.emptyTxt}>Aún no tienes emblemas</Text>
                <Text style={s.emptyHint}>Publica, interactúa y sube de XP</Text>
              </View>
            ) : (
              <View style={s.badgesGrid}>
                {profile.badges.map((b, i) => (
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
              <TouchableOpacity style={s.settingsRow} onPress={() => { setBgTarget('banner'); setBgModal(true); }}>
                <Ionicons name="image-outline" size={20} color={colors.textMid} />
                <Text style={s.settingsRowTxt}>Fondo del hero (banner)</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
              </TouchableOpacity>
              <TouchableOpacity style={s.settingsRow} onPress={() => { setBgTarget('card'); setBgModal(true); }}>
                <Ionicons name="color-palette-outline" size={20} color={colors.textMid} />
                <Text style={s.settingsRowTxt}>Fondo de la card</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
              </TouchableOpacity>
              <TouchableOpacity style={s.settingsRow} onPress={() => navigation.navigate('Top')}>
                <Ionicons name="trophy-outline" size={20} color={colors.textMid} />
                <Text style={s.settingsRowTxt}>Top Semanal</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
              </TouchableOpacity>
            </View>

            <View style={[s.settingsGroup, { marginTop: 20 }]}>
              <Text style={s.settingsGroupLabel}>VISIBILIDAD DEL PERFIL</Text>
              {[
                { key: 'showXp',        label: 'Mostrar XP',        icon: 'flash-outline' },
                { key: 'showFollowers', label: 'Mostrar seguidores', icon: 'people-outline' },
                { key: 'showFollowing', label: 'Mostrar siguiendo',  icon: 'person-add-outline' },
                { key: 'showPosts',     label: 'Mostrar posts',      icon: 'grid-outline' },
              ].map(item => (
                <TouchableOpacity key={item.key} style={s.settingsRow} onPress={async () => {
                  const newPrefs = { ...prefs, [item.key]: !prefs[item.key] };
                  setPrefs(newPrefs);
                  try {
                    const { data } = await api.patch('/users/me/profile', { profilePrefs: newPrefs });
                    if (updateUser) updateUser(data.user);
                  } catch {}
                }}>
                  <Ionicons name={item.icon} size={20} color={colors.textMid} />
                  <Text style={s.settingsRowTxt}>{item.label}</Text>
                  <View style={[s.toggle, prefs[item.key] && s.toggleOn]}>
                    <View style={[s.toggleThumb, prefs[item.key] && s.toggleThumbOn]} />
                  </View>
                </TouchableOpacity>
              ))}
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

      {/* Modal Fondo */}
      <Modal visible={bgModal} transparent animationType="slide" onRequestClose={() => setBgModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.bgModalBox}>
            <Text style={s.modalTitle}>{bgTarget === 'banner' ? 'FONDO DEL BANNER' : 'FONDO DE LA CARD'}</Text>
            <View style={s.colorGrid}>
              {BG_COLORS.map(c => (
                <TouchableOpacity key={c.id}
                  style={[s.colorSwatch, c.value ? { backgroundColor: c.value, borderWidth: 2 } : { borderWidth: 1 },
                    (bgTarget === 'banner' ? profile?.profileBanner : profile?.profileBg) === c.value && { borderColor: colors.c1, borderWidth: 2 }]}
                  onPress={() => savePatch(bgTarget === 'banner' ? { profileBanner: c.value, profileBannerType: 'color' } : { profileBg: c.value, profileBgType: 'color' }).then(() => setBgModal(false))}>
                  {!c.value && <Ionicons name="close" size={16} color={colors.textDim} />}
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={s.colorSwatchImg} onPress={handlePickBgImage}>
                <Ionicons name="image-outline" size={20} color={colors.c1} />
                <Text style={{ color: colors.c1, fontSize: 9, marginTop: 3 }}>Imagen</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.closeBtn} onPress={() => setBgModal(false)}>
              <Text style={s.closeBtnTxt}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Marco */}
      <Modal visible={frameModal} transparent animationType="fade" onRequestClose={() => setFrameModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>MARCOS DE PERFIL</Text>
            <View style={{ marginBottom: 20 }}>
              <AvatarWithFrame size={90} avatarUrl={profile?.avatarUrl} username={profile?.username} profileFrame="frame_001" />
            </View>
            <Text style={s.frameName}>Marco Estelar</Text>
            <Text style={s.frameDesc}>
              {canUnlock ? (hasFrame ? 'Marco equipado.' : 'Desbloqueado.') : `Requiere 10 XP — tienes ${profile?.xp || 0}`}
            </Text>
            <TouchableOpacity style={[s.equipBtn, !canUnlock && s.equipBtnLocked]} onPress={handleEquipFrame} disabled={equipping || !canUnlock}>
              <Text style={s.equipBtnTxt}>{equipping ? 'Guardando...' : hasFrame ? 'Quitar marco' : canUnlock ? 'Equipar marco' : 'Bloqueado'}</Text>
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
  root:         { flex: 1, backgroundColor: colors.black },
  backBtn:      { position: 'absolute', left: 16, zIndex: 10, width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  heroBanner:   { alignItems: 'center', paddingBottom: 40, paddingHorizontal: 24, overflow: 'hidden' },
  avatarWrap:   { position: 'relative', marginBottom: 14 },
  username:     { color: colors.textHi, fontSize: 22, fontWeight: '700', marginBottom: 8 },
  xpSimple:     { color: '#ffffff', fontSize: 12, fontWeight: '700', marginBottom: 12 },
  heroStats:    { flexDirection: 'row', width: '100%', marginTop: 8, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  heroStat:     { flex: 1, alignItems: 'center' },
  heroStatVal:  { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  heroStatLbl:  { color: 'rgba(255,255,255,0.6)', fontSize: 8, letterSpacing: 2, marginTop: 2 },
  heroStatDiv:  { width: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  tabBar:       { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 16, overflow: 'hidden', position: 'relative' },
  tabBtn:       { alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  tabIndicator: { position: 'absolute', bottom: 0, height: 2, backgroundColor: '#ffffff', borderRadius: 1 },
  padded:       { paddingHorizontal: 16 },
  pageSection:      { borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, position: 'relative', minHeight: 120, marginBottom: 8 },
  pageSectionGlass: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' },
  pageBgImage:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 16 },
  blocksContainer:  { paddingBottom: 48, gap: 8 },
  emptyPage:        { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyPageTxt:     { color: colors.textDim, fontSize: 12, textAlign: 'center' },
  mentionBlockView: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(0,229,204,0.07)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,229,204,0.2)', padding: 12 },
  mentionBlockAv:   { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.deep, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  mentionBlockAt:   { flex: 1, color: colors.c1, fontWeight: '700', fontSize: 14 },
  editFab:      { position: 'absolute', bottom: 24, right: 24, width: 48, height: 48, borderRadius: 24, backgroundColor: colors.c1, alignItems: 'center', justifyContent: 'center', elevation: 8, zIndex: 20 },
  toggle:       { width: 40, height: 22, borderRadius: 11, backgroundColor: colors.border, justifyContent: 'center', padding: 2 },
  toggleOn:     { backgroundColor: 'rgba(0,229,204,0.3)' },
  toggleThumb:  { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.textDim },
  toggleThumbOn:{ backgroundColor: colors.c1, alignSelf: 'flex-end' },
  emptyTab:     { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyTxt:     { color: colors.textDim, fontSize: 14 },
  emptyHint:    { color: colors.textDim, fontSize: 11, opacity: 0.6 },
  badgesGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeCard:    { alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.borderC, padding: 14, width: (W - 52) / 3 },
  badgeIcon:    { fontSize: 28, marginBottom: 6 },
  badgeName:    { color: colors.c1, fontSize: 9, letterSpacing: 1, textAlign: 'center' },
  badgeDesc:    { color: colors.textDim, fontSize: 9, textAlign: 'center', marginTop: 2 },
  settingsGroup:      { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  settingsGroupLabel: { color: colors.textDim, fontSize: 9, letterSpacing: 3, padding: 14, paddingBottom: 8 },
  settingsRow:        { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
  settingsRowTxt:     { flex: 1, color: colors.textMid, fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
  modalBox:     { backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.borderC, padding: 28, width: '82%', alignItems: 'center' },
  modalTitle:   { fontSize: 12, letterSpacing: 4, color: colors.c1, fontWeight: '800', marginBottom: 20 },
  frameName:    { color: colors.textHi, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  frameDesc:    { color: colors.textDim, fontSize: 12, textAlign: 'center', marginBottom: 24 },
  equipBtn:     { backgroundColor: colors.c1, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 36, marginBottom: 12, width: '100%', alignItems: 'center' },
  equipBtnLocked: { backgroundColor: 'rgba(255,255,255,0.08)' },
  equipBtnTxt:  { color: colors.black, fontWeight: '800', fontSize: 14 },
  closeBtn:     { paddingVertical: 12 },
  closeBtnTxt:  { color: colors.textDim, fontSize: 13 },
  bgModalBox:   { backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.borderC, padding: 24, width: '90%', alignItems: 'center' },
  colorGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginVertical: 16 },
  colorSwatch:  { width: 48, height: 48, borderRadius: 12, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  colorSwatchImg: { width: 48, height: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.borderC, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,229,204,0.05)' },
});
