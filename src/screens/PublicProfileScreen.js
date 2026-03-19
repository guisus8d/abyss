import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, StatusBar, SafeAreaView, ActivityIndicator,
  Alert, Dimensions,
} from 'react-native';
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
            other: { _id: profile._id, username: profile.username, avatarUrl: profile.avatarUrl }
          });
        }
      } catch (err) {
        Alert.alert('Error', err.response?.data?.error || 'No se pudo abrir el chat');
      }
      return;
    }
    navigation.navigate('ChatRoom', {
      chat: { _id: null, participants: [] },
      other: { _id: profile._id, username: profile.username, avatarUrl: profile.avatarUrl },
      requestMode: true,
      alreadyRequested: chatStatus === 'requested',
    });
  }

  async function handleFramePress() {
    const frameId = profile?.profileFrame;
    if (!frameId || frameId === 'default' || frameId === 'frame_001') return;
    try {
      const { data } = await api.get(`/frames/${frameId}`);
      navigation.navigate('FrameDetail', {
        frame: data.frame,
        units: null,
        mode: 'viewer',
      });
    } catch {
      // si falla, el avatar queda sin acción
    }
  }

  if (loading) return (
    <View style={s.root}><ActivityIndicator color={colors.c1} style={{ marginTop: 80 }} /></View>
  );

  const isMe      = profile?._id === me._id;
  const daysSince = Math.floor((Date.now() - new Date(profile?.createdAt)) / 86400000);
  const isImageBg = profile?.profileBgType === 'image';
  const hasBg     = !!profile?.profileBg;
  const prefs     = { showXp: true, showFollowers: true, showFollowing: true, showPosts: true, ...(profile?.profilePrefs || {}) };
  const TABS = TABS_BASE.filter(t => t.key !== "posts" || prefs.showPosts);
  const TAB_W     = (W - 32) / TABS.length;

  return (
    <View style={s.root}>
      {isImageBg && profile?.profileBg
        ? <Image source={{ uri: profile.profileBg }} style={s.fullBgImage} resizeMode="cover" />
        : null}
      {isImageBg && profile?.profileBg
        ? <View style={s.fullBgOverlay} />
        : null}
      {!isImageBg && hasBg
        ? <View style={[s.fullBgColor, { backgroundColor: profile.profileBg }]} />
        : null}
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={colors.c1} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{profile?.username}</Text>
          {!isMe ? (
            <TouchableOpacity onPress={handleBlock}>
              <Ionicons name={blocked ? 'lock-open-outline' : 'ban-outline'} size={20} color={colors.textDim} />
            </TouchableOpacity>
          ) : <View style={{ width: 32 }} />}
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <LinearGradient colors={['rgba(0,110,100,0.2)','rgba(2,5,9,1)']} style={s.hero}>
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
          {prefs.showXp && (
            <View style={s.xpRow}>
              <Text style={s.xpLabel}>XP</Text>
              <View style={s.xpBarBg}>
                <LinearGradient colors={['#006b63','#00e5cc']} style={[s.xpBarFill, { width: `${Math.min((profile?.xp||0)%100,100)}%` }]} start={{x:0,y:0}} end={{x:1,y:0}} />
              </View>
              <Text style={s.xpVal}>{profile?.xp || 0}</Text>
            </View>
          )}

          {!isMe && !blocked && (
            <View style={s.actionRow}>
              <TouchableOpacity onPress={handleFollow} disabled={loadingBtn} style={{ flex: 1 }}>
                {following ? (
                  <View style={s.btnUnfollow}>
                    <Ionicons name="checkmark" size={14} color={colors.c1} />
                    <Text style={s.btnUnfollowTxt}>{loadingBtn ? '...' : 'Siguiendo'}</Text>
                  </View>
                ) : (
                  <LinearGradient colors={['#006b63','#00e5cc']} style={s.btnFollow} start={{x:0,y:0}} end={{x:1,y:0}}>
                    <Ionicons name="person-add-outline" size={14} color="#001a18" />
                    <Text style={s.btnFollowTxt}>{loadingBtn ? '...' : 'Seguir'}</Text>
                  </LinearGradient>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={s.btnChat} onPress={handleChat}>
                <Ionicons name="chatbubble-outline" size={15} color={colors.textMid} />
                <Text style={s.btnChatTxt}>
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
        </LinearGradient>

        {/* Stats */}
        {(prefs.showFollowing || prefs.showFollowers || prefs.showPosts) && (
        <View style={s.statsRow}>
          {prefs.showFollowing && (
            <TouchableOpacity style={s.stat} onPress={() => navigation.navigate('FollowList', { username: profile?.username, type: 'following' })}>
              <Text style={s.statVal}>{profile?.following?.length || 0}</Text>
              <Text style={s.statLbl}>SIGUIENDO</Text>
            </TouchableOpacity>
          )}
          {prefs.showFollowing && (prefs.showPosts || prefs.showFollowers) && <View style={s.statDiv} />}
          {prefs.showPosts && (
            <View style={s.stat}>
              <Text style={[s.statVal, { color: colors.c1 }]}>{posts.length}</Text>
              <Text style={s.statLbl}>POSTS</Text>
            </View>
          )}
          {prefs.showPosts && prefs.showFollowers && <View style={s.statDiv} />}
          {prefs.showFollowers && (
            <TouchableOpacity style={s.stat} onPress={() => navigation.navigate('FollowList', { username: profile?.username, type: 'followers' })}>
              <Text style={s.statVal}>{profile?.followers?.length || 0}</Text>
              <Text style={s.statLbl}>SEGUIDORES</Text>
            </TouchableOpacity>
          )}
        </View>
        )}

        {/* Tabs */}
        <View style={[s.tabBar, { marginHorizontal: 16 }]}>
          {TABS.map(t => (
            <TouchableOpacity key={t.key} style={[s.tabBtn, { width: TAB_W }]} onPress={() => setTab(t.key)}>
              <Ionicons name={t.icon} size={20} color={tab === t.key ? colors.c1 : colors.textDim} />
              {tab === t.key && <View style={[s.tabDot, { width: TAB_W }]} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab: Perfil */}
        {tab === 'profile' && (
          <View style={s.padded}>
            <View style={[s.profileSection, profile?.profileBgType === 'image' && { overflow: 'hidden' }]}>
              {profile?.profileBgType === 'image' && profile?.profileBg
                ? <><Image source={{ uri: profile.profileBg }} style={s.sectionBgImage} resizeMode="cover" blurRadius={1} />
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 16 }]} /></>
                : null}
              {profile?.profileBgType !== 'image' && profile?.profileBg
                ? <View style={[StyleSheet.absoluteFill, { backgroundColor: profile.profileBg, borderRadius: 16 }]} />
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

        {/* Posts feed */}
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

        {/* Badges */}
        {tab === 'badges' && (
          <View style={s.padded}>
            {profile?.badges?.length === 0 ? (
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
  fullBgImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 },
  fullBgOverlay:{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 0 },
  fullBgColor: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 4, color: colors.c1 },

  hero:     { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  username: { color: colors.textHi, fontSize: 22, fontWeight: '700', marginTop: 14, marginBottom: 6 },
  bio:      { color: colors.textDim, fontSize: 13, textAlign: 'center', marginBottom: 16, lineHeight: 18, maxWidth: 260 },
  xpRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', marginBottom: 12 },
  xpLabel:  { color: colors.textDim, fontSize: 10, letterSpacing: 2, width: 24 },
  xpBarBg:  { flex: 1, height: 5, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' },
  xpBarFill:{ height: '100%', borderRadius: 3, minWidth: 4 },
  xpVal:    { color: colors.c1, fontSize: 12, fontWeight: '700', width: 36, textAlign: 'right' },

  actionRow:      { flexDirection: 'row', gap: 12, width: '100%', marginTop: 4 },
  btnFollow:      { borderRadius: 12, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  btnFollowTxt:   { color: '#001a18', fontWeight: '700', fontSize: 14 },
  btnUnfollow:    { borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.borderC, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  btnUnfollowTxt: { color: colors.c1, fontWeight: '700', fontSize: 14 },
  btnChat:        { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20, borderWidth: 1, borderColor: colors.border, alignItems: 'center', flexDirection: 'row', gap: 6 },
  btnChatTxt:     { color: colors.textMid, fontSize: 14 },
  blockedBanner:  { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', flexDirection: 'row', gap: 8, alignItems: 'center' },
  blockedTxt:     { color: 'rgba(239,68,68,0.7)', fontSize: 13 },

  statsRow: { flexDirection: 'row', margin: 16, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 18 },
  stat:     { flex: 1, alignItems: 'center' },
  statVal:  { color: colors.textHi, fontSize: 20, fontWeight: '700' },
  statLbl:  { color: colors.textDim, fontSize: 8, letterSpacing: 2, marginTop: 3 },
  statDiv:  { width: 1, backgroundColor: colors.border },

  tabBar:       { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 16, overflow: 'hidden' },
  tabBtn:       { alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  tabDot:       { position: 'absolute', bottom: 0, height: 2, backgroundColor: colors.c1, borderRadius: 1 },

  postsGrid:   { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 2 },
  postTile:    { backgroundColor: colors.card, borderRadius: 6, overflow: 'hidden', justifyContent: 'center', padding: 6 },
  postTileTxt: { color: colors.textDim, fontSize: 10, lineHeight: 14 },

  padded:     { paddingHorizontal: 16 },
  bioCard:    { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 20, minHeight: 100 },
  bioCardLabel: { color: colors.textDim, fontSize: 9, letterSpacing: 3, marginBottom: 12 },
  bioText:    { color: colors.textHi, fontSize: 14, lineHeight: 22 },

  profileSection:  { borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, position: 'relative', minHeight: 120 },
  sectionBgImage:  { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 16 },
  blocksContainer: { gap: 8, paddingBottom: 8 },
  emptyPage:       { alignItems: 'center', paddingVertical: 24 },
  emptyPageTxt:    { color: colors.textDim, fontSize: 12 },
  mentionBlockView:{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(0,229,204,0.07)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,229,204,0.2)', padding: 12 },
  mentionBlockAv:  { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.deep, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  mentionBlockAt:  { flex: 1, color: colors.c1, fontWeight: '700', fontSize: 14 },
  emptyTab:   { alignItems: 'center', paddingVertical: 48, gap: 12, width: '100%' },
  emptyTxt:   { color: colors.textDim, fontSize: 14 },

  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeCard:  { alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.borderC, padding: 14, width: (W - 52) / 3 },
  badgeIcon:  { fontSize: 28, marginBottom: 6 },
  badgeName:  { color: colors.c1, fontSize: 9, letterSpacing: 1, textAlign: 'center' },
  badgeDesc:  { color: colors.textDim, fontSize: 9, textAlign: 'center', marginTop: 2 },
});
