import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, FlatList, TextInput, TouchableOpacity, Image,
  StyleSheet, StatusBar, ActivityIndicator,
  Animated, Alert, Modal, Dimensions, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { getActivityStatus, getRelativeTime } from '../utils/timeUtils';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import AvatarWithFrame from '../components/AvatarWithFrame';
import PostCard from '../components/PostCard';
import AudioMessage from '../components/AudioMessage';
import GenderIcon from '../components/GenderIcon';
import VerifiedIcon from '../components/VerifiedIcon';

const W         = Dimensions.get('window').width;
const H         = Dimensions.get('window').height;
const GRID_GAP  = 4;
const CELL      = Math.floor((W - 40 - GRID_GAP) / 2);
const POST_TILE = (W - 32 - 4) / 3;
const BASE_URL  = process.env.EXPO_PUBLIC_API_URL || 'https://abyss-production-7171.up.railway.app/api';


const TABS = [
  { key: 'profile',  icon: 'person-outline'   },
  { key: 'posts',    icon: 'grid-outline'      },
  { key: 'badges',   icon: 'ribbon-outline'    },
  { key: 'settings', icon: 'settings-outline'  },
];

const BG_COLORS = [
  { id: 'none',    value: '',                          label: 'Ninguno'  },
  { id: 'teal',    value: 'rgba(0,229,204,0.12)',       label: 'Teal'     },
  { id: 'purple',  value: 'rgba(147,51,234,0.15)',      label: 'Púrpura'  },
  { id: 'red',     value: 'rgba(239,68,68,0.12)',       label: 'Rojo'     },
  { id: 'blue',    value: 'rgba(41,121,255,0.15)',      label: 'Azul'     },
  { id: 'orange',  value: 'rgba(249,115,22,0.15)',      label: 'Naranja'  },
  { id: 'pink',    value: 'rgba(236,72,153,0.15)',      label: 'Rosa'     },
  { id: 'green',   value: 'rgba(34,197,94,0.12)',       label: 'Verde'    },
  { id: 'yellow',  value: 'rgba(234,179,8,0.15)',       label: 'Amarillo' },
  { id: 'white',   value: 'rgba(255,255,255,0.06)',     label: 'Blanco'   },
];

