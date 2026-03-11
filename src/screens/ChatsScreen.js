import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, Image,
  StyleSheet, StatusBar, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { connectSocket } from '../services/socket';

export default function ChatsScreen({ navigation }) {
  const { user } = useAuthStore();
  const [chats, setChats]       = useState([]);
  const [sent, setSent]         = useState([]);
  const [requests, setRequests] = useState([]);
  const [showReqs, setShowReqs] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage]           = useState(1);
  const [hasMore, setHasMore]     = useState(true);

  useFocusEffect(useCallback(() => {
    loadAll();

    let socket = null;
    connectSocket().then(s => {
      socket = s;
      s.off('chat:read_ack');
      s.off('chat:notification');

      s.on('chat:read_ack', ({ chatId }) => {
        setChats(prev => prev.map(c =>
          c._id === chatId ? { ...c, unread: 0 } : c
        ));
      });

      s.on('chat:notification', () => {
        api.get('/chats').then(r => setChats(r.data.chats)).catch(() => {});
      });
    });

    return () => {
      if (socket) {
        socket.off('chat:read_ack');
        socket.off('chat:notification');
      }
    };
  }, []));

  async function loadAll() {
    setLoading(true);
    setPage(1);
    try {
      const [chatsRes, reqsRes, sentRes] = await Promise.all([
        api.get('/chats?page=1&limit=15'),
        api.get('/chats/requests/pending'),
        api.get('/chats/requests/sent'),
      ]);
      setChats(chatsRes.data.chats);
      setHasMore(chatsRes.data.page < chatsRes.data.pages);
      setRequests(reqsRes.data.requests);
      setSent(sentRes.data.sent);
    } catch (e) { console.log(e); }
    finally { setLoading(false); }
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const { data } = await api.get(`/chats?page=${next}&limit=15`);
      setChats(prev => [...prev, ...data.chats]);
      setPage(next);
      setHasMore(next < data.pages);
    } catch (e) { console.log(e); }
    finally { setLoadingMore(false); }
  }

  async function handleRequest(fromId, action) {
    try {
      const { data } = await api.patch(`/chats/request/${fromId}`, { action });
      if (action === 'accept' && data.chat) {
        setChats(prev => [data.chat, ...prev]);
      }
      setRequests(prev => prev.filter(r => r.from._id !== fromId));
    } catch (err) { console.log(err); }
  }

  function getOther(chat) {
    return chat.participants?.find(p => p._id !== user._id) || chat.participants?.[0];
  }

  const allItems = [
    ...chats.map(c => ({ type: 'chat', data: c })),
    ...sent.map(s => ({ type: 'pending', data: s })),
  ].sort((a, b) => {
    const dateA = a.type === 'chat' ? a.data.lastMessage : a.data.createdAt;
    const dateB = b.type === 'chat' ? b.data.lastMessage : b.data.createdAt;
    return new Date(dateB) - new Date(dateA);
  });

  function renderItem({ item }) {
    if (item.type === 'pending') {
      const sr = item.data;
      const lastMsg = sr.messages?.[sr.messages.length - 1];
      return (
        <TouchableOpacity
          style={s.chatItem}
          onPress={() => navigation.navigate('ChatRoom', {
            chat: { _id: null, participants: [] },
            other: sr.to,
            requestMode: true,
            alreadyRequested: true,
          })}
        >
          <View style={s.avatarWrap}>
            {sr.to?.avatarUrl
              ? <Image source={{ uri: sr.to.avatarUrl }} style={s.avatarImg} />
              : <Text style={s.avatarTxt}>{sr.to?.username?.[0]?.toUpperCase()}</Text>
            }
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.chatUser}>{sr.to?.username}</Text>
            <Text style={s.chatPreview} numberOfLines={1}>
              {lastMsg ? lastMsg.text : 'Solicitud enviada...'}
            </Text>
          </View>
          <View style={s.pendingBadge}>
            <Text style={s.pendingBadgeTxt}>PENDIENTE</Text>
          </View>
        </TouchableOpacity>
      );
    }

    const chat = item.data;
    const other = getOther(chat);
    const unread = chat.unread || 0;

    return (
      <TouchableOpacity
        style={s.chatItem}
        onPress={() => navigation.navigate('ChatRoom', { chat, other })}
      >
        <View style={s.avatarWrap}>
          {other?.avatarUrl
            ? <Image source={{ uri: other.avatarUrl }} style={s.avatarImg} />
            : <Text style={s.avatarTxt}>{other?.username?.[0]?.toUpperCase()}</Text>
          }
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.chatUser}>{other?.username}</Text>
          <Text style={[s.chatPreview, unread > 0 && s.chatPreviewUnread]} numberOfLines={1}>
            {chat.lastMessageText || 'Toca para chatear'}
          </Text>
        </View>
        {unread > 0 && (
          <View style={s.unreadBadge}>
            <Text style={s.unreadBadgeTxt}>{unread > 99 ? '99+' : unread}</Text>
          </View>
        )}
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
          <Text style={s.headerTitle}>CHATS</Text>
          <TouchableOpacity style={s.reqBtn} onPress={() => setShowReqs(!showReqs)}>
            <Text style={s.reqIcon}>📨</Text>
            {requests.length > 0 && (
              <View style={s.reqBadge}>
                <Text style={s.reqBadgeTxt}>{requests.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {showReqs && (
        <View style={s.reqPanel}>
          <Text style={s.reqPanelTitle}>SOLICITUDES RECIBIDAS</Text>
          {requests.length === 0 ? (
            <Text style={s.reqEmpty}>Sin solicitudes pendientes</Text>
          ) : (
            requests.map(r => (
              <View key={r._id} style={s.reqItem}>
                <View style={s.reqAvatar}>
                  {r.from?.avatarUrl
                    ? <Image source={{ uri: r.from.avatarUrl }} style={s.reqAvatarImg} />
                    : <Text style={s.reqAvatarTxt}>{r.from?.username?.[0]?.toUpperCase()}</Text>
                  }
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.reqUser}>{r.from?.username}</Text>
                  <Text style={s.reqXp}>XP {r.from?.xp}</Text>
                </View>
                <TouchableOpacity style={s.btnReject} onPress={() => handleRequest(r.from._id, 'reject')}>
                  <Text style={s.btnRejectTxt}>✕</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btnAccept} onPress={() => handleRequest(r.from._id, 'accept')}>
                  <Text style={s.btnAcceptTxt}>Aceptar</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={colors.c1} style={{ marginTop: 40 }} />
      ) : allItems.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTxt}>Sin conversaciones aún</Text>
          <Text style={s.emptyHint}>Ve al perfil de alguien para iniciar un chat</Text>
        </View>
      ) : (
        <FlatList
          data={allItems}
          keyExtractor={(item, i) => String(item.data._id || i) + item.type}
          renderItem={renderItem}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.c1} style={{padding:16}} /> : null}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.black },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '900', letterSpacing: 8, color: colors.c1 },
  backBtn: { padding: 8, width: 40 },
  backTxt: { color: colors.c1, fontSize: 22 },
  reqBtn:  { width: 40, alignItems: 'flex-end', position: 'relative' },
  reqIcon: { fontSize: 22 },
  reqBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: colors.c1, borderRadius: 8,
    minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
  },
  reqBadgeTxt: { color: colors.black, fontSize: 9, fontWeight: 'bold', paddingHorizontal: 3 },
  reqPanel: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.borderC, padding: 16,
  },
  reqPanelTitle: { fontSize: 9, letterSpacing: 3, color: colors.textDim, marginBottom: 12 },
  reqEmpty:      { color: colors.textDim, fontSize: 13, textAlign: 'center', paddingVertical: 8 },
  reqItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  reqAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,229,204,0.1)', borderWidth: 1, borderColor: colors.borderC,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  reqAvatarImg: { width: 40, height: 40, borderRadius: 20 },
  reqAvatarTxt: { color: colors.c1, fontWeight: 'bold' },
  reqUser:  { color: colors.textHi, fontWeight: '600', fontSize: 13 },
  reqXp:    { color: colors.textDim, fontSize: 10 },
  btnAccept: {
    backgroundColor: 'rgba(0,229,204,0.15)', borderWidth: 1, borderColor: colors.borderC,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6,
  },
  btnAcceptTxt: { color: colors.c1, fontSize: 12, fontWeight: '600' },
  btnReject: {
    backgroundColor: 'rgba(255,60,60,0.1)', borderWidth: 1, borderColor: 'rgba(255,60,60,0.3)',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginRight: 4,
  },
  btnRejectTxt: { color: '#ff5555', fontSize: 12, fontWeight: '700' },
  chatItem: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  avatarWrap: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(0,229,204,0.1)', borderWidth: 1, borderColor: colors.borderC,
    alignItems: 'center', justifyContent: 'center', marginRight: 12, overflow: 'hidden',
  },
  avatarImg:          { width: 46, height: 46, borderRadius: 23 },
  avatarTxt:          { color: colors.c1, fontWeight: 'bold', fontSize: 16 },
  chatUser:           { color: colors.textHi, fontWeight: '600', fontSize: 14, marginBottom: 3 },
  chatPreview:        { color: colors.textDim, fontSize: 12 },
  chatPreviewUnread:  { color: colors.textMid, fontWeight: '700' },
  unreadBadge: {
    backgroundColor: colors.c1, borderRadius: 12,
    minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 5, marginLeft: 8,
  },
  unreadBadgeTxt: { color: colors.black, fontSize: 11, fontWeight: '900' },
  pendingBadge: {
    backgroundColor: 'rgba(255,180,0,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,180,0,0.4)',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 8,
  },
  pendingBadgeTxt: { color: '#ffb400', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  empty:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTxt: { color: colors.textMid, fontSize: 15, marginBottom: 8 },
  emptyHint:{ color: colors.textDim, fontSize: 12 },
});
