import React, { useCallback, useState, useEffect, useRef } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, RefreshControl,
  ActivityIndicator, Alert, Animated, Platform, Linking,
  Image, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import CustomTabBar from '../components/CustomTabBar';
import { colors } from '../theme/colors';
import { getActivityStatus } from '../utils/timeUtils';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { connectSocket } from '../services/socket';
import ProfileDrawer   from '../components/ProfileDrawer';
import PostComposer    from '../components/PostComposer';
import CreatePostMenu  from '../components/CreatePostMenu';
import AvatarWithFrame from '../components/AvatarWithFrame';
import PostCard        from '../components/PostCard';
import OrbitUsers      from '../components/OrbitUsers';
import GuestAuthModal  from '../components/GuestAuthModal';


const TABS = [
  { key: 'todos',     label: 'Para Ti',   icon: 'planet-outline',      endpoint: '/posts' },
  { key: 'siguiendo', label: 'Siguiendo', icon: 'people-outline',      endpoint: '/posts/following' },
  { key: 'trending',  label: 'Trending',  icon: 'trending-up-outline', endpoint: '/posts/trending' },
];

const INITIAL_TAB_STATE = () => ({ posts: [], page: 1, hasMore: true, loading: false, loaded: false });

const { width: SCREEN_W } = Dimensions.get('window');
const FIESTA_CARD_W = Math.floor(SCREEN_W * 0.65) - 30;
const FIESTA_LOGO_H = 150;
const HASHTAG_COLORS = ['#2979ff', '#f472b6', '#facc15', '#22d3ee', '#4ade80', '#f97316'];
const MEET_PAD = 14;
const MEET_GAP = 8;
const MEET_CARD_W = Math.floor((SCREEN_W - MEET_PAD * 2 - MEET_GAP * 2) / 3);
const MEET_CARD_H = Math.round(MEET_CARD_W * (242 / 314)); // ratio nativo de los bg_*.9.png (314×242)

function MeetSection() {
  return (
    <View style={ms.wrap}>
      <View style={ms.card}>
        <Image source={require('../../assets/meet/bg_text_match_entrance.9.png')} style={ms.img} resizeMode="contain" />
        <Text style={ms.label}>{'Meet\nText'}</Text>
        <View style={ms.iconWrap}>
          <Image source={require('../../assets/meet/icon_text_match_hd.webp')} style={ms.iconImg} resizeMode="contain" />
        </View>
      </View>
      <View style={ms.card}>
        <Image source={require('../../assets/meet/bg_voice_match_entrance.9.png')} style={ms.img} resizeMode="contain" />
        <Text style={ms.label}>{'Meet\nVoice'}</Text>
        <View style={ms.iconWrap}>
          <Image source={require('../../assets/meet/icon_activity_open.webp')} style={ms.iconImg} resizeMode="contain" />
        </View>
      </View>
      <View style={ms.card}>
        <Image source={require('../../assets/meet/bg_drifting_bottle_entrance.9.png')} style={ms.img} resizeMode="contain" />
        <Text style={ms.label}>{'Meet\nBottle'}</Text>
        <View style={ms.iconWrap}>
          <Image source={require('../../assets/meet/icon_bottle_match_hd.webp')} style={ms.iconImg} resizeMode="contain" />
        </View>
      </View>
    </View>
  );
}