// ── Helper: upload con fetch nativo (funciona en web y en app) ────────────────
async function uploadFile(path, fieldName, uri, filename) {
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  const token = await AsyncStorage.getItem('token');

  const formData = new FormData();

  if (Platform.OS === 'web') {
    // En web: blob directo
    const blob = await fetch(uri).then(r => r.blob());
    formData.append(fieldName, blob, filename);
  } else {
    // En nativo: objeto con uri
    formData.append(fieldName, { uri, type: 'image/jpeg', name: filename });
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error al subir');
  return data;
}

async function uploadBioAudio(uri, mimeType, filename) {
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  const token = await AsyncStorage.getItem('token');
  const formData = new FormData();
  formData.append('audio', { uri, type: mimeType || 'audio/mpeg', name: filename || 'bio.mp3' });
  const response = await fetch(`${BASE_URL}/users/me/bio-audio`, {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: formData,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error al subir audio');
  return data;
}

function countWords(str) {
  return str.trim() === '' ? 0 : str.trim().split(/\s+/).length;
}

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, logout, updateUser } = useAuthStore();

  const [profile,       setProfile]       = useState(null);
  const [posts,         setPosts]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [uploading,     setUploading]     = useState(false);
  const [tab,           setTab]           = useState('profile');
  const [frameModal,    setFrameModal]    = useState(false);
  const [bgModal,       setBgModal]       = useState(false);
  const [bgTarget,      setBgTarget]      = useState('banner');
  const [equipping,     setEquipping]     = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [muroModal,     setMuroModal]     = useState(false);
  const [openPickerId,  setOpenPickerId]  = useState(null);
  const [bioModal,     setBioModal]     = useState(false);
  const [bioText,      setBioText]      = useState('');
  const [bioUploading, setBioUploading] = useState(false);
  const [prefs, setPrefs] = useState({
    showXp: true, showFollowers: true, showFollowing: true, showPosts: true,
  });
  const [wallMessages, setWallMessages] = useState([]);
  const [wallLoading,  setWallLoading]  = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex,   setViewerIndex]   = useState(0);

  const [activityStatus, setActivityStatus] = useState({ text: '', isOnline: false });
  const [headerHeight,   setHeaderHeight]   = useState(0);
  const flatListRef = useRef(null);

  useEffect(() => {
    setActivityStatus(getActivityStatus(user?.lastActive));
    const interval = setInterval(() => {
      setActivityStatus(getActivityStatus(user?.lastActive));
    }, 60000);
    return () => clearInterval(interval);
  }, [user?.lastActive]);

  const hasFrame  = profile?.profileFrame === 'frame_001';
  const canUnlock = (profile?.xp || 0) >= 10;

  const tabIndicator = useRef(new Animated.Value(0)).current;

  // ── Cargar perfil y posts ─────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      api.get('/users/me'),
      api.get('/posts/user/me').catch(() => ({ data: { posts: [] } })),
    ]).then(([profileRes, postsRes]) => {
      const u = profileRes.data.user;
      setProfile(u);
      if (u.profilePrefs) setPrefs(prev => ({ ...prev, ...u.profilePrefs }));
      setPosts(postsRes.data.posts || []);
    }).finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => {
    api.get('/users/me').then(r => setProfile(r.data.user)).catch(() => {});
  }, []));

  // ── Cargar mensajes del muro ──────────────────────────────────────────────
  useEffect(() => {
    if (!profile?.username) return;
    setWallLoading(true);
    api.get(`/wall/${profile.username}`)
      .then(r => setWallMessages(r.data.messages || []))
      .catch(() => {})
      .finally(() => setWallLoading(false));
  }, [profile?.username]);

  async function handleDeleteWallMsg(id) {
    Alert.alert('Eliminar mensaje', '¿Eliminar este mensaje del muro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/wall/msg/${id}`);
          setWallMessages(prev => prev.filter(m => m._id !== id));
        } catch (err) {
          Alert.alert('Error', err.response?.data?.error || 'No se pudo eliminar');
        }
      }},
    ]);
  }

  // ── Reacciones, comentarios, borrar post ──────────────────────────────────
  async function handleReact(postId, type) {
    setPosts(prev => prev.map(p => {
      if (p._id !== postId) return p;
      const already = p.reactions.find(r => (r.user?._id || r.user) === user?._id && r.type === type);
      return {
        ...p,
        reactions: already
          ? p.reactions.filter(r => !((r.user?._id || r.user) === user?._id && r.type === type))
          : [...p.reactions, { user: user?._id, type }],
      };
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

  // ── Tabs ──────────────────────────────────────────────────────────────────
  function switchTab(key) {
    const idx = TABS.findIndex(t => t.key === key);
    Animated.spring(tabIndicator, { toValue: idx, friction: 8, useNativeDriver: true }).start();
    setTab(key);
  }

  // ── Subir avatar ──────────────────────────────────────────────────────────
  async function handlePickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9,
    });
    if (result.canceled) return;
    setUploading(true);
    try {
      const data = await uploadFile('/users/me/avatar', 'avatar', result.assets[0].uri, 'avatar.jpg');
      setProfile(prev => ({ ...prev, avatarUrl: data.avatarUrl }));
      if (updateUser) updateUser(data.user);
    } catch {
      Alert.alert('Error', 'No se pudo subir la imagen');
    } finally {
      setUploading(false);
    }
  }

  // ── Subir imagen de fondo (banner o card) ─────────────────────────────────
  async function handlePickBgImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false, // sin recorte forzado → más calidad
      quality: 1,
    });
    if (result.canceled) return;
    setUploading(true);
    try {
      const asset = result.assets[0];
      if (bgTarget === 'banner') {
        const data = await uploadFile('/users/me/banner', 'banner', asset.uri, 'banner.jpg');
        setProfile(data.user);
        if (updateUser) updateUser(data.user);
      } else {
        const data = await uploadFile('/users/me/card-bg', 'cardBg', asset.uri, 'card-bg.jpg');
        setProfile(data.user);
        if (updateUser) updateUser(data.user);
      }
      setBgModal(false);
    } catch {
      Alert.alert('Error', 'No se pudo subir la imagen');
    } finally {
      setUploading(false);
    }
  }

  // ── Guardar cambios de perfil ─────────────────────────────────────────────
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

  // ── Bio: guardar texto ────────────────────────────────────────────────────
  async function handleSaveBioText() {
    const trimmed = bioText.trim();
    if (!trimmed) return;
    await savePatch({ bio: trimmed, bioType: 'text', bioAudioUrl: null });
    setBioModal(false);
  }

  // ── Bio: seleccionar y subir audio ────────────────────────────────────────
  async function handlePickBioAudio() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      if (result.canceled) return;
      setBioUploading(true);
      const asset = result.assets[0];
      const data  = await uploadBioAudio(asset.uri, asset.mimeType || 'audio/mpeg', asset.name || 'bio.mp3');
      await savePatch({ bioType: 'audio', bio: null, bioAudioUrl: data.bioAudioUrl });
    } catch {
      Alert.alert('Error', 'No se pudo subir el audio');
    } finally {
      setBioUploading(false);
    }
  }

  // ── Marco de perfil ───────────────────────────────────────────────────────
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

  const renderHeader = () => {
    const TAB_W = (W - 32) / TABS.length;

    return (
      <View>
        {/* ── Hero ── */}
        <View style={[s.heroBanner, { paddingTop: insets.top + 140 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[s.backBtn, { top: insets.top + 12 }]}>
            <Ionicons name="arrow-back" size={22} color="#ffffff" />
          </TouchableOpacity>

          {profile?.profileBannerType === 'image' && profile?.profileBanner
            ? <>
                <Image source={{ uri: profile.profileBanner }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]} />
              </>
            : profile?.profileBanner
              ? <View style={[StyleSheet.absoluteFill, { backgroundColor: profile.profileBanner }]} />
              : <LinearGradient colors={['rgba(0,110,100,0.35)', 'rgba(2,5,9,1)']} style={StyleSheet.absoluteFill} />
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
                badgeRole={profile?.role}
              />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Text style={s.username}>{profile?.username}</Text>
            <GenderIcon gender={profile?.gender} size={14} />
            <VerifiedIcon isCreator={profile?.isCreator} size={14} />
            {profile?.emailVerified && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,229,204,0.1)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(0,229,204,0.3)' }}>
                <Ionicons name="checkmark-circle" size={12} color="#00e5cc" />
                <Text style={{ color: '#00e5cc', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>Verificado</Text>
              </View>
            )}
          </View>
          {activityStatus.text ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, marginBottom: 2 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: activityStatus.isOnline ? '#16B88A' : '#6B6090', marginRight: 6 }} />
              <Text style={{ fontSize: 12, color: activityStatus.isOnline ? '#16B88A' : colors.textDim }}>
                {activityStatus.text}
              </Text>
            </View>
          ) : null}
          {prefs.showXp && <Text style={s.xpSimple}>XP {profile?.xp || 0}</Text>}

          <View style={s.heroStats}>
            {prefs.showFollowing && (
              <TouchableOpacity style={s.heroStat} onPress={() => navigation.navigate('FollowList', { username: profile?.username, type: 'following' })}>
                <Text style={s.heroStatVal}>{profile?.following?.length || 0}</Text>
                <Text style={s.heroStatLbl}>SIGUIENDO</Text>
              </TouchableOpacity>
            )}
            {prefs.showPosts && (
              <View style={s.heroStat}>
                <Text style={s.heroStatVal}>{posts.length}</Text>
                <Text style={s.heroStatLbl}>POSTS</Text>
              </View>
            )}
            {prefs.showFollowers && (
              <TouchableOpacity style={s.heroStat} onPress={() => navigation.navigate('FollowList', { username: profile?.username, type: 'followers' })}>
                <Text style={s.heroStatVal}>{profile?.followers?.length || 0}</Text>
                <Text style={s.heroStatLbl}>SEGUIDORES</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Tabs ── */}
        <View style={[s.tabBar, { marginHorizontal: 0, marginTop: 0, marginBottom: 0 }]}>
          {TABS.map((t) => (
            <TouchableOpacity key={t.key} style={[s.tabBtn, { width: TAB_W }]} onPress={() => switchTab(t.key)}>
              <Ionicons name={t.icon} size={20} color={tab === t.key ? '#ffffff' : colors.textDim} />
            </TouchableOpacity>
          ))}
          <Animated.View style={[s.tabIndicator, {
            width: TAB_W,
            transform: [{
              translateX: tabIndicator.interpolate({
                inputRange:  [0, 1, 2, 3],
                outputRange: [0, TAB_W, TAB_W * 2, TAB_W * 3],
              }),
            }],
          }]} />
        </View>
      </View>
    );
  };

  const renderItem = ({ item, index }) => {
    if (tab === 'posts') {
      return (
        <View style={index === 0 ? { paddingTop: 12 } : null}>
          <PostCard
            post={item}
            currentUserId={user?._id}
            currentUserRole={user?.role}
            onReact={handleReact}
            onComment={handleComment}
            onDelete={handleDelete}
            navigation={navigation}
            openPickerId={openPickerId}
            setOpenPickerId={setOpenPickerId}
          />
        </View>
      );
    }

    if (item === 'profile') {
      const hasBg       = !!profile?.profileBg;
      const isImageBg   = profile?.profileBgType === 'image';
      const hasBanner   = !!profile?.profileBanner;
      const isBannerImg = profile?.profileBannerType === 'image';
      const imgBlocks   = (profile?.profileBlocks || []).filter(b => b.type === 'image' && b.imageUrl);
      let imgGridShown  = false;
      return (
        <View style={{ paddingHorizontal: 0 }}>

          {/* ── Wrapper con fondo unificado: Bio + Sobre mí + Muro ── */}
          <View style={s.contentBgWrapper}>
            {isImageBg && profile?.profileBg
              ? <>
                  <Image source={{ uri: profile.profileBg }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
                </>
              : !isImageBg && hasBg
                ? <View style={[StyleSheet.absoluteFill, { backgroundColor: profile.profileBg }]} />
                : null
            }

            {/* Bio */}
            <TouchableOpacity
              style={s.sectionRow}
              onPress={() => { setBioText(profile?.bio || ''); setBioModal(true); }}
              activeOpacity={0.7}
            >
              <View style={[s.sectionLabelBadge, { borderWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 5 }]}>
                <Text style={s.sectionLabelBadgeTxt}>BIO</Text>
                <Ionicons name="chevron-forward" size={11} color={colors.textDim} />
              </View>
            </TouchableOpacity>

            {(profile?.bioType === 'text' || (!profile?.bioType && profile?.bio?.trim())) && profile?.bio?.trim() ? (
              <TouchableOpacity
                style={s.bioTextDisplay}
                onPress={() => { setBioText(profile.bio); setBioModal(true); }}
                activeOpacity={0.7}
              >
                <Text style={s.bioTextContent}>{profile.bio}</Text>
              </TouchableOpacity>
            ) : profile?.bioType === 'audio' && profile?.bioAudioUrl ? (
              <View style={s.bioAudioDisplay}>
                <AudioMessage uri={profile.bioAudioUrl} isMe={false} duration={0} />
                <TouchableOpacity onPress={handlePickBioAudio} disabled={bioUploading}>
                  <Text style={s.bioChangeAudio}>
                    {bioUploading ? 'Subiendo...' : 'Cambiar audio'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.bioIconsRow}>
                <TouchableOpacity
                  style={s.bioIconBtn}
                  onPress={() => { setBioText(profile?.bio || ''); setBioModal(true); }}
                >
                  <Ionicons name="text-outline" size={24} color={colors.c1} />
                  <Text style={s.bioOptionLabel}>Texto</Text>
                </TouchableOpacity>
                <View style={s.bioDivider} />
                <TouchableOpacity style={s.bioIconBtn} onPress={handlePickBioAudio} disabled={bioUploading}>
                  {bioUploading
                    ? <ActivityIndicator size="small" color={colors.c3} />
                    : <Ionicons name="mic-outline" size={24} color={colors.c3} />}
                  <Text style={s.bioOptionLabel}>Audio</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── SOBRE MÍ — label ── */}
            <TouchableOpacity
              style={s.sectionRow}
              onPress={() => navigation.navigate('EditProfilePage', { profile })}
              activeOpacity={0.7}
            >
              <View style={[s.sectionLabelBadge, { borderWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 5 }]}>
                <Text style={s.sectionLabelBadgeTxt}>SOBRE MÍ</Text>
                <Ionicons name="chevron-forward" size={11} color={colors.textDim} />
              </View>
            </TouchableOpacity>

            {/* Sobre mí */}
            <View style={[s.pageSection, {
              borderRadius: 0, borderWidth: 0,
              paddingHorizontal: 20, backgroundColor: 'transparent',
            }]}>
              {(profile?.profileBlocks || []).length === 0 ? (
                <TouchableOpacity
                  style={s.emptyPage}
                  onPress={() => navigation.navigate('EditProfilePage', { profile })}
                  activeOpacity={0.7}
                >
                  <Ionicons name="create-outline" size={38} color={colors.textDim} />
                </TouchableOpacity>
              ) : (
                <View style={[s.blocksContainer, { paddingBottom: 8 }]}>
                  {(profile?.profileBlocks || []).map((block, i) => {
                    if (block.type === 'text') return (
                      <Text key={block.id || i} style={{ fontSize: block.fontSize || 14, fontWeight: block.bold ? '700' : '400', textAlign: block.align || 'left', color: colors.textHi, lineHeight: (block.fontSize || 14) * 1.5, marginBottom: 8 }}>
                        {block.content}
                      </Text>
                    );
                    if (block.type === 'audio' && block.audioUrl) return (
                      <View key={block.id || i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(249,115,22,0.06)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(249,115,22,0.18)', paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8 }}>
                        <Ionicons name="musical-note-outline" size={14} color={colors.textDim} />
                        <AudioMessage uri={block.audioUrl} isMe={false} duration={0} />
                      </View>
                    );
                    if (block.type === 'image' && block.imageUrl) {
                      if (imgGridShown) return null;
                      imgGridShown = true;
                      return (
                        <View key="imgGrid" style={s.imgGrid}>
                          {imgBlocks.map((b, idx) => (
                            <TouchableOpacity key={b.id || idx} style={s.imgCell} activeOpacity={0.85}
                              onPress={() => { setViewerIndex(idx); setViewerVisible(true); }}>
                              <Image source={{ uri: b.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                            </TouchableOpacity>
                          ))}
                        </View>
                      );
                    }
                    if (block.type === 'mention') return (
                      <TouchableOpacity key={block.id || i} style={s.mentionBlockView}
                        onPress={() => navigation.navigate('PublicProfile', { username: block.mentionUsername })}>
                        <View style={s.mentionBlockAv}>
                          {block.mentionAvatar
                            ? <Image source={{ uri: block.mentionAvatar }} style={{ width: '100%', height: '100%', borderRadius: 18 }} />
                            : <Text style={{ color: colors.c1, fontWeight: '700' }}>{block.mentionUsername?.[0]?.toUpperCase()}</Text>}
                        </View>
                        <Text style={s.mentionBlockAt}>{block.mentionUsername}</Text>
                        <Ionicons name="arrow-forward" size={14} color={colors.c1} />
                      </TouchableOpacity>
                    );
                    return null;
                  })}
                </View>
              )}
            </View>

            {/* Muro */}
            <BlurView intensity={22} tint="dark" style={s.muroSection}>
              <View style={s.muroHeaderInner}>
                <Text style={[s.sectionLabel, { flex: 1 }]}>MURO</Text>
                <TouchableOpacity onPress={() => setMuroModal(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="settings-outline" size={16} color={colors.textDim} />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ flex: 1 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {wallLoading && <ActivityIndicator color={colors.c1} style={{ paddingVertical: 20 }} />}
                {!wallLoading && wallMessages.length === 0 && (
                  <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                    <Text style={{ color: colors.textDim, fontSize: 12 }}>Aún no hay mensajes en el muro</Text>
                  </View>
                )}
                {wallMessages.map((msg, i) => (
                  <TouchableOpacity key={msg._id} activeOpacity={0.8} onLongPress={() => handleDeleteWallMsg(msg._id)}>
                    <View style={s.muroMsg}>
                      <View style={s.muroAvatar}>
                        {msg.author?.avatarUrl
                          ? <Image source={{ uri: msg.author.avatarUrl }} style={{ width: '100%', height: '100%', borderRadius: 18 }} />
                          : <Text style={s.muroAvatarLetter}>{msg.author?.username?.[0]?.toUpperCase()}</Text>}
                      </View>
                      <View style={s.muroMsgBody}>
                        <Text style={s.muroUsername}>{msg.author?.username}</Text>
                        <Text style={s.muroText}>{msg.text}</Text>
                        <Text style={s.muroDate}>{getRelativeTime(msg.createdAt)}</Text>
                      </View>
                    </View>
                    {i < wallMessages.length - 1 && <View style={s.muroDivider} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={s.muroInput}>
                <Ionicons name="lock-closed-outline" size={15} color={colors.textDim} />
                <Text style={s.muroInputTxt}>Este es tu muro — los visitantes escriben aquí</Text>
              </View>
            </BlurView>

            <View style={{ height: 28 }} />
          </View>

        </View>
      );
    }

    if (item === 'badges') {
      return (
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
      );
    }

    if (item === 'settings') {
      return (
        <View style={s.padded}>
          <View style={s.settingsGroup}>
            <Text style={s.settingsGroupLabel}>CUENTA</Text>

            <TouchableOpacity style={s.settingsRow} onPress={handlePickAvatar} disabled={uploading}>
              <Ionicons name="camera-outline" size={20} color={colors.textMid} />
              <Text style={s.settingsRowTxt}>Cambiar foto de perfil</Text>
              {uploading ? <ActivityIndicator size="small" color={colors.c1} /> : <Ionicons name="chevron-forward" size={16} color={colors.textDim} />}
            </TouchableOpacity>

            <TouchableOpacity style={s.settingsRow} onPress={() => { setBgTarget('banner'); setBgModal(true); }}>
              <Ionicons name="image-outline" size={20} color={colors.textMid} />
              <Text style={s.settingsRowTxt}>Fondo Card</Text>
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
              { key: 'showXp',        label: 'Mostrar XP',        icon: 'flash-outline'      },
              { key: 'showFollowers', label: 'Mostrar seguidores', icon: 'people-outline'     },
              { key: 'showFollowing', label: 'Mostrar siguiendo',  icon: 'person-add-outline' },
              { key: 'showPosts',     label: 'Mostrar posts',      icon: 'grid-outline'       },
            ].map(itemPrefs => (
              <TouchableOpacity key={itemPrefs.key} style={s.settingsRow} onPress={async () => {
                const newPrefs = { ...prefs, [itemPrefs.key]: !prefs[itemPrefs.key] };
                setPrefs(newPrefs);
                try {
                  const { data } = await api.patch('/users/me/profile', { profilePrefs: newPrefs });
                  if (updateUser) updateUser(data.user);
                } catch {}
              }}>
                <Ionicons name={itemPrefs.icon} size={20} color={colors.textMid} />
                <Text style={s.settingsRowTxt}>{itemPrefs.label}</Text>
                <View style={[s.toggle, prefs[itemPrefs.key] && s.toggleOn]}>
                  <View style={[s.toggleThumb, prefs[itemPrefs.key] && s.toggleThumbOn]} />
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
      );
    }

    return null;
  };

  if (loading) return (
    <View style={s.root}><ActivityIndicator color={colors.c1} style={{ marginTop: 80 }} /></View>
  );

  const flatListData = tab === 'posts' ? posts : [tab];

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.black} />

      <Animated.FlatList
        ref={flatListRef}
        data={flatListData}
        renderItem={renderItem}
        keyExtractor={(item, index) => tab === 'posts' ? (item._id || index.toString()) : item}
        ListHeaderComponent={() => (
          <View onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h !== headerHeight) setHeaderHeight(h);
          }}>
            {renderHeader()}
          </View>
        )}
        ListFooterComponent={<View style={{ height: 60 }} />}
        showsVerticalScrollIndicator={false}
        progressViewOffset={headerHeight}
        removeClippedSubviews={Platform.OS !== 'web'}
        maxToRenderPerBatch={5}
        windowSize={5}
        initialNumToRender={5}
        getItemLayout={tab === 'posts' ? (data, index) => (
          { length: 400, offset: 400 * index, index }
        ) : undefined}
      />

      {/* ── Modal Fondo — sin bordes, ancho completo ── */}
      <Modal visible={bgModal} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setBgModal(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.bgModalBox, { paddingBottom: Math.max(insets.bottom + 16, 40) }]}>
            <Text style={s.modalTitle}>
              {bgTarget === 'banner' ? 'FONDO DEL BANNER' : 'FONDO DE LA CARD'}
            </Text>

            {/* Colores */}
            <View style={s.colorGrid}>
              {BG_COLORS.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    s.colorSwatch,
                    c.value ? { backgroundColor: c.value, borderWidth: 2 } : { borderWidth: 1 },
                    (bgTarget === 'banner' ? profile?.profileBanner : profile?.profileBg) === c.value && { borderColor: colors.c1, borderWidth: 2 },
                  ]}
                  onPress={() => {
                    const patch = bgTarget === 'banner'
                      ? { profileBanner: c.value, profileBannerType: 'color' }
                      : { profileBg: c.value, profileBgType: 'color' };
                    savePatch(patch).then(() => setBgModal(false));
                  }}
                >
                  {!c.value && <Ionicons name="close" size={16} color={colors.textDim} />}
                </TouchableOpacity>
              ))}

              {/* Botón imagen */}
              <TouchableOpacity style={s.colorSwatchImg} onPress={handlePickBgImage} disabled={uploading}>
                {uploading
                  ? <ActivityIndicator size="small" color={colors.c1} />
                  : <>
                      <Ionicons name="image-outline" size={20} color={colors.c1} />
                      <Text style={{ color: colors.c1, fontSize: 9, marginTop: 3 }}>Imagen</Text>
                    </>
                }
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={s.closeBtn} onPress={() => setBgModal(false)}>
              <Text style={s.closeBtnTxt}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modal Marco ── */}
      <Modal visible={frameModal} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setFrameModal(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { paddingBottom: Math.max(insets.bottom + 16, 28) }]}>
            <Text style={s.modalTitle}>MARCOS DE PERFIL</Text>
            <View style={{ marginBottom: 20 }}>
              <AvatarWithFrame size={90} avatarUrl={profile?.avatarUrl} username={profile?.username} profileFrame="frame_001" />
            </View>
            <Text style={s.frameName}>Marco Estelar</Text>
            <Text style={s.frameDesc}>
              {canUnlock ? (hasFrame ? 'Marco equipado.' : 'Desbloqueado.') : `Requiere 10 XP — tienes ${profile?.xp || 0}`}
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

      {/* ── Modal Bio Texto ── */}
      <Modal visible={bioModal} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setBioModal(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.bgModalBox, { paddingBottom: Math.max(insets.bottom + 16, 40) }]}>
            <Text style={s.modalTitle}>BIO DE TEXTO</Text>
            <TextInput
              style={s.bioTextInput}
              multiline
              placeholder="Cuéntanos sobre ti…"
              placeholderTextColor={colors.textDim}
              value={bioText}
              onChangeText={text => {
                if (countWords(text) <= 150) setBioText(text);
              }}
            />
            <Text style={s.bioWordCount}>
              {150 - countWords(bioText)} palabras restantes
            </Text>
            <TouchableOpacity
              style={[s.equipBtn, (!bioText.trim() || saving) && s.equipBtnLocked]}
              onPress={handleSaveBioText}
              disabled={!bioText.trim() || saving}
            >
              <Text style={s.equipBtnTxt}>{saving ? 'Guardando...' : 'Guardar'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.closeBtn} onPress={() => setBioModal(false)}>
              <Text style={s.closeBtnTxt}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modal Muro — configuración ── */}
      <Modal visible={muroModal} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setMuroModal(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.bgModalBox, { paddingBottom: Math.max(insets.bottom + 16, 40) }]}>
            <Text style={s.modalTitle}>CONFIGURAR MURO</Text>
            <Text style={{ color: colors.textDim, fontSize: 13, textAlign: 'center', marginBottom: 20 }}>
              Elige quién puede escribir en tu muro
            </Text>
            {[
              { label: 'Todos',           icon: 'globe-outline',  value: 'everyone'  },
              { label: 'Solo siguiendo',  icon: 'people-outline', value: 'following' },
              { label: 'Solo seguidores', icon: 'person-outline', value: 'followers' },
            ].map((opt) => {
              const active = (profile?.wallPermission || 'everyone') === opt.value;
              return (
                <TouchableOpacity key={opt.value} style={s.muroConfigRow} onPress={async () => {
                  await savePatch({ wallPermission: opt.value });
                  setMuroModal(false);
                }}>
                  <Ionicons name={opt.icon} size={18} color={active ? colors.c1 : colors.textMid} />
                  <Text style={[s.muroConfigLabel, active && { color: colors.c1 }]}>{opt.label}</Text>
                  {active
                    ? <Ionicons name="checkmark-circle" size={16} color={colors.c1} />
                    : <Ionicons name="chevron-forward"  size={14} color={colors.textDim} />}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={[s.closeBtn, { marginTop: 8 }]} onPress={() => setMuroModal(false)}>
              <Text style={s.closeBtnTxt}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Visor de imágenes fullscreen ── */}
      <Modal visible={viewerVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setViewerVisible(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <FlatList
            data={(profile?.profileBlocks || []).filter(b => b.type === 'image' && b.imageUrl)}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={viewerIndex}
            getItemLayout={(_, index) => ({ length: W, offset: W * index, index })}
            renderItem={({ item }) => (
              <View style={{ width: W, height: H, justifyContent: 'center', alignItems: 'center' }}>
                <Image source={{ uri: item.imageUrl }} style={{ width: W, height: H }} resizeMode="contain" />
              </View>
            )}
            keyExtractor={(item, idx) => item.id || String(idx)}
            style={{ flex: 1 }}
          />
          <TouchableOpacity
            style={{ position: 'absolute', top: insets.top + 12, right: 16, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 8 }}
            onPress={() => setViewerVisible(false)}
          >
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: colors.black },
  backBtn:    { position: 'absolute', left: 16, zIndex: 10, width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  heroBanner: { alignItems: 'center', paddingBottom: 100, paddingHorizontal: 24, overflow: 'hidden', width: W, alignSelf: 'stretch' },
  avatarWrap: { position: 'relative', marginBottom: 14 },
  username:   { color: colors.textHi, fontSize: 22, fontWeight: '700', marginBottom: 8 },
  xpSimple:   { color: '#ffffff', fontSize: 12, fontWeight: '700', marginBottom: 12 },

  heroStats:   { flexDirection: 'row', width: '100%', marginTop: 8, gap: 8, justifyContent: 'center' },
  heroStat:    { width: 100, alignItems: 'center', paddingVertical: 12, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  heroStatVal: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  heroStatLbl: { color: 'rgba(255,255,255,0.6)', fontSize: 8, letterSpacing: 2, marginTop: 2 },
  heroStatDiv: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)' },

  tabBar:       { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 0, borderWidth: 1, borderColor: colors.border, marginBottom: 16, overflow: 'hidden' },
  tabBtn:       { alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  tabIndicator: { position: 'absolute', bottom: 0, height: 2, backgroundColor: '#ffffff', borderRadius: 1 },

  padded:           { paddingHorizontal: 16, paddingTop: 12 },
  pageSection:      { borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, position: 'relative', minHeight: 120, marginBottom: 8 },
  pageSectionGlass: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' },
  pageBgImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  blocksContainer:  { paddingBottom: 48, gap: 8 },
  imgGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP, marginBottom: 8 },
  imgCell:          { width: CELL, height: CELL, borderRadius: 10, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)' },
  emptyPage:        { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyPageTxt:     { color: colors.textDim, fontSize: 12, textAlign: 'center' },
  mentionBlockView: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(0,229,204,0.07)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,229,204,0.2)', padding: 12 },
  mentionBlockAv:   { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.deep, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  mentionBlockAt:   { flex: 1, color: colors.c1, fontWeight: '700', fontSize: 14 },
  editFab:          { position: 'absolute', bottom: 24, right: 24, width: 48, height: 48, borderRadius: 24, backgroundColor: colors.c1, alignItems: 'center', justifyContent: 'center', elevation: 8, zIndex: 20 },

  toggle:         { width: 40, height: 22, borderRadius: 11, backgroundColor: colors.border, justifyContent: 'center', padding: 2 },
  toggleOn:       { backgroundColor: 'rgba(0,229,204,0.3)' },
  toggleThumb:    { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.textDim },
  toggleThumbOn:  { backgroundColor: colors.c1, alignSelf: 'flex-end' },

  emptyTab:  { alignItems: 'center', paddingVertical: 48, gap: 12 },
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

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },

  // ── Modal fondo: sin bordes, ocupa todo el ancho ──
  bgModalBox: {
    backgroundColor: colors.surface,
    // Sin borderRadius arriba — borde solo en las esquinas superiores
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.borderC,
    padding: 24,
    paddingBottom: 40,
    width: '100%',
    alignItems: 'center',
  },

  modalBox:   { backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.borderC, padding: 28, width: '82%', alignItems: 'center' },
  modalTitle: { fontSize: 12, letterSpacing: 4, color: colors.c1, fontWeight: '800', marginBottom: 20 },

  frameName:      { color: colors.textHi, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  frameDesc:      { color: colors.textDim, fontSize: 12, textAlign: 'center', marginBottom: 24 },
  equipBtn:       { backgroundColor: colors.c1, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 36, marginBottom: 12, width: '100%', alignItems: 'center' },
  equipBtnLocked: { backgroundColor: 'rgba(255,255,255,0.08)' },
  equipBtnTxt:    { color: colors.black, fontWeight: '800', fontSize: 14 },
  closeBtn:       { paddingVertical: 12 },
  closeBtnTxt:    { color: colors.textDim, fontSize: 13 },

  colorGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginVertical: 16 },
  colorSwatch:    { width: 48, height: 48, borderRadius: 12, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  colorSwatchImg: { width: 48, height: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.borderC, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,229,204,0.05)' },

  // Banner extension
  bannerExt: { height: 80, width: '100%', overflow: 'hidden', marginBottom: -4 },

  // Unified background wrapper (Bio + Sobre mí + Muro)
  contentBgWrapper: { overflow: 'hidden', backgroundColor: colors.surface },

  // Section labels
  sectionLabel:      { color: colors.textDim, fontSize: 9, fontWeight: '700', letterSpacing: 3 },
  sectionRow:        { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  sectionLabelBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.deep,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.borderC,
  },
  sectionLabelBadgeTxt: { color: colors.textHi, fontSize: 9, fontWeight: '700', letterSpacing: 3 },

  // Bio — estados vacío / texto / audio
  bioIconsRow:    { flexDirection: 'row', marginHorizontal: 20, paddingVertical: 10, alignItems: 'center' },
  bioIconBtn:     { flex: 1, alignItems: 'center', paddingVertical: 16, gap: 8 },
  bioOptionLabel: { color: colors.textMid, fontSize: 12, fontWeight: '500' },
  bioDivider:     { width: 1, height: 40, backgroundColor: colors.border },
  bioTextDisplay: { marginHorizontal: 20, paddingVertical: 12, paddingBottom: 6, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bioTextContent: { flex: 1, color: colors.textHi, fontSize: 14, lineHeight: 22 },
  bioAudioDisplay:{ marginHorizontal: 20, paddingVertical: 12, gap: 8 },
  bioChangeAudio: { color: colors.textDim, fontSize: 11 },
  bioTextInput:   { width: '100%', color: colors.textHi, fontSize: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, minHeight: 110, textAlignVertical: 'top', backgroundColor: colors.deep, marginBottom: 8 },
  bioWordCount:   { color: colors.textDim, fontSize: 11, alignSelf: 'flex-end', marginBottom: 16 },

  // Muro — glassmorphism
  muroSection: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 24,
    backgroundColor: 'rgba(5,12,20,0.92)',
    height: 340,
  },
  muroHeaderInner:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  muroMsg:          { flexDirection: 'row', padding: 14, gap: 12, alignItems: 'flex-start' },
  muroAvatar:       { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  muroAvatarLetter: { color: colors.c1, fontSize: 14, fontWeight: '700' },
  muroMsgBody:      { flex: 1, gap: 2 },
  muroUsername:     { color: colors.textHi, fontSize: 13, fontWeight: '700' },
  muroText:         { color: colors.textMid, fontSize: 13, lineHeight: 19 },
  muroDate:         { color: colors.textDim, fontSize: 10, marginTop: 2 },
  muroDivider:      { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 14 },
  muroInput:        { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  muroInputTxt:     { color: colors.textDim, fontSize: 13 },
  muroConfigRow:    { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: colors.border, width: '100%' },
  muroConfigLabel:  { flex: 1, color: colors.textMid, fontSize: 14 },
});
