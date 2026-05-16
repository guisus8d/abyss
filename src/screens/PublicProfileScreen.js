import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, StatusBar, ActivityIndicator,
  Alert, Dimensions, Clipboard, Modal, Pressable, Linking, Platform,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import AvatarWithFrame from '../components/AvatarWithFrame';
import PostCard from '../components/PostCard';
import ReportModal from '../components/ReportModal';
import ShareProfileModal from '../components/ShareProfileModal';

const W = Dimensions.get('window').width;
const isWeb = Platform.OS === 'web';

const TABS_BASE = [
  { key: 'profile', icon: 'person-outline' },
  { key: 'posts',   icon: 'grid-outline'   },
  { key: 'badges',  icon: 'ribbon-outline' },
];

export default function PublicProfileScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { username } = route.params;
  const { user: me } = useAuthStore();

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

  useEffect(() => {
    if (username === me?.username) navigation.replace('Profile');
  }, [username]);

  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    try {
      const [profileRes, postsRes] = await Promise.all([
        api.get(`/users/${username}`),
        api.get(`/posts/user/${username}?page=1&limit=10`).catch(() => ({ data: { posts: [], total: 0, hasMore: false } })),
      ]);
      setProfile(profileRes.data.user);
      setPosts(postsRes.data.posts || []);
      setTotalPosts(postsRes.data.total || 0);
      setPostsHasMore(postsRes.data.hasMore ?? false);
      setPostsPage(1);
      setFollowing(profileRes.data.user.followers?.some(f => f._id === me?._id || f === me?._id));
      setBlocked(me?.blockedUsers?.some(id => (id?._id || id) === profileRes.data.user._id) ?? false);
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
      const { data } = await api.get(`/posts/user/${username}?page=${nextPage}&limit=10`);
      setPosts(prev => [...prev, ...(data.posts || [])]);
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
            const { data } = await api.post(`/social/block/${username}`);
            setBlocked(data.blocked);
            if (data.blocked) setFollowing(false);
          } catch (err) { Alert.alert('Error', err.response?.data?.error); }
        }},
      ]
    );
  }

  async function handleUnblock() {
    try {
      await api.post(`/social/block/${username}`);
      setBlocked(false);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Error al desbloquear');
    }
  }

  function handleReport() {
    setMenuVisible(false);
    setTimeout(() => setReportOpen(true), 300);
  }

  async function handleChat() {
    if (chatStatus === 'active') {
      try {
        const { data } = await api.get(`/chats/with/${profile._id}`);
        if (data.chat) {
          navigation.navigate('ChatRoom', {
            chat:  data.chat,
            other: { _id: profile._id, username: profile.username, avatarUrl: profile.avatarUrl, profileFrame: profile.profileFrame, profileFrameUrl: profile.profileFrameUrl },
          });
        }
      } catch (err) { Alert.alert('Error', err.response?.data?.error || 'No se pudo abrir el chat'); }
      return;
    }
    navigation.navigate('ChatRoom', {
      chat:  { _id: null, participants: [] },
      other: { _id: profile._id, username: profile.username, avatarUrl: profile.avatarUrl, profileFrame: profile.profileFrame, profileFrameUrl: profile.profileFrameUrl },
      requestMode:      true,
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

  if (blocked) return (
    <View style={{ flex:1, backgroundColor:'#020509' }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
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
  const TAB_W        = (W - 32) / TABS.length;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

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
          </View>
          {prefs.showXp && <Text style={s.xpTxt}>XP {profile?.xp || 0}</Text>}

          <View style={s.heroStats}>
            {prefs.showFollowing && (
              <TouchableOpacity style={s.heroStat} onPress={() => navigation.navigate('FollowList', { username: profile?.username, type:'following' })}>
                <Text style={s.heroStatVal}>{profile?.following?.length || 0}</Text>
                <Text style={s.heroStatLbl}>SIGUIENDO</Text>
              </TouchableOpacity>
            )}
            {prefs.showPosts && (
              <View style={s.heroStat}>
                <Text style={s.heroStatVal}>{totalPosts}</Text>
                <Text style={s.heroStatLbl}>POSTS</Text>
              </View>
            )}
            {prefs.showFollowers && (
              <TouchableOpacity style={s.heroStat} onPress={() => navigation.navigate('FollowList', { username: profile?.username, type:'followers' })}>
                <Text style={s.heroStatVal}>{profile?.followers?.length || 0}</Text>
                <Text style={s.heroStatLbl}>SEGUIDORES</Text>
              </TouchableOpacity>
            )}
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
              <TouchableOpacity onPress={handleFollow} disabled={loadingBtn} style={{ flex:1 }}>
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
                <Ionicons name={chatStatus==='active'?'chatbubble':chatStatus==='requested'?'time-outline':'chatbubble-outline'} size={15} color={chatStatus==='active'?colors.c1:colors.textMid} />
                <Text style={[s.btnChatTxt, chatStatus==='active'&&{color:colors.c1}]}>
                  {chatStatus==='active'?'Chat':chatStatus==='requested'?'Pendiente':'Chatear'}
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
        <View style={[s.tabBar, { marginHorizontal:16 }]}>
          {TABS.map(t => (
            <TouchableOpacity key={t.key} style={[s.tabBtn, { width:TAB_W }]} onPress={() => setTab(t.key)}>
              <Ionicons name={t.icon} size={20} color={tab===t.key?'#ffffff':colors.textDim} />
              {tab===t.key && <View style={[s.tabDot, { width:TAB_W }]} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Tab: Perfil ── */}
        {tab === 'profile' && (
          <View>
            <View style={[s.profileSection, { borderRadius:0, borderLeftWidth:0, borderRightWidth:0, paddingHorizontal:20 }]}>
              {profile?.profileBgType==='image' && profile?.profileBg && (
                <>
                  <Image source={{ uri:profile.profileBg }} style={s.sectionBgImage} resizeMode="cover" />
                  <View style={[StyleSheet.absoluteFill, { backgroundColor:'rgba(0,0,0,0.35)' }]} />
                </>
              )}
              {profile?.profileBgType!=='image' && profile?.profileBg && (
                <View style={[StyleSheet.absoluteFill, { backgroundColor:profile.profileBg }]} />
              )}
              <View style={s.blocksContainer}>
                {(!profile?.profileBlocks || profile.profileBlocks.length===0) && (
                  <View style={s.emptyPage}><Text style={s.emptyPageTxt}>Sin contenido todavía</Text></View>
                )}
                {(profile?.profileBlocks||[]).map((block,i) => {
                  if (block.type==='text') return (
                    <Text key={block.id||i} style={{ fontSize:block.fontSize||14, fontWeight:block.bold?'700':'400', textAlign:block.align||'left', color:colors.textHi, lineHeight:(block.fontSize||14)*1.5, marginBottom:8 }}>
                      {block.content}
                    </Text>
                  );
                  if (block.type==='image' && block.imageUrl) return (
                    <Image key={block.id||i} source={{ uri:block.imageUrl }} style={{ width:'100%', height:180, borderRadius:12, marginBottom:8 }} resizeMode="cover" />
                  );
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
                })}
              </View>
            </View>
          </View>
        )}

        {/* ── Tab: Posts ── */}
        {tab==='posts' && prefs.showPosts && (
          <View>
            {posts.length===0 ? (
              <View style={s.emptyTab}>
                <Ionicons name="document-text-outline" size={40} color={colors.textDim} />
                <Text style={s.emptyTxt}>Sin publicaciones aún</Text>
              </View>
            ) : posts.map(p => (
              <PostCard key={p._id} post={p} currentUserId={me?._id} onReact={handleReact} onComment={handleComment} onDelete={() => {}} navigation={navigation} openPickerId={openPickerId} setOpenPickerId={setOpenPickerId} />
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

      {/* ── Overlay de ban ── */}
      {profile?.banned && (
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill}>
          <View style={s.banOverlay}>
            <Ionicons name="ban" size={72} color="#ff4444" />
            <Text style={s.banTitle}>Usuario suspendido</Text>
            <Text style={s.banSubtitle}>
              Esta cuenta ha sido suspendida por violar{'\n'}
              los términos de uso de Abyss.
            </Text>
            {profile?.bannedReason ? (
              <View style={s.banReasonBox}>
                <Text style={s.banReasonTxt}>Motivo: {profile.bannedReason}</Text>
              </View>
            ) : null}
            <TouchableOpacity style={s.banBackBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={16} color="#fff" />
              <Text style={s.banBackTxt}>Volver</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex:1, backgroundColor:colors.black },
  hero: { alignItems:'center', paddingBottom:60, paddingHorizontal:24, overflow:'hidden', width:W, alignSelf:'stretch', position:'relative' },
  heroTopRow: { position:'absolute', left:16, right:16, flexDirection:'row', justifyContent:'space-between', zIndex:10 },
  heroBtn: { width:36, height:36, borderRadius:10, backgroundColor:'rgba(255,255,255,0.12)', alignItems:'center', justifyContent:'center' },
  username: { color:colors.textHi, fontSize:22, fontWeight:'700', marginTop:14, marginBottom:4 },
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
  banOverlay:    { flex:1, alignItems:'center', justifyContent:'center', paddingHorizontal:32, backgroundColor:'rgba(2,5,9,0.75)' },
  banTitle:      { color:'#ffffff', fontSize:24, fontWeight:'800', marginTop:20, marginBottom:10, textAlign:'center' },
  banSubtitle:   { color:'rgba(255,255,255,0.6)', fontSize:14, textAlign:'center', lineHeight:22 },
  banReasonBox:  { marginTop:16, paddingHorizontal:16, paddingVertical:10, borderRadius:10, backgroundColor:'rgba(239,68,68,0.1)', borderWidth:1, borderColor:'rgba(239,68,68,0.3)' },
  banReasonTxt:  { color:'rgba(239,68,68,0.8)', fontSize:12, textAlign:'center' },
  banBackBtn:    { flexDirection:'row', alignItems:'center', gap:8, marginTop:32, paddingHorizontal:24, paddingVertical:12, borderRadius:14, backgroundColor:'rgba(255,255,255,0.1)', borderWidth:1, borderColor:'rgba(255,255,255,0.15)' },
  banBackTxt:    { color:'#ffffff', fontSize:14, fontWeight:'600' },

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
  profileSection:  { borderWidth:1, borderColor:'rgba(255,255,255,0.1)', padding:16, position:'relative', minHeight:120, backgroundColor:'rgba(255,255,255,0.04)' },
  sectionBgImage:  { position:'absolute', top:0, left:0, right:0, bottom:0 },
  blocksContainer: { gap:8, paddingBottom:8 },
  emptyPage:       { alignItems:'center', paddingVertical:24 },
  emptyPageTxt:    { color:colors.textDim, fontSize:12 },
  mentionBlock:    { flexDirection:'row', alignItems:'center', gap:10, backgroundColor:'rgba(0,229,204,0.07)', borderRadius:12, borderWidth:1, borderColor:'rgba(0,229,204,0.2)', padding:12 },
  mentionAv:       { width:36, height:36, borderRadius:18, backgroundColor:colors.deep, alignItems:'center', justifyContent:'center', overflow:'hidden' },
  mentionAt:       { flex:1, color:colors.c1, fontWeight:'700', fontSize:14 },
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
});
