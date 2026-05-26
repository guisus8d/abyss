import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, Image,
  StyleSheet, StatusBar, ActivityIndicator,
  Platform, ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { connectSocket } from '../services/socket';
import AvatarWithFrame from '../components/AvatarWithFrame';
import CustomTabBar from '../components/CustomTabBar';

function chatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = (now - d) / (1000 * 60 * 60 * 24);
  if (diff < 1) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 2) return 'Ayer';
  if (diff < 7) return ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][d.getDay()];
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

const TABS = [
  { key: 'privado',  label: 'Privado'  },
  { key: 'circulos', label: 'Círculos' },
  { key: 'game',     label: 'Game'     },
];

const AVATAR_SIZE = 48;

export default function ChatsScreen({ navigation }) {
  const { user }     = useAuthStore();
  const insets       = useSafeAreaInsets();

  const [tab,         setTab]         = useState('privado');
  const [chats,       setChats]       = useState([]);
  const [groups,      setGroups]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page,        setPage]        = useState(1);
  const [hasMore,     setHasMore]     = useState(true);
  const [error,       setError]       = useState(null);

  useFocusEffect(useCallback(() => {
    loadAll();
    let socket = null;

    connectSocket().then(s => {
      socket = s;
      s.off('chat:read_ack');
      s.off('chat:notification');
      s.off('group:notification');

      s.on('chat:read_ack', ({ chatId }) =>
        setChats(prev => prev.map(c => c._id === chatId ? { ...c, unread: 0 } : c))
      );
      s.on('chat:notification', () =>
        api.get('/chats').then(r => setChats(r.data.chats)).catch(() => {})
      );
      s.on('group:notification', () =>
        api.get('/groups').then(r => setGroups(r.data.groups || [])).catch(() => {})
      );
    });

    return () => {
      if (socket) {
        socket.off('chat:read_ack');
        socket.off('chat:notification');
        socket.off('group:notification');
      }
    };
  }, []));

  async function loadAll() {
    setLoading(true);
    setPage(1);
    setError(null);
    try {
      const [chatsRes, groupsRes] = await Promise.all([
        api.get('/chats?page=1&limit=15'),
        api.get('/groups').catch(() => ({ data: { groups: [] } })),
      ]);
      setChats(chatsRes.data.chats);
      setHasMore(chatsRes.data.page < chatsRes.data.pages);
      setGroups(groupsRes.data.groups || []);
    } catch (e) {
      console.log(e);
      setError('No se pudo cargar. Toca para reintentar.');
    } finally {
      setLoading(false);
    }
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

  function getOther(chat) {
    return (
      chat.participants?.find(p => p._id?.toString() !== user._id?.toString()) ||
      chat.participants?.[0]
    );
  }

  function switchTab(key) {
    setTab(key);
  }

  const privateItems = [...chats]
    .sort((a, b) => new Date(b.lastMessage) - new Date(a.lastMessage))
    .map(c => ({ type: 'chat', data: c }));

  const groupItems = [...groups].sort((a, b) =>
    new Date(b.lastMessage || b.createdAt) - new Date(a.lastMessage || a.createdAt)
  );

  function renderChatItem({ item }) {
    const chat  = item.data;
    const other = getOther(chat);
    const unread = Number(chat.unread) || 0;

    return (
      <TouchableOpacity
        style={s.chatItem}
        onPress={() => navigation.navigate('ChatRoom', { chat, other })}
      >
        <View style={s.avatarSlot}>
          <AvatarWithFrame size={AVATAR_SIZE} avatarUrl={other?.avatarUrl} username={other?.username} profileFrame={other?.profileFrame} frameUrl={other?.profileFrameUrl} banned={!!other?.banned} />
        </View>
        <View style={{ flex:1, minWidth:0 }}>
          <Text style={s.chatUser} numberOfLines={1}>{other?.username}</Text>
          <Text style={unread > 0 ? [s.chatPreview, s.chatPreviewUnread] : s.chatPreview} numberOfLines={1}>
            {chat.lastMessageText || 'Toca para chatear'}
          </Text>
        </View>
        <View style={{ alignItems:'flex-end', gap:4, flexShrink:0 }}>
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

  function renderGroupItem({ item: g }) {
    const unread = Number(g.unreadCounts?.[user._id]) || 0;
    return (
      <TouchableOpacity style={s.groupItem} onPress={() => navigation.navigate('GroupRoom', { group: g })}>
        {g.imageUrl
          ? <Image source={{ uri: g.imageUrl }} style={s.groupImg} />
          : <View style={s.groupImgPlaceholder}><Ionicons name="people" size={20} color={colors.c1} /></View>}
        <View style={{ flex:1, minWidth:0 }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:6, marginBottom:2 }}>
            <Text style={s.chatUser} numberOfLines={1}>{g.name}</Text>
            <View style={s.groupBadge}><Text style={s.groupBadgeTxt}>GRUPO</Text></View>
          </View>
          <Text style={s.chatPreview} numberOfLines={1}>{g.lastMessageText || g.description || 'Grupo privado'}</Text>
        </View>
        <View style={{ alignItems:'flex-end', gap:4, flexShrink:0 }}>
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

  function renderEmpty(icon, title, subtitle) {
    return (
      <View style={s.emptyTab}>
        <View style={s.emptyIconWrap}><Ionicons name={icon} size={32} color={colors.c1} /></View>
        <Text style={s.emptyTitle}>{title}</Text>
        <Text style={s.emptySubtitle}>{subtitle}</Text>
      </View>
    );
  }

  function renderComingSoon(icon, label) {
    return (
      <View style={s.emptyTab}>
        <View style={s.comingSoonIcon}><Ionicons name={icon} size={36} color={colors.c1} /></View>
        <Text style={s.emptyTitle}>{label}</Text>
        <View style={s.comingSoonBadge}><Text style={s.comingSoonTxt}>PRÓXIMAMENTE</Text></View>
        <Text style={s.emptySubtitle}>Esta función estará disponible pronto</Text>
      </View>
    );
  }

  function renderPrivado() {
    if (loading) return <ActivityIndicator color={colors.c1} style={{ marginTop:40 }} />;
    if (error) {
      return (
        <TouchableOpacity style={s.emptyTab} onPress={loadAll}>
          <View style={s.emptyIconWrap}><Ionicons name="cloud-offline" size={32} color={colors.textDim} /></View>
          <Text style={s.emptyTitle}>Sin conexión</Text>
          <Text style={s.emptySubtitle}>{error}</Text>
        </TouchableOpacity>
      );
    }
    if (privateItems.length === 0) return renderEmpty('chatbubble', 'Sin chats todavía', 'Visita el perfil de alguien y envíale un mensaje');
    return (
      <FlatList
        style={{ backgroundColor: colors.black }}
        data={privateItems}
        keyExtractor={(item, i) => item.data._id || String(i)}
        renderItem={renderChatItem}
        contentContainerStyle={[s.listContent, { paddingBottom: 90 + insets.bottom }]}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.c1} style={{ marginVertical:12 }} /> : null}
      />
    );
  }

  function renderCirculos() {
    if (loading) return <ActivityIndicator color={colors.c1} style={{ marginTop:40 }} />;
    if (groupItems.length === 0) return renderEmpty('people', 'Sin círculos', 'Crea un grupo o únete a uno para empezar');
    return <FlatList style={{ backgroundColor: colors.black }} data={groupItems} keyExtractor={g => g._id} renderItem={renderGroupItem} contentContainerStyle={[s.listContent, { paddingBottom: 90 + insets.bottom }]} />;
  }

  return (
    <View style={s.root}>
      {Platform.OS !== 'web' && <StatusBar barStyle="light-content" backgroundColor={colors.black} />}
      <SafeAreaView edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#ffffff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>MENSAJES</Text>
          <TouchableOpacity style={s.addBtn} onPress={() => navigation.navigate('CreateGroup')}>
            <Ionicons name="add" size={22} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View style={s.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} style={s.tabBtn} onPress={() => switchTab(t.key)} activeOpacity={1}>
            <Text style={tab === t.key ? [s.tabLabel, s.tabLabelActive] : s.tabLabel}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ flex:1 }}>
        {tab === 'privado'  ? renderPrivado()                                     : null}
        {tab === 'circulos' ? renderCirculos()                                    : null}
        {tab === 'game'     ? renderComingSoon('game-controller','Game Sessions') : null}
      </View>

      <CustomTabBar
        navigation={navigation}
        activeTab="chats"
        onCreatePress={() => navigation.navigate('CreateGroup')}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex:1, backgroundColor:colors.black },
  header: { flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:14, justifyContent:'space-between' },
  backBtn: { width:36, height:36, borderRadius:10, backgroundColor:'rgba(255,255,255,0.08)', borderWidth:1, alignItems:'center', justifyContent:'center' },
  headerTitle: { color:colors.textHi, fontSize:13, fontWeight:'800', letterSpacing:2.5 },
  addBtn: { width:36, height:36, borderRadius:10, backgroundColor:'rgba(255,255,255,0.08)', borderWidth:1, alignItems:'center', justifyContent:'center' },
  tabBar: { flexDirection:'row', justifyContent:'space-around', marginBottom:8, paddingVertical:10, paddingHorizontal:16 },
  tabBtn: { alignItems:'center', justifyContent:'center', paddingHorizontal:6 },
  tabLabel: { color:colors.textDim, fontSize:13, fontWeight:'500' },
  tabLabelActive: { color:colors.textHi, fontWeight:'700' },
  tabBadge: { position:'absolute', top:-5, right:-10, backgroundColor:'rgba(239,68,68,0.95)', borderRadius:6, minWidth:13, height:13, alignItems:'center', justifyContent:'center', paddingHorizontal:2 },
  tabBadgeTxt: { color:'#fff', fontSize:7, fontWeight:'800' },
  listContent: { paddingHorizontal:16, paddingTop:4, paddingBottom:90 },
  avatarSlot: { width:AVATAR_SIZE+8, height:AVATAR_SIZE+8, alignItems:'center', justifyContent:'center', marginRight:10, flexShrink:0 },
  chatItem: { flexDirection:'row', alignItems:'center', paddingVertical:10, borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.04)' },
  chatUser: { color:colors.textHi, fontWeight:'600', fontSize:14, marginBottom:3 },
  chatDate: { color:colors.textDim, fontSize:10 },
  chatPreview: { color:colors.textDim, fontSize:12 },
  chatPreviewUnread: { color:colors.textMid, fontWeight:'600' },
  unreadBadge: { backgroundColor:colors.c1, borderRadius:10, minWidth:20, height:20, alignItems:'center', justifyContent:'center', paddingHorizontal:5 },
  unreadBadgeTxt: { color:colors.black, fontSize:10, fontWeight:'800' },
  groupItem: { flexDirection:'row', alignItems:'center', paddingVertical:10, gap:12, backgroundColor:'rgba(255,255,255,0.03)', paddingHorizontal:8, borderRadius:12, marginBottom:4, borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.04)' },
  groupImg: { width:48, height:48, borderRadius:12, flexShrink:0 },
  groupImgPlaceholder: { width:48, height:48, borderRadius:12, flexShrink:0, backgroundColor:colors.surface, borderWidth:1, borderColor:colors.borderC, alignItems:'center', justifyContent:'center' },
  groupBadge: { backgroundColor:'rgba(0,229,204,0.1)', borderRadius:6, paddingHorizontal:6, paddingVertical:2, borderWidth:1, borderColor:'rgba(0,229,204,0.2)', flexShrink:0 },
  groupBadgeTxt: { color:colors.c1, fontSize:8, fontWeight:'800', letterSpacing:1 },
  emptyTab: { flex:1, alignItems:'center', justifyContent:'center', paddingHorizontal:40, gap:12 },
  emptyIconWrap: { width:68, height:68, borderRadius:34, backgroundColor:'rgba(0,229,204,0.06)', borderWidth:1, borderColor:'rgba(0,229,204,0.15)', alignItems:'center', justifyContent:'center' },
  emptyTitle: { color:colors.textHi, fontSize:16, fontWeight:'700', textAlign:'center' },
  emptySubtitle: { color:colors.textDim, fontSize:13, textAlign:'center', lineHeight:18 },
  comingSoonIcon: { width:72, height:72, borderRadius:36, backgroundColor:'rgba(0,229,204,0.08)', borderWidth:1, borderColor:'rgba(0,229,204,0.2)', alignItems:'center', justifyContent:'center' },
  comingSoonBadge: { backgroundColor:'rgba(0,229,204,0.08)', borderRadius:8, borderWidth:1, borderColor:'rgba(0,229,204,0.2)', paddingHorizontal:12, paddingVertical:4 },
  comingSoonTxt: { color:colors.c1, fontSize:10, fontWeight:'800', letterSpacing:2 },
});
