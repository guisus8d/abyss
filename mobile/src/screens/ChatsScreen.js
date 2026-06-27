import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, Image,
  StyleSheet, StatusBar, ActivityIndicator,
  Platform, ScrollView, Modal, Pressable, Alert,
} from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { connectSocket } from '../services/socket';
import AvatarWithFrame from '../components/AvatarWithFrame';
import CustomTabBar from '../components/CustomTabBar';
import GenderIcon from '../components/GenderIcon';
import VerifiedIcon from '../components/VerifiedIcon';
import ProfileDrawer from '../components/ProfileDrawer';

// ── AsyncStorage keys ──────────────────────────────────────────────────────
const SK_PINNED = 'pinnedChats';
const SK_MUTED  = 'mutedChats';
const SK_UNREAD = 'unreadOverride';
const HASHTAG_COLORS = ['#2979ff', '#f472b6', '#facc15', '#22d3ee', '#4ade80', '#f97316'];
const SK_HIDDEN = 'hiddenChats';

// ── Helpers ────────────────────────────────────────────────────────────────
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

async function loadSet(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return new Set(JSON.parse(raw || '[]'));
  } catch { return new Set(); }
}

async function saveSet(key, set) {
  try { await AsyncStorage.setItem(key, JSON.stringify([...set])); } catch {}
}

// ── Constants ──────────────────────────────────────────────────────────────
const TABS = [
  { key: 'privado',      label: 'Privado'      },
  { key: 'circulos',    label: 'Fiestas'    },
  { key: 'game',        label: 'Game'        },
  { key: 'invitaciones', label: 'Invitaciones' },
];
const AVATAR_SIZE = 48;

