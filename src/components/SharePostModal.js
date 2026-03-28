import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput,
  FlatList, ActivityIndicator, StyleSheet, Platform,
  Share, ScrollView, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

// ─── Paleta ───────────────────────────────────────────────────────────────────
const C = {
  bg:           '#060e18',
  card:         '#0b1521',
  surface:      '#0d1d2e',
  border:       'rgba(255,255,255,0.07)',
  accent:       '#00e5cc',
  accentDim:    'rgba(0,229,204,0.10)',
  accentBorder: 'rgba(0,229,204,0.25)',
  textHi:       '#e8f4f8',
  textMid:      'rgba(232,244,248,0.65)',
  textDim:      'rgba(232,244,248,0.32)',
  success:      '#22c55e',
  successDim:   'rgba(34,197,94,0.12)',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getInitials(username) {
  if (!username) return '?';
  return username.slice(0, 2).toUpperCase();
}

// Avatar simple sin marco
function PlainAvatar({ size = 48, avatarUrl, username }) {
  const [error, setError] = useState(false);
  if (avatarUrl && !error) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onError={() => setError(true)}
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: '#0d2a3e',
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: 'rgba(0,229,204,0.2)',
    }}>
      <Text style={{ color: C.accent, fontSize: size * 0.32, fontWeight: '700' }}>
        {getInitials(username)}
      </Text>
    </View>
  );
}

