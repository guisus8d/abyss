import React, { useCallback, useState, useEffect } from 'react';
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

function PostCard({ post, currentUserId, onReact, onComment, onDelete, navigation, openPickerId, setOpenPickerId }) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText]   = useState('');
  const [sending, setSending]           = useState(false);
  const [replyToComment, setReplyToComment] = useState(null);
  const showEmojiPicker = openPickerId;
  const setShowEmojiPicker = setOpenPickerId;

  const likeCount = post.reactions.filter(r => r.type === 'like').length;
  const hasLiked  = post.reactions.some(r => r.user === currentUserId && r.type === 'like');
  const emojiReactions = post.reactions.filter(r => r.type !== 'like');
  const emojiGroups = Object.entries(
    emojiReactions.reduce((acc, r) => { acc[r.type] = (acc[r.type] || 0) + 1; return acc; }, {})
  ).map(([emoji, count]) => ({ emoji, count }));
  const myEmoji = emojiReactions.find(r => {
    const uid = r.user?._id || r.user;
    return uid?.toString() === currentUserId?.toString();
  });

  async function submitComment() {
    if (!commentText.trim() || sending) return;
    setSending(true);
    const txt = commentText.trim();
    const reply = replyToComment;
    setCommentText('');
    setReplyToComment(null);
    await onComment(post._id, txt, reply);
    setSending(false);
  }

  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        {/* Avatar con marco */}
        <TouchableOpacity
          onPress={() => navigation.navigate('PublicProfile', { username: post.author.username })}
          style={{ marginRight: 10 }}
        >
          <AvatarWithFrame
            size={38}
            avatarUrl={post.author.avatarUrl}
            username={post.author.username}
            profileFrame={post.author.profileFrame}
          />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <TouchableOpacity onPress={() => navigation.navigate('PublicProfile', { username: post.author.username })}>
            <Text style={s.cardUser}>{post.author.username}</Text>
          </TouchableOpacity>
          <Text style={s.cardMeta}>XP {post.author.xp} · {timeAgo(post.createdAt)}</Text>
        </View>
        {(post.author._id === currentUserId || post.author.id === currentUserId) && (
          <TouchableOpacity
            onPress={() => {
              if (window.confirm('¿Seguro que quieres borrar este post?')) {
                onDelete(post._id);
              }
            }}
            style={s.deleteBtn}
          >
            <Text style={s.deleteBtnTxt}>···</Text>
          </TouchableOpacity>
        )}
      </View>

      {post.postType === 'news' ? (
        <TouchableOpacity style={s.newsCard} onPress={() => navigation.navigate('PostDetail', { postId: post._id })}>
          {post.imageUrl && <Image source={{ uri: post.imageUrl }} style={s.newsCover} resizeMode="cover" />}
          <View style={s.newsBody}>
            <View style={s.newsBadge}>
              <Ionicons name="newspaper-outline" size={10} color="rgba(251,191,36,1)" />
              <Text style={s.newsBadgeTxt}>NOTICIA</Text>
            </View>
            {post.title ? <Text style={s.newsTitle}>{post.title}</Text> : null}
            <Text style={s.newsContent} numberOfLines={3}>{post.content}</Text>
          </View>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={() => navigation.navigate('PostDetail', { postId: post._id })}>
          <Text style={s.cardBody}>{post.content}</Text>
          {post.imageUrl && <Image source={{ uri: post.imageUrl }} style={s.postImage} resizeMode="contain" />}
        </TouchableOpacity>
      )}



      {post.tags?.length > 0 && (
        <View style={s.tagsRow}>
          {post.tags.map((t, i) => <Text key={i} style={s.tag}>{t}</Text>)}
        </View>
      )}

      <View style={s.cardActions}>
        <TouchableOpacity style={s.act} onPress={() => onReact(post._id, 'like')}>
          <Ionicons name={hasLiked ? 'heart' : 'heart-outline'} size={18} color={hasLiked ? colors.c3 : colors.textDim} />
          <Text style={s.actCount}>{likeCount}</Text>
        </TouchableOpacity>

        {emojiGroups.map(g => (
          <TouchableOpacity key={g.emoji} style={s.act}
            onPress={() => onReact(post._id, g.emoji)}>
            <Text style={[s.actIcon, myEmoji?.type === g.emoji && {opacity:1}]}>{g.emoji}</Text>
            <Text style={s.actCount}>{g.count}</Text>
          </TouchableOpacity>
        ))}

        <View>
          <TouchableOpacity style={s.act} onPress={() => setShowEmojiPicker(prev => prev === post._id ? null : post._id)}>
            <Ionicons name='add' size={18} color='#fff' />
          </TouchableOpacity>
          {showEmojiPicker === post._id && (
            <View style={s.emojiPicker}>
              {['😂','😮','😢','😡','🤯','👏','🥰','💀','🔥','👀','💯','🫶','😍','🤣','😭','🙌'].map(e => (
                <TouchableOpacity key={e} style={s.emojiOpt}
                  onPress={() => { onReact(post._id, e); setShowEmojiPicker(null); }}>
                  <Text style={s.emojiOptTxt}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity style={s.act} onPress={() => setShowComments(!showComments)}>
          <Ionicons name='chatbubble-outline' size={15} color='#fff' />
          <Text style={s.actCount}>{post.comments.length}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.act, { marginLeft: 'auto' }]}>
          <Ionicons name='share-outline' size={18} color='#fff' />
        </TouchableOpacity>
      </View>

      {showComments && (
        <View style={s.commentsBox}>
          <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
          {(() => {
            const topLevel = post.comments.filter(c => !c.replyTo?.commentId);
            const replies  = post.comments.filter(c => !!c.replyTo?.commentId);
            return topLevel.map((c, i) => {
              const cReplies = replies.filter(r => r.replyTo.commentId?.toString() === c._id?.toString());
              return (
                <View key={i}>
                  <View style={s.comment}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Text>
                          <TouchableOpacity onPress={() => navigation.navigate('PublicProfile', { username: c.user?.username })}>
                            <Text style={s.commentUser}>{c.user?.username || 'user'} </Text>
                          </TouchableOpacity>
                          <Text style={s.commentText}>{c.text}</Text>
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => setReplyToComment({ commentId: c._id, username: c.user?.username, text: c.text })}>
                        <Ionicons name='return-down-forward-outline' size={14} color='#555' />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {cReplies.map((r, j) => (
                    <View key={j} style={s.commentReply}>
                      <View style={s.commentReplyLine} />
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={{ flex: 1 }}>
                            <Text>
                              <TouchableOpacity onPress={() => navigation.navigate('PublicProfile', { username: r.user?.username })}>
                                <Text style={s.commentUser}>{r.user?.username || 'user'} </Text>
                              </TouchableOpacity>
                              <Text style={s.commentText}>{r.text}</Text>
                            </Text>
                          </View>
                          <TouchableOpacity onPress={() => setReplyToComment({ commentId: c._id, username: c.user?.username, text: c.text })}>
                            <Ionicons name='return-down-forward-outline' size={14} color='#555' />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              );
            });
          })()}
          </ScrollView>
          {replyToComment && (
            <View style={s.commentReplyBar}>
              <Text style={s.commentReplyBarTxt} numberOfLines={1}>↩  @{replyToComment.username}: {replyToComment.text?.slice(0,40)}</Text>
              <TouchableOpacity onPress={() => setReplyToComment(null)}>
                <Text style={{ color: '#888', paddingHorizontal: 8 }}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={s.commentInput}>
            <TextInput
              style={s.commentField}
              placeholder="Escribe un comentario..."
              placeholderTextColor={colors.textDim}
              value={commentText}
              onChangeText={setCommentText}
            />
            <TouchableOpacity onPress={submitComment} disabled={sending}>
              <Text style={s.commentSend}>{sending ? '...' : '↑'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

export default function HomeScreen({ navigation }) {
  const [unreadNotifs, setUnreadNotifs] = React.useState(0);
  const [openPickerId, setOpenPickerId] = useState(null);

  React.useEffect(() => {
    api.get('/notifications/unread').then(r => setUnreadNotifs(r.data.unread)).catch(() => {});
    connectSocket().then(s => {
      s.off('notification:new');
      s.on('notification:new', () => setUnreadNotifs(prev => prev + 1));
    });
  }, []);

  const { user, logout, updateUser } = useAuthStore();

  // Refrescar datos del usuario (coins, xp, etc) al montar
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
    try {
      await api.post(`/posts/${postId}/react`, { type });
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
    } catch {}
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
      <StatusBar barStyle="light-content" backgroundColor={colors.black} />

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

      <SafeAreaView>
        <View style={s.header}>
          {/* Header avatar con marco */}
          <TouchableOpacity style={s.headerAvatarWrap} onPress={() => setDrawerOpen(true)}>
            <AvatarWithFrame
              size={34}
              avatarUrl={user?.avatarUrl}
              username={user?.username}
              profileFrame={user?.profileFrame}
              bgColor='rgba(0,229,204,0.15)'
            />
          </TouchableOpacity>
          <Text style={s.headerTitle}>ABBYS</Text>
          <View style={s.headerRight}>
            <TouchableOpacity style={s.iconBtn} onPress={() => { setUnreadNotifs(0); navigation.navigate('Notifications'); }}>
              <Ionicons name='notifications-outline' size={22} color={colors.textHi} />
              {unreadNotifs > 0 && (
                <View style={{
                  position:'absolute', top:-2, right:-2,
                  backgroundColor: colors.c1, borderRadius: 8,
                  minWidth: 16, height: 16, alignItems:'center', justifyContent:'center',
                }}>
                  <Text style={{ color: colors.black, fontSize: 9, fontWeight:'900', paddingHorizontal:3 }}>
                    {unreadNotifs > 99 ? '99+' : unreadNotifs}
                  </Text>
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
                <AvatarWithFrame
                  size={36}
                  avatarUrl={u.avatarUrl}
                  username={u.username}
                  profileFrame={u.profileFrame}
                />
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

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.c1} size="large" /></View>
      ) : (
        <ScrollView
          style={s.feed}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPosts(); }} tintColor={colors.c1} />}
        >
         
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

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle:     { fontSize: 18, fontWeight: '900', letterSpacing: 8, color: colors.c1 },
  headerAvatarWrap:{ width: 34, height: 34 },
  headerAvatarImg: { width: 34, height: 34, borderRadius: 17 },
  headerRight:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn:      { padding: 8 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: colors.borderC,
  },
  searchInput: { flex: 1, padding: 12, color: colors.textHi, fontSize: 14 },
  searchResults: {
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: colors.borderC,
    overflow: 'hidden',
  },
  searchItem: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, gap: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  searchUser:  { color: colors.textHi, fontSize: 13, fontWeight: '600' },
  searchXp:    { color: colors.textDim, fontSize: 10, marginTop: 1 },
  searchArrow: { color: colors.textDim, fontSize: 18 },
  searchEmpty: { marginHorizontal: 16, marginBottom: 8, padding: 12, alignItems: 'center' },
  searchEmptyTxt: { color: colors.textDim, fontSize: 13 },

  feed: { flex: 1 },
  card: {
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: colors.card,
    borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 16,
  },
  cardHead:   { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatarTxt:  { color: colors.c1, fontWeight: 'bold', fontSize: 14 },
  cardUser:   { color: colors.textHi, fontWeight: '600', fontSize: 13 },
  cardMeta:   { color: colors.textDim, fontSize: 10, marginTop: 1 },
  cardBody:   { color: colors.textMid, fontSize: 13, lineHeight: 20, marginBottom: 10 },
  newsCard:   { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(234,179,8,0.2)', overflow: 'hidden', marginBottom: 10 },
  newsCover:  { width: '100%', height: 160 },
  newsBody:   { padding: 12, gap: 8 },
  newsBadge:  { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(234,179,8,0.1)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  newsBadgeTxt: { color: 'rgba(251,191,36,1)', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  newsTitle:  { color: colors.textHi, fontSize: 16, fontWeight: '700', lineHeight: 22 },
  newsContent:{ color: colors.textDim, fontSize: 13, lineHeight: 20 },
  emojiPicker: {
    position: 'absolute', bottom: 36, left: -60, zIndex: 99,
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.borderC,
    flexDirection: 'row', flexWrap: 'wrap',
    padding: 8, gap: 4, width: 220,
  },
  emojiOpt:    { padding: 5 },
  emojiOptTxt: { fontSize: 22 },
  deleteBtn:    { padding: 8, marginLeft: 4, backgroundColor: 'rgba(255,0,0,0.15)', borderRadius: 8 },
  deleteBtnTxt: { color: '#ff4444', fontSize: 18, fontWeight: 'bold' },
  postImage:  { width: "100%", aspectRatio: 4/3, borderRadius: 12, marginBottom: 10, backgroundColor: colors.surface, resizeMode: 'contain' },
  tagsRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  tag:        { color: colors.c1, fontSize: 11, opacity: 0.7 },
  cardActions:{ flexDirection: 'row', alignItems: 'center', gap: 20 },
  act:        { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actIcon:    { fontSize: 16, color: colors.textDim },
  actCount:   { color: colors.textDim, fontSize: 12 },

  commentsBox:  { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  comment:      { flexDirection: 'row', marginBottom: 6 },
  commentUser:  { color: colors.c1, fontSize: 12, fontWeight: '600' },
  commentText:  { color: colors.textMid, fontSize: 12, flex: 1 },
  commentReply:        { flexDirection: 'row', paddingLeft: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#111' },
  commentReplyLine:    { width: 2, backgroundColor: '#333', marginRight: 10, borderRadius: 2 },
  commentReplyBar:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', padding: 6, borderRadius: 8, marginBottom: 4 },
  commentReplyBarTxt:  { color: '#888', fontSize: 11, flex: 1 },
  commentInput: {
    flexDirection: 'row', alignItems: 'center', marginTop: 8,
    backgroundColor: 'rgba(8,20,36,0.95)',
    borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  commentField: { flex: 1, color: colors.textHi, fontSize: 13 },
  commentSend:  { color: colors.c1, fontSize: 20, paddingLeft: 8 },

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