// ──────────────────────────────────────────────────────────────────────────
export default function ChatsScreen({ navigation }) {
  const { user, logout } = useAuthStore();
  const insets   = useSafeAreaInsets();

  const [tab,         setTab]         = useState('privado');
  const [chats,       setChats]       = useState([]);
  const [groups,      setGroups]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page,        setPage]        = useState(1);
  const [hasMore,     setHasMore]     = useState(true);
  const [error,       setError]       = useState(null);

  const [pinnedIds,      setPinnedIds]      = useState(new Set());
  const [mutedIds,       setMutedIds]       = useState(new Set());
  const [unreadOverride, setUnreadOverride] = useState(new Set());
  const [hiddenIds,      setHiddenIds]      = useState(new Set());
  const [actionSheet,    setActionSheet]    = useState(null); // { type:'chat'|'group', item }
  const [recentFollowing, setRecentFollowing] = useState([]);
  const [fiestas,         setFiestas]         = useState([]);
  const [drawerOpen,     setDrawerOpen]     = useState(false);

  // ── Load & sockets ────────────────────────────────────────────────────────
  useFocusEffect(useCallback(() => {
    loadAll();
    loadStorageState();
    let socket = null;

    connectSocket().then(s => {
      socket = s;
      s.off('chat:notification');
      s.off('group:notification');
      s.off('circle:activated');

      s.on('chat:notification', ({ chatId, lastMessageText, lastMessage }) => {
        setChats(prev => {
          const next = prev.map(c =>
            c._id?.toString() === chatId?.toString()
              ? { ...c, lastMessageText, lastMessage, unread: (c.unread || 0) + 1 }
              : c
          );
          return next.sort((a, b) => new Date(b.lastMessage) - new Date(a.lastMessage));
        });
      });
      s.on('group:notification', ({ groupId, lastMessageText, lastMessage, lastMessageSender }) => {
        setGroups(prev => {
          const myIdStr = user._id?.toString();
          const next = prev.map(g => {
            if (g._id?.toString() !== groupId?.toString()) return g;
            const prevCount = g.unreadCounts?.[myIdStr] || 0;
            return {
              ...g, lastMessageText, lastMessage, lastMessageSender,
              unreadCounts: { ...(g.unreadCounts || {}), [myIdStr]: prevCount + 1 },
            };
          });
          return next.sort((a, b) => new Date(b.lastMessage) - new Date(a.lastMessage));
        });
      });

      s.on('circle:activated', ({ groupId }) => {
        setFiestas(prev => prev.map(f =>
          f._id?.toString() === groupId?.toString() ? { ...f, isActive: true } : f
        ));
      });
    });

    return () => {
      if (socket) {
        socket.off('chat:notification');
        socket.off('group:notification');
        socket.off('circle:activated');
      }
    };
  }, []));

  async function loadStorageState() {
    const [pinned, muted, unread, hidden] = await Promise.all([
      loadSet(SK_PINNED),
      loadSet(SK_MUTED),
      loadSet(SK_UNREAD),
      loadSet(SK_HIDDEN),
    ]);
    setPinnedIds(pinned);
    setMutedIds(muted);
    setUnreadOverride(unread);
    setHiddenIds(hidden);
  }

  async function loadAll() {
    setLoading(true);
    setPage(1);
    setError(null);
    try {
      const [chatsRes, groupsRes, followingRes, fiestasRes] = await Promise.all([
        api.get('/chats?page=1&limit=15'),
        api.get('/groups').catch(() => ({ data: { groups: [] } })),
        api.get(`/social/following/${user?.username}`).catch(() => ({ data: { following: [] } })),
        api.get('/groups/circles/mine').catch(() => ({ data: { circles: [] } })),
      ]);
      setChats(chatsRes.data.chats);
      setHasMore(chatsRes.data.page < chatsRes.data.pages);
      setGroups(groupsRes.data.groups || []);
      const all = followingRes.data.following || [];
      setRecentFollowing(all.slice(-3).reverse());
      setFiestas(fiestasRes.data.circles || []);
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

  // ── Acciones persistidas ──────────────────────────────────────────────────
  async function togglePin(id) {
    const next = new Set(pinnedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setPinnedIds(next);
    await saveSet(SK_PINNED, next);
    setActionSheet(null);
  }

  async function toggleMute(id) {
    const next = new Set(mutedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setMutedIds(next);
    await saveSet(SK_MUTED, next);
    setActionSheet(null);
  }

  async function markUnread(id) {
    const next = new Set(unreadOverride);
    next.add(id);
    setUnreadOverride(next);
    await saveSet(SK_UNREAD, next);
    setActionSheet(null);
  }

  async function clearUnread(id) {
    if (!unreadOverride.has(id)) return;
    const next = new Set(unreadOverride);
    next.delete(id);
    setUnreadOverride(next);
    await saveSet(SK_UNREAD, next);
  }

  function confirmDeleteChat(id) {
    Alert.alert(
      'Eliminar conversación',
      'Se eliminará de tu lista. El otro usuario no será notificado.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => hideChat(id) },
      ]
    );
  }

  async function hideChat(id) {
    const next = new Set(hiddenIds);
    next.add(id);
    setHiddenIds(next);
    await saveSet(SK_HIDDEN, next);
  }

  function confirmLeaveGroup(group) {
    setActionSheet(null);
    Alert.alert(
      'Salir del grupo',
      `Quieres salir de "${group.name}"? Ya no podras ver los mensajes de este grupo.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', style: 'destructive', onPress: () => leaveGroup(group) },
      ]
    );
  }

  async function leaveGroup(group) {
    try {
      await api.post(`/groups/${group._id}/leave`);
      setGroups(prev => prev.filter(g => g._id?.toString() !== group._id?.toString()));
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'No se pudo salir del grupo');
    }
  }

  // ── Unread / badge logic ──────────────────────────────────────────────────
  function getUnreadCount(item, type) {
    const real = type === 'chat'
      ? (Number(item.unread) || 0)
      : (Number(item.unreadCounts?.[user._id?.toString()]) || 0);
    if (unreadOverride.has(item._id?.toString())) return Math.max(1, real);
    return real;
  }

  function showUnreadBadge(item, type) {
    if (mutedIds.has(item._id?.toString())) return false;
    return getUnreadCount(item, type) > 0;
  }

  // ── List data (pinned section + regular) ──────────────────────────────────
  const allPrivateItems = [
    ...[...chats].map(c  => ({ type: 'chat',  data: c, _t: new Date(c.lastMessage || 0).getTime() })),
    ...[...groups].filter(g => !g.isCircle).map(g => ({ type: 'group', data: g, _t: new Date(g.lastMessage || g.createdAt || 0).getTime() })),
  ].sort((a, b) => b._t - a._t);

  function buildListData() {
    const visible = allPrivateItems.filter(i => !hiddenIds.has(i.data._id?.toString()));
    const pinned  = visible.filter(i =>  pinnedIds.has(i.data._id?.toString()));
    const regular = visible.filter(i => !pinnedIds.has(i.data._id?.toString()));
    return [...pinned, ...regular];
  }

  // ── Renderizado de filas ──────────────────────────────────────────────────
  function renderChatRow(chat) {
    const other    = getOther(chat);
    const id       = chat._id?.toString();
    const isPinned = pinnedIds.has(id);
    const isMuted  = mutedIds.has(id);
    const badge    = showUnreadBadge(chat, 'chat');
    const count    = badge ? getUnreadCount(chat, 'chat') : 0;

    return (
      <TouchableOpacity
        style={s.chatItem}
        activeOpacity={0.75}
        onPress={() => {
          setChats(prev => prev.map(c => c._id?.toString() === id ? { ...c, unread: 0 } : c));
          clearUnread(id);
          navigation.navigate('ChatRoom', { chat, other });
        }}
        onLongPress={() => setActionSheet({ type: 'chat', item: chat })}
        delayLongPress={380}
      >
        <View style={s.avatarSlot}>
          <AvatarWithFrame
            size={AVATAR_SIZE}
            avatarUrl={other?.avatarUrl}
            username={other?.username}
            profileFrame={other?.profileFrame}
            frameUrl={other?.profileFrameUrl}
            banned={!!other?.banned}
          />
          {isMuted  && <View style={s.muteIndicator}><Ionicons name="notifications-off" size={7} color="rgba(255,255,255,0.8)" /></View>}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 }}>
            <Text style={[s.chatUser, { marginBottom: 0, flexShrink: 1 }]} numberOfLines={1}>{other?.username}</Text>
            <GenderIcon gender={other?.gender} />
            <VerifiedIcon isCreator={other?.isCreator} />
          </View>
          <Text numberOfLines={1} style={{ color: badge ? '#ffffff' : colors.textDim, fontWeight: badge ? '700' : '400', fontSize: 12 }}>
            {chat.lastMessageText || 'Toca para chatear'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <Text style={s.chatDate}>{chatDate(chat.lastMessage)}</Text>
          {badge && (
            <View style={s.unreadBadge}>
              <Text style={s.unreadBadgeTxt}>{count > 99 ? '99+' : count}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  function renderGroupRow(g) {
    const id       = g._id?.toString();
    const isPinned = pinnedIds.has(id);
    const isMuted  = mutedIds.has(id);
    const badge    = showUnreadBadge(g, 'group');
    const count    = badge ? getUnreadCount(g, 'group') : 0;

    return (
      <TouchableOpacity
        style={s.chatItem}
        activeOpacity={0.75}
        onPress={() => {
          setGroups(prev => prev.map(g2 => g2._id?.toString() === id ? { ...g2, unreadCounts: { ...(g2.unreadCounts || {}), [user._id?.toString()]: 0 } } : g2));
          clearUnread(id);
          navigation.navigate('GroupRoom', { group: g });
        }}
        onLongPress={() => setActionSheet({ type: 'group', item: g })}
        delayLongPress={380}
      >
        <View style={s.avatarSlot}>
          {g.imageUrl
            ? <Image source={{ uri: g.imageUrl }} style={s.groupImg} />
            : <View style={s.groupImgPlaceholder}><Ionicons name="people" size={20} color={colors.c1} /></View>
          }
          {isMuted  && <View style={s.muteIndicator}><Ionicons name="notifications-off" size={7} color="rgba(255,255,255,0.8)" /></View>}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.chatUser} numberOfLines={1}>{g.name}</Text>
          {g.lastMessageSender ? (
            <Text numberOfLines={1}>
              <Text style={{ color: badge ? colors.c1 : colors.textDim, fontWeight: badge ? '700' : '400', fontSize: 12 }}>{g.lastMessageSender}: </Text>
              <Text style={{ color: badge ? '#ffffff' : colors.textDim, fontWeight: badge ? '700' : '400', fontSize: 12 }}>{g.lastMessageText || ''}</Text>
            </Text>
          ) : (
            <Text numberOfLines={1} style={{ color: badge ? '#ffffff' : colors.textDim, fontWeight: badge ? '700' : '400', fontSize: 12 }}>
              {g.lastMessageText || g.description || 'Grupo privado'}
            </Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <Text style={s.chatDate}>{chatDate(g.lastMessage)}</Text>
          {badge && (
            <View style={s.unreadBadge}>
              <Text style={s.unreadBadgeTxt}>{count > 99 ? '99+' : count}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  function renderListItem({ item }) {
    if (item.type === 'header') {
      return (
        <View style={s.sectionHeader}>
          <Text style={s.sectionHeaderTxt}>{item.label}</Text>
        </View>
      );
    }
    if (item.type === 'group') return renderGroupRow(item.data);
    return renderChatRow(item.data);
  }

  // ── Bottom sheet ──────────────────────────────────────────────────────────
  function renderActionSheet() {
    if (!actionSheet) return null;
    const { type, item } = actionSheet;
    const id       = item._id?.toString();
    const isPinned = pinnedIds.has(id);
    const isMuted  = mutedIds.has(id);
    const title    = type === 'chat' ? (getOther(item)?.username || 'Chat') : item.name;

    const options = type === 'chat'
      ? [
          {
            icon:    isPinned ? 'pin' : 'pin-outline',
            label:   isPinned ? 'Quitar de fijados' : 'Fijar conversación',
            onPress: () => togglePin(id),
          },
          {
            icon:    'ellipse-outline',
            label:   'Marcar como no leído',
            onPress: () => markUnread(id),
          },
          {
            icon:    'trash-outline',
            label:   'Eliminar conversación',
            danger:  true,
            onPress: () => { setActionSheet(null); confirmDeleteChat(id); },
          },
        ]
      : [
          {
            icon:    isPinned ? 'pin' : 'pin-outline',
            label:   isPinned ? 'Quitar de fijados' : 'Fijar grupo',
            onPress: () => togglePin(id),
          },
          {
            icon:    isMuted ? 'notifications-outline' : 'notifications-off-outline',
            label:   isMuted ? 'Activar notificaciones' : 'Silenciar notificaciones',
            onPress: () => toggleMute(id),
          },
          {
            icon:    'exit-outline',
            label:   'Salir del grupo',
            danger:  true,
            onPress: () => confirmLeaveGroup(item),
          },
        ];

    return (
      <Modal
        visible
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setActionSheet(null)}
      >
        <Pressable style={s.bsOverlay} onPress={() => setActionSheet(null)}>
          <Pressable style={s.bsSheet} onPress={() => {}}>
            <View style={s.bsHandle} />
            <Text style={s.bsTitle} numberOfLines={1}>{title}</Text>
            {options.map((opt, i) => (
              <React.Fragment key={opt.label}>
                {i > 0 && <View style={s.bsDivider} />}
                <TouchableOpacity style={s.bsOption} onPress={opt.onPress} activeOpacity={0.7}>
                  <Ionicons
                    name={opt.icon}
                    size={20}
                    color={opt.danger ? 'rgba(239,68,68,0.85)' : colors.textMid}
                  />
                  <Text style={[s.bsOptionTxt, opt.danger && s.bsOptionDanger]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              </React.Fragment>
            ))}
            <View style={{ height: Math.max(insets.bottom, 12) }} />
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  // ── Pinned shortcuts ─────────────────────────────────────────────────────
  function renderPinnedShortcuts() {
    const pinned = allPrivateItems.filter(
      i => pinnedIds.has(i.data._id?.toString()) && !hiddenIds.has(i.data._id?.toString())
    );
    if (pinned.length === 0) return null;

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, marginVertical: 10 }}
        contentContainerStyle={s.pinnedRow}
      >
        {pinned.map(item => {
          const id = item.data._id?.toString();
          if (item.type === 'chat') {
            const chat  = item.data;
            const other = getOther(chat);
            return (
              <TouchableOpacity
                key={id}
                style={s.pinnedItem}
                activeOpacity={0.75}
                onPress={() => {
                  setChats(prev => prev.map(c => c._id?.toString() === id ? { ...c, unread: 0 } : c));
                  clearUnread(id);
                  navigation.navigate('ChatRoom', { chat, other });
                }}
              >
                {other?.avatarUrl
                  ? <Image source={{ uri: other.avatarUrl }} style={s.pinnedPrivateImg} />
                  : <View style={s.pinnedPrivatePlaceholder}>
                      <Text style={s.pinnedInitial}>{other?.username?.[0]?.toUpperCase()}</Text>
                    </View>
                }
                <Text style={s.pinnedName} numberOfLines={1}>{other?.username}</Text>
              </TouchableOpacity>
            );
          }
          const g = item.data;
          return (
            <TouchableOpacity
              key={id}
              style={s.pinnedItem}
              activeOpacity={0.75}
              onPress={() => {
                setGroups(prev => prev.map(g2 =>
                  g2._id?.toString() === id
                    ? { ...g2, unreadCounts: { ...(g2.unreadCounts || {}), [user._id?.toString()]: 0 } }
                    : g2
                ));
                clearUnread(id);
                navigation.navigate('GroupRoom', { group: g });
              }}
            >
              {g.imageUrl
                ? <Image source={{ uri: g.imageUrl }} style={s.pinnedGroupImg} />
                : <View style={s.pinnedGroupPlaceholder}><Ionicons name="people" size={22} color={colors.c1} /></View>
              }
              <Text style={s.pinnedName} numberOfLines={1}>{g.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  }

  // ── Tab content ───────────────────────────────────────────────────────────
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
        <View style={s.comingSoonBadge}><Text style={s.comingSoonTxt}>PROXIMAMENTE</Text></View>
        <Text style={s.emptySubtitle}>Esta función estará disponible pronto</Text>
      </View>
    );
  }

  function renderCirculos() {
    if (loading) return <ActivityIndicator color={colors.c1} style={{ marginTop: 40 }} />;
    if (fiestas.length === 0) {
      return (
        <View style={s.emptyTab}>
          <View style={s.emptyIconWrap}><Ionicons name="planet-outline" size={32} color={colors.textDim} /></View>
          <Text style={s.emptyTitle}>Aún no estás en ninguna fiesta</Text>
          <Text style={s.emptySubtitle}>Únete o crea una para empezar</Text>
          <TouchableOpacity style={s.fiestasExploreBtn} onPress={() => navigation.navigate('Circles')}>
            <Text style={s.fiestasExploreBtnTxt}>Explorar fiestas</Text>
          </TouchableOpacity>
        </View>
      );
    }
    const sortedFiestas = [...fiestas].sort((a, b) => {
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      if (a.isActive && b.isActive)
        return new Date(b.activatedAt || 0) - new Date(a.activatedAt || 0);
      return new Date(b.lastMessage || 0) - new Date(a.lastMessage || 0);
    });
    return (
      <FlatList
        data={sortedFiestas}
        keyExtractor={item => item._id}
        contentContainerStyle={{ paddingVertical: 8 }}
        renderItem={({ item }) => {
          const admin = (item.members || []).find(m => m.role === 'admin');
          const adminUser = admin?.user;
          const adminUsername = adminUser?.username || '?';
          const adminAvatar = adminUser?.avatarUrl;
          return (
            <TouchableOpacity
              style={[s.fiestasRow, !item.isActive && { opacity: 0.45 }]}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('GroupRoom', { group: item })}
            >
              <View style={s.fiestasCardRight}>
                <View style={s.fiestasHeaderRow}>
                  <AvatarWithFrame
                    size={48}
                    avatarUrl={adminAvatar}
                    username={adminUsername}
                    profileFrame={adminUser?.profileFrame}
                    frameUrl={adminUser?.profileFrameUrl}
                  />
                  <Text style={s.fiestasAdminName} numberOfLines={1}>{adminUsername}</Text>
                </View>
                <View style={s.fiestasLogoWrap}>
                  {item.imageUrl
                    ? <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]} />}
                  <LinearGradient
                    colors={['rgba(0,0,0,0.75)', 'transparent']}
                    style={[StyleSheet.absoluteFill, { justifyContent: 'flex-start', padding: 8 }]}
                  >
                    <Text style={s.fiestasLogoName} numberOfLines={1}>{item.name}</Text>
                  </LinearGradient>
                  <LinearGradient
                    colors={['rgba(0,0,0,0.7)', 'transparent']}
                    start={{ x: 0, y: 1 }}
                    end={{ x: 0, y: 0 }}
                    style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%' }}
                  />
                  {item.hashtags?.length > 0 && (
                    <View style={[s.fiestasHashtags, { position: 'absolute', bottom: 6, left: 6 }]}>
                      {item.hashtags.slice(0, 5).map((tag, idx) => {
                        const c = HASHTAG_COLORS[idx % HASHTAG_COLORS.length];
                        return (
                          <View key={tag} style={[s.fiestasHashtagPill, { borderColor: c + '55', backgroundColor: c + '18' }]}>
                            <Text style={[s.fiestasHashtagTxt, { color: c }]}>#{tag}</Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                  <View style={{ position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: '600' }}>
                      {(item.membersCount ?? item.members?.length ?? 0)} miembros
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    );
  }

  function renderPrivado() {
    if (loading) return <ActivityIndicator color={colors.c1} style={{ marginTop: 40 }} />;
    if (error) {
      return (
        <TouchableOpacity style={s.emptyTab} onPress={loadAll}>
          <View style={s.emptyIconWrap}><Ionicons name="cloud-offline" size={32} color={colors.textDim} /></View>
          <Text style={s.emptyTitle}>Sin conexión</Text>
          <Text style={s.emptySubtitle}>{error}</Text>
        </TouchableOpacity>
      );
    }
    const listData = buildListData();
    if (listData.length === 0) {
      return renderEmpty('chatbubble', 'Sin mensajes todavía', 'Visita el perfil de alguien o crea un grupo');
    }
    return (
      <FlatList
        style={{ backgroundColor: colors.black }}
        data={listData}
        keyExtractor={item => item.type === 'header' ? item.key : `${item.type}_${item.data._id}`}
        renderItem={renderListItem}
        contentContainerStyle={[s.listContent, { paddingBottom: 90 + insets.bottom }]}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.c1} style={{ marginVertical: 12 }} /> : null}
      />
    );
  }

  // ── Root ──────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      {Platform.OS !== 'web' && <StatusBar barStyle="light-content" backgroundColor={colors.black} />}
      <SafeAreaView edges={['top']}>
        <View style={s.header}>
          {/* Avatar propio — abre drawer */}
          <TouchableOpacity onPress={() => setDrawerOpen(true)} activeOpacity={0.8}>
            {user?.avatarUrl
              ? <Image source={{ uri: user.avatarUrl }} style={s.headerAvatar} />
              : <View style={[s.headerAvatar, s.headerAvatarPlaceholder]}>
                  <Text style={s.headerAvatarInitial}>{user?.username?.[0]?.toUpperCase()}</Text>
                </View>
            }
          </TouchableOpacity>

          <Text style={s.headerTitle}>Mis chats</Text>

          <TouchableOpacity style={s.cleanBtn} onPress={() => {}}>
            <MaterialCommunityIcons name="broom" size={20} color="#ffffff" />
          </TouchableOpacity>

          {/* Últimos 3 seguidos — stacked */}
          <View style={s.followingStack}>
            {recentFollowing.map((u, i) => (
              u?.avatarUrl
                ? <Image
                    key={u._id}
                    source={{ uri: u.avatarUrl }}
                    style={[s.stackAvatar, i > 0 && s.stackAvatarOffset]}
                  />
                : <View
                    key={u._id}
                    style={[s.stackAvatar, s.stackAvatarPlaceholder, i > 0 && s.stackAvatarOffset]}
                  >
                    <Text style={s.stackAvatarInitial}>{u?.username?.[0]?.toUpperCase()}</Text>
                  </View>
            ))}
          </View>

          <TouchableOpacity style={s.addBtn} onPress={() => navigation.navigate('CreateGroup')}>
            <Ionicons name="add" size={22} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {renderPinnedShortcuts()}

      <View style={s.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} style={s.tabBtn} onPress={() => setTab(t.key)} activeOpacity={1}>
            {t.key === 'circulos' ? (
              <MaskedView
                maskElement={
                  <Text style={tab === t.key ? [s.tabLabel, s.tabLabelActive] : s.tabLabel}>
                    {t.label}
                  </Text>
                }
              >
                <LinearGradient
                  colors={[colors.c5, colors.c2]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={[tab === t.key ? [s.tabLabel, s.tabLabelActive] : s.tabLabel, { opacity: 0 }]}>
                    {t.label}
                  </Text>
                </LinearGradient>
              </MaskedView>
            ) : (
              <Text style={tab === t.key ? [s.tabLabel, s.tabLabelActive] : s.tabLabel}>{t.label}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ flex: 1 }}>
        {tab === 'privado'      ? renderPrivado()                                      : null}
        {tab === 'circulos'    ? renderCirculos()                                     : null}
        {tab === 'game'        ? renderComingSoon('game-controller', 'Game Sessions') : null}
        {tab === 'invitaciones' ? renderComingSoon('mail-outline', 'Invitaciones')    : null}
      </View>

      {renderActionSheet()}

      <ProfileDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        user={user}
        onLogout={logout}
        onNavigate={(screen, params) => { setDrawerOpen(false); navigation.navigate(screen, params); }}
      />

      <CustomTabBar
        navigation={navigation}
        activeTab="chats"
        onCreatePress={() => navigation.navigate('CreateGroup')}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.black },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, gap: 10 },
  headerTitle: { flex: 1, color: colors.textHi, fontSize: 16, fontWeight: '700' },
  headerAvatar:            { width: 32, height: 32, borderRadius: 16 },
  headerAvatarPlaceholder: { backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerAvatarInitial:     { color: colors.textMid, fontSize: 13, fontWeight: '700' },
  cleanBtn:    { paddingHorizontal: 8, paddingVertical: 4 },
  followingStack: { flexDirection: 'row', alignItems: 'center' },
  stackAvatar:        { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#ffffff' },
  stackAvatarOffset:  { marginLeft: -8 },
  stackAvatarPlaceholder: { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  stackAvatarInitial: { color: colors.textMid, fontSize: 11, fontWeight: '700' },
  addBtn:      { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  tabBar:        { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 2, paddingVertical: 4, paddingHorizontal: 16 },
  tabBtn:        { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  tabLabel:      { color: colors.textDim, fontSize: 15, fontWeight: '800' },
  tabLabelActive:{ color: colors.textHi, fontWeight: '700' },
  tabBadge:      { position: 'absolute', top: -5, right: -10, backgroundColor: 'rgba(239,68,68,0.95)', borderRadius: 6, minWidth: 13, height: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  tabBadgeTxt:   { color: '#fff', fontSize: 7, fontWeight: '800' },

  listContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 90 },

  sectionHeader:    { paddingHorizontal: 4, paddingVertical: 6, marginTop: 4 },
  sectionHeaderTxt: { color: colors.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },

  avatarSlot:  { width: AVATAR_SIZE + 8, height: AVATAR_SIZE + 8, alignItems: 'center', justifyContent: 'center', marginRight: 10, flexShrink: 0 },
  chatItem:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  chatUser:    { color: colors.textHi, fontWeight: '600', fontSize: 14, marginBottom: 3 },
  chatDate:    { color: colors.textDim, fontSize: 10 },
  chatPreview: { color: colors.textDim, fontSize: 12 },

  unreadBadge:    { backgroundColor: colors.c1, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadBadgeTxt: { color: colors.black, fontSize: 10, fontWeight: '800' },

  pinIndicator:  { position: 'absolute', top: 0, right: 0, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.c1, alignItems: 'center', justifyContent: 'center' },
  muteIndicator: { position: 'absolute', bottom: 0, right: 0, width: 15, height: 15, borderRadius: 8, backgroundColor: 'rgba(100,100,120,0.9)', alignItems: 'center', justifyContent: 'center' },

  groupImg:            { width: 48, height: 48, borderRadius: 12, flexShrink: 0, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  groupImgPlaceholder: { width: 48, height: 48, borderRadius: 12, flexShrink: 0, backgroundColor: colors.surface, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  groupBadge:          { backgroundColor: 'rgba(0,229,204,0.1)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(0,229,204,0.2)', flexShrink: 0 },
  groupBadgeTxt:       { color: colors.c1, fontSize: 8, fontWeight: '800', letterSpacing: 1 },

  // Pinned shortcuts
  pinnedRow:             { paddingHorizontal: 12, paddingVertical: 0, gap: 12, justifyContent: 'flex-start', alignItems: 'center' },
  pinnedItem:            { alignItems: 'center', width: 58, gap: 4 },
  pinnedName:            { color: colors.textMid, fontSize: 11, fontWeight: '500', textAlign: 'center', width: 58 },
  pinnedGroupImg:        { width: 50, height: 50, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  pinnedGroupPlaceholder:{ width: 50, height: 50, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  pinnedPrivateImg:        { width: 50, height: 50, borderRadius: 25 },
  pinnedPrivatePlaceholder:{ width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  pinnedInitial:           { color: '#fff', fontSize: 18, fontWeight: '600' },

  // Bottom sheet
  bsOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  bsSheet:      { backgroundColor: '#0d1821', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, paddingHorizontal: 0, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  bsHandle:     { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', alignSelf: 'center', marginBottom: 16 },
  bsTitle:      { color: colors.textDim, fontSize: 12, fontWeight: '600', letterSpacing: 0.4, paddingHorizontal: 20, marginBottom: 8 },
  bsDivider:    { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: 20 },
  bsOption:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 20 },
  bsOptionTxt:  { color: colors.textHi, fontSize: 15, fontWeight: '500' },
  bsOptionDanger:{ color: 'rgba(239,68,68,0.9)' },

  emptyTab:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  emptyIconWrap:  { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(0,229,204,0.06)', borderWidth: 1, borderColor: 'rgba(0,229,204,0.15)', alignItems: 'center', justifyContent: 'center' },
  emptyTitle:     { color: colors.textHi, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptySubtitle:  { color: colors.textDim, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  comingSoonIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(0,229,204,0.08)', borderWidth: 1, borderColor: 'rgba(0,229,204,0.2)', alignItems: 'center', justifyContent: 'center' },
  comingSoonBadge:{ backgroundColor: 'rgba(0,229,204,0.08)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,229,204,0.2)', paddingHorizontal: 12, paddingVertical: 4 },
  comingSoonTxt:  { color: colors.c1, fontSize: 10, fontWeight: '800', letterSpacing: 2 },

  fiestasRow:          { paddingLeft: 0, paddingRight: 16, paddingVertical: 19, marginLeft: 73, marginRight: 60, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  fiestasHeaderRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6, marginLeft: -56 },
  fiestasAdminAvatar:  { width: 48, height: 48, borderRadius: 24, overflow: 'hidden', backgroundColor: 'rgba(0,229,204,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  fiestasAdminInitial: { color: colors.c1, fontSize: 20, fontWeight: '700' },
  fiestasCardRight:    { gap: 0 },
  fiestasAdminName:    { color: colors.textHi, fontSize: 12, fontWeight: '600', flex: 1 },
  fiestasLogoWrap:     { width: '100%', height: 175, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.surface, marginRight: 80 },
  fiestasLogoName:     { color: '#ffffff', fontSize: 20, fontWeight: '700', marginTop: 10 },
  fiestasExploreBtn:   { marginTop: 4, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(0,229,204,0.1)', borderWidth: 1, borderColor: 'rgba(0,229,204,0.3)' },
  fiestasExploreBtnTxt:{ color: colors.c1, fontSize: 13, fontWeight: '700' },
  fiestasHashtags:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  fiestasHashtagPill:  { backgroundColor: 'rgba(0,229,204,0.1)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  fiestasHashtagTxt:   { color: colors.c1, fontSize: 10, fontWeight: '600' },
});
