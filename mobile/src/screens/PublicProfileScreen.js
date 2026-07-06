import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, FlatList, TouchableOpacity, Image, TextInput,
  StyleSheet, StatusBar, ActivityIndicator,
  Alert, Dimensions, Clipboard, Modal, Pressable, Linking, Platform,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getActivityStatus, getRelativeTime } from '../utils/timeUtils';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import AvatarWithFrame from '../components/AvatarWithFrame';
import PostCard from '../components/PostCard';
import AudioMessage from '../components/AudioMessage';
import GenderIcon from '../components/GenderIcon';
import VerifiedIcon from '../components/VerifiedIcon';
import ReportModal from '../components/ReportModal';
import ShareProfileModal from '../components/ShareProfileModal';

const W        = Dimensions.get('window').width;
const H        = Dimensions.get('window').height;
const GRID_GAP = 4;
const CELL     = Math.floor((W - 40 - GRID_GAP) / 2);
const isWeb = Platform.OS === 'web';

const TABS_BASE = [
  { key: 'profile', icon: 'person-outline' },
  { key: 'posts',   icon: 'grid-outline'   },
  { key: 'badges',  icon: 'ribbon-outline' },
];

export default function PublicProfileScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { username } = route.params;
  const { user: me, updateUser } = useAuthStore();

  const [profile,          setProfile]          = useState(null);
  const [posts,            setPosts]            = useState([]);
  const [totalPosts,       setTotalPosts]       = useState(0);
  const [postsPage,        setPostsPage]        = useState(1);
  const [postsHasMore,     setPostsHasMore]     = useState(true);
  const [postsLoadingMore, setPostsLoadingMore] = useState(false);
  const [loading,          setLoading]          = useState(true);
  const [following,        setFollowing]        = useState(false);
  const [blocked,          setBlocked]          = useState(false);
  const [loadingBtn,       setLoadingBtn]       = useState(false);
  const [chatStatus,       setChatStatus]       = useState('none');
  const [tab,              setTab]              = useState('profile');
  const [openPickerId,     setOpenPickerId]     = useState(null);
  const [menuVisible,      setMenuVisible]      = useState(false);
  const [reportOpen,       setReportOpen]       = useState(false);
  const [shareProfileOpen, setShareProfileOpen] = useState(false);
  const [activityStatus,   setActivityStatus]   = useState({ text: '', isOnline: false });
  const [userHasStore,     setUserHasStore]     = useState(false);
  const [wallMessages,     setWallMessages]     = useState([]);
  const [wallLoading,      setWallLoading]      = useState(false);
  const [wallText,         setWallText]         = useState('');
  const [wallPosting,      setWallPosting]      = useState(false);
  const [viewerVisible,    setViewerVisible]    = useState(false);
  const [viewerIndex,      setViewerIndex]      = useState(0);

  useEffect(() => {
    if (username === me?.username) navigation.replace('Profile');
  }, [username]);

  useFocusEffect(useCallback(() => { loadProfile(); }, []));

  useEffect(() => {
    setActivityStatus(getActivityStatus(profile?.lastActive));
    const interval = setInterval(() => {
      setActivityStatus(getActivityStatus(profile?.lastActive));
    }, 60000);
    return () => clearInterval(interval);
  }, [profile?.lastActive]);

  async function loadProfile() {
    setLoading(true);
    try {
      const [profileRes, postsRes, storeRes] = await Promise.all([
        api.get(`/users/${encodeURIComponent(username)}`),
        api.get(`/posts/user/${encodeURIComponent(username)}?page=1&limit=10`).catch(() => ({ data: { posts: [], total: 0, hasMore: false } })),
        api.get(`/store/${encodeURIComponent(username)}`).catch(() => null),
      ]);
      setProfile(profileRes.data.user);
      setUserHasStore(!!(storeRes?.data?.store));
      setPosts(postsRes.data.posts || []);
      setTotalPosts(postsRes.data.total || 0);
      setPostsHasMore(postsRes.data.hasMore ?? false);
      setPostsPage(1);
      setFollowing(profileRes.data.user.followers?.some(f => f._id === me?._id || f === me?._id));
      setBlocked(me?.blockedUsers?.some(id => (id?._id || id) === profileRes.data.user._id) ?? false);
      // Cargar muro
      setWallLoading(true);
      api.get(`/wall/${encodeURIComponent(username)}`)
        .then(r => setWallMessages(r.data.messages || []))
        .catch(() => {})
        .finally(() => setWallLoading(false));
      if (me) {
        try {
          const chatRes = await api.get(`/chats/check/${profileRes.data.user._id}`);
          setChatStatus(chatRes.data.status);
        } catch { setChatStatus('none'); }
      }
    } catch {
      Alert.alert('Error', 'No se pudo cargar el perfil');
    } finally {
      setLoading(false);
    }
  }

  async function loadMorePosts() {
    if (postsLoadingMore || !postsHasMore) return;
    setPostsLoadingMore(true);
    try {
      const nextPage = postsPage + 1;
      const { data } = await api.get(`/posts/user/${encodeURIComponent(username)}?page=${nextPage}&limit=10`);
      setPosts(prev => {
        const all = [...prev, ...(data.posts || [])];
        return [...new Map(all.map(p => [p._id?.toString(), p])).values()];
      });
      setPostsHasMore(data.hasMore ?? false);
      setPostsPage(nextPage);
    } catch {}
    finally { setPostsLoadingMore(false); }
  }

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

  async function handleDelete(postId) {
    try {
      await api.delete(`/posts/${postId}`);
      setPosts(prev => prev.filter(p => p._id !== postId));
      setTotalPosts(prev => Math.max(0, prev - 1));
    } catch {}
  }

  async function handleFollow() {
    setLoadingBtn(true);
    try {
      const { data } = await api.post(`/social/follow/${encodeURIComponent(username)}`);
      setFollowing(data.following);
      setProfile(prev => ({
        ...prev,
        followers: data.following
          ? [...(prev.followers || []), { _id: me._id }]
          : (prev.followers || []).filter(f => f._id !== me._id),
      }));
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Error al seguir');
    } finally { setLoadingBtn(false); }
  }

  // Abre el ShareProfileModal — comparte dentro de Abyss + externo
  function handleShare() {
    setMenuVisible(false);
    setTimeout(() => setShareProfileOpen(true), 300);
  }

  function handleCopyLink() {
    setMenuVisible(false);
    Clipboard.setString(`https://abyss.social/user/${username}`);
    Alert.alert('Enlace copiado', `abyss.social/user/${username}`);
  }

  async function handleBlock() {
    setMenuVisible(false);
    Alert.alert(
      blocked ? 'Desbloquear' : 'Bloquear',
      `¿${blocked ? 'Desbloquear' : 'Bloquear'} a @${username}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: blocked ? 'Desbloquear' : 'Bloquear', style: 'destructive', onPress: async () => {
          try {
            const { data } = await api.post(`/social/block/${encodeURIComponent(username)}`);
            setBlocked(data.blocked);
            if (data.blocked) {
              setFollowing(false);
              updateUser({ ...me, blockedUsers: [...(me.blockedUsers || []), profile._id] });
            } else {
              updateUser({ ...me, blockedUsers: (me.blockedUsers || []).filter(id => id.toString() !== profile._id.toString()) });
            }
          } catch (err) { Alert.alert('Error', err.response?.data?.error); }
        }},
      ]
    );
  }

  async function handleUnblock() {
    try {
      await api.post(`/social/block/${encodeURIComponent(username)}`);
      setBlocked(false);
      updateUser({ ...me, blockedUsers: (me.blockedUsers || []).filter(id => id.toString() !== profile._id.toString()) });
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Error al desbloquear');
    }
  }

  function handleReport() {
    setMenuVisible(false);
    setTimeout(() => setReportOpen(true), 300);
  }

  async function handleChat() {
    try {
      const { data } = await api.post(`/chats/request/${profile._id}`);
      if (!data.chat?._id) throw new Error('Chat inválido');
      navigation.navigate('ChatRoom', {
        chat:  data.chat,
        other: { _id: profile._id, username: profile.username, avatarUrl: profile.avatarUrl, profileFrame: profile.profileFrame, profileFrameUrl: profile.profileFrameUrl },
      });
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo abrir el chat');
    }
  }

  async function handleFramePress() {
    const frameId = profile?.profileFrame;
    if (!frameId || frameId === 'default' || frameId === 'frame_001') return;
    try {
      const { data } = await api.get(`/frames/${frameId}`);
      navigation.navigate('MarketFrameDetail', { frame: data.frame });
    } catch {}
  }

  async function postWallMsg() {
    if (!wallText.trim()) return;
    setWallPosting(true);
    try {
      const { data } = await api.post(`/wall/${encodeURIComponent(username)}`, { text: wallText.trim() });
      setWallMessages(prev => [data.message, ...prev]);
      setWallText('');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo enviar el mensaje');
    } finally {
      setWallPosting(false);
    }
  }

  async function deleteWallMsg(id) {
    Alert.alert('Eliminar', '¿Eliminar este mensaje?', [
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

  if (loading) return (
    <View style={s.root}><ActivityIndicator color={colors.c1} style={{ marginTop: 80 }} /></View>
  );

  if (blocked) return (
    <View style={{ flex:1, backgroundColor:'#020509' }}>
      <StatusBar barStyle="light-content" backgroundColor={colors.black} />
      <SafeAreaView edges={['top']}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding:16 }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
      </SafeAreaView>
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:32 }}>
        <View style={{ width:80, height:80, borderRadius:40, backgroundColor:'#091525', alignItems:'center', justifyContent:'center', marginBottom:20, borderWidth:1, borderColor:'#0d1520' }}>
          <Ionicons name="person-outline" size={40} color="#3a5570" />
        </View>
        <Text style={{ color:'#e8f4f8', fontSize:20, fontWeight:'700', marginTop:16, textAlign:'center' }}>
          Contenido bloqueado
        </Text>
        <Text style={{ color:'#3a5570', fontSize:14, marginTop:8, textAlign:'center', lineHeight:22 }}>
          Has bloqueado a este usuario.{'\n'}Su contenido no está disponible.
        </Text>
        <TouchableOpacity
          onPress={handleUnblock}
          style={{ marginTop:32, paddingHorizontal:24, paddingVertical:12, borderRadius:20, borderWidth:1, borderColor:'#0d1520', backgroundColor:'#091525' }}
        >
          <Text style={{ color:'#00e5cc', fontSize:14 }}>Desbloquear usuario</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const theyFollowMe = profile?.following?.some(f => f._id === me?._id || f === me?._id);
  const isMutual     = following && theyFollowMe;
  const prefs        = { showXp: true, showFollowers: true, showFollowing: true, showPosts: true, ...(profile?.profilePrefs || {}) };
  const TABS         = TABS_BASE.filter(t => t.key !== 'posts' || prefs.showPosts);
  const TAB_W        = W / TABS.length;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.black} />

      {/* ── Menú bottom sheet ── */}
      <Modal
        transparent
        visible={menuVisible}
        animationType="slide"
        statusBarTranslucent={true}
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={s.menuOverlay} onPress={() => setMenuVisible(false)}>
          <Pressable style={[s.menuSheet, { paddingBottom: insets.bottom + 8 }]} onPress={e => e.stopPropagation()}>
            <View style={s.menuHandle} />

            {/* Cabecera con avatar */}
            <View style={s.menuProfile}>
              <AvatarWithFrame size={40} avatarUrl={profile?.avatarUrl} username={profile?.username} profileFrame={profile?.profileFrame} frameUrl={profile?.profileFrameUrl} />
              <View>
                <Text style={s.menuProfileName}>{username}</Text>
                <Text style={s.menuProfileSub}>{profile?.followers?.length || 0} seguidores</Text>
              </View>
            </View>

            <View style={s.menuDivider} />

            <TouchableOpacity style={s.menuItem} onPress={handleShare} activeOpacity={0.7}>
              <View style={[s.menuItemIcon, { backgroundColor:'rgba(0,229,204,0.1)' }]}>
                <Ionicons name="share-social-outline" size={18} color={colors.c1} />
              </View>
              <View style={{ flex:1 }}>
                <Text style={s.menuItemTxt}>Compartir perfil</Text>
                <Text style={s.menuItemSub}>Enviar a amigos, grupos o apps externas</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={colors.textDim} />
            </TouchableOpacity>

            <TouchableOpacity style={s.menuItem} onPress={handleCopyLink} activeOpacity={0.7}>
              <View style={[s.menuItemIcon, { backgroundColor:'rgba(255,255,255,0.07)' }]}>
                <Ionicons name="link-outline" size={18} color={colors.textMid} />
              </View>
              <View style={{ flex:1 }}>
                <Text style={s.menuItemTxt}>Copiar enlace</Text>
                <Text style={s.menuItemSub}>abyss.social/user/{username}</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={colors.textDim} />
            </TouchableOpacity>

            {me && (
              <>
                <View style={s.menuDivider} />

                <TouchableOpacity style={s.menuItem} onPress={handleBlock} activeOpacity={0.7}>
                  <View style={[s.menuItemIcon, { backgroundColor: blocked ? 'rgba(0,229,204,0.1)' : 'rgba(239,68,68,0.08)' }]}>
                    <Ionicons name={blocked ? 'lock-open-outline' : 'ban-outline'} size={18} color={blocked ? colors.c1 : 'rgba(239,68,68,0.8)'} />
                  </View>
                  <View style={{ flex:1 }}>
                    <Text style={[s.menuItemTxt, { color: blocked ? colors.c1 : 'rgba(239,68,68,0.85)' }]}>
                      {blocked ? 'Desbloquear usuario' : 'Bloquear usuario'}
                    </Text>
                    <Text style={s.menuItemSub}>{blocked ? 'Volver a ver su contenido' : 'No verás su contenido'}</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={s.menuItem} onPress={handleReport} activeOpacity={0.7}>
                  <View style={[s.menuItemIcon, { backgroundColor:'rgba(239,68,68,0.08)' }]}>
                    <Ionicons name="flag-outline" size={18} color="rgba(239,68,68,0.8)" />
                  </View>
                  <View style={{ flex:1 }}>
                    <Text style={[s.menuItemTxt, { color:'rgba(239,68,68,0.85)' }]}>Reportar usuario</Text>
                    <Text style={s.menuItemSub}>Notificar al equipo de moderación</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modales */}
      <ReportModal
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        type="user"
        targetId={profile?._id}
        targetName={profile?.username}
      />
      <ShareProfileModal
        visible={shareProfileOpen}
        onClose={() => setShareProfileOpen(false)}
        profile={profile}
        currentUserId={me?._id}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={400}
        onScroll={({ nativeEvent }) => {
          if (tab !== 'posts' || !postsHasMore || postsLoadingMore) return;
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 300) {
            loadMorePosts();
          }
        }}
      >
        {/* ── Hero ── */}
        <View style={[s.hero, { paddingTop: insets.top + 100 }]}>
          {profile?.profileBannerType === 'image' && profile?.profileBanner
            ? <><Image source={{ uri: profile.profileBanner }} style={StyleSheet.absoluteFill} resizeMode="cover" />
               <View style={[StyleSheet.absoluteFill, { backgroundColor:'rgba(0,0,0,0.45)' }]} /></>
            : profile?.profileBanner
              ? <View style={[StyleSheet.absoluteFill, { backgroundColor: profile.profileBanner }]} />
              : <LinearGradient colors={['rgba(0,110,100,0.35)','rgba(2,5,9,1)']} style={StyleSheet.absoluteFill} />
          }

          <View style={[s.heroTopRow, { top: insets.top + 12 }]}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.heroBtn}>
              <Ionicons name="arrow-back" size={20} color="#ffffff" />
            </TouchableOpacity>
            {userHasStore && (
              <TouchableOpacity
                style={s.heroBtn}
                onPress={() => navigation.navigate('Store', { username })}
              >
                <Ionicons name="storefront-outline" size={20} color={colors.c1} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setMenuVisible(true)} style={s.heroBtn}>
              <Ionicons name="ellipsis-vertical" size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={handleFramePress}
            activeOpacity={profile?.profileFrame && profile.profileFrame !== 'default' ? 0.8 : 1}
            disabled={!profile?.profileFrame || profile.profileFrame === 'default'}
          >
            <AvatarWithFrame size={88} avatarUrl={profile?.avatarUrl} username={profile?.username} profileFrame={profile?.profileFrame} frameUrl={profile?.profileFrameUrl} bgColor="rgba(0,229,204,0.12)" banned={!!profile?.banned} badgeRole={profile?.role} />
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Text style={s.username}>{profile?.username}</Text>
            <GenderIcon gender={profile?.gender} size={14} />
            <VerifiedIcon isCreator={profile?.isCreator} size={14} />
            {profile?.banned && (
              <View style={s.bannedBadge}>
                <Text style={s.bannedBadgeTxt}>Suspendido</Text>
              </View>
            )}
          </View>
          {activityStatus.text ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, marginBottom: 2 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: activityStatus.isOnline ? '#16B88A' : colors.textDim, marginRight: 6 }} />
              <Text style={{ fontSize: 12, color: activityStatus.isOnline ? '#16B88A' : colors.textDim }}>
                {activityStatus.text}
              </Text>
            </View>
          ) : null}
          {prefs.showXp && <Text style={s.xpTxt}>XP {profile?.xp || 0}</Text>}

          <View style={s.heroStats}>
            <TouchableOpacity style={s.heroStat} onPress={prefs.showFollowing ? () => navigation.navigate('FollowList', { username: profile?.username, type:'following' }) : undefined}>
              <Text style={s.heroStatVal}>{prefs.showFollowing ? (profile?.following?.length || 0) : '—'}</Text>
              <Text style={s.heroStatLbl}>SIGUIENDO</Text>
            </TouchableOpacity>
            {prefs.showPosts && (
              <View style={s.heroStat}>
                <Text style={s.heroStatVal}>{totalPosts}</Text>
                <Text style={s.heroStatLbl}>POSTS</Text>
              </View>
            )}
            <TouchableOpacity style={s.heroStat} onPress={prefs.showFollowers ? () => navigation.navigate('FollowList', { username: profile?.username, type:'followers' }) : undefined}>
              <Text style={s.heroStatVal}>{prefs.showFollowers ? (profile?.followers?.length || 0) : '—'}</Text>
              <Text style={s.heroStatLbl}>SEGUIDORES</Text>
            </TouchableOpacity>
          </View>

          {!me && isWeb && (
            <TouchableOpacity
              style={s.ctaBtn}
              onPress={() => Linking.openURL(`abyss://user/${username}`)}
              activeOpacity={0.8}
            >
              <Text style={s.ctaTxt}>Abrir en Abyss</Text>
            </TouchableOpacity>
          )}

          {me && !blocked && (
            <View style={s.actionRow}>
              {!profile?.banned && (
                <TouchableOpacity onPress={handleFollow} disabled={loadingBtn} style={{ flex:1 }}>
                  {following ? (
                    <View style={s.btnUnfollow}>
                      <Text style={s.btnUnfollowTxt}>{loadingBtn ? '...' : isMutual ? 'Amigos' : 'Siguiendo'}</Text>
                    </View>
                  ) : (
                    <LinearGradient colors={['#006b63','#00e5cc']} style={s.btnFollow} start={{x:0,y:0}} end={{x:1,y:0}}>
                      <Text style={s.btnFollowTxt}>{loadingBtn ? '...' : 'Seguir'}</Text>
                    </LinearGradient>
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[s.btnChat, profile?.banned && { flex:1 }]}
                onPress={profile?.banned
                  ? () => Alert.alert('No disponible', 'No puedes contactar a este usuario.')
                  : handleChat
                }>
                <Ionicons name={chatStatus === 'active' ? 'chatbubble' : 'chatbubble-outline'} size={15} color={chatStatus === 'active' ? colors.c1 : colors.textMid} />
                <Text style={[s.btnChatTxt, chatStatus === 'active' && { color: colors.c1 }]}>
                  {chatStatus === 'active' ? 'Chat' : 'Chatear'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {me && blocked && (
            <View style={s.blockedBanner}>
              <Ionicons name="ban-outline" size={14} color="rgba(239,68,68,0.7)" />
              <Text style={s.blockedTxt}>Usuario bloqueado</Text>
            </View>
          )}

        </View>

        {/* ── Tabs ── */}
        <View style={[s.tabBar, { marginHorizontal:0, borderRadius:0 }]}>
          {TABS.map(t => (
            <TouchableOpacity key={t.key} style={[s.tabBtn, { width:TAB_W }]} onPress={() => setTab(t.key)}>
              <Ionicons name={t.icon} size={20} color={tab===t.key?'#ffffff':colors.textDim} />
              {tab===t.key && <View style={[s.tabDot, { width:TAB_W }]} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Tab: Perfil ── */}
        {tab === 'profile' && (
          <View style={s.pubContentBgWrapper}>
            {profile?.profileBgType === 'image' && profile?.profileBg
              ? <>
                  <Image source={{ uri: profile.profileBg }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
                </>
              : profile?.profileBgType !== 'image' && profile?.profileBg
                ? <View style={[StyleSheet.absoluteFill, { backgroundColor: profile.profileBg }]} />
                : null
            }

            {/* ── Bio ── */}
            {((profile?.bioType === 'text' || (!profile?.bioType && profile?.bio?.trim())) && profile?.bio?.trim()) ? (
              <>
                <View style={s.pubSectionLabelRow}>
                  <View style={s.pubSectionBadge}><Text style={s.pubSectionBadgeTxt}>BIO</Text></View>
                </View>
                <View style={s.pubBioSection}>
                  <Text style={s.pubBioText}>{profile.bio}</Text>
                </View>
              </>
            ) : profile?.bioType === 'audio' && profile?.bioAudioUrl ? (
              <>
                <View style={s.pubSectionLabelRow}>
                  <View style={s.pubSectionBadge}><Text style={s.pubSectionBadgeTxt}>BIO</Text></View>
                </View>
                <View style={s.pubBioSection}>
                  <View style={s.pubBioAudio}>
                    <AudioMessage uri={profile.bioAudioUrl} isMe={false} duration={0} />
                  </View>
                </View>
              </>
            ) : null}

            {/* ── Sobre mí ── */}
            <View style={s.pubSectionLabelRow}>
              <View style={s.pubSectionBadge}><Text style={s.pubSectionBadgeTxt}>SOBRE MÍ</Text></View>
            </View>
            <View style={[s.profileSection, { borderWidth:0, borderRadius:0, backgroundColor:'transparent', paddingHorizontal:20 }]}>
              <View style={s.blocksContainer}>
                {(!profile?.profileBlocks || profile.profileBlocks.length===0) && (
                  <View style={s.emptyPage}><Text style={s.emptyPageTxt}>Sin contenido todavía</Text></View>
                )}
                {(() => {
                  const imgBlocks = (profile?.profileBlocks||[]).filter(b => b.type==='image' && b.imageUrl);
                  let imgGridShown = false;
                  return (profile?.profileBlocks||[]).map((block,i) => {
                  if (block.type==='text') return (
                    <Text key={block.id||i} style={{ fontSize:block.fontSize||14, fontWeight:block.bold?'700':'400', textAlign:block.align||'left', color:colors.textHi, lineHeight:(block.fontSize||14)*1.5, marginBottom:8 }}>
                      {block.content}
                    </Text>
                  );
                  if (block.type==='audio' && block.audioUrl) return (
                    <View key={block.id||i} style={s.pubAudioBlock}>
                      <Ionicons name="musical-note-outline" size={14} color={colors.textDim} />
                      <AudioMessage uri={block.audioUrl} isMe={false} duration={0} />
                    </View>
                  );
                  if (block.type==='image' && block.imageUrl) {
                    if (imgGridShown) return null;
                    imgGridShown = true;
                    return (
                      <View key="imgGrid" style={s.imgGrid}>
                        {imgBlocks.map((b, idx) => (
                          <TouchableOpacity key={b.id||idx} style={s.imgCell} activeOpacity={0.85}
                            onPress={() => { setViewerIndex(idx); setViewerVisible(true); }}>
                            <Image source={{ uri:b.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                          </TouchableOpacity>
                        ))}
                      </View>
                    );
                  }
                  if (block.type==='mention') return (
                    <TouchableOpacity key={block.id||i} style={s.mentionBlock} onPress={() => navigation.navigate('PublicProfile', { username:block.mentionUsername })}>
                      <View style={s.mentionAv}>
                        {block.mentionAvatar
                          ? <Image source={{ uri:block.mentionAvatar }} style={{ width:'100%', height:'100%', borderRadius:18 }} />
                          : <Text style={{ color:colors.c1, fontWeight:'700' }}>{block.mentionUsername?.[0]?.toUpperCase()}</Text>}
                      </View>
                      <Text style={s.mentionAt}>{block.mentionUsername}</Text>
                      <Ionicons name="arrow-forward" size={14} color={colors.c1} />
                    </TouchableOpacity>
                  );
                  return null;
                  });
                })()}
              </View>
            </View>

            {/* ── Muro ── */}
            <View style={s.pubMuroSection}>
              <View style={s.pubMuroHeader}>
                <Text style={s.pubMuroTitle}>MURO</Text>
              </View>

              {/* Mensajes — ocupa el espacio flexible arriba */}
              <ScrollView style={{ flex: 1 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {wallLoading && <ActivityIndicator color={colors.c1} style={{ paddingVertical: 20 }} />}
                {!wallLoading && wallMessages.length === 0 && (
                  <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                    <Text style={{ color: colors.textDim, fontSize: 12 }}>Aún no hay mensajes</Text>
                  </View>
                )}
                {wallMessages.map((msg, i) => {
                  const isOwn = msg.author?._id === me?._id || msg.author?.username === me?.username;
                  return (
                    <TouchableOpacity key={msg._id} activeOpacity={isOwn ? 0.8 : 1} onLongPress={isOwn ? () => deleteWallMsg(msg._id) : undefined}>
                      <View style={s.pubMuroMsg}>
                        <TouchableOpacity onPress={() => navigation.navigate('PublicProfile', { username: msg.author?.username })}>
                          <View style={s.pubMuroAvatar}>
                            {msg.author?.avatarUrl
                              ? <Image source={{ uri: msg.author.avatarUrl }} style={{ width: '100%', height: '100%', borderRadius: 18 }} />
                              : <Text style={s.pubMuroAvatarLetter}>{msg.author?.username?.[0]?.toUpperCase()}</Text>}
                          </View>
                        </TouchableOpacity>
                        <View style={s.pubMuroMsgBody}>
                          <Text style={s.pubMuroUsername}>{msg.author?.username}</Text>
                          <Text style={s.pubMuroText}>{msg.text}</Text>
                          <Text style={s.pubMuroDate}>{getRelativeTime(msg.createdAt)}</Text>
                        </View>
                      </View>
                      {i < wallMessages.length - 1 && <View style={s.pubMuroDivider} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Input fijo en la parte inferior */}
              {me && (
                <View style={s.pubMuroInputRow}>
                  <TextInput
                    style={s.pubMuroInput}
                    placeholder="Escribe algo en el muro…"
                    placeholderTextColor={colors.textDim}
                    value={wallText}
                    onChangeText={setWallText}
                    maxLength={500}
                    multiline
                  />
                  <TouchableOpacity
                    style={[s.pubMuroSendBtn, (!wallText.trim() || wallPosting) && { opacity: 0.4 }]}
                    onPress={postWallMsg}
                    disabled={!wallText.trim() || wallPosting}
                  >
                    {wallPosting
                      ? <ActivityIndicator size="small" color={colors.black} />
                      : <Ionicons name="send" size={16} color={colors.black} />}
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={{ height: 20 }} />
          </View>
        )}

        {/* ── Tab: Posts ── */}
        {tab==='posts' && prefs.showPosts && (
          <View>
            {profile?.banned ? (
              <View style={s.emptyTab}>
                <Text style={s.emptyTxt}>Este usuario no tiene contenido disponible</Text>
              </View>
            ) : posts.length===0 ? (
              <View style={s.emptyTab}>
                <Ionicons name="document-text-outline" size={40} color={colors.textDim} />
                <Text style={s.emptyTxt}>Sin publicaciones aún</Text>
              </View>
            ) : posts.map(p => (
              <PostCard key={p._id} post={p} currentUserId={me?._id} currentUserRole={me?.role} onReact={handleReact} onComment={handleComment} onDelete={handleDelete} navigation={navigation} openPickerId={openPickerId} setOpenPickerId={setOpenPickerId} />
            ))}
            {postsLoadingMore && (
              <ActivityIndicator color={colors.c1} style={{ paddingVertical: 16 }} />
            )}
          </View>
        )}

        {/* ── Tab: Badges ── */}
        {tab==='badges' && (
          <View style={s.padded}>
            {!profile?.badges?.length ? (
              <View style={s.emptyTab}>
                <Ionicons name="ribbon-outline" size={40} color={colors.textDim} />
                <Text style={s.emptyTxt}>Sin emblemas aún</Text>
              </View>
            ) : (
              <View style={s.badgesGrid}>
                {profile?.badges?.map((b,i) => (
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

        <View style={{ height:60 }} />
      </ScrollView>

      {/* ── Visor de imágenes fullscreen ── */}
      <Modal visible={viewerVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setViewerVisible(false)}>
        <View style={{ flex:1, backgroundColor:'#000' }}>
          <FlatList
            data={(profile?.profileBlocks||[]).filter(b => b.type==='image' && b.imageUrl)}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={viewerIndex}
            getItemLayout={(_, index) => ({ length: W, offset: W * index, index })}
            renderItem={({ item }) => (
              <View style={{ width:W, height:H, justifyContent:'center', alignItems:'center' }}>
                <Image source={{ uri:item.imageUrl }} style={{ width:W, height:H }} resizeMode="contain" />
              </View>
            )}
            keyExtractor={(item, idx) => item.id || String(idx)}
            style={{ flex:1 }}
          />
          <TouchableOpacity
            style={{ position:'absolute', top:insets.top+12, right:16, backgroundColor:'rgba(0,0,0,0.6)', borderRadius:20, padding:8 }}
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
  root: { flex:1, backgroundColor:colors.black },
  hero: { alignItems:'center', paddingBottom:60, paddingHorizontal:24, overflow:'hidden', width:W, alignSelf:'stretch', position:'relative' },
  heroTopRow: { position:'absolute', left:16, right:16, flexDirection:'row', justifyContent:'space-between', zIndex:10 },
  heroBtn: { width:36, height:36, borderRadius:10, backgroundColor:'rgba(255,255,255,0.12)', alignItems:'center', justifyContent:'center' },
  username: { color:colors.textHi, fontSize:22, fontWeight:'700', marginTop:14, marginBottom:2 },
  xpTxt:    { color:'rgba(255,255,255,0.6)', fontSize:12, fontWeight:'700', marginBottom:12 },
  heroStats:  { flexDirection:'row', width:'100%', marginTop:8, gap:8, justifyContent:'center' },
  heroStat:   { width:100, alignItems:'center', paddingVertical:12, backgroundColor:'rgba(0,0,0,0.45)', borderRadius:12, borderWidth:1, borderColor:'rgba(255,255,255,0.1)' },
  heroStatVal:{ color:'#ffffff', fontSize:18, fontWeight:'700' },
  heroStatLbl:{ color:'rgba(255,255,255,0.6)', fontSize:8, letterSpacing:2, marginTop:2 },
  actionRow:     { flexDirection:'row', gap:12, width:'100%', marginTop:20 },
  btnFollow:     { borderRadius:12, paddingVertical:12, alignItems:'center', flexDirection:'row', justifyContent:'center', gap:6 },
  btnFollowTxt:  { color:'#001a18', fontWeight:'700', fontSize:14 },
  btnUnfollow:   { borderRadius:12, paddingVertical:12, alignItems:'center', flexDirection:'row', justifyContent:'center', gap:6, backgroundColor:'rgba(0,229,204,0.22)', borderWidth:1, borderColor:'rgba(0,229,204,0.5)' },
  btnUnfollowTxt:{ color:colors.c1, fontWeight:'700', fontSize:14 },
  btnChat:       { borderRadius:12, paddingVertical:12, paddingHorizontal:20, backgroundColor:'rgba(255,255,255,0.15)', borderWidth:1, borderColor:'rgba(255,255,255,0.25)', alignItems:'center', flexDirection:'row', gap:6 },
  btnChatTxt:    { color:colors.textMid, fontSize:14 },
  blockedBanner: { borderRadius:10, paddingVertical:10, paddingHorizontal:20, borderWidth:1, borderColor:'rgba(239,68,68,0.3)', flexDirection:'row', gap:8, alignItems:'center' },
  blockedTxt:    { color:'rgba(239,68,68,0.7)', fontSize:13 },
  bannedBadge:    { backgroundColor:'rgba(255,107,107,0.15)', borderColor:'rgba(255,107,107,0.4)', borderWidth:1, borderRadius:10, paddingHorizontal:8, paddingVertical:2 },
  bannedBadgeTxt: { color:'#FF6B6B', fontSize:10, fontWeight:'700' },

  // Menú bottom sheet
  menuOverlay:     { flex:1, backgroundColor:'rgba(0,0,0,0.55)', justifyContent:'flex-end' },
  menuSheet:       { backgroundColor:colors.surface, borderTopLeftRadius:24, borderTopRightRadius:24, paddingTop:12, borderWidth:1, borderColor:colors.border, borderBottomWidth:0 },
  menuHandle:      { width:36, height:4, borderRadius:2, backgroundColor:'rgba(255,255,255,0.2)', alignSelf:'center', marginBottom:16 },
  menuProfile:     { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:20, paddingBottom:16 },
  menuProfileName: { color:colors.textHi, fontWeight:'700', fontSize:15 },
  menuProfileSub:  { color:colors.textDim, fontSize:12, marginTop:2 },
  menuDivider:     { height:1, backgroundColor:colors.border, marginVertical:4 },
  menuItem:        { flexDirection:'row', alignItems:'center', gap:14, paddingVertical:14, paddingHorizontal:20 },
  menuItemIcon:    { width:36, height:36, borderRadius:18, alignItems:'center', justifyContent:'center' },
  menuItemTxt:     { color:colors.textHi, fontSize:15, fontWeight:'500' },
  menuItemSub:     { color:colors.textDim, fontSize:11, marginTop:2 },

  // Tabs
  tabBar: { flexDirection:'row', backgroundColor:colors.card, borderRadius:12, borderWidth:1, borderColor:colors.border, marginBottom:16, overflow:'hidden' },
  tabBtn: { alignItems:'center', justifyContent:'center', paddingVertical:12 },
  tabDot: { position:'absolute', bottom:0, height:2, backgroundColor:'#ffffff', borderRadius:1 },

  // Perfil
  profileSection:  { borderWidth:1, borderColor:'rgba(255,255,255,0.1)', padding:16, position:'relative', minHeight:80, backgroundColor:'rgba(255,255,255,0.04)' },
  sectionBgImage:  { position:'absolute', top:0, left:0, right:0, bottom:0 },
  blocksContainer: { gap:8, paddingBottom:8 },
  imgGrid:         { flexDirection:'row', flexWrap:'wrap', gap:GRID_GAP, marginBottom:8 },
  imgCell:         { width:CELL, height:CELL, borderRadius:10, overflow:'hidden', backgroundColor:'rgba(255,255,255,0.06)' },
  emptyPage:       { alignItems:'center', paddingVertical:24 },
  emptyPageTxt:    { color:colors.textDim, fontSize:12 },
  mentionBlock:    { flexDirection:'row', alignItems:'center', gap:10, backgroundColor:'rgba(0,229,204,0.07)', borderRadius:12, borderWidth:1, borderColor:'rgba(0,229,204,0.2)', padding:12 },
  mentionAv:       { width:36, height:36, borderRadius:18, backgroundColor:colors.deep, alignItems:'center', justifyContent:'center', overflow:'hidden' },
  mentionAt:       { flex:1, color:colors.c1, fontWeight:'700', fontSize:14 },

  // Bio pública
  pubContentBgWrapper: { overflow: 'hidden', backgroundColor: colors.surface },
  pubBioSection:     { paddingHorizontal:20, paddingBottom:12 },
  pubSectionLabelRow:{ paddingHorizontal:20, paddingTop:16, paddingBottom:8 },
  pubSectionBadge:   { alignSelf:'flex-start', backgroundColor:colors.deep, borderRadius:10, paddingHorizontal:12, paddingVertical:5 },
  pubSectionBadgeTxt:{ color:colors.textHi, fontSize:9, fontWeight:'700', letterSpacing:3 },
  pubBioText:        { color:colors.textHi, fontSize:14, lineHeight:22 },
  pubBioAudio:       { paddingVertical:8 },
  pubAudioBlock:     { flexDirection:'row', alignItems:'center', gap:10, backgroundColor:'rgba(249,115,22,0.06)', borderRadius:12, borderWidth:1, borderColor:'rgba(249,115,22,0.18)', paddingHorizontal:14, paddingVertical:12, marginBottom:8 },

  // Muro público
  pubMuroSection:    { marginHorizontal:20, marginTop:16, marginBottom:8, borderRadius:18, overflow:'hidden', backgroundColor:'rgba(5,12,20,0.92)', borderWidth:1, borderColor:'rgba(255,255,255,0.07)', height:420 },
  pubMuroHeader:     { flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.07)' },
  pubMuroTitle:      { color:colors.textDim, fontSize:9, fontWeight:'700', letterSpacing:3, flex:1 },
  pubMuroInputRow:   { flexDirection:'row', alignItems:'flex-end', gap:8, margin:12 },
  pubMuroInput:      { flex:1, color:colors.textHi, fontSize:13, backgroundColor:'rgba(255,255,255,0.06)', borderRadius:12, borderWidth:1, borderColor:'rgba(255,255,255,0.1)', paddingHorizontal:14, paddingVertical:10, maxHeight:90 },
  pubMuroSendBtn:    { width:40, height:40, borderRadius:20, backgroundColor:colors.c1, alignItems:'center', justifyContent:'center' },
  pubMuroMsg:        { flexDirection:'row', padding:14, gap:12, alignItems:'flex-start' },
  pubMuroAvatar:     { width:36, height:36, borderRadius:18, backgroundColor:'rgba(255,255,255,0.06)', alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.1)', overflow:'hidden' },
  pubMuroAvatarLetter:{ color:colors.c1, fontSize:14, fontWeight:'700' },
  pubMuroMsgBody:    { flex:1, gap:2 },
  pubMuroUsername:   { color:colors.textHi, fontSize:13, fontWeight:'700' },
  pubMuroText:       { color:colors.textMid, fontSize:13, lineHeight:19 },
  pubMuroDate:       { color:colors.textDim, fontSize:10, marginTop:2 },
  pubMuroDivider:    { height:1, backgroundColor:'rgba(255,255,255,0.06)', marginHorizontal:14 },
  padded:          { paddingHorizontal:16 },
  emptyTab:        { alignItems:'center', paddingVertical:48, gap:12 },
  emptyTxt:        { color:colors.textDim, fontSize:14 },
  badgesGrid:      { flexDirection:'row', flexWrap:'wrap', gap:10 },
  badgeCard:       { alignItems:'center', backgroundColor:colors.card, borderRadius:14, borderWidth:1, borderColor:colors.borderC, padding:14, width:(W-52)/3 },
  badgeIcon:       { fontSize:28, marginBottom:6 },
  badgeName:       { color:colors.c1, fontSize:9, letterSpacing:1, textAlign:'center' },
  badgeDesc:       { color:colors.textDim, fontSize:9, textAlign:'center', marginTop:2 },
  ctaBtn: { backgroundColor:colors.c1, paddingVertical:13, paddingHorizontal:32, borderRadius:12, marginTop:20, alignItems:'center' },
  ctaTxt: { color:'#001a18', fontWeight:'800', fontSize:14 },
  secondaryRow:     { flexDirection:'row', gap:10, marginTop:12, width:'100%' },
  btnSecondary:     { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, paddingVertical:10, borderRadius:12, backgroundColor:'rgba(255,255,255,0.07)', borderWidth:1, borderColor:'rgba(255,255,255,0.12)' },
  btnSecondaryTxt:  { fontSize:13, fontWeight:'600' },
});
