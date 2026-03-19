import React, { useCallback, useState, useEffect, useRef } from 'react';
import { Image } from 'react-native';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, SafeAreaView, RefreshControl,
  ActivityIndicator, Alert, Animated,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { connectSocket } from '../services/socket';
import ProfileDrawer from '../components/ProfileDrawer';
import { TouchableWithoutFeedback } from 'react-native';
import PostComposer    from '../components/PostComposer';
import CreatePostMenu from '../components/CreatePostMenu';
import AvatarWithFrame from '../components/AvatarWithFrame';
import PostCard from '../components/PostCard';
import OrbitUsers    from '../components/OrbitUsers';
import RandomUsers  from '../components/RandomUsers';

function timeAgo(date) {
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 60)    return `${Math.floor(diff)}s`;
  if (diff < 3600)  return `${Math.floor(diff/60)}m`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h`;
  return `${Math.floor(diff/86400)}d`;
}

function BadgeToast({ badge, onHide }) {
  const opacity = React.useRef(new Animated.Value(0)).current;
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
  const [unreadNotifs, setUnreadNotifs] = React.useState(0);
  const [openPickerId, setOpenPickerId] = useState(null);
  const [scrolled, setScrolled]         = useState(false);

  React.useEffect(() => {
    api.get('/notifications/unread').then(r => setUnreadNotifs(r.data.unread)).catch(() => {});
    connectSocket().then(s => {
      s.off('notification:new');
      s.on('notification:new', () => setUnreadNotifs(prev => prev + 1));
    });
  }, []);

  const { user, logout, updateUser } = useAuthStore();

  useEffect(() => {
    api.get('/users/me').then(({ data }) => {
      if (data.user) updateUser(data.user);
    }).catch(() => {});
  }, []);

  const [posts, setPosts]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [showMenu, setShowMenu]       = useState(false);
  const [toastBadge, setToastBadge]   = useState(null);
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [searchOpen, setSearchOpen]   = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]     = useState(false);

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

  async function fetchPosts() {
    try {
      const { data } = await api.get('/posts');
      setPosts(data.posts);
    } catch {
      Alert.alert('Error', 'No se pudo cargar el feed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { fetchPosts(); }, []);
  useFocusEffect(useCallback(() => { fetchPosts(); }, []));

  function handlePostCreated(post, newBadges) {
    setPosts(prev => [post, ...prev]);
    if (newBadges?.length > 0) setToastBadge(newBadges[0]);
  }

  async function handleReact(postId, type) {
    setPosts(prev => prev.map(p => {
      if (p._id !== postId) return p;
      const myId = user._id?.toString();
      const isSame = p.reactions.find(r => (r.user?._id || r.user)?.toString() === myId && r.type === type);
      const reactions = p.reactions.filter(r => {
        const uid = (r.user?._id || r.user)?.toString();
        if (uid !== myId) return true;
        if (type === 'like') return r.type !== 'like';
        return r.type === 'like';
      });
      if (!isSame) reactions.push({ user: user._id, type });
      return { ...p, reactions };
    }));
    try { await api.post(`/posts/${postId}/react`, { type }); } catch {}
  }

  async function handleDelete(postId) {
    try {
      await api.delete(`/posts/${postId}`);
      setPosts(prev => prev.filter(p => p._id !== postId));
    } catch {
      Alert.alert('Error', 'No se pudo eliminar el post');
    }
  }

  async function handleComment(postId, text, replyTo, updatedComments) {
    if (updatedComments) {
      setPosts(prev => prev.map(p => p._id === postId ? { ...p, comments: updatedComments } : p));
      return;
    }
    try {
      const { data } = await api.post(`/posts/${postId}/comment`, { text, replyTo });
      setPosts(prev => prev.map(p => {
        if (p._id !== postId) return p;
        return { ...p, comments: data.comments };
      }));
    } catch {
      Alert.alert('Error', 'No se pudo comentar');
    }
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {toastBadge && <BadgeToast badge={toastBadge} onHide={() => setToastBadge(null)} />}

      <ProfileDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        user={user}
        onLogout={logout}
        onNavigate={(screen) => navigation.navigate(screen)}
      />

      {showMenu && (
        <CreatePostMenu
          visible={showMenu}
          onClose={() => setShowMenu(false)}
          onSelect={key => {
            if (key === 'quick') setShowCompose(true);
            else if (key === 'frame') navigation.navigate('CreateFrame');
            else if (key === 'image') navigation.navigate('PostImage');
            else if (key === 'news') navigation.navigate('PostNoticia');
          }}
        />
      )}
      {showCompose && (
        <PostComposer
          onClose={() => setShowCompose(false)}
          onPostCreated={handlePostCreated}
        />
      )}

      {/* Header flotante — transparente o cristal según scroll */}
      <View style={[s.headerWrap, scrolled && s.headerWrapScrolled]}>
        <SafeAreaView>
          <View style={s.header}>
            <TouchableOpacity style={s.headerLeft} onPress={() => setDrawerOpen(true)}>
              <AvatarWithFrame
                size={34}
                avatarUrl={user?.avatarUrl}
                username={user?.username}
                profileFrame={user?.profileFrame}
                frameUrl={user?.profileFrameUrl}
                bgColor='rgba(0,229,204,0.15)'
              />
              <Text style={s.headerUsername}>{user?.username}</Text>
            </TouchableOpacity>
            <View style={s.headerRight}>
              <TouchableOpacity style={s.iconBtn} onPress={() => { setUnreadNotifs(0); navigation.navigate('Notifications'); }}>
                <Ionicons name='notifications-outline' size={22} color={colors.textHi} />
                {unreadNotifs > 0 && (
                  <View style={s.notifBadge}>
                    <Text style={s.notifBadgeTxt}>{unreadNotifs > 99 ? '99+' : unreadNotifs}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {searchOpen && (
            <View style={s.searchBar}>
              <TextInput
                style={s.searchInput}
                placeholder="Buscar usuarios..."
                placeholderTextColor={colors.textDim}
                value={searchQuery}
                onChangeText={handleSearch}
                autoFocus
              />
              {searching && <ActivityIndicator color={colors.c1} size="small" style={{ marginRight: 10 }} />}
            </View>
          )}

          {searchOpen && searchResults.length > 0 && (
            <View style={s.searchResults}>
              {searchResults.map(u => (
                <TouchableOpacity
                  key={u._id}
                  style={s.searchItem}
                  onPress={() => { setSearchOpen(false); navigation.navigate('PublicProfile', { username: u.username }); }}
                >
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
      </View>

      {/* Feed */}
      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.c1} size="large" /></View>
      ) : (
        <ScrollView
          style={s.feed}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPosts(); }} tintColor={colors.c1} />}
          onScroll={e => setScrolled(e.nativeEvent.contentOffset.y > 40)}
          scrollEventThrottle={16}
        >
          <View style={{ height: 70 }} />
          <RandomUsers navigation={navigation} />
          {posts.length === 0 && (
            <View style={s.center}><Text style={s.emptyTxt}>Sin posts aún. ¡Sé el primero!</Text></View>
          )}
          {posts.filter(p => p && p._id).map(p => (
            <PostCard
              key={p._id} post={p}
              currentUserId={user?._id}
              onReact={handleReact}
              onComment={handleComment}
              onDelete={handleDelete}
              openPickerId={openPickerId}
              setOpenPickerId={setOpenPickerId}
              navigation={navigation}
            />
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Nav bar */}
      <View style={s.bnav}>
        <TouchableOpacity style={[s.ni, s.niActive]}>
          <Ionicons name='home' size={22} color={colors.c1} />
          <Text style={[s.niLbl, { color: colors.c1 }]}>Inicio</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.ni} onPress={() => { setSearchOpen(!searchOpen); setSearchQuery(''); setSearchResults([]); }}>
          <Ionicons name='search-outline' size={22} color={colors.textDim} />
          <Text style={s.niLbl}>Buscar</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowMenu(true)}>
          <View style={s.niCreate}>
            <Ionicons name='add' size={28} color='#001a18' />
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={s.ni} onPress={() => navigation.navigate('Chats')}>
          <Ionicons name='chatbubble-outline' size={22} color={colors.textDim} />
          <Text style={s.niLbl}>Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.ni} onPress={() => setDrawerOpen(true)}>
          <Ionicons name='person-outline' size={22} color={colors.textDim} />
          <Text style={s.niLbl}>Perfil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: colors.black },
  center:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTxt: { color: colors.textDim, fontSize: 14 },

  toast: {
    position: 'absolute', top: 60, left: 20, right: 20, zIndex: 998,
    backgroundColor: 'rgba(0,50,45,0.97)',
    borderRadius: 16, borderWidth: 1, borderColor: colors.borderC,
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16,
    shadowColor: colors.c1, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
  },
  toastIcon:  { fontSize: 32 },
  toastTitle: { color: colors.textDim, fontSize: 10, letterSpacing: 2 },
  toastName:  { color: colors.c1, fontSize: 16, fontWeight: '700' },

  // Header wrapper — flotante, transparente por defecto
  headerWrap: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    backgroundColor: 'transparent',
  },
  // Cuando scrollea — fondo cristal oscuro
  headerWrapScrolled: {
    backgroundColor: 'rgba(2,5,9,0.82)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  headerLeft:     { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerUsername: { color: colors.textHi, fontWeight: '700', fontSize: 13 },
  headerRight:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn:        { padding: 8 },
  notifBadge:     { position: 'absolute', top: -2, right: -2, backgroundColor: colors.c1, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  notifBadgeTxt:  { color: colors.black, fontSize: 9, fontWeight: '900', paddingHorizontal: 3 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: colors.borderC,
  },
  searchInput:  { flex: 1, padding: 12, color: colors.textHi, fontSize: 14 },
  searchResults: {
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: colors.borderC,
    overflow: 'hidden',
  },
  searchItem:   { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchUser:   { color: colors.textHi, fontSize: 13, fontWeight: '600' },
  searchXp:     { color: colors.textDim, fontSize: 10, marginTop: 1 },
  searchArrow:  { color: colors.textDim, fontSize: 18 },
  searchEmpty:  { marginHorizontal: 16, marginBottom: 8, padding: 12, alignItems: 'center' },
  searchEmptyTxt:{ color: colors.textDim, fontSize: 13 },

  feed: { flex: 1 },

  bnav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    backgroundColor: colors.deep,
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingVertical: 10, paddingBottom: 20,
  },
  ni:       { alignItems: 'center', flex: 1 },
  niLbl:    { fontSize: 9, color: colors.textDim, letterSpacing: 0.5 },
  niCreate: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.c1, alignItems: 'center', justifyContent: 'center', shadowColor: colors.c1, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 },
});