function FiestasSection({ fiestas, onPress }) {
  if (!fiestas || fiestas.length === 0) return null;
  return (
    <View style={fs.wrap}>
      <View style={fs.headerRow}>
        <Text style={fs.title}>Fiestas</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={fs.scroll}>
        {fiestas.map(item => (
          <TouchableOpacity key={item._id} style={fs.card} activeOpacity={0.8} onPress={() => onPress(item)}>
            {item.imageUrl
              ? <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]} />}
            <LinearGradient
              colors={['rgba(0,0,0,0.8)', 'transparent']}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '55%', justifyContent: 'flex-start', padding: 10 }}
            >
              <Text style={fs.name} numberOfLines={2}>{item.name}</Text>
            </LinearGradient>
            <LinearGradient
              colors={['rgba(0,0,0,0.75)', 'transparent']}
              start={{ x: 0, y: 1 }} end={{ x: 0, y: 0 }}
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%' }}
            />
            {item.hashtags?.length > 0 && (
              <View style={fs.hashtags}>
                {item.hashtags.slice(0, 3).map((tag, idx) => {
                  const c = HASHTAG_COLORS[idx % HASHTAG_COLORS.length];
                  return (
                    <View key={tag} style={[fs.hashtagPill, { borderColor: c + '55', backgroundColor: c + '18' }]}>
                      <Text style={[fs.hashtagTxt, { color: c }]}>#{tag}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function BadgeToast({ badge, onHide }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(onHide);
  }, []);
  return (
    <Animated.View style={[s.toast, { opacity }]}>
      <Text style={s.toastIcon}>{badge.icon}</Text>
      <View>
        <Text style={s.toastTitle}>¡Badge desbloqueado!</Text>
        <Text style={s.toastName}>{badge.name}</Text>
      </View>
    </Animated.View>
  );
}

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, logout, updateUser, isGuest } = useAuthStore();

  const [unreadNotifs,  setUnreadNotifs]  = useState(0);
  const [showCompose,   setShowCompose]   = useState(false);
  const [showMenu,      setShowMenu]      = useState(false);
  const [toastBadge,    setToastBadge]    = useState(null);
  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching,     setSearching]     = useState(false);
  const [activityStatus, setActivityStatus] = useState(() => getActivityStatus(user?.lastActive));

  useEffect(() => {
    setActivityStatus(getActivityStatus(user?.lastActive));
    const interval = setInterval(() => setActivityStatus(getActivityStatus(user?.lastActive)), 60000);
    return () => clearInterval(interval);
  }, [user?.lastActive]);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [refreshing,    setRefreshing]    = useState(false);
  const [fiestas,       setFiestas]       = useState([]);
  const [activeTab,     setActiveTab]     = useState('todos');
  const [tabData,       setTabData]       = useState({
    todos:     INITIAL_TAB_STATE(),
    siguiendo: INITIAL_TAB_STATE(),
    trending:  INITIAL_TAB_STATE(),
  });

  const loadingRef   = useRef(false);

  useEffect(() => {
    if (isGuest) return;
    api.get('/notifications/unread').then(r => setUnreadNotifs(r.data.unread)).catch(() => {});
    connectSocket().then(s => {
      s.off('notification:new');
      s.on('notification:new', () => setUnreadNotifs(prev => prev + 1));
    });
  }, [isGuest]);

  useEffect(() => {
    if (isGuest) return;
    api.get('/users/me').then(({ data }) => {
      if (data.user) updateUser(data.user);
    }).catch(() => {});
  }, [isGuest]);

  useEffect(() => {
    api.get('/groups/circles/public')
      .then(({ data }) => setFiestas(data.circles || []))
      .catch(() => {});
  }, []);

  const fetchTab = useCallback(async (tabKey, page = 1, append = false) => {
    const tab = TABS.find(t => t.key === tabKey);
    if (!tab) return;
    setTabData(prev => ({ ...prev, [tabKey]: { ...prev[tabKey], loading: true } }));
    try {
      const { data } = await api.get(`${tab.endpoint}?page=${page}&limit=10`);
      const incoming = data.posts || [];
      setTabData(prev => {
        const base   = append ? prev[tabKey].posts : [];
        const merged = [...base, ...incoming];
        const seen   = new Set();
        const unique = merged.filter(p => { if (seen.has(p._id)) return false; seen.add(p._id); return true; });
        return { ...prev, [tabKey]: { posts: unique, page, hasMore: page < (data.totalPages || 1), loading: false, loaded: true } };
      });
    } catch {
      setTabData(prev => ({ ...prev, [tabKey]: { ...prev[tabKey], loading: false, loaded: true } }));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    const current = tabData[activeTab];
    if (!current.loaded && !current.loading) fetchTab(activeTab, 1);
  }, [activeTab, tabData, fetchTab]));

  function switchTab(key) {
    if (isGuest && key === 'siguiendo') { setShowGuestModal(true); return; }
    setActiveTab(key);
    if (!tabData[key].loaded && !tabData[key].loading) fetchTab(key, 1);
  }

  function handleRefresh() {
    setRefreshing(true);
    setTabData(prev => ({ ...prev, [activeTab]: INITIAL_TAB_STATE() }));
    fetchTab(activeTab, 1);
  }

  function loadMore() {
    const { page, hasMore, loading } = tabData[activeTab];
    if (!hasMore || loading || loadingRef.current) return;
    loadingRef.current = true;
    fetchTab(activeTab, page + 1, true).finally(() => { loadingRef.current = false; });
  }

  function handlePostCreated(post, newBadges) {
    setTabData(prev => ({ ...prev, todos: { ...prev.todos, posts: [post, ...prev.todos.posts] } }));
    if (newBadges?.length > 0) setToastBadge(newBadges[0]);
  }

  function handleReact(postId, type) {
    if (isGuest) { setShowGuestModal(true); return; }
    const updatePosts = posts => posts.map(p => {
      if (p._id !== postId) return p;
      const myId   = user._id?.toString();
      const already = p.reactions.find(r => (r.user?._id || r.user)?.toString() === myId && r.type === type);
      const reactions = already
        ? p.reactions.filter(r => !((r.user?._id || r.user)?.toString() === myId && r.type === type))
        : [...p.reactions, { user: user._id, type }];
      return { ...p, reactions };
    });
    setTabData(prev => {
      const next = { ...prev };
      TABS.forEach(t => { next[t.key] = { ...prev[t.key], posts: updatePosts(prev[t.key].posts) }; });
      return next;
    });
    api.post(`/posts/${postId}/react`, { type }).catch(() => {});
  }

  async function handleDelete(postId) {
    try {
      await api.delete(`/posts/${postId}`);
      setTabData(prev => {
        const next = { ...prev };
        TABS.forEach(t => { next[t.key] = { ...prev[t.key], posts: prev[t.key].posts.filter(p => p._id !== postId) }; });
        return next;
      });
    } catch { Alert.alert('Error', 'No se pudo eliminar el post'); }
  }

  async function handleComment(postId, text, replyTo, updatedComments) {
    if (updatedComments) {
      // solo actualiza estado local, no requiere auth
      setTabData(prev => {
        const next = { ...prev };
        TABS.forEach(t => { next[t.key] = { ...prev[t.key], posts: prev[t.key].posts.map(p => p._id === postId ? { ...p, comments: updatedComments } : p) }; });
        return next;
      });
      return;
    }
    if (isGuest) { setShowGuestModal(true); return; }
    try {
      const { data } = await api.post(`/posts/${postId}/comment`, { text, replyTo });
      setTabData(prev => {
        const next = { ...prev };
        TABS.forEach(t => { next[t.key] = { ...prev[t.key], posts: prev[t.key].posts.map(p => p._id === postId ? { ...p, comments: data.comments } : p) }; });
        return next;
      });
    } catch { Alert.alert('Error', 'No se pudo comentar'); }
  }

  async function handleSearch(q) {
    setSearchQuery(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const { data } = await api.get(`/users/search?q=${q.trim()}`);
      setSearchResults(data.users);
    } catch {}
    finally { setSearching(false); }
  }

  const currentTab = tabData[activeTab];

  return (
    <View style={s.root}>
      {Platform.OS !== 'web' && <StatusBar barStyle="light-content" backgroundColor={colors.black} />}

      {toastBadge && <BadgeToast badge={toastBadge} onHide={() => setToastBadge(null)} />}

      <GuestAuthModal visible={showGuestModal} onClose={() => setShowGuestModal(false)} />

      {!isGuest && (
        <ProfileDrawer
          visible={drawerOpen} onClose={() => setDrawerOpen(false)}
          user={user} onLogout={logout}
          onNavigate={(screen, params) => navigation.navigate(screen, params)}
        />
      )}

      {/* Header */}
      <LinearGradient colors={['rgba(2,5,9,1)', 'rgba(2,5,9,0)']} style={s.headerWrap} start={{ x:0, y:0 }} end={{ x:0, y:1 }}>
        <SafeAreaView>
          <View style={s.header}>
            {isGuest ? (
              <TouchableOpacity style={s.headerLeft} onPress={() => setShowGuestModal(true)} activeOpacity={0.75}>
                <View style={s.guestAvatar}>
                  <Ionicons name="person-outline" size={18} color={colors.c1} />
                </View>
                <View>
                  <Text style={s.headerUsername}>Modo invitado</Text>
                  <Text style={{ fontSize: 11, color: colors.c1 }}>Inicia sesión →</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={s.headerLeft} onPress={() => setDrawerOpen(true)}>
                <AvatarWithFrame size={34} avatarUrl={user?.avatarUrl} username={user?.username}
                  profileFrame={user?.profileFrame} frameUrl={user?.profileFrameUrl} bgColor="rgba(0,229,204,0.15)" />
                <View>
                  <Text style={s.headerUsername}>{user?.username}</Text>
                  {activityStatus.text ? (
                    <View style={{ flexDirection:'row', alignItems:'center', marginTop:1 }}>
                      <View style={{ width:6, height:6, borderRadius:3, backgroundColor: activityStatus.isOnline ? '#16B88A' : '#6B6090', marginRight:4 }} />
                      <Text style={{ fontSize:11, color: activityStatus.isOnline ? '#16B88A' : colors.textDim }}>{activityStatus.text}</Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            )}
            <View style={s.headerRight}>
              {Platform.OS === 'web' && (
                <TouchableOpacity
                  style={s.downloadBtn}
                  onPress={() => Linking.openURL('https://abyss.social/download')}
                  activeOpacity={0.75}
                >
                  <Ionicons name="download-outline" size={14} color={colors.c1} />
                  <Text style={s.downloadBtnTxt}>Descargar</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={s.iconBtnBox}
                onPress={() => navigation.navigate('Search')}>
                <Ionicons name="search" size={18} color={colors.textHi} />
              </TouchableOpacity>
              <TouchableOpacity style={s.iconBtnBox}
                onPress={isGuest
                  ? () => setShowGuestModal(true)
                  : () => { setUnreadNotifs(0); navigation.navigate('Notifications'); }
                }>
                <Ionicons name="notifications" size={18} color={isGuest ? colors.textDim : colors.textHi} />
                {!isGuest && unreadNotifs > 0 && (
                  <View style={s.notifBadge}>
                    <Text style={s.notifBadgeTxt}>{unreadNotifs > 99 ? '99+' : unreadNotifs}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
          {searchOpen && (
            <View style={s.searchBar}>
              <TextInput style={s.searchInput} placeholder="Buscar usuarios..." placeholderTextColor={colors.textDim}
                value={searchQuery} onChangeText={handleSearch} autoFocus />
              {searching && <ActivityIndicator color={colors.c1} size="small" style={{ marginRight: 10 }} />}
            </View>
          )}
          {searchOpen && searchResults.length > 0 && (
            <View style={s.searchResults}>
              {searchResults.map(u => (
                <TouchableOpacity key={u._id} style={s.searchItem}
                  onPress={() => { setSearchOpen(false); navigation.navigate('PublicProfile', { username: u.username }); }}>
                  <AvatarWithFrame size={36} avatarUrl={u.avatarUrl} username={u.username} profileFrame={u.profileFrame} frameUrl={u.profileFrameUrl} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={s.searchUser}>{u.username}</Text>
                    <Text style={s.searchXp}>XP {u.xp}</Text>
                  </View>
                  <Text style={s.searchArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {searchOpen && searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
            <View style={s.searchEmpty}>
              <Text style={s.searchEmptyTxt}>Sin resultados para "{searchQuery}"</Text>
            </View>
          )}
        </SafeAreaView>
      </LinearGradient>

      {/* Feed */}
      <ScrollView style={s.feed} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.c1} />}
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          if (contentSize.height - contentOffset.y - layoutMeasurement.height < 300) loadMore();
        }}
        scrollEventThrottle={400}>
        <View style={{ height: 70 + insets.top }} />
        <OrbitUsers navigation={navigation} />
        <MeetSection />
        <FiestasSection
          fiestas={fiestas}
          onPress={item => isGuest ? setShowGuestModal(true) : navigation.navigate('GroupRoom', { group: item })}
        />

        {/* Tab bar */}
        <View style={s.tabBarWrap}>
          <View style={s.tabBar}>
            {TABS.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <TouchableOpacity key={tab.key} style={[s.tabBtn, active ? s.tabBtnActive : s.tabBtnInactive]} onPress={() => switchTab(tab.key)} activeOpacity={0.7}>
                  <Text style={[s.tabLabel, active && s.tabLabelActive]}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={s.feedContainer}>
          {currentTab.loading && !currentTab.loaded && <View style={s.center}><ActivityIndicator color={colors.c1} size="large" /></View>}
          {currentTab.loaded && currentTab.posts.length === 0 && (
            <View style={s.center}>
              {activeTab === 'siguiendo' ? (
                <><Ionicons name="people-outline" size={40} color={colors.textDim} style={{ marginBottom: 10 }} />
                  <Text style={s.emptyTxt}>Sigue a alguien para ver sus posts aquí</Text></>
              ) : activeTab === 'trending' ? (
                <><Ionicons name="trending-up-outline" size={40} color={colors.textDim} style={{ marginBottom: 10 }} />
                  <Text style={s.emptyTxt}>Aún no hay posts populares esta semana</Text></>
              ) : <Text style={s.emptyTxt}>Sin posts aún. ¡Sé el primero!</Text>}
            </View>
          )}
          {currentTab.posts.filter(p => p && p._id).map((p, i) => (
            <View key={`${activeTab}-${p._id}`} style={i > 0 ? s.postGap : null}>
              <PostCard post={p} currentUserId={user?._id} onReact={handleReact}
                onComment={handleComment} onDelete={handleDelete}
                navigation={navigation} isGuest={isGuest} />
            </View>
          ))}
          {currentTab.loading && currentTab.loaded && <View style={s.loadingMore}><ActivityIndicator color={colors.c1} size="small" /></View>}
          {currentTab.loaded && !currentTab.hasMore && currentTab.posts.length > 0 && (
            <View style={s.endRow}>
              <View style={s.endLine} /><Text style={s.endTxt}>ya viste todo</Text><View style={s.endLine} />
            </View>
          )}
          <View style={{ height: 160 }} />
        </View>
      </ScrollView>

      <CustomTabBar
        navigation={navigation}
        activeTab="home"
        onCreatePress={() => setShowMenu(true)}
        onCirclesPress={() => navigation.navigate('Circles')}
        onGuestAction={() => setShowGuestModal(true)}
      />

      {showMenu && (
        <CreatePostMenu visible={showMenu} onClose={() => setShowMenu(false)}
          onSelect={key => {
            setShowMenu(false);
            if (key === 'quick')      setShowCompose(true);
            else if (key === 'frame')   navigation.navigate('CreateFrame');
            else if (key === 'image')   navigation.navigate('PostImage');
            else if (key === 'news')    navigation.navigate('PostNoticia');
            else if (key === 'channel') navigation.navigate('Circles');
          }} />
      )}
      {showCompose && <PostComposer onClose={() => setShowCompose(false)} onPostCreated={handlePostCreated} />}
    </View>
  );
}

const CARD_BG = '#0b1521';

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: colors.black },
  feed:     { flex: 1, backgroundColor: '#020509' },
  center:   { alignItems: 'center', justifyContent: 'center', paddingVertical: 50 },
  emptyTxt: { color: colors.textDim, fontSize: 14, textAlign: 'center', paddingHorizontal: 30, marginTop: 6 },

  toast: {
    position: 'absolute', top: 60, left: 20, right: 20, zIndex: 998,
    backgroundColor: 'rgba(0,50,45,0.97)', borderRadius: 16, borderWidth: 1, borderColor: colors.borderC,
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16,
    shadowColor: colors.c1, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
  },
  toastIcon:  { fontSize: 32 },
  toastTitle: { color: colors.textDim, fontSize: 10, letterSpacing: 2 },
  toastName:  { color: colors.c1, fontSize: 16, fontWeight: '700' },

  headerWrap:     { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100 },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  headerLeft:     { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerUsername: { color: colors.textHi, fontWeight: '700', fontSize: 13 },
  guestAvatar:    { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(0,229,204,0.08)', borderWidth: 1, borderColor: 'rgba(0,229,204,0.3)', alignItems: 'center', justifyContent: 'center' },
  headerRight:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtnBox:     { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', marginHorizontal: 2 },
  downloadBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: 'rgba(0,229,204,0.08)', borderWidth: 1, borderColor: 'rgba(0,229,204,0.35)', marginHorizontal: 2 },
  downloadBtnTxt: { color: colors.c1, fontSize: 12, fontWeight: '700' },
  notifBadge:     { position: 'absolute', top: -2, right: -2, backgroundColor: colors.c1, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  notifBadgeTxt:  { color: colors.black, fontSize: 9, fontWeight: '900', paddingHorizontal: 3 },

  searchBar:      { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.borderC },
  searchInput:    { flex: 1, padding: 12, color: colors.textHi, fontSize: 14 },
  searchResults:  { marginHorizontal: 16, marginBottom: 8, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.borderC, overflow: 'hidden' },
  searchItem:     { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchUser:     { color: colors.textHi, fontSize: 13, fontWeight: '600' },
  searchXp:       { color: colors.textDim, fontSize: 10, marginTop: 1 },
  searchArrow:    { color: colors.textDim, fontSize: 18 },
  searchEmpty:    { marginHorizontal: 16, marginBottom: 8, padding: 12, alignItems: 'center' },
  searchEmptyTxt: { color: colors.textDim, fontSize: 13 },

  tabBarWrap: { marginHorizontal: 0, marginBottom: 0 },
  tabBar: {
    flexDirection: 'row', backgroundColor: CARD_BG,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    padding: 4, overflow: 'hidden',
  },
  tabBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 9, paddingHorizontal: 4, borderRadius: 10, margin: 2 },
  tabBtnActive:   { backgroundColor: colors.c1 },
  tabBtnInactive: { backgroundColor: colors.card },
  tabLabel:       { color: colors.textDim, fontSize: 12, fontWeight: '600' },
  tabLabelActive: { color: colors.black },

  feedContainer: { backgroundColor: CARD_BG, marginHorizontal: 0, minHeight: 300, paddingTop: 4 },
  postGap:       { marginTop: 8 },
  loadingMore:   { paddingVertical: 20, alignItems: 'center' },
  endRow:        { flexDirection: 'row', alignItems: 'center', marginHorizontal: 24, marginVertical: 20, gap: 10 },
  endLine:       { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  endTxt:        { color: colors.textDim, fontSize: 11, letterSpacing: 1 },

});

const fs = StyleSheet.create({
  wrap:            { marginTop: 16, marginBottom: 20 },
  headerRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 10 },
  title:           { color: colors.textHi, fontSize: 16, fontWeight: '700' },
  scroll:          { paddingHorizontal: 14, gap: 10 },
  card:            { width: FIESTA_CARD_W, height: FIESTA_LOGO_H, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', shadowColor: '#ffffff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3 },
  name:            { color: '#fff', fontSize: 15, fontWeight: '800' },
  hashtags:        { position: 'absolute', bottom: 8, left: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  hashtagPill:     { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1 },
  hashtagTxt:      { fontSize: 9, fontWeight: '600' },
  membersBadge:    { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  membersBadgeTxt: { color: '#fff', fontSize: 9, fontWeight: '600' },
});

const ms = StyleSheet.create({
  wrap:     { flexDirection: 'row', paddingHorizontal: MEET_PAD, marginTop: 12, marginBottom: 4, gap: MEET_GAP },
  card:     { width: MEET_CARD_W, height: MEET_CARD_H },
  img:      { width: MEET_CARD_W, height: MEET_CARD_H },
  label:    {
    position: 'absolute',
    bottom: 28,
    left: 22,
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(255,255,255,0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  iconWrap: {
    position: 'absolute',
    bottom: 5,
    right: 8,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconImg:  { width: 40, height: 40 },
});
