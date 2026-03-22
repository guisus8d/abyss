import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, Image,
  StyleSheet, StatusBar, SafeAreaView, ActivityIndicator,
  Animated, Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { connectSocket } from '../services/socket';
import AvatarWithFrame from '../components/AvatarWithFrame';

const { width: W } = Dimensions.get('window');
const TABS = [
  { key: 'privado',      label: 'Privado',      icon: 'chatbubble-outline' },
  { key: 'circulos',     label: 'Círculos',      icon: 'people-outline' },
  { key: 'invitaciones', label: 'Invitaciones',  icon: 'mail-outline' },
  { key: 'game',         label: 'Game',          icon: 'game-controller-outline' },
];
const TAB_W = (W - 32) / TABS.length;

function chatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = (now - d) / (1000 * 60 * 60 * 24);
  if (diff < 1) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 2) return 'Ayer';
  if (diff < 7) return ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][d.getDay()];
  return `${d.getDate()}/${d.getMonth()+1}`;
}

export default function ChatsScreen({ navigation }) {
  const { user } = useAuthStore();
  const [tab, setTab]           = useState('privado');
  const [chats, setChats]       = useState([]);
  const [sent, setSent]         = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [groups, setGroups]     = useState([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage]         = useState(1);
  const [hasMore, setHasMore]   = useState(true);
  const tabAnim                 = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => {
    loadAll();
    let socket = null;
    connectSocket().then(s => {
      socket = s;
      s.off('chat:read_ack');
      s.off('chat:notification');
      s.on('chat:read_ack', ({ chatId }) => {
        setChats(prev => prev.map(c => c._id === chatId ? { ...c, unread: 0 } : c));
      });
      s.on('chat:notification', () => {
        api.get('/chats').then(r => setChats(r.data.chats)).catch(() => {});
      });
    });
    return () => {
      if (socket) { socket.off('chat:read_ack'); socket.off('chat:notification'); }
    };
  }, []));

  async function loadAll() {
    setLoading(true); setPage(1);
    try {
      const [chatsRes, reqsRes, sentRes, groupsRes] = await Promise.all([
        api.get('/chats?page=1&limit=15'),
        api.get('/chats/requests/pending'),
        api.get('/chats/requests/sent'),
        api.get('/groups').catch(() => ({ data: { groups: [] } })),
      ]);
      setChats(chatsRes.data.chats);
      setHasMore(chatsRes.data.page < chatsRes.data.pages);
      setRequests(reqsRes.data.requests);
      setSent(sentRes.data.sent);
      setGroups(groupsRes.data.groups || []);
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
      setPage(next); setHasMore(next < data.pages);
    } catch (e) { console.log(e); }
    finally { setLoadingMore(false); }
  }

  async function handleRequest(fromId, action) {
    try {
      const { data } = await api.patch(`/chats/request/${fromId}`, { action });
      if (action === 'accept' && data.chat) setChats(prev => prev.find(c => c._id === data.chat._id) ? prev : [data.chat, ...prev]);
      setRequests(prev => prev.filter(r => r.from._id !== fromId));
    } catch (err) { console.log(err); }
  }

  function getOther(chat) {
    return chat.participants?.find(p => p._id?.toString() !== user._id?.toString()) || chat.participants?.[0];
  }

  function switchTab(key) {
    const idx = TABS.findIndex(t => t.key === key);
    Animated.spring(tabAnim, {
      toValue: idx * TAB_W,
      useNativeDriver: true,
      tension: 80, friction: 10,
    }).start();
    setTab(key);
  }

  const allItems = [
    ...chats.map(c => ({ type: 'chat', data: c })),
    ...sent.map(s => ({ type: 'pending', data: s })),
    ...groups.map(g => ({ type: 'group', data: g })),
  ].sort((a, b) => {
    const dateA = a.type === 'chat' ? a.data.lastMessage : a.type === 'group' ? a.data.lastMessage : a.data.createdAt;
    const dateB = b.type === 'chat' ? b.data.lastMessage : b.type === 'group' ? b.data.lastMessage : b.data.createdAt;
    return new Date(dateB) - new Date(dateA);
  });

  function renderChatItem({ item }) {
    if (item.type === 'group') {
      const g = item.data;
      const unread = g.unreadCounts?.[user._id] || 0;
      return (
        <TouchableOpacity style={s.groupItem}
          onPress={() => navigation.navigate('GroupRoom', { group: g })}>
          {g.imageUrl
            ? <Image source={{ uri: g.imageUrl }} style={s.groupImg} />
            : <View style={s.groupImgPlaceholder}>
                <Ionicons name="people" size={20} color={colors.c1} />
              </View>}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <Text style={s.chatUser}>{g.name}</Text>
              <View style={s.groupBadge}><Text style={s.groupBadgeTxt}>GRUPO</Text></View>
            </View>
            <Text style={s.chatPreview} numberOfLines={1}>
              {g.lastMessageText || g.description || 'Grupo privado'}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Text style={s.chatDate}>{chatDate(g.lastMessage)}</Text>
            {unread > 0 && (
              <View style={s.unreadBadge}>
                <Text style={s.unreadBadgeTxt}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      );
    }
    if (item.type === 'pending') {
      const sr = item.data;
      const lastMsg = sr.messages?.[sr.messages.length - 1];
      return (
        <TouchableOpacity style={s.chatItem}
          onPress={() => navigation.navigate('ChatRoom', {
            chat: { _id: null, participants: [] },
            other: sr.to, requestMode: true, alreadyRequested: true,
          })}>
          <AvatarWithFrame size={46} avatarUrl={sr.to?.avatarUrl}
            username={sr.to?.username} profileFrame={sr.to?.profileFrame}
              frameUrl={sr.to?.profileFrameUrl}
            style={{ marginRight: 12 }} />
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
      <TouchableOpacity style={s.chatItem}
        onPress={() => navigation.navigate('ChatRoom', { chat, other })}>
        <AvatarWithFrame size={46} avatarUrl={other?.avatarUrl}
          username={other?.username} profileFrame={other?.profileFrame}
              frameUrl={other?.profileFrameUrl}
          style={{ marginRight: 12 }} />
        <View style={{ flex: 1 }}>
          <Text style={s.chatUser}>{other?.username}</Text>
          <Text style={[s.chatPreview, unread > 0 && s.chatPreviewUnread]} numberOfLines={1}>
            {chat.lastMessageText || 'Toca para chatear'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={s.chatDate}>{chatDate(chat.lastMessage)}</Text>
          {unread > 0 && (
            <View style={s.unreadBadge}>
              <Text style={s.unreadBadgeTxt}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  function renderInvitaciones() {
    if (requests.length === 0) return (
      <View style={s.emptyTab}>
        <Ionicons name="mail-outline" size={44} color={colors.textDim} />
        <Text style={s.emptyTitle}>Sin invitaciones</Text>
        <Text style={s.emptySubtitle}>Cuando alguien te envíe una solicitud de chat aparecerá aquí</Text>
      </View>
    );
    return (
      <FlatList
        data={requests}
        keyExtractor={r => r._id}
        contentContainerStyle={s.listContent}
        renderItem={({ item: r }) => (
          <View style={s.reqItem}>
            <TouchableOpacity onPress={() => navigation.navigate('PublicProfile', { username: r.from?.username })}>
              <AvatarWithFrame size={46} avatarUrl={r.from?.avatarUrl}
                username={r.from?.username} profileFrame={r.from?.profileFrame}
              frameUrl={r.from?.profileFrameUrl}
              frameUrl={r.from?.profileFrameUrl}
                style={{ marginRight: 12 }} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={s.chatUser}>{r.from?.username}</Text>
              <Text style={s.chatPreview} numberOfLines={1}>
                {r.messages?.[0]?.text || 'Quiere chatear contigo'}
              </Text>
            </View>
            <View style={s.reqActions}>
              <TouchableOpacity style={s.reqAccept} onPress={() => handleRequest(r.from._id, 'accept')}>
                <Ionicons name="checkmark" size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={s.reqReject} onPress={() => handleRequest(r.from._id, 'reject')}>
                <Ionicons name="close" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    );
  }

  function renderComingSoon(icon, label) {
    return (
      <View style={s.emptyTab}>
        <View style={s.comingSoonIcon}>
          <Ionicons name={icon} size={40} color={colors.c1} />
        </View>
        <Text style={s.emptyTitle}>{label}</Text>
        <View style={s.comingSoonBadge}>
          <Text style={s.comingSoonTxt}>PRÓXIMAMENTE</Text>
        </View>
        <Text style={s.emptySubtitle}>Esta función estará disponible pronto</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.black} />
      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.textHi} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>MENSAJES</Text>
          <TouchableOpacity
            style={s.addBtn}
            onPress={() => navigation.navigate('CreateGroup')}
          >
            <Ionicons name="add" size={22} color={colors.c1} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Tabs */}
      <View style={s.tabBar}>
        <Animated.View style={[s.tabIndicator, { width: TAB_W, transform: [{ translateX: tabAnim }] }]} />
        {TABS.map(t => {
          const active = tab === t.key;
          const badge = t.key === 'invitaciones' && requests.length > 0 ? requests.length : 0;
          return (
            <TouchableOpacity key={t.key} style={[s.tabBtn, { width: TAB_W }]} onPress={() => switchTab(t.key)}>
              <View style={{ position: 'relative' }}>
                <Ionicons name={t.icon} size={16} color={active ? colors.c1 : colors.textDim} />
                {badge > 0 && (
                  <View style={s.tabBadge}>
                    <Text style={s.tabBadgeTxt}>{badge}</Text>
                  </View>
                )}
              </View>
              <Text style={[s.tabLabel, active && s.tabLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Contenido */}
      {tab === 'privado' && (
        loading ? (
          <ActivityIndicator color={colors.c1} style={{ marginTop: 40 }} />
        ) : allItems.length === 0 ? (
          <View style={s.emptyTab}>
            <Ionicons name="chatbubble-outline" size={44} color={colors.textDim} />
            <Text style={s.emptyTitle}>Sin chats todavía</Text>
            <Text style={s.emptySubtitle}>Visita el perfil de alguien y envíale un mensaje</Text>
          </View>
        ) : (
          <FlatList
            data={allItems}
            keyExtractor={(item, i) => item.data._id || i.toString()}
            renderItem={renderChatItem}
            contentContainerStyle={s.listContent}
            onEndReached={loadMore}
            onEndReachedThreshold={0.3}
            ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.c1} style={{ marginVertical: 12 }} /> : null}
          />
        )
      )}

      {tab === 'invitaciones' && renderInvitaciones()}
      {tab === 'circulos' && renderComingSoon('people-outline', 'Círculos')}
      {tab === 'game' && renderComingSoon('game-controller-outline', 'Game Sessions')}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    justifyContent: 'space-between',
  },
  backBtn:     { padding: 4 },
  headerTitle: { color: colors.textHi, fontSize: 13, fontWeight: '800', letterSpacing: 2.5 },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, padding: 4,
    position: 'relative', overflow: 'hidden',
  },
  tabIndicator: {
    position: 'absolute', top: 4, bottom: 4, left: 4,
    backgroundColor: 'rgba(0,229,204,0.12)',
    borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(0,229,204,0.2)',
  },
  tabBtn: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, gap: 3,
  },
  tabLabel:       { color: colors.textDim, fontSize: 9, fontWeight: '600', letterSpacing: 0.5 },
  tabLabelActive: { color: colors.c1 },
  tabBadge: {
    position: 'absolute', top: -4, right: -6,
    backgroundColor: 'rgba(239,68,68,0.9)',
    borderRadius: 6, minWidth: 12, height: 12,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 2,
  },
  tabBadgeTxt: { color: '#fff', fontSize: 7, fontWeight: '800' },

  // Lista
  listContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 20 },
  chatItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  chatUser:    { color: colors.textHi, fontWeight: '600', fontSize: 14, marginBottom: 3 },
  chatDate:    { color: colors.textDim, fontSize: 10 },
  chatPreview: { color: colors.textDim, fontSize: 12 },
  chatPreviewUnread: { color: colors.textMid, fontWeight: '600' },
  unreadBadge: {
    backgroundColor: colors.c1, borderRadius: 10,
    minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  unreadBadgeTxt: { color: colors.black, fontSize: 10, fontWeight: '800' },
  pendingBadge: {
    backgroundColor: 'rgba(251,191,36,0.12)', borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)',
    paddingHorizontal: 8, paddingVertical: 3,
  },
  pendingBadgeTxt: { color: 'rgba(251,191,36,1)', fontSize: 9, fontWeight: '800', letterSpacing: 1 },

  // Invitaciones
  reqItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  reqActions: { flexDirection: 'row', gap: 8 },
  reqAccept: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,229,204,0.15)',
    borderWidth: 1, borderColor: 'rgba(0,229,204,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  reqReject: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Empty / Coming soon
  emptyTab: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, gap: 12,
  },
  emptyTitle:    { color: colors.textHi, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptySubtitle: { color: colors.textDim, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  comingSoonIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(0,229,204,0.08)',
    borderWidth: 1, borderColor: 'rgba(0,229,204,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  comingSoonBadge: {
    backgroundColor: 'rgba(0,229,204,0.08)',
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,229,204,0.2)',
    paddingHorizontal: 12, paddingVertical: 4,
  },
  comingSoonTxt: { color: colors.c1, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  addBtn:      { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(0,229,204,0.1)', borderWidth: 1, borderColor: colors.borderC, alignItems: 'center', justifyContent: 'center' },
  groupItem:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)', gap: 12, backgroundColor: 'rgba(255,255,255,0.03)', paddingHorizontal: 8, borderRadius: 12, marginBottom: 2 },
  groupBadge:  { backgroundColor: 'rgba(0,229,204,0.1)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(0,229,204,0.2)' },
  groupBadgeTxt: { color: colors.c1, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  groupImg:    { width: 48, height: 48, borderRadius: 12 },
  groupImgPlaceholder: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderC, alignItems: 'center', justifyContent: 'center' },
});
