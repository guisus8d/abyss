import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, StatusBar, ActivityIndicator,
  Alert, Dimensions, Share, Clipboard, Modal, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import AvatarWithFrame from '../components/AvatarWithFrame';
import PostCard from '../components/PostCard';

const W = Dimensions.get('window').width;
const POST_TILE = (W - 32 - 4) / 3;

const TABS_BASE = [
  { key: 'profile', icon: 'person-outline'  },
  { key: 'posts',   icon: 'grid-outline'    },
  { key: 'badges',  icon: 'ribbon-outline'  },
];

export default function PublicProfileScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { username } = route.params;
  const { user: me } = useAuthStore();
  const [profile, setProfile]       = useState(null);
  const [posts, setPosts]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [following, setFollowing]   = useState(false);
  const [blocked, setBlocked]       = useState(false);
  const [loadingBtn, setLoadingBtn] = useState(false);
  const [chatStatus, setChatStatus] = useState('none');
  const [tab, setTab]               = useState('profile');
  const [openPickerId, setOpenPickerId] = useState(null);
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    if (username === me?.username) {
      navigation.replace('Profile');
    }
  }, [username]);

  async function handleReact(postId, type) {
    setPosts(prev => prev.map(p => {
      if (p._id !== postId) return p;
      const already = p.reactions.find(r => (r.user?._id||r.user) === me?._id && r.type === type);
      return { ...p, reactions: already
        ? p.reactions.filter(r => !((r.user?._id||r.user) === me?._id && r.type === type))
        : [...p.reactions, { user: me?._id, type }] };
    }));
    try { await api.post(`/posts/${postId}/react`, { type }); } catch {}
  }

  async function handleComment(postId, text, replyTo) {
    try {
      const { data } = await api.post(`/posts/${postId}/comment`, { text, replyTo });
      setPosts(prev => prev.map(p => p._id === postId ? { ...p, comments: data.comments } : p));
    } catch {}
  }

  useEffect(() => { loadProfile(); }, []);

  useEffect(() => {
    const { user: me } = useAuthStore.getState();
    if (username === me?.username) {
      navigation.replace('Profile');
    }
  }, []);

  async function loadProfile() {
    try {
      const [profileRes, postsRes] = await Promise.all([
        api.get(`/users/${username}`),
        api.get(`/posts/user/${username}`).catch(() => ({ data: { posts: [] } })),
      ]);
      setProfile(profileRes.data.user);
      setPosts(postsRes.data.posts || []);
      setFollowing(profileRes.data.user.followers?.some(f => f._id === me._id || f === me._id));
      try {
        const chatRes = await api.get(`/chats/check/${profileRes.data.user._id}`);
        setChatStatus(chatRes.data.status);
      } catch { setChatStatus('none'); }
    } catch {
      Alert.alert('Error', 'No se pudo cargar el perfil');
    } finally {
      setLoading(false);
    }
  }

  async function handleFollow() {
    setLoadingBtn(true);
    try {
      const { data } = await api.post(`/social/follow/${username}`);
      setFollowing(data.following);
      setProfile(prev => ({
        ...prev,
        followers: data.following
          ? [...(prev.followers || []), { _id: me._id }]
          : (prev.followers || []).filter(f => f._id !== me._id),
      }));
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Error al seguir');
    } finally {
      setLoadingBtn(false);
    }
  }

  async function handleShare() {
    setMenuVisible(false);
    try {
      await Share.share({
        message: `Mira el perfil de @${username} en Abyss: https://abyss.social/@${username}`,
        url: `https://abyss.social/@${username}`,
      });
    } catch {}
  }

  function handleCopyLink() {
    setMenuVisible(false);
    Clipboard.setString(`https://abyss.social/@${username}`);
    Alert.alert('Enlace copiado', `abyss.social/@${username}`);
  }

  async function handleBlock() {
    Alert.alert(
      blocked ? 'Desbloquear' : 'Bloquear',
      `¿${blocked ? 'Desbloquear' : 'Bloquear'} a ${username}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: blocked ? 'Desbloquear' : 'Bloquear', style: 'destructive', onPress: async () => {
          try {
            const { data } = await api.post(`/social/block/${username}`);
            setBlocked(data.blocked);
            if (data.blocked) setFollowing(false);
          } catch (err) {
            Alert.alert('Error', err.response?.data?.error);
          }
        }}
      ]
    );
  }

  async function handleChat() {
    if (chatStatus === 'active') {
      try {
        const { data } = await api.get(`/chats/with/${profile._id}`);
        if (data.chat) {
          navigation.navigate('ChatRoom', {
            chat: data.chat,
            other: { _id: profile._id, username: profile.username, avatarUrl: profile.avatarUrl, profileFrame: profile.profileFrame, profileFrameUrl: profile.profileFrameUrl }
          });
        }
      } catch (err) {
        Alert.alert('Error', err.response?.data?.error || 'No se pudo abrir el chat');
      }
      return;
    }
    navigation.navigate('ChatRoom', {
      chat: { _id: null, participants: [] },
      other: { _id: profile._id, username: profile.username, avatarUrl: profile.avatarUrl, profileFrame: profile.profileFrame, profileFrameUrl: profile.profileFrameUrl },
      requestMode: true,
      alreadyRequested: chatStatus === 'requested',
    });
  }

  async function handleFramePress() {
    const frameId = profile?.profileFrame;
    if (!frameId || frameId === 'default' || frameId === 'frame_001') return;
    try {
      const { data } = await api.get(`/frames/${frameId}`);
      navigation.navigate('FrameDetail', { frame: data.frame, units: null, mode: 'viewer' });
    } catch {}
  }

  if (loading) return (
    <View style={s.root}><ActivityIndicator color={colors.c1} style={{ marginTop: 80 }} /></View>
  );

  const theyFollowMe = profile?.following?.some(f => f._id === me._id || f === me._id);
  const isMutual     = following && theyFollowMe;
  const isMe      = profile?._id === me._id;
  const isImageBg = profile?.profileBgType === 'image';
  const hasBg     = !!profile?.profileBg;
  const prefs     = { showXp: true, showFollowers: true, showFollowing: true, showPosts: true, ...(profile?.profilePrefs || {}) };
  const TABS = TABS_BASE.filter(t => t.key !== "posts" || prefs.showPosts);
  const TAB_W = (W - 32) / TABS.length;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Hero ── */}
        <View style={[s.hero, { paddingTop: insets.top + 100 }]}>
          {profile?.profileBannerType === 'image' && profile?.profileBanner
            ? <><Image source={{ uri: profile.profileBanner }} style={StyleSheet.absoluteFill} resizeMode="cover" />
               <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]} /></>
            : profile?.profileBanner
              ? <View style={[StyleSheet.absoluteFill, { backgroundColor: profile.profileBanner }]} />
              : <LinearGradient colors={['rgba(0,110,100,0.35)','rgba(2,5,9,1)']} style={StyleSheet.absoluteFill} />
          }

          <View style={[s.heroTopRow, { top: insets.top + 12 }]}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
              <Ionicons name="arrow-back" size={20} color="#ffffff" />
            </TouchableOpacity>
            {!isMe && (
              <TouchableOpacity onPress={() => setMenuVisible(true)} style={s.blockBtn}>
                <Ionicons name="ellipsis-vertical" size={18} color="#ffffff" />
              </TouchableOpacity>
            )}
          </View>

          {/* Menu desplegable */}
          <Modal transparent visible={menuVisible} animationType="fade" onRequestClose={() => setMenuVisible(false)}>
            <Pressable style={s.menuOverlay} onPress={() => setMenuVisible(false)}>
              <View style={[s.menuBox, { top: insets.top + 52, right: 16 }]}>
                <TouchableOpacity style={s.menuItem} onPress={handleShare}>
                  <Ionicons name="share-social-outline" size={16} color={colors.textHi} />
                  <Text style={s.menuItemTxt}>Compartir perfil</Text>
                </TouchableOpacity>
                <View style={s.menuDivider} />
                <TouchableOpacity style={s.menuItem} onPress={handleCopyLink}>
                  <Ionicons name="link-outline" size={16} color={colors.textHi} />
                  <Text style={s.menuItemTxt}>Copiar enlace</Text>
                </TouchableOpacity>
                <View style={s.menuDivider} />
                <TouchableOpacity style={s.menuItem} onPress={() => { setMenuVisible(false); handleBlock(); }}>
                  <Ionicons name={blocked ? 'lock-open-outline' : 'ban-outline'} size={16} color="rgba(239,68,68,0.8)" />
                  <Text style={[s.menuItemTxt, { color: 'rgba(239,68,68,0.8)' }]}>{blocked ? 'Desbloquear' : 'Bloquear'}</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Modal>

          <TouchableOpacity
            onPress={handleFramePress}
            activeOpacity={profile?.profileFrame && profile.profileFrame !== 'default' && profile.profileFrame !== 'frame_001' ? 0.8 : 1}
            disabled={!profile?.profileFrame || profile.profileFrame === 'default' || profile.profileFrame === 'frame_001'}
          >
            <AvatarWithFrame
              size={88}
              avatarUrl={profile?.avatarUrl}
              username={profile?.username}
              profileFrame={profile?.profileFrame}
              frameUrl={profile?.profileFrameUrl}
              bgColor="rgba(0,229,204,0.12)"
            />
          </TouchableOpacity>

          <Text style={s.username}>{profile?.username}</Text>
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

          {/* ── Botones Seguir / Chat ── */}
          {!isMe && !blocked && (
            <View style={s.actionRow}>
              <TouchableOpacity onPress={handleFollow} disabled={loadingBtn} style={{ flex: 1 }}>
                {following ? (
                  <View style={s.btnUnfollow}>
                    <Ionicons name={isMutual ? 'people' : 'checkmark'} size={14} color={colors.c1} />
                    <Text style={s.btnUnfollowTxt}>{loadingBtn ? '...' : isMutual ? 'Amigos' : 'Siguiendo'}</Text>
                  </View>
                ) : (
                  <LinearGradient colors={['#006b63','#00e5cc']} style={s.btnFollow} start={{x:0,y:0}} end={{x:1,y:0}}>
                    <Ionicons name="person-add-outline" size={14} color="#001a18" />
                    <Text style={s.btnFollowTxt}>{loadingBtn ? '...' : 'Seguir'}</Text>
                  </LinearGradient>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={s.btnChat} onPress={handleChat}>
                <Ionicons
                  name={chatStatus === 'active' ? 'chatbubble' : chatStatus === 'requested' ? 'time-outline' : 'chatbubble-outline'}
                  size={15}
                  color={chatStatus === 'active' ? colors.c1 : colors.textMid}
                />
                <Text style={[s.btnChatTxt, chatStatus === 'active' && { color: colors.c1 }]}>
                  {chatStatus === 'active' ? 'Chat' : chatStatus === 'requested' ? 'Pendiente' : 'Chatear'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {blocked && (
            <View style={s.blockedBanner}>
              <Ionicons name="ban-outline" size={14} color="rgba(239,68,68,0.7)" />
              <Text style={s.blockedTxt}>Usuario bloqueado</Text>
            </View>
          )}
        </View>

        {/* ── Tabs ── */}
        <View style={[s.tabBar, { marginHorizontal: 16 }]}>
          {TABS.map(t => (
            <TouchableOpacity key={t.key} style={[s.tabBtn, { width: TAB_W }]} onPress={() => setTab(t.key)}>
              <Ionicons name={t.icon} size={20} color={tab === t.key ? '#ffffff' : colors.textDim} />
              {tab === t.key && <View style={[s.tabDot, { width: TAB_W }]} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Tab: Perfil — full width, sin padded ── */}
        {tab === 'profile' && (
          <View>
            <View style={[
              s.profileSection,
              isImageBg && { overflow: 'hidden' },
              { borderRadius: 0, borderLeftWidth: 0, borderRightWidth: 0, paddingHorizontal: 20 },
            ]}>
              {isImageBg && profile?.profileBg
                ? <>
                    {/* Sin borderRadius en Image — el parent clipea con overflow:hidden */}
                    <Image source={{ uri: profile.profileBg }} style={s.sectionBgImage} resizeMode="cover" />
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)' }]} />
                  </>
                : null}
              {!isImageBg && profile?.profileBg
                ? <View style={[StyleSheet.absoluteFill, { backgroundColor: profile.profileBg }]} />
                : null}
              <View style={s.blocksContainer}>
                {(!profile?.profileBlocks || profile.profileBlocks.length === 0) && (
                  <View style={s.emptyPage}>
                    <Text style={s.emptyPageTxt}>Sin contenido todavía</Text>
                  </View>
                )}
                {(profile?.profileBlocks || []).map((block, i) => {
                  if (block.type === 'text') return (
                    <Text key={block.id || i} style={{ fontSize: block.fontSize || 14, fontWeight: block.bold ? '700' : '400', textAlign: block.align || 'left', color: colors.textHi, lineHeight: (block.fontSize || 14) * 1.5, marginBottom: 8 }}>
                      {block.content}
                    </Text>
                  );
                  if (block.type === 'image' && block.imageUrl) return (
                    <Image key={block.id || i} source={{ uri: block.imageUrl }} style={{ width: '100%', height: 180, borderRadius: 12, marginBottom: 8 }} resizeMode="cover" />
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
            </View>
          </View>
        )}

        {/* ── Tab: Posts ── */}
        {tab === 'posts' && prefs.showPosts && (
          <View>
            {posts.length === 0 ? (
              <View style={s.emptyTab}>
                <Ionicons name="document-text-outline" size={40} color={colors.textDim} />
                <Text style={s.emptyTxt}>Sin publicaciones aún</Text>
              </View>
            ) : posts.map(p => (
              <PostCard
                key={p._id}
                post={p}
                currentUserId={me?._id}
                onReact={handleReact}
                onComment={handleComment}
                onDelete={() => {}}
                navigation={navigation}
                openPickerId={openPickerId}
                setOpenPickerId={setOpenPickerId}
              />
            ))}
          </View>
        )}

        {/* ── Tab: Badges ── */}
        {tab === 'badges' && (
          <View style={s.padded}>
            {!profile?.badges?.length ? (
              <View style={s.emptyTab}>
                <Ionicons name="ribbon-outline" size={40} color={colors.textDim} />
                <Text style={s.emptyTxt}>Sin emblemas aún</Text>
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

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.black },
  heroTopRow:  { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', zIndex: 10 },
  backBtn:     { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  blockBtn:    { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },

  // ✅ Banner: ancho completo, sin borde circular
  hero: { alignItems: 'center', paddingBottom: 60, paddingHorizontal: 24, overflow: 'hidden', width: W, alignSelf: 'stretch', position: 'relative' },

  username: { color: colors.textHi, fontSize: 22, fontWeight: '700', marginTop: 14, marginBottom: 6 },
  xpSimple: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700', marginTop: 4, marginBottom: 12 },

  actionRow:      { flexDirection: 'row', gap: 12, width: '100%', marginTop: 20 },

  // Seguir — gradiente verde
  btnFollow:      { borderRadius: 12, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  btnFollowTxt:   { color: '#001a18', fontWeight: '700', fontSize: 14 },

  // Siguiendo / Amigos — fondo sutil teal
  btnUnfollow:    { borderRadius: 12, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(0,229,204,0.22)', borderWidth: 1, borderColor: 'rgba(0,229,204,0.5)' },
  btnUnfollowTxt: { color: colors.c1, fontWeight: '700', fontSize: 14 },

  // Chat — fondo oscuro con borde
  btnChat:        { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', flexDirection: 'row', gap: 6 },
  btnChatTxt:     { color: colors.textMid, fontSize: 14 },

  menuOverlay:   { flex: 1, backgroundColor: 'transparent' },
  menuBox:       { position: 'absolute', backgroundColor: '#0f1923', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', minWidth: 200, overflow: 'hidden', elevation: 10, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12 },
  menuItem:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 18 },
  menuItemTxt:   { color: '#ffffff', fontSize: 14, fontWeight: '500' },
  menuDivider:   { height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  blockedBanner:  { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', flexDirection: 'row', gap: 8, alignItems: 'center' },
  blockedTxt:     { color: 'rgba(239,68,68,0.7)', fontSize: 13 },

  tabBar:       { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 16, overflow: 'hidden' },
  tabBtn:       { alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  tabDot:       { position: 'absolute', bottom: 0, height: 2, backgroundColor: '#ffffff', borderRadius: 1 },

  heroStats:    { flexDirection: 'row', width: '100%', marginTop: 8, gap: 8, justifyContent: 'center' },
  heroStat:     { width: 100, alignItems: 'center', paddingVertical: 12, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  heroStatVal:  { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  heroStatLbl:  { color: 'rgba(255,255,255,0.6)', fontSize: 8, letterSpacing: 2, marginTop: 2 },
  heroStatDiv:  { width: 1, backgroundColor: 'rgba(255,255,255,0.1)' },

  // ✅ Section: sin borderRadius lateral para que tome 100% ancho
  profileSection:  { borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: 16, position: 'relative', minHeight: 120, backgroundColor: 'rgba(255,255,255,0.04)' },
  // ✅ Sin borderRadius en Image — el parent con overflow:hidden clipea limpiamente
  sectionBgImage:  { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  blocksContainer: { gap: 8, paddingBottom: 8 },
  emptyPage:       { alignItems: 'center', paddingVertical: 24 },
  emptyPageTxt:    { color: colors.textDim, fontSize: 12 },
  mentionBlockView:{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(0,229,204,0.07)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,229,204,0.2)', padding: 12 },
  mentionBlockAv:  { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.deep, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  mentionBlockAt:  { flex: 1, color: colors.c1, fontWeight: '700', fontSize: 14 },

  padded:     { paddingHorizontal: 16 },
  emptyTab:   { alignItems: 'center', paddingVertical: 48, gap: 12, width: '100%' },
  emptyTxt:   { color: colors.textDim, fontSize: 14 },
  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeCard:  { alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.borderC, padding: 14, width: (W - 52) / 3 },
  badgeIcon:  { fontSize: 28, marginBottom: 6 },
  badgeName:  { color: colors.c1, fontSize: 9, letterSpacing: 1, textAlign: 'center' },
  badgeDesc:  { color: colors.textDim, fontSize: 9, textAlign: 'center', marginTop: 2 },
});
