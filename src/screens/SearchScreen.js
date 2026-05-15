import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import api from '../services/api';
import AvatarWithFrame from '../components/AvatarWithFrame';
import { useAuthStore } from '../store/authStore';

const C = {
  bg:      colors.black,
  surface: colors.surface,
  card:    colors.card,
  accent:  colors.c1,
  border:  colors.border,
  textHi:  colors.textHi,
  textMid: colors.textMid,
  textDim: colors.textDim,
};

const TABS = ['Usuarios', 'Posts'];

const TRENDING_TOPICS = [
  '#abyss', '#gaming', '#arte', '#música', '#anime',
  '#tecnología', '#memes', '#design',
];

// ─── UserRow ──────────────────────────────────────────────────────────────────
function UserRow({ user, onPress, currentUserId }) {
  const [following, setFollowing] = useState(
    user.followers?.some(f => (f._id || f)?.toString() === currentUserId?.toString()) ?? false
  );
  const [loading, setLoading] = useState(false);

  async function toggleFollow() {
    if (loading) return;
    setLoading(true);
    try {
      await api.post(`/users/${user._id}/follow`);
      setFollowing(f => !f);
    } catch {}
    finally { setLoading(false); }
  }

  return (
    <TouchableOpacity style={s.userRow} onPress={onPress} activeOpacity={0.75}>
      <AvatarWithFrame
        size={44}
        avatarUrl={user.avatarUrl}
        username={user.username}
        profileFrame={user.profileFrame}
        frameUrl={user.profileFrameUrl}
      />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={s.userRowName}>{user.username}</Text>
        <Text style={s.userRowMeta}>XP {user.xp || 0}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── PostRow ──────────────────────────────────────────────────────────────────
function PostRow({ post, onPress }) {
  const ago = (() => {
    const d = Math.floor((Date.now() - new Date(post.createdAt)) / 60000);
    if (d < 60) return `${d}m`;
    if (d < 1440) return `${Math.floor(d/60)}h`;
    return `${Math.floor(d/1440)}d`;
  })();

  return (
    <TouchableOpacity style={s.postRow} onPress={onPress} activeOpacity={0.75}>
      {post.imageUrl && (
        <Image source={{ uri: post.imageUrl }} style={s.postThumb} resizeMode="cover" />
      )}
      <View style={{ flex: 1 }}>
        {post.title ? <Text style={s.postTitle} numberOfLines={1}>{post.title}</Text> : null}
        <Text style={s.postContent} numberOfLines={2}>{post.content}</Text>
        <View style={s.postMeta}>
          <Text style={s.postMetaTxt}>@{post.author?.username}</Text>
          <Text style={s.postMetaDot}>·</Text>
          <Text style={s.postMetaTxt}>{ago}</Text>
          <Text style={s.postMetaDot}>·</Text>
          <Ionicons name="heart" size={10} color={C.textDim} />
          <Text style={s.postMetaTxt}> {post.reactions?.length || 0}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── SuggestedUserCard ────────────────────────────────────────────────────────
function SuggestedUserCard({ user, onPress }) {
  return (
    <TouchableOpacity style={s.suggestedCard} onPress={onPress} activeOpacity={0.8}>
      <AvatarWithFrame
        size={52}
        avatarUrl={user.avatarUrl}
        username={user.username}
        profileFrame={user.profileFrame}
        frameUrl={user.profileFrameUrl}
      />
      <Text style={s.suggestedName} numberOfLines={1}>{user.username}</Text>
      <Text style={s.suggestedXp}>XP {user.xp || 0}</Text>
    </TouchableOpacity>
  );
}

// ─── SearchScreen ─────────────────────────────────────────────────────────────
export default function SearchScreen({ navigation }) {
  const { user } = useAuthStore();
  const insets   = useSafeAreaInsets();

  const [query,          setQuery]          = useState('');
  const [activeTab,      setActiveTab]      = useState(0);
  const [userResults,    setUserResults]    = useState([]);
  const [postResults,    setPostResults]    = useState([]);
  const [suggested,      setSuggested]      = useState([]);
  const [searching,      setSearching]      = useState(false);
  const [loadingSugg,    setLoadingSugg]    = useState(true);
  const inputRef = useRef(null);
  const timer    = useRef(null);

  const isSearching = query.trim().length >= 2;

  useEffect(() => {
    api.get('/users/random').then(({ data }) => setSuggested(data.users || [])).catch(() => {}).finally(() => setLoadingSugg(false));
  }, []);

  const doSearch = useCallback((q) => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) { setUserResults([]); setPostResults([]); return; }
    setSearching(true);
    timer.current = setTimeout(async () => {
      try {
        const [usersRes, postsRes] = await Promise.all([
          api.get(`/users/search?q=${q.trim()}`).catch(() => ({ data: { users: [] } })),
          api.get(`/posts/search?q=${q.trim()}`).catch(() => ({ data: { posts: [] } })),
        ]);
        setUserResults(usersRes.data.users || []);
        setPostResults(postsRes.data.posts || []);
      } catch {}
      finally { setSearching(false); }
    }, 380);
  }, []);

  function handleChangeText(t) {
    setQuery(t);
    doSearch(t);
  }

  function clearSearch() {
    setQuery('');
    setUserResults([]);
    setPostResults([]);
    inputRef.current?.focus();
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={C.textHi} />
        </TouchableOpacity>
        <View style={s.searchBar}>
          <Ionicons name="search-outline" size={16} color={C.textDim} />
          <TextInput
            ref={inputRef}
            style={s.searchInput}
            placeholder="Buscar usuarios, posts..."
            placeholderTextColor={C.textDim}
            value={query}
            onChangeText={handleChangeText}
            autoFocus
            returnKeyType="search"
          />
          {searching && <ActivityIndicator size="small" color={C.accent} style={{ marginRight: 4 }} />}
          {query.length > 0 && !searching && (
            <TouchableOpacity onPress={clearSearch} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
              <Ionicons name="close-circle" size={16} color={C.textDim} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isSearching ? (
        /* ── ESTADO BUSCANDO ── */
        <View style={{ flex: 1 }}>
          {/* Tabs */}
          <View style={s.tabs}>
            {TABS.map((tab, i) => (
              <TouchableOpacity key={tab} style={[s.tab, activeTab === i && s.tabActive]} onPress={() => setActiveTab(i)} activeOpacity={0.8}>
                <Text style={[s.tabTxt, activeTab === i && s.tabTxtActive]}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeTab === 0 && (
            <FlatList
              data={userResults}
              keyExtractor={u => u._id}
              renderItem={({ item }) => (
                <UserRow
                  user={item}
                  currentUserId={user?._id}
                  onPress={() => navigation.navigate('PublicProfile', { username: item.username })}
                />
              )}
              ListEmptyComponent={!searching ? (
                <View style={s.empty}>
                  <Ionicons name="person-outline" size={36} color={C.textDim} />
                  <Text style={s.emptyTxt}>Sin usuarios para "{query}"</Text>
                </View>
              ) : null}
              contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
            />
          )}

          {activeTab === 1 && (
            <FlatList
              data={postResults}
              keyExtractor={p => p._id}
              renderItem={({ item }) => (
                <PostRow
                  post={item}
                  onPress={() => navigation.navigate('PostDetail', { postId: item._id })}
                />
              )}
              ListEmptyComponent={!searching ? (
                <View style={s.empty}>
                  <Ionicons name="document-text-outline" size={36} color={C.textDim} />
                  <Text style={s.emptyTxt}>Sin posts para "{query}"</Text>
                </View>
              ) : null}
              contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
            />
          )}
        </View>
      ) : (
        /* ── ESTADO VACÍO / EXPLORAR ── */
        <FlatList
          data={[]}
          ListHeaderComponent={
            <View>
              {/* Trending topics */}
              <View style={s.section}>
                <Text style={s.sectionTitle}>TENDENCIAS</Text>
                <View style={s.trendingGrid}>
                  {TRENDING_TOPICS.map(tag => (
                    <TouchableOpacity
                      key={tag}
                      style={s.trendingChip}
                      onPress={() => { setQuery(tag.slice(1)); handleChangeText(tag.slice(1)); }}
                      activeOpacity={0.75}
                    >
                      <Text style={s.trendingChipTxt}>{tag}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Sugeridos */}
              <View style={s.section}>
                <Text style={s.sectionTitle}>SUGERIDOS</Text>
                {loadingSugg ? (
                  <ActivityIndicator color={C.accent} style={{ marginVertical: 20 }} />
                ) : (
                  <View style={s.suggestedGrid}>
                    {suggested.slice(0, 6).map(u => (
                      <SuggestedUserCard
                        key={u._id}
                        user={u}
                        onPress={() => navigation.navigate('PublicProfile', { username: u.username })}
                      />
                    ))}
                  </View>
                )}
              </View>
            </View>
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },

  // Header
  header:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn:   { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, height: 40 },
  searchInput:{ flex: 1, color: C.textHi, fontSize: 14, paddingVertical: 0 },

  // Tabs
  tabs:       { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border },
  tab:        { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabActive:  { borderBottomWidth: 2, borderBottomColor: C.accent },
  tabTxt:     { color: C.textDim, fontSize: 13, fontWeight: '600' },
  tabTxtActive:{ color: C.accent },

  // User row
  userRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  userRowName:  { color: C.textHi, fontSize: 14, fontWeight: '700' },
  userRowMeta:  { color: C.textDim, fontSize: 11, marginTop: 2 },
  followBtn:    { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: C.accent },
  followingBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.border },
  followBtnTxt: { color: C.bg, fontSize: 12, fontWeight: '700' },
  followingBtnTxt:{ color: C.textMid },

  // Post row
  postRow:     { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  postThumb:   { width: 64, height: 64, borderRadius: 10, backgroundColor: C.card },
  postTitle:   { color: C.textHi, fontSize: 13, fontWeight: '700', marginBottom: 2 },
  postContent: { color: C.textMid, fontSize: 12, lineHeight: 17 },
  postMeta:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  postMetaTxt: { color: C.textDim, fontSize: 10 },
  postMetaDot: { color: C.textDim, fontSize: 10 },

  // Empty
  empty:    { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyTxt: { color: C.textDim, fontSize: 13 },

  // Sections
  section:      { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 },
  sectionTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 2.5, color: C.textDim, marginBottom: 12 },

  // Trending
  trendingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  trendingChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  trendingChipTxt:{ color: C.accent, fontSize: 13, fontWeight: '600' },

  // Suggested grid
  suggestedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  suggestedCard: { width: '31%', backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, alignItems: 'center', paddingVertical: 16, paddingHorizontal: 8 },
  suggestedName: { color: C.textHi, fontSize: 11, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  suggestedXp:   { color: C.textDim, fontSize: 10, marginTop: 2 },
});
