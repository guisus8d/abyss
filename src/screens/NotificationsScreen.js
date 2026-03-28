import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, Image,
  StyleSheet, StatusBar, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';
import api from '../services/api';
import { connectSocket } from '../services/socket';

const TABS = [
  { key: 'all',     label: 'Todo' },
  { key: 'like',    label: 'Reacciones' },
  { key: 'comment', label: 'Comentarios' },
  { key: 'follow',  label: 'Seguidores' },
];

function timeAgo(date) {
  const diff = Date.now() - new Date(date);
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'ahora';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function notifText(n) {
  switch (n.type) {
    case 'like':
      return n.text && n.text !== '❤️'
        ? `reaccionó con ${n.text} a tu post`
        : 'le dio ❤️ a tu post';
    case 'comment':
      return n.text === 'comentó en tu post'
        ? 'comentó en tu post'
        : n.text?.startsWith('↩')
          ? 'respondió a tu comentario'
          : 'comentó en tu post';
    case 'follow':       return 'empezó a seguirte';
    case 'chat_accepted':return 'aceptó tu solicitud de chat';
    case 'mention':      return 'te mencionó en un mensaje';
    default:             return '';
  }
}

export default function NotificationsScreen({ navigation }) {
  const [tab, setTab]         = useState('all');
  const [notifs, setNotifs]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useFocusEffect(useCallback(() => {
    load(1, tab, true);
    api.patch('/notifications/read', { type: 'all' }).catch(() => {});

    let socket = null;
    connectSocket().then(s => {
      socket = s;
      s.off('notification:new');
      s.on('notification:new', () => load(1, tab, true));
    });

    return () => { if (socket) socket.off('notification:new'); };
  }, [tab]));

  async function load(p, t, reset = false) {
    if (reset) setLoading(true);
    try {
      const { data } = await api.get(`/notifications?type=${t}&page=${p}&limit=20`);
      setNotifs(prev => reset ? data.notifs : [...prev, ...data.notifs]);
      setPage(p);
      setHasMore(p < data.pages);
    } catch(e) { console.log(e); }
    finally { setLoading(false); setLoadingMore(false); }
  }

  function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    load(page + 1, tab);
  }

  function renderNotif({ item }) {
    const isRead = item.read;
    return (
      <TouchableOpacity
        style={[s.item, !isRead && s.itemUnread]}
        onPress={() => {
          if (item.post && (item.type === 'comment' || item.type === 'like' || item.type === 'mention')) {
            const postId = item.post?._id || item.post;
            navigation.navigate('PostDetail', { postId });
          } else if (item.type === 'follow') {
            navigation.navigate('PublicProfile', { username: item.from?.username });
          }
        }}
      >
        {/* Avatar */}
        <TouchableOpacity onPress={() => navigation.navigate('PublicProfile', { username: item.from?.username })}>
          <View style={s.avatar}>
            {item.from?.avatarUrl
              ? <Image source={{ uri: item.from.avatarUrl }} style={s.avatarImg} />
              : <Text style={s.avatarTxt}>{item.from?.username?.[0]?.toUpperCase()}</Text>
            }
          </View>
        </TouchableOpacity>

        {/* Texto */}
        <View style={{ flex: 1 }}>
          <Text style={s.notifTxt}>
            <Text style={s.username}>{item.from?.username} </Text>
            <Text>{notifText(item)}</Text>
          </Text>
          <Text style={s.time}>{timeAgo(item.createdAt)}</Text>
        </View>

        {/* Thumbnail del post si aplica */}
        {item.post?.imageUrl && (
          <Image source={{ uri: item.post.imageUrl }} style={s.thumb} />
        )}

        {/* Punto no leído */}
        {!isRead && <View style={s.dot} />}
      </TouchableOpacity>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.black} />
      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backTxt}>←</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>NOTIFICACIONES</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Tabs */}
        <FlatList
          horizontal
          data={TABS}
          keyExtractor={t => t.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabs}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.tab, tab === item.key && s.tabActive]}
              onPress={() => setTab(item.key)}
            >
              <Text style={[s.tabTxt, tab === item.key && s.tabTxtActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>

      {loading ? (
        <ActivityIndicator color={colors.c1} style={{ marginTop: 40 }} />
      ) : notifs.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTxt}>Sin notificaciones</Text>
        </View>
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={n => n._id}
          renderItem={renderNotif}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore
            ? <ActivityIndicator color={colors.c1} style={{ padding: 16 }} />
            : null}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.black },
  header:      {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 6, color: colors.c1 },
  backBtn:     { padding: 8, width: 40 },
  backTxt:     { color: colors.c1, fontSize: 22 },

  tabs:        { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  tab:         {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: colors.border,
  },
  tabActive:   { backgroundColor: 'rgba(0,229,204,0.1)', borderColor: colors.borderC },
  tabTxt:      { color: colors.textDim, fontSize: 12 },
  tabTxtActive:{ color: colors.c1, fontWeight: '700' },

  item:        {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  itemUnread:  { backgroundColor: 'rgba(0,229,204,0.03)' },
  avatar:      {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,229,204,0.1)', borderWidth: 1, borderColor: colors.borderC,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImg:   { width: 44, height: 44, borderRadius: 22 },
  avatarTxt:   { color: colors.c1, fontWeight: 'bold', fontSize: 16 },
  notifTxt:    { color: colors.textMid, fontSize: 13, lineHeight: 19 },
  username:    { color: colors.textHi, fontWeight: '700' },
  time:        { color: colors.textDim, fontSize: 11, marginTop: 3 },
  thumb:       { width: 44, height: 44, borderRadius: 8 },
  dot:         {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.c1, marginLeft: 4,
  },
  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTxt:    { color: colors.textDim, fontSize: 14 },
});