// ─── PostPreviewCard ──────────────────────────────────────────────────────────
function PostPreviewCard({ post }) {
  return (
    <View style={p.card}>
      <View style={p.accent} />
      <View style={p.body}>
        <View style={p.authorRow}>
          <Ionicons name="person-circle-outline" size={12} color={C.textDim} />
          <Text style={p.author}>@{post.author?.username || post.authorUsername}</Text>
        </View>
        {post.title ? <Text style={p.title} numberOfLines={1}>{post.title}</Text> : null}
        <Text style={p.content} numberOfLines={2}>{post.content}</Text>
        {post.imageUrl ? (
          <View style={p.imgBadge}>
            <Ionicons name="image-outline" size={10} color={C.textDim} />
            <Text style={p.imgTxt}>Incluye imagen</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const p = StyleSheet.create({
  card:      { flexDirection:'row', backgroundColor:C.surface, borderRadius:12, borderWidth:1, borderColor:C.border, overflow:'hidden', marginHorizontal:16, marginBottom:14 },
  accent:    { width:3, backgroundColor:C.accent },
  body:      { flex:1, padding:10, gap:3 },
  authorRow: { flexDirection:'row', alignItems:'center', gap:4 },
  author:    { color:C.accent, fontSize:11, fontWeight:'700' },
  title:     { color:C.textHi, fontSize:13, fontWeight:'700' },
  content:   { color:C.textMid, fontSize:12, lineHeight:16 },
  imgBadge:  { flexDirection:'row', alignItems:'center', gap:3, marginTop:2 },
  imgTxt:    { color:C.textDim, fontSize:10 },
});

// ─── FriendBubble ─────────────────────────────────────────────────────────────
function FriendBubble({ user, sent, sending, onPress }) {
  return (
    <TouchableOpacity style={fb.wrap} onPress={onPress} activeOpacity={0.75} disabled={sent || sending}>
      <View style={[fb.ringOuter, sent && fb.ringOuterDone]}>
        <View style={fb.avatarWrap}>
          {sending ? (
            <View style={{ width:48, height:48, alignItems:'center', justifyContent:'center' }}>
              <ActivityIndicator size="small" color={C.accent} />
            </View>
          ) : (
            <PlainAvatar size={48} avatarUrl={user.avatarUrl} username={user.username} />
          )}
        </View>
        {sent && (
          <View style={fb.check}>
            <Ionicons name="checkmark" size={10} color="#fff" />
          </View>
        )}
      </View>
      <Text style={fb.name} numberOfLines={1}>{user.username}</Text>
      <View style={[fb.sendChip, sent && fb.sendChipDone]}>
        <Ionicons
          name={sent ? 'checkmark' : 'send-outline'}
          size={9}
          color={sent ? C.success : C.accent}
        />
        <Text style={[fb.sendChipTxt, sent && { color: C.success }]}>
          {sending ? '...' : sent ? 'Enviado' : 'Enviar'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const fb = StyleSheet.create({
  wrap:         { alignItems:'center', gap:4, width:68 },
  ringOuter:    { borderRadius:30, borderWidth:2, borderColor:'rgba(0,229,204,0.25)', padding:2, position:'relative' },
  ringOuterDone:{ borderColor:'rgba(34,197,94,0.55)' },
  avatarWrap:   { borderRadius:26, overflow:'hidden' },
  name:         { color:C.textMid, fontSize:10, fontWeight:'600', maxWidth:64, textAlign:'center' },
  check:        { position:'absolute', bottom:0, right:0, width:16, height:16, borderRadius:8, backgroundColor:C.success, alignItems:'center', justifyContent:'center', borderWidth:1.5, borderColor:C.bg },
  sendChip:     { flexDirection:'row', alignItems:'center', gap:3, paddingHorizontal:6, paddingVertical:2, borderRadius:8, backgroundColor:C.accentDim, borderWidth:1, borderColor:C.accentBorder },
  sendChipDone: { backgroundColor:'rgba(34,197,94,0.08)', borderColor:'rgba(34,197,94,0.25)' },
  sendChipTxt:  { color:C.accent, fontSize:9, fontWeight:'700' },
});

// ─── GroupRow ─────────────────────────────────────────────────────────────────
function GroupRow({ group, sent, sending, onPress }) {
  return (
    <TouchableOpacity style={gr.row} onPress={onPress} activeOpacity={0.75} disabled={sent || sending}>
      <View style={gr.avatarWrap}>
        {group.imageUrl
          ? <Image source={{ uri: group.imageUrl }} style={gr.avatar} />
          : (
            <View style={[gr.avatar, { backgroundColor:'#0d2a3e', alignItems:'center', justifyContent:'center' }]}>
              <Text style={{ color:C.accent, fontSize:14, fontWeight:'700' }}>
                {getInitials(group.name)}
              </Text>
            </View>
          )
        }
      </View>
      <View style={{ flex:1 }}>
        <Text style={gr.name} numberOfLines={1}>{group.name}</Text>
        <Text style={gr.sub} numberOfLines={1}>
          {group.members?.length || 0} miembros
        </Text>
      </View>
      {sending ? (
        <ActivityIndicator size="small" color={C.accent} />
      ) : (
        <View style={[gr.btn, sent && gr.btnDone]}>
          <Ionicons
            name={sent ? 'checkmark' : 'send-outline'}
            size={13}
            color={sent ? C.success : C.accent}
          />
          <Text style={[gr.btnTxt, sent && { color:C.success }]}>
            {sent ? 'Enviado' : 'Enviar'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const gr = StyleSheet.create({
  row:      { flexDirection:'row', alignItems:'center', gap:10, paddingVertical:10, borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.04)' },
  avatarWrap:{ },
  avatar:   { width:40, height:40, borderRadius:20 },
  name:     { color:C.textHi, fontSize:13, fontWeight:'600' },
  sub:      { color:C.textDim, fontSize:11, marginTop:1 },
  btn:      { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:12, paddingVertical:7, borderRadius:10, backgroundColor:C.accentDim, borderWidth:1, borderColor:C.accentBorder },
  btnDone:  { backgroundColor:'rgba(34,197,94,0.08)', borderColor:'rgba(34,197,94,0.25)' },
  btnTxt:   { color:C.accent, fontSize:11, fontWeight:'700' },
});

// ─── Plataformas sociales ─────────────────────────────────────────────────────
const PLATFORMS = [
  { id:'whatsapp', label:'WhatsApp', icon:'logo-whatsapp', color:'#25D366', bg:'rgba(37,211,102,0.10)' },
  { id:'telegram', label:'Telegram', icon:'send',          color:'#229ED9', bg:'rgba(34,158,217,0.10)' },
  { id:'twitter',  label:'X',        icon:'logo-twitter',  color:'#888',    bg:'rgba(255,255,255,0.06)' },
  { id:'other',    label:'Más',      icon:'share-outline', color:C.textMid, bg:'rgba(255,255,255,0.06)' },
];

// ─── SharePostModal ───────────────────────────────────────────────────────────
export default function SharePostModal({ visible, onClose, post, currentUserId }) {
  const insets = useSafeAreaInsets();

  const [friends,       setFriends]       = useState([]);
  const [groups,        setGroups]        = useState([]);
  const [loadingData,   setLoadingData]   = useState(false);
  const [groupQuery,    setGroupQuery]    = useState('');
  const [sentMap,       setSentMap]       = useState({});
  const [sendingMap,    setSendingMap]    = useState({});
  const [linkCopied,    setLinkCopied]    = useState(false);
  const [showSearch,    setShowSearch]    = useState(false);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching,     setSearching]     = useState(false);

  const postUrl = `https://abyss.social/post/${post?._id}`;

  // ── Cargar amigos y grupos ────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    setSentMap({});
    setGroupQuery('');
    setLinkCopied(false);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
    setLoadingData(true);

    Promise.all([
      api.get('/chats').catch(() => ({ data: { chats: [] } })),
      api.get('/groups').catch(() => ({ data: { groups: [] } })),
    ]).then(([chatsRes, groupsRes]) => {
      const chats = chatsRes.data.chats || [];
      // Guardar chatId junto al usuario para no tener que buscarlo después
      const extracted = chats
        .map(c => {
          const other = c.participants?.find(u => u._id?.toString() !== currentUserId?.toString());
          return other ? { ...other, chatId: c._id } : null;
        })
        .filter(Boolean);
      setFriends(extracted);
      // La ruta devuelve { groups: [...] }
      setGroups(groupsRes.data?.groups || []);
    }).finally(() => setLoadingData(false));
  }, [visible]);

  // ── Buscar amigos (overlay +) ─────────────────────────────────────────────
  const handleSearchFriend = useCallback(async (q) => {
    setSearchQuery(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const { data } = await api.get(`/users/search?q=${q.trim()}`);
      setSearchResults((data.users || []).filter(u => u._id !== currentUserId));
    } catch {}
    finally { setSearching(false); }
  }, [currentUserId]);

  // ── Payload compartir ─────────────────────────────────────────────────────
  const sharedPostPayload = {
    postId:          post?._id,
    title:           post?.title || '',
    content:         post?.content || '',
    imageUrl:        post?.imageUrl || null,
    authorUsername:  post?.author?.username || '',
    authorAvatarUrl: post?.author?.avatarUrl || null,
    postType:        post?.postType || 'quick',
  };

  // ── Auto-cierre tras envío ────────────────────────────────────────────────
  function closeAfterSend() {
    setTimeout(() => onClose(), 700);
  }

  // ── Enviar a chat por userId ──────────────────────────────────────────────
  async function sendToFriend(friend) {
    const key = `friend_${friend._id}`;
    if (sendingMap[key] || sentMap[key]) return;
    const chatId = friend.chatId;
    if (!chatId) {
      console.log('sendToFriend: sin chatId para', friend.username);
      return;
    }
    setSendingMap(prev => ({ ...prev, [key]: true }));
    try {
      await api.post(`/chats/${chatId}/share-post`, sharedPostPayload);
      setSentMap(prev => ({ ...prev, [key]: true }));
      closeAfterSend();
    } catch (e) {
      console.log('sendToFriend error:', e.message);
    } finally {
      setSendingMap(prev => ({ ...prev, [key]: false }));
    }
  }

  // ── Enviar a grupo ────────────────────────────────────────────────────────
  async function sendToGroup(group) {
    const key = `group_${group._id}`;
    if (sendingMap[key] || sentMap[key]) return;
    setSendingMap(prev => ({ ...prev, [key]: true }));
    try {
      await api.post(`/groups/${group._id}/share-post`, sharedPostPayload);
      setSentMap(prev => ({ ...prev, [key]: true }));
      closeAfterSend();
    } catch (e) {
      console.log('sendToGroup error:', e.message);
    } finally {
      setSendingMap(prev => ({ ...prev, [key]: false }));
    }
  }

  // ── Copiar link ───────────────────────────────────────────────────────────
  async function handleCopyLink() {
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(postUrl);
      } else {
        const { Clipboard } = require('react-native');
        Clipboard.setString(postUrl);
      }
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    } catch {}
  }

  // ── Compartir por plataforma ──────────────────────────────────────────────
  async function handlePlatformShare(platformId) {
    const text  = post?.content?.slice(0, 100) || 'Mira este post en Abyss';
    const msg   = `${text}\n\n${postUrl}`;
    const title = post?.title || 'Post en Abyss';

    if (Platform.OS === 'web') {
      if (platformId === 'whatsapp') {
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      } else if (platformId === 'telegram') {
        window.open(`https://t.me/share/url?url=${encodeURIComponent(postUrl)}&text=${encodeURIComponent(text)}`, '_blank');
      } else if (platformId === 'twitter') {
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(msg)}`, '_blank');
      } else if (navigator?.share) {
        navigator.share({ title, text, url: postUrl }).catch(() => {});
      } else {
        handleCopyLink();
      }
      return;
    }

    if (platformId === 'whatsapp') {
      const { Linking } = require('react-native');
      Linking.openURL(`whatsapp://send?text=${encodeURIComponent(msg)}`).catch(() =>
        Share.share({ message: msg, title })
      );
    } else if (platformId === 'telegram') {
      const { Linking } = require('react-native');
      Linking.openURL(`tg://msg?text=${encodeURIComponent(msg)}`).catch(() =>
        Share.share({ message: msg, title })
      );
    } else {
      Share.share({ message: msg, url: postUrl, title }).catch(() => {});
    }
  }

  // ── Grupos filtrados ──────────────────────────────────────────────────────
  const filteredGroups = groupQuery.trim().length > 0
    ? groups.filter(g => g.name?.toLowerCase().includes(groupQuery.toLowerCase()))
    : groups;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={s.overlay}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>

          {/* Handle */}
          <View style={s.handle} />

          {/* Header */}
          <View style={s.header}>
            <Text style={s.headerTitle}>Compartir</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={18} color={C.textDim} />
            </TouchableOpacity>
          </View>

          {/* Preview del post */}
          {post ? <PostPreviewCard post={post} /> : null}

          {/* ── Amigos horizontal ── */}
          <View style={s.sectionRow}>
            <Text style={s.sectionLabel}>Amigos</Text>
          </View>

          {loadingData ? (
            <ActivityIndicator color={C.accent} style={{ marginVertical:16 }} />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.friendsRow}
            >
              {friends.map((f, idx) => (
                <FriendBubble
                  key={`friend_${f._id}_${idx}`}
                  user={f}
                  sent={!!sentMap[`friend_${f._id}`]}
                  sending={!!sendingMap[`friend_${f._id}`]}
                  onPress={() => sendToFriend(f)}
                />
              ))}

              {/* Botón + buscar más */}
              <TouchableOpacity style={fb.wrap} onPress={() => setShowSearch(true)} activeOpacity={0.75}>
                <View style={[fb.ring, s.plusCircle]}>
                  <Ionicons name="add" size={24} color={C.accent} />
                </View>
                <Text style={fb.name}>Buscar</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* ── Redes sociales ── */}
          <View style={s.divider} />
          <View style={s.sectionRow}>
            <Text style={s.sectionLabel}>Compartir en</Text>
          </View>

          <View style={s.platformsRow}>
            {/* Copiar link */}
            <TouchableOpacity
              style={[s.platformBtn, linkCopied && s.platformBtnDone]}
              onPress={handleCopyLink}
              activeOpacity={0.75}
            >
              <Ionicons
                name={linkCopied ? 'checkmark' : 'link-outline'}
                size={20}
                color={linkCopied ? C.success : C.textMid}
              />
              <Text style={[s.platformTxt, linkCopied && { color: C.success }]}>
                {linkCopied ? 'Copiado' : 'Copiar'}
              </Text>
            </TouchableOpacity>

            {PLATFORMS.map(pl => (
              <TouchableOpacity
                key={pl.id}
                style={[s.platformBtn, { backgroundColor: pl.bg }]}
                onPress={() => handlePlatformShare(pl.id)}
                activeOpacity={0.75}
              >
                <Ionicons name={pl.icon} size={20} color={pl.color} />
                <Text style={[s.platformTxt, { color: pl.color }]}>{pl.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Grupos ── */}
          <View style={s.divider} />
          <View style={s.sectionRow}>
            <Text style={s.sectionLabel}>Grupos</Text>
          </View>

          {/* Buscador de grupos */}
          <View style={s.searchBar}>
            <Ionicons name="search-outline" size={14} color={C.textDim} style={{ marginLeft:10 }} />
            <TextInput
              style={s.searchInput}
              placeholder="Buscar grupo..."
              placeholderTextColor={C.textDim}
              value={groupQuery}
              onChangeText={setGroupQuery}
            />
          </View>

          <FlatList
            data={filteredGroups}
            keyExtractor={(item, i) => `group_${String(item._id || i)}_${i}`}
            style={{ maxHeight: 220 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={() => (
              <View style={s.empty}>
                <Text style={s.emptyTxt}>
                  {loadingData ? '' : groups.length === 0 ? 'No perteneces a ningún grupo' : 'Sin resultados'}
                </Text>
              </View>
            )}
            renderItem={({ item }) => (
              <GroupRow
                group={item}
                sent={!!sentMap[`group_${item._id}`]}
                sending={!!sendingMap[`group_${item._id}`]}
                onPress={() => sendToGroup(item)}
              />
            )}
          />
        </View>
      </View>

      {/* ── Modal buscar amigo (+) ── */}
      <Modal
        visible={showSearch}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSearch(false)}
      >
        <View style={s.overlay}>
          <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setShowSearch(false)} />
          <View style={[s.searchSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={s.handle} />
            <View style={s.header}>
              <Text style={s.headerTitle}>Buscar amigo</Text>
              <TouchableOpacity onPress={() => setShowSearch(false)} style={s.closeBtn}>
                <Ionicons name="close" size={18} color={C.textDim} />
              </TouchableOpacity>
            </View>
            <View style={[s.searchBar, { marginHorizontal:16, marginBottom:10 }]}>
              <Ionicons name="search-outline" size={14} color={C.textDim} style={{ marginLeft:10 }} />
              <TextInput
                style={s.searchInput}
                placeholder="Buscar usuario..."
                placeholderTextColor={C.textDim}
                value={searchQuery}
                onChangeText={handleSearchFriend}
                autoFocus
              />
              {searching && <ActivityIndicator size="small" color={C.accent} style={{ marginRight:10 }} />}
            </View>
            <FlatList
              data={searchResults}
              keyExtractor={(item, i) => `search_${String(item._id || i)}_${i}`}
              style={{ maxHeight:300 }}
              contentContainerStyle={{ paddingHorizontal:16 }}
              ListEmptyComponent={() => (
                <View style={s.empty}>
                  <Text style={s.emptyTxt}>
                    {searchQuery.length >= 2 ? 'Sin resultados' : 'Escribe para buscar'}
                  </Text>
                </View>
              )}
              renderItem={({ item }) => {
                const key = `friend_${item._id}`;
                return (
                  <TouchableOpacity
                    style={[gr.row, { paddingHorizontal:0 }]}
                    onPress={async () => {
                      await sendToFriend(item);
                      // agregar a la lista de amigos si no está
                      if (!friends.find(f => f._id === item._id)) {
                        setFriends(prev => [item, ...prev]);
                      }
                    }}
                    activeOpacity={0.75}
                    disabled={!!sentMap[key] || !!sendingMap[key]}
                  >
                    <PlainAvatar size={40} avatarUrl={item.avatarUrl} username={item.username} />
                    <View style={{ flex:1, marginLeft:10 }}>
                      <Text style={gr.name}>{item.username}</Text>
                    </View>
                    {sendingMap[key] ? (
                      <ActivityIndicator size="small" color={C.accent} />
                    ) : (
                      <View style={[gr.btn, sentMap[key] && gr.btnDone]}>
                        <Ionicons
                          name={sentMap[key] ? 'checkmark' : 'send-outline'}
                          size={13}
                          color={sentMap[key] ? C.success : C.accent}
                        />
                        <Text style={[gr.btnTxt, sentMap[key] && { color: C.success }]}>
                          {sentMap[key] ? 'Enviado' : 'Enviar'}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  overlay: { flex:1, justifyContent:'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(0,0,0,0.6)' },

  sheet: {
    backgroundColor:      C.bg,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    borderTopWidth:       1,
    borderLeftWidth:      1,
    borderRightWidth:     1,
    borderColor:          'rgba(0,229,204,0.12)',
    maxHeight:            '90%',
    paddingTop:           12,
  },
  searchSheet: {
    backgroundColor:      C.bg,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    borderTopWidth:       1,
    borderLeftWidth:      1,
    borderRightWidth:     1,
    borderColor:          'rgba(0,229,204,0.12)',
    paddingTop:           12,
  },

  handle: {
    width:40, height:4,
    backgroundColor:'rgba(255,255,255,0.12)',
    borderRadius:2,
    alignSelf:'center',
    marginBottom:14,
  },
  header: {
    flexDirection:'row', alignItems:'center',
    justifyContent:'space-between',
    paddingHorizontal:20,
    marginBottom:14,
  },
  headerTitle: { color:C.textHi, fontSize:17, fontWeight:'700' },
  closeBtn: {
    width:32, height:32, borderRadius:16,
    backgroundColor:'rgba(255,255,255,0.07)',
    alignItems:'center', justifyContent:'center',
  },

  sectionRow:  { paddingHorizontal:16, marginBottom:10 },
  sectionLabel:{ color:C.textDim, fontSize:11, fontWeight:'700', letterSpacing:0.8, textTransform:'uppercase' },

  friendsRow: { paddingHorizontal:16, gap:16, paddingBottom:4 },

  plusCircle: {
    width:50, height:50, borderRadius:25,
    backgroundColor:'rgba(0,229,204,0.07)',
    borderStyle:'dashed',
    alignItems:'center', justifyContent:'center',
  },

  divider: {
    height:1,
    backgroundColor:'rgba(255,255,255,0.05)',
    marginHorizontal:16,
    marginVertical:14,
  },

  platformsRow: {
    flexDirection:'row',
    paddingHorizontal:16,
    gap:8,
    marginBottom:4,
  },
  platformBtn: {
    flex:1,
    alignItems:'center',
    gap:5,
    paddingVertical:10,
    borderRadius:12,
    backgroundColor:'rgba(255,255,255,0.05)',
    borderWidth:1,
    borderColor:C.border,
  },
  platformBtnDone: {
    backgroundColor:'rgba(34,197,94,0.08)',
    borderColor:'rgba(34,197,94,0.25)',
  },
  platformTxt: { color:C.textMid, fontSize:10, fontWeight:'600' },

  searchBar: {
    flexDirection:'row', alignItems:'center',
    backgroundColor:C.surface,
    borderRadius:12,
    borderWidth:1,
    borderColor:C.border,
    marginHorizontal:16,
    marginBottom:8,
  },
  searchInput: {
    flex:1,
    paddingVertical:10,
    paddingHorizontal:8,
    color:C.textHi,
    fontSize:13,
    ...(Platform.OS === 'web' ? { outlineStyle:'none' } : {}),
  },

  empty: { paddingVertical:24, alignItems:'center' },
  emptyTxt: { color:C.textDim, fontSize:12 },
});
