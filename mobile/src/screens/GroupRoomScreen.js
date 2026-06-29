import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
  View, Animated, Text, StyleSheet, TouchableOpacity, TextInput,
  Image, ImageBackground, FlatList, StatusBar, ActivityIndicator,
  Modal, Pressable, Linking, Alert, ScrollView, Dimensions,
  KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import api from '../services/api';
import { connectSocket } from '../services/socket';
import { useFocusEffect } from '@react-navigation/native';
import AvatarWithFrame from '../components/AvatarWithFrame';
import CoinIcon from '../components/CoinIcon';
import AudioMessage from '../components/AudioMessage';
import SharedProfileBubble from '../components/SharedProfileBubble';
import GiftBubble from '../components/GiftBubble';
import ReportModal from '../components/ReportModal';
import GenderIcon from '../components/GenderIcon';
import VerifiedIcon from '../components/VerifiedIcon';
import { formatCoins } from '../utils/formatCoins';
import YoutubeIframe from 'react-native-youtube-iframe';
import { useCinemaStore } from '../store/cinemaStore';

const GROUP_BG_PRESETS = { night: '#020D1A', void: '#050505', purple: '#0D0714', teal: '#030F10' };
const SCREEN_H = Dimensions.get('window').height;
const SCREEN_W = Dimensions.get('window').width;
const CINEMA_H = Math.round(SCREEN_H * 0.40);
const CINEMA_W = SCREEN_W - 24; // marginHorizontal: 12 * 2

function extractYoutubeId(url) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}
const _circleCache = {};

const AVATAR_SLOT = 38;
const COMMISSION = 0.15;
const FRAME_COST_PER_UNIT = 5;
const GIFT_COLS = 3;
const GIFT_GAP  = 8;
const GIFT_CARD_W = (Dimensions.get('window').width - 40 - GIFT_GAP * (GIFT_COLS - 1)) / GIFT_COLS;

// ─── Helpers de fecha ─────────────────────────────────────────────────────────
function dateLabel(date) {
  const d         = new Date(date);
  const today     = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString())     return 'Hoy';
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
  const days   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const diff   = (today - d) / (1000 * 60 * 60 * 24);
  if (diff < 7) return days[d.getDay()];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function timeStr(date) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Texto enriquecido ────────────────────────────────────────────────────────
function renderRichText(text, navigation) {
  if (!text) return null;
  const parts = text.split(/(@\w+|https?:\/\/[^\s]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      const username = part.slice(1);
      return <Text key={i} style={{ fontWeight:'700', color: colors.c1 }} onPress={() => navigation.navigate('PublicProfile', { username })}>{part}</Text>;
    }
    if (/^https?:\/\//.test(part)) {
      const postId = part.match(/abyss\.social\/post\/([a-f0-9]{24})/i)?.[1];
      if (postId) return <Text key={i} style={{ color:'#00e5cc', fontWeight:'600' }} onPress={() => navigation.navigate('PostDetail', { postId })}>Ver post en Abyss</Text>;
      return <Text key={i} style={{ color:'#00e5cc', textDecorationLine:'underline' }} onPress={() => Linking.openURL(part).catch(() => {})}>{part}</Text>;
    }
    return <Text key={i}>{part}</Text>;
  });
}

// ─── Mensaje de sistema ───────────────────────────────────────────────────────
function SystemMessage({ msg, isCircle }) {
  const text = isCircle
    ? (msg.text || '')
        .replace(/\bdel grupo\b/gi, 'de la fiesta')
        .replace(/\bal grupo\b/gi, 'a la fiesta')
        .replace(/\bgrupo\b/gi, 'fiesta')
    : msg.text;
  return (
    <View style={s.sysRow}>
      <Text style={s.sysTxt}>{text}</Text>
    </View>
  );
}

// ─── SharedPostBubble ─────────────────────────────────────────────────────────
function SharedPostBubble({ sharedPost, navigation, isMe, onPress }) {
  if (!sharedPost?.postId) return null;
  const hasImage  = !!sharedPost.imageUrl;
  const bgColor   = isMe ? 'rgba(0,140,126,0.22)' : 'rgba(13,29,46,0.9)';
  const borderCol = isMe ? 'rgba(0,229,204,0.30)' : 'rgba(255,255,255,0.09)';
  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('PostDetail', { postId: sharedPost.postId.toString() })}
      onLongPress={onPress}
      activeOpacity={0.82}
      style={{ borderRadius:14, borderWidth:1, overflow:'hidden', width:224, marginBottom:4, backgroundColor:bgColor, borderColor:borderCol }}
    >
      <View style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:10, paddingVertical:9, gap:7, borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.06)' }}>
        <View style={{ width:2, height:16, backgroundColor:'#00e5cc', borderRadius:1 }} />
        <Text style={{ color:'#00e5cc', fontSize:11, fontWeight:'700', flex:1 }}>{sharedPost.authorUsername}</Text>
        <Ionicons name="open-outline" size={13} color="rgba(0,229,204,0.5)" />
      </View>
      {hasImage && <Image source={{ uri: sharedPost.imageUrl }} style={{ width:'100%', height:110 }} resizeMode="cover" />}
      <View style={{ paddingHorizontal:10, paddingVertical:8, gap:3 }}>
        {!!sharedPost.title   && <Text style={{ color:'#e8f4f8', fontSize:13, fontWeight:'700' }} numberOfLines={2}>{sharedPost.title}</Text>}
        {!!sharedPost.content && <Text style={{ color:'rgba(232,244,248,0.58)', fontSize:12, lineHeight:17 }} numberOfLines={hasImage ? 1 : 3}>{sharedPost.content}</Text>}
      </View>
      <View style={{ flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:10, paddingBottom:8 }}>
        <Ionicons name="arrow-forward-circle-outline" size={12} color="rgba(0,229,204,0.45)" />
        <Text style={{ color:'rgba(0,229,204,0.45)', fontSize:10, fontWeight:'600' }}>Ver post completo</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── MessageBubble ────────────────────────────────────────────────────────────
const MessageBubble = memo(function MessageBubble({
  msg, prevMsg, isMe, user, group, isAdmin, blockedIds,
  navigation, onOpenMenu, onReply, onFullImg, onGiftAction, onGiftClaim,
}) {
  const sender       = msg.sender;
  const prevSenderId = (prevMsg?.sender?._id || prevMsg?.sender)?.toString();
  const thisSenderId = (sender?._id || sender)?.toString();
  const sameAsPrev   = prevMsg && prevMsg.type !== 'system' && prevSenderId === thisSenderId;
  const showAvatar   = !sameAsPrev && msg.type !== 'system';
  const senderIsBlocked = !isMe && blockedIds?.includes((sender?._id || sender)?.toString());

  if (msg.type === 'system') {
    return <SystemMessage msg={msg} isCircle={!!group?.isCircle} />;
  }

  const displayName        = isMe ? (user?.username || 'Tu') : (sender?.username || '');
  const isPostType         = msg.type === 'shared_post' || msg.type === 'shared_profile';
  const isDeleted          = msg.deletedFor?.map(d => d.toString()).includes(user?._id?.toString());
  const senderMemberRole = group?.members?.find(
    m => (m.user?._id || m.user)?.toString() === (sender?._id || sender)?.toString()
  )?.role;
  const senderIsGroupAdmin   = senderMemberRole === 'admin';
  const senderIsGroupCoAdmin = senderMemberRole === 'co-admin';

  return (
    <>
      <View style={{ marginBottom: 4 }}>
        {showAvatar && (
          <View style={[s.msgSenderRow, isMe && s.msgSenderRowMe]}>
            <Text style={s.msgSenderName}>{displayName}</Text>
            <GenderIcon gender={isMe ? user?.gender : sender?.gender} size={11} />
            <VerifiedIcon isCreator={isMe ? user?.isCreator : sender?.isCreator} size={11} />
            {senderIsGroupAdmin && (
              <View style={s.adminBadge}>
                <Text style={s.adminBadgeTxt}>Admin</Text>
              </View>
            )}
            {senderIsGroupCoAdmin && (
              <View style={s.coAdminBadge}>
                <Text style={s.coAdminBadgeTxt}>Co-admin</Text>
              </View>
            )}
          </View>
        )}

        <View style={[s.msgRow, isMe && s.msgRowMe]}>
          <TouchableOpacity
            style={{ width: AVATAR_SLOT, alignSelf:'flex-start', alignItems:'center', paddingTop:2 }}
            onPress={() => !isMe && navigation.navigate('PublicProfile', { username: sender?.username })}
            activeOpacity={isMe ? 1 : 0.7}
          >
            {showAvatar && (
              <AvatarWithFrame
                size={30}
                avatarUrl={isMe ? user?.avatarUrl : sender?.avatarUrl}
                username={isMe ? user?.username : sender?.username}
                profileFrame={isMe ? user?.profileFrame : sender?.profileFrame}
                frameUrl={isMe ? user?.profileFrameUrl : sender?.profileFrameUrl}
                banned={!isMe && !!sender?.banned}
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem, isPostType && s.bubblePost, msg.type === 'gift' && s.bubbleGift, msg.type === 'image' && !!msg.mediaUrl && s.bubbleImage]}
            delayLongPress={350}
            onLongPress={() => !isDeleted && onOpenMenu(msg)}
            activeOpacity={0.85}
          >
            {senderIsBlocked ? (
              <Text style={[s.bubbleText, { opacity:0.35, fontStyle:'italic' }]}>Mensaje de usuario bloqueado</Text>
            ) : isDeleted ? (
              <Text style={[s.bubbleText, { opacity:0.4, fontStyle:'italic' }]}>Mensaje eliminado</Text>
            ) : (
              <>
                {msg.replyTo?.text && (
                  <View style={s.replyPreview}>
                    <Text style={s.replyUser}>{msg.replyTo.senderUsername}</Text>
                    <Text style={s.replyText} numberOfLines={1}>{msg.replyTo.text}</Text>
                  </View>
                )}
                {msg.type === 'gift'
                  ? <GiftBubble giftData={msg.giftData} giftId={msg.giftId} isMe={isMe} myId={user?._id} onGiftAction={onGiftAction} onGiftClaim={onGiftClaim} members={group?.members} />
                  : msg.type === 'shared_profile' && msg.sharedProfile
                  ? <SharedProfileBubble sharedProfile={msg.sharedProfile} navigation={navigation} isMe={isMe} onLongPress={() => onOpenMenu(msg)} />
                  : msg.type === 'shared_post' && msg.sharedPost
                  ? <SharedPostBubble sharedPost={msg.sharedPost} navigation={navigation} isMe={isMe} onPress={() => onOpenMenu(msg)} />
                  : msg.type === 'audio' && msg.mediaUrl
                  ? <AudioMessage uri={msg.mediaUrl} isMe={isMe} duration={msg.audioDuration || 0} />
                  : msg.type === 'image' && msg.mediaUrl
                  ? (
                    <TouchableOpacity
                      onPress={() => onFullImg(msg.mediaUrl)}
                      activeOpacity={0.9}
                      style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', marginRight: isMe ? 12 : 0, marginLeft: isMe ? 0 : 12 }}
                    >
                      <Image source={{ uri: msg.mediaUrl }} style={{ width:220, height:220, borderRadius:12 }} resizeMode="contain" />
                    </TouchableOpacity>
                  )
                  : (
                    <Text style={s.bubbleText}>
                      {renderRichText(msg.text, navigation)}
                    </Text>
                  )
                }
              </>
            )}
            {!isPostType && msg.type !== 'gift' && !isDeleted && (
              <Text style={[s.bubbleTime, msg.type === 'image' && msg.mediaUrl && { textAlign: isMe ? 'right' : 'left', marginTop:2 }]}>
                {timeStr(msg.createdAt)}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
});

const _grpBgCache = new Map();

// ─── GroupRoomScreen ──────────────────────────────────────────────────────────
export default function GroupRoomScreen({ route, navigation }) {
  const { group: initialGroup } = route.params;
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { markChatRead } = useAppStore();

  const [group, setGroup] = useState(() => {
    const cachedBg = _grpBgCache.get(initialGroup._id?.toString());
    return cachedBg !== undefined ? { ...initialGroup, backgroundUrl: cachedBg } : initialGroup;
  });
  const [messages,      setMessages]      = useState([]);
  const [text,          setText]          = useState('');
  const [loading,       setLoading]       = useState(true);
  const [sending,       setSending]       = useState(false);
  const [uploading,     setUploading]     = useState(false);
  const [isRecording,   setIsRecording]   = useState(false);
  const [recSeconds,    setRecSeconds]    = useState(0);
  const [audioPreview,  setAudioPreview]  = useState(null);
  const [imagePreview,  setImagePreview]  = useState(null);
  const [fullImg,       setFullImg]       = useState(null);
  const [replyTo,       setReplyTo]       = useState(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [menuMsg,       setMenuMsg]       = useState(null);
  const [menuVisible,   setMenuVisible]   = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [infoVisible,       setInfoVisible]       = useState(false);
  const [imgViewerVisible,  setImgViewerVisible]  = useState(false);
  const [allMembersVisible, setAllMembersVisible] = useState(false);
  const [memberSearch,      setMemberSearch]      = useState('');
  const [banConfirm,    setBanConfirm]    = useState(false);
  const [kickConfirm,   setKickConfirm]   = useState(false);

  // Estados de expulsión / baneo
  const [isKicked,         setIsKicked]         = useState(false);
  const [isBanned,         setIsBanned]          = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [kbVisible,          setKbVisible]          = useState(false);
  const [hasMore,            setHasMore]            = useState(false);
  const [loadingMore,        setLoadingMore]        = useState(false);
  const [newMsgIndicator,    setNewMsgIndicator]    = useState(false);
  const [dismissedJoinBar,   setDismissedJoinBar]   = useState(false);
  const [groupLoaded,        setGroupLoaded]        = useState(false);

  // ── Regalo ─────────────────────────────────────────────────────────────────
  const [giftModal,   setGiftModal]   = useState(false);
  const [giftType,    setGiftType]    = useState('coins');
  const [giftCoins,   setGiftCoins]   = useState('');
  const [giftSlots,   setGiftSlots]   = useState('5');
  const [giftFrame,   setGiftFrame]   = useState(null);
  const [giftCantidad,setGiftCantidad]= useState('5');
  const [giftMsg,     setGiftMsg]     = useState('');
  const [giftInv,     setGiftInv]     = useState([]);
  const [giftInvLoad, setGiftInvLoad] = useState(false);
  const [sendingGift, setSendingGift] = useState(false);
  const [giftErr,     setGiftErr]     = useState('');

  // ── Sala de Cine ───────────────────────────────────────────────────────────
  const [showCinemaMenu,  setShowCinemaMenu]  = useState(false);
  const [showCinemaInput, setShowCinemaInput] = useState(false);
  const [cinemaYtUrl,     setCinemaYtUrl]     = useState('');
  const [cinemaUrlError,  setCinemaUrlError]  = useState('');
  const [cinemaVideoId,   setCinemaVideoId]   = useState(null);
  const [cinemaPlaying,   setCinemaPlaying]   = useState(true);
  const [cinemaMinimized, setCinemaMinimized] = useState(false);

  const { isProyector, setProyector, clearProyector } = useCinemaStore();

  const flatRef           = useRef(null);
  const socketRef         = useRef(null);
  const playerRef         = useRef(null);
  const lastSyncEmitRef   = useRef(0);
  const cinemaIntervalRef = useRef(null);
  const cinemaStartingRef = useRef(false);
  const cinemaBufferingRef = useRef(false);
  const cinemaPausedRef = useRef(false);
  const keyboardOffset = useRef(new Animated.Value(0)).current;
  const recordingRef = useRef(null);
  const recTimerRef  = useRef(null);
  const recSecsRef   = useRef(0);
  const sendingRef      = useRef(false);
  const msgSkipRef      = useRef(0);
  const loadingMoreRef  = useRef(false);
  const scrollOffsetRef = useRef(0);

  const isAdmin = group?.members?.some(
    m => ((m.user?._id || m.user)?.toString()) === user?._id?.toString() && m.role === 'admin'
  );
  const isCoAdmin = group?.members?.some(
    m => ((m.user?._id || m.user)?.toString()) === user?._id?.toString() && m.role === 'co-admin'
  );

  const [isMember, setIsMember] = useState(() => {
    const grp = route.params?.group;
    if (!grp || !user?._id) return false;
    if (_circleCache[grp._id]) return true;
    const creatorId = grp.creator?._id?.toString() || grp.creator?.toString();
    if (creatorId === user._id.toString()) return true;
    return (grp.members || []).some(
      m => (m.user?._id?.toString() || m.user?.toString()) === user._id.toString()
    );
  });

  const isPending = !isMember && group?.pendingInvites?.some(
    u => u?.toString() === user?._id?.toString()
  );

  const flatListData = useMemo(() => {
    const unique = [...new Map(messages.map(m => [m._id?.toString(), m])).values()];
    const reversed = [...unique].reverse();
    const result = [];
    for (let i = 0; i < reversed.length; i++) {
      result.push(reversed[i]);
      const next = reversed[i + 1];
      if (!next || dateLabel(reversed[i].createdAt) !== dateLabel(next.createdAt)) {
        result.push({ _id: `sep_${dateLabel(reversed[i].createdAt)}_${i}`, type: 'date_separator', label: dateLabel(reversed[i].createdAt) });
      }
    }
    return result;
  }, [messages]);

  useFocusEffect(useCallback(() => {
    markChatRead(group._id?.toString());
    if (socketRef.current) {
      socketRef.current.emit('group:join', { groupId: group._id });
    }
    api.get(`/groups/${group._id}`)
      .then(({ data }) => {
        _grpBgCache.set(data.group._id?.toString(), data.group.backgroundUrl ?? null);
        setGroup(data.group);
        if (!data.isPending) {
          api.post(`/groups/${group._id}/read`).catch(() => {});
        }
      })
      .catch(() => {});
  }, [group._id]));

  useEffect(() => {
    const eventShow = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const eventHide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(eventShow, (e) => {
      setKbVisible(true);
      Animated.timing(keyboardOffset, { toValue: e.endCoordinates.height, duration: e.duration || 250, useNativeDriver: false }).start();
    });
    const hide = Keyboard.addListener(eventHide, (e) => {
      setKbVisible(false);
      Animated.timing(keyboardOffset, { toValue: 0, duration: e.duration || 250, useNativeDriver: false }).start();
    });
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (group?.isCircle) {
      const id = group._id;
      import('@react-native-async-storage/async-storage')
        .then(({ default: AS }) => AS.getItem(`circle_member_${id}`))
        .then(v => { if (v) { _circleCache[id] = true; setIsMember(true); } })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    loadGroup();
    setupSocket();
    return () => {
      if (socketRef.current) {
        socketRef.current.emit('group:leave', { groupId: group._id });
        socketRef.current.off('group:message');
        socketRef.current.off('group:message_deleted');
        socketRef.current.off('group:kicked');
        socketRef.current.off('group:banned');
        socketRef.current.off('group:deleted');
        socketRef.current.off('group:background_updated');
        socketRef.current.off('gift:update');
        socketRef.current.off('circle:cinema:start');
        socketRef.current.off('circle:cinema:stop');
        socketRef.current.off('circle:cinema:sync');
        clearInterval(cinemaIntervalRef.current);
      }
      clearInterval(recTimerRef.current);
    };
  }, []);

  async function loadGroup() {
    try {
      const { data } = await api.get(`/groups/${group._id}`);
      setGroup(data.group);
      const myId = user?._id?.toString();
      setIsMember((data.group.members ?? []).some(
        m => m.user?._id?.toString() === myId || m.user?.toString() === myId
      ));
      // Detect banned state from server data (in case user was banned then re-added without unban)
      if (myId && data.group.bannedUsers?.some(b => b?.toString() === myId)) {
        setIsBanned(true);
      }
      if (!data.isPending) {
        const { data: msgData } = await api.get(`/groups/${group._id}/messages?limit=50`);
        setMessages(msgData.messages || []);
        setHasMore(msgData.hasMore ?? false);
        msgSkipRef.current = 50;
        api.post(`/groups/${group._id}/read`).catch(() => {});
      }
    } catch (e) {
      if (e.response?.status === 403 && !group?.isCircle) setIsBanned(true);
    }
    finally { setLoading(false); setGroupLoaded(true); }
  }

  async function setupSocket() {
    const socket = await connectSocket();
    socketRef.current = socket;

    socket.off('group:message');
    socket.off('group:message_deleted');
    socket.off('group:kicked');
    socket.off('group:banned');
    socket.off('group:deleted');
    socket.off('group:background_updated');
    socket.off('circle:cinema:start');
    socket.off('circle:cinema:stop');
    socket.off('circle:cinema:sync');

    socket.on('group:message', ({ groupId, message }) => {
      if (groupId.toString() !== group._id.toString()) return;
      setMessages(prev =>
        prev.some(m => m._id?.toString() === message._id?.toString()) ? prev : [...prev, message]
      );
      api.post(`/groups/${group._id}/read`).catch(() => {});
      const isOwnMsg = (message.sender?._id || message.sender)?.toString() === user?._id?.toString();
      if (isOwnMsg || scrollOffsetRef.current < 100) {
        setTimeout(() => flatRef.current?.scrollToOffset({ offset: 0, animated: true }), 50);
      } else {
        setNewMsgIndicator(true);
      }
    });

    socket.on('group:message_deleted', ({ groupId, msgId }) => {
      if (groupId.toString() !== group._id.toString()) return;
      setMessages(prev => prev.filter(m => m._id?.toString() !== msgId?.toString()));
    });

    // Escuchar expulsion
    socket.on('group:kicked', ({ groupId, userId }) => {
      if (groupId.toString() !== group._id.toString()) return;
      if (userId?.toString() === user?._id?.toString()) {
        setIsKicked(true);
      } else {
        // Actualizar lista de miembros localmente
        setGroup(prev => ({
          ...prev,
          members: prev.members.filter(m => (m.user?._id || m.user)?.toString() !== userId?.toString()),
        }));
      }
    });

    // Escuchar baneo
    socket.on('group:banned', ({ groupId, userId }) => {
      if (groupId.toString() !== group._id.toString()) return;
      if (userId?.toString() === user?._id?.toString()) {
        setIsBanned(true);
      } else {
        setGroup(prev => ({
          ...prev,
          members: prev.members.filter(m => (m.user?._id || m.user)?.toString() !== userId?.toString()),
        }));
      }
    });

    // Escuchar eliminación del grupo
    socket.on('group:deleted', ({ groupId }) => {
      if (groupId.toString() !== group._id.toString()) return;
      Alert.alert(
        group?.isCircle ? 'Fiesta eliminada' : 'Grupo eliminado',
        group?.isCircle ? 'Esta fiesta fue eliminada.' : 'Este grupo fue eliminado.',
        [{ text: 'Aceptar', onPress: () => navigation.navigate('Chats') }],
      );
    });

    socket.on('group:background_updated', ({ groupId, backgroundUrl }) => {
      if (groupId.toString() !== group._id.toString()) return;
      setGroup(prev => ({ ...prev, backgroundUrl }));
    });

    socket.on('circle:cinema:start', ({ groupId, videoId }) => {
      if (groupId?.toString() !== group._id?.toString()) return;
      setCinemaVideoId(videoId);
      setCinemaPlaying(true);
      setCinemaMinimized(false);
    });
    socket.on('circle:cinema:stop', ({ groupId }) => {
      if (groupId?.toString() !== group._id?.toString()) return;
      setCinemaVideoId(null);
      setCinemaPlaying(true);
      clearProyector();
    });
    socket.on('circle:cinema:sync', ({ groupId, action, currentTime }) => {
      if (groupId?.toString() !== group._id?.toString()) return;
      if (action === 'play') {
        setCinemaPlaying(true);
        playerRef.current?.getCurrentTime().then(t => {
          if (Math.abs((t ?? 0) - (currentTime ?? 0)) > 5)
            playerRef.current?.seekTo(currentTime ?? 0, true);
        }).catch(() => {});
      } else if (action === 'pause') {
        setCinemaPlaying(false);
      } else if (action === 'seek') {
        if (cinemaBufferingRef.current) return;
        playerRef.current?.getCurrentTime().then(t => {
          if (Math.abs((t ?? 0) - (currentTime ?? 0)) > 5) {
            playerRef.current?.seekTo(currentTime ?? 0, true);
          }
        }).catch(() => {});
      }
    });

    socket.on('gift:update', ({ giftId, estado, slotsReclamados, reclamadoPor }) => {
      setMessages(prev => prev.map(m => {
        if (m.giftId?.toString() !== giftId?.toString()) return m;
        const patch = {};
        if (estado          !== undefined) patch.estado          = estado;
        if (slotsReclamados !== undefined) patch.slotsReclamados = slotsReclamados;
        if (reclamadoPor    !== undefined) patch.reclamadoPor    = reclamadoPor;
        return { ...m, giftData: { ...(m.giftData || {}), ...patch } };
      }));
    });

    socket.emit('group:join', { groupId: group._id });
  }

  function openMenu(msg) {
    setMenuMsg(msg);
    setMenuVisible(true);
    setBanConfirm(false);
    setKickConfirm(false);
  }

  function closeMenu() {
    setMenuVisible(false);
    setMenuMsg(null);
    setBanConfirm(false);
    setKickConfirm(false);
  }

  async function handleDeleteMessage(msgId, forAll) {
    closeMenu();
    try {
      await api.delete(`/groups/${group._id}/message/${msgId}?forAll=${forAll}`);
      if (forAll) {
        setMessages(prev => prev.filter(m => m._id?.toString() !== msgId?.toString()));
      } else {
        setMessages(prev => prev.map(m =>
          m._id?.toString() === msgId?.toString()
            ? { ...m, deletedFor: [...(m.deletedFor || []), user._id] }
            : m
        ));
      }
    } catch {}
  }

  async function handleKickUser(userId, username) {
    closeMenu();
    try {
      await api.post(`/groups/${group._id}/kick/${userId}`);
      setGroup(prev => ({
        ...prev,
        members: prev.members.filter(m => (m.user?._id || m.user)?.toString() !== userId?.toString()),
      }));
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'No se pudo expulsar');
    }
  }

  async function handleBanUser(userId, username, deleteMessages = false) {
    closeMenu();
    try {
      await api.post(`/groups/${group._id}/ban/${userId}?deleteMessages=${deleteMessages}`);
      setGroup(prev => ({
        ...prev,
        members: prev.members.filter(m => (m.user?._id || m.user)?.toString() !== userId?.toString()),
      }));
      if (deleteMessages) {
        setMessages(prev => prev.filter(m =>
          (m.sender?._id || m.sender)?.toString() !== userId?.toString()
        ));
      }
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'No se pudo banear');
    }
  }

  async function handleJoinGroup() {
    try {
      const { data } = await api.post(`/groups/${group._id}/join`);
      setGroup(data.group);
      setIsKicked(false);
      loadGroup();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || (group?.isCircle ? 'No se pudo unir a la fiesta' : 'No se pudo unir al grupo'));
    }
  }

  async function handleCircleJoin() {
    try {
      const { data } = await api.post(`/groups/circles/${group._id}/join`);
      const id = group._id;
      _circleCache[id] = true;
      setGroup(data.group);
      setIsMember(true);
      import('@react-native-async-storage/async-storage')
        .then(({ default: AS }) => AS.setItem(`circle_member_${id}`, '1'))
        .catch(() => {});
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'No se pudo unir a la fiesta');
    }
  }

  async function handleAcceptInvite() {
    try {
      const { data } = await api.post(`/groups/${group._id}/invite/accept`);
      setGroup(data.group);
      const { data: msgData } = await api.get(`/groups/${group._id}/messages?limit=50`);
      setMessages(msgData.messages || []);
      setHasMore(msgData.hasMore ?? false);
      msgSkipRef.current = 50;
      api.post(`/groups/${group._id}/read`).catch(() => {});
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'No se pudo aceptar la invitación');
    }
  }

  async function handleDeclineInvite() {
    try {
      await api.post(`/groups/${group._id}/invite/decline`);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'No se pudo rechazar la invitación');
    }
  }

  function handleTextChange(val) {
    setText(val);
    const match = val.match(/@(\w*)$/);
    if (match) {
      const q = match[1].toLowerCase();
      const suggestions = [];
      // @todos solo para admins
      if (isAdmin && ('todos'.startsWith(q) || 'all'.startsWith(q) || q === '')) {
        suggestions.push({ _id: '__todos__', username: 'todos', special: true });
      }
      const members = group?.members || [];
      for (const m of members) {
        if (suggestions.length >= 8) break;
        const uname = (m.user?.username || '').toLowerCase();
        if (uname === user?.username?.toLowerCase()) continue;
        if (q === '' || uname.startsWith(q)) {
          suggestions.push({ _id: m.user?._id || m.user, username: m.user?.username || '', avatarUrl: m.user?.avatarUrl });
        }
      }
      setMentionSuggestions(suggestions);
    } else {
      setMentionSuggestions([]);
    }
  }

  function pickMention(username) {
    const newText = text.replace(/@(\w*)$/, `@${username} `);
    setText(newText);
    setMentionSuggestions([]);
  }

  async function handleLeaveWelcome() {
    try {
      await api.post(`/groups/${group._id}/leave`);
      navigation.goBack();
    } catch (e) { navigation.goBack(); }
  }

  async function openGiftModal() {
    setGiftModal(true);
    setGiftType('coins');
    setGiftCoins('');
    setGiftSlots('5');
    setGiftFrame(null);
    setGiftCantidad('5');
    setGiftMsg('');
    setGiftErr('');
    setGiftInvLoad(true);
    try {
      const { data } = await api.get('/frames/me/inventory');
      setGiftInv((data.inventory || []).filter(i => (i.unidadesEnMano || 0) >= 1));
    } catch {}
    finally { setGiftInvLoad(false); }
  }

  async function sendGroupGift() {
    if (giftType === 'coins') {
      if (!giftCoins || parseInt(giftCoins) <= 0) { setGiftErr('Ingresa un monto válido'); return; }
      if (!giftSlots || parseInt(giftSlots) < 2) { setGiftErr('Mínimo 2 usuarios'); return; }
    } else {
      if (!giftFrame) { setGiftErr('Selecciona un marco'); return; }
      if (!giftCantidad || parseInt(giftCantidad) < 1) { setGiftErr('Ingresa al menos 1 unidad'); return; }
    }
    setSendingGift(true); setGiftErr('');
    try {
      const slots = parseInt(giftSlots) || 5;
      const cant  = parseInt(giftCantidad) || 5;
      const { data } = await api.post('/gifts/group', {
        monedas: giftType === 'coins' ? parseInt(giftCoins) : 0,
        slots:   giftType === 'coins' ? slots : cant,
        items:   giftType === 'frame' ? [{ frameId: (giftFrame.frame || giftFrame)._id, cantidad: cant }] : [],
        mensaje: giftMsg.trim(),
      });
      const gift = data.gift;
      socketRef.current?.emit('group:message', {
        groupId: group._id,
        type:    'gift',
        text:    '',
        giftId:  gift._id,
        giftData: {
          monedas:         gift.monedas || 0,
          items:           (gift.items || []).map(i => ({ name: i.frame?.name, cantidad: i.cantidad, imageUrl: i.frame?.imageUrl || null })),
          mensaje:         gift.mensaje || '',
          estado:          'pendiente',
          emisorUsername:  user.username,
          tipo:            'grupal',
          slots:           gift.slots,
          slotsReclamados: 0,
          reclamadoPor:    [],
        },
      });
      Keyboard.dismiss();
      setGiftModal(false);
      flatRef.current?.scrollToOffset({ offset: 0, animated: true });
      setNewMsgIndicator(false);
    } catch (e) {
      setGiftErr(e.response?.data?.error || 'Error al enviar regalo');
    } finally { setSendingGift(false); }
  }

  const handleGroupGiftClaim = useCallback(async (giftId) => {
    try {
      const { data } = await api.post(`/gifts/${giftId}/claim`, {
        roomId:   group._id,
        roomType: 'group',
      });
      setMessages(prev => prev.map(m => {
        if (m.giftId?.toString() !== giftId?.toString()) return m;
        return {
          ...m,
          giftData: {
            ...(m.giftData || {}),
            slotsReclamados: data.slotsReclamados,
            reclamadoPor: [...(m.giftData?.reclamadoPor || []), String(user._id)],
          },
        };
      }));
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'No se pudo reclamar el regalo');
    }
  }, [group._id, user._id]);

  const loadMoreGroupMessages = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const { data } = await api.get(`/groups/${group._id}/messages?limit=50&skip=${msgSkipRef.current}`);
      if (data.messages?.length) {
        setMessages(prev => [...data.messages, ...prev]);
      }
      setHasMore(data.hasMore ?? false);
      msgSkipRef.current += 50;
    } catch {}
    finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore]);

  function sendMessage() {
    if (!text.trim() || sendingRef.current) return;
    sendingRef.current = true;
    const payload = {
      groupId: group._id,
      text:    text.trim(),
      type:    'text',
      replyTo: replyTo ? {
        messageId:      replyTo._id,
        text:           replyTo.text,
        senderUsername: replyTo.sender?.username || '',
      } : undefined,
    };
    socketRef.current?.emit('group:message', payload);
    setText('');
    flatRef.current?.scrollToOffset({ offset: 0, animated: true });
    setNewMsgIndicator(false);
    setReplyTo(null);
    sendingRef.current = false;
  }

  async function pickImage() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 });
      if (result.canceled) return;
      setImagePreview(result.assets[0].uri);
    } catch (e) { console.log('pickImage error:', e.message); }
  }

  async function confirmSendImage() {
    if (!imagePreview) return;
    const uri = imagePreview;
    setImagePreview(null);
    flatRef.current?.scrollToOffset({ offset: 0, animated: true });
    setNewMsgIndicator(false);
    try {
      setUploading(true);
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      const token = await AsyncStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', { uri, type: 'image/jpeg', name: 'group.jpg' });
      const BASE_URL = process.env.EXPO_PUBLIC_API_URL;
      const res  = await fetch(`${BASE_URL}/chats/upload`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
        body:    formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      socketRef.current?.emit('group:message', { groupId: group._id, text: '', type: 'image', mediaUrl: data.url });
    } catch (e) { console.log('confirmSendImage error:', e.message); }
    finally { setUploading(false); }
  }

  async function startRecording() {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      recSecsRef.current   = 0;
      setIsRecording(true);
      setRecSeconds(0);
      recTimerRef.current = setInterval(() => {
        recSecsRef.current += 1;
        setRecSeconds(recSecsRef.current);
      }, 1000);
    } catch (e) { console.log('startRecording error:', e.message); }
  }

  async function stopRecording() {
    clearInterval(recTimerRef.current);
    const secs = recSecsRef.current;
    recSecsRef.current = 0;
    setIsRecording(false);
    setRecSeconds(0);
    try {
      await recordingRef.current?.stopAndUnloadAsync();
      const uri = recordingRef.current?.getURI();
      recordingRef.current = null;
      if (!uri) return;
      setAudioPreview({ uri, duration: secs });
    } catch (e) {
      console.log('stopRecording error:', e.message);
      recordingRef.current = null;
    }
  }

  async function sendAudioPreview() {
    if (!audioPreview) return;
    const preview = { ...audioPreview };
    setAudioPreview(null);
    flatRef.current?.scrollToOffset({ offset: 0, animated: true });
    setNewMsgIndicator(false);
    try {
      setUploading(true);
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      const token = await AsyncStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', { uri: preview.uri, type: 'audio/m4a', name: 'audio.m4a' });
      const BASE_URL = process.env.EXPO_PUBLIC_API_URL;
      const res = await fetch(`${BASE_URL}/chats/upload/audio`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
        body:    formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      socketRef.current?.emit('group:message', { groupId: group._id, text: '', type: 'audio', mediaUrl: data.url, audioDuration: preview.duration });
    } catch (e) { console.log('sendAudioPreview error:', e.message); }
    finally { setUploading(false); }
  }

  function cancelAudioPreview() { setAudioPreview(null); recordingRef.current = null; }

  const handleCinemaStateChange = useCallback(async (state) => {
    if (state === 'buffering') { cinemaBufferingRef.current = true; return; }
    if (state === 'playing' || state === 'paused') cinemaBufferingRef.current = false;
    if (state === 'paused')  cinemaPausedRef.current = true;
    if (state === 'playing') cinemaPausedRef.current = false;
    if (!isProyector) return;
    const now = Date.now();
    if (state !== 'paused' && now - lastSyncEmitRef.current < 500) return;
    lastSyncEmitRef.current = now;
    const currentTime = await playerRef.current?.getCurrentTime() ?? 0;
    socketRef.current?.emit('circle:cinema:sync', {
      groupId: group._id,
      action:  state === 'playing' ? 'play' : 'pause',
      currentTime,
    });
  }, [group._id, isProyector]);

  useEffect(() => {
    if (!cinemaVideoId || !isProyector) {
      clearInterval(cinemaIntervalRef.current);
      return;
    }
    clearInterval(cinemaIntervalRef.current);
    cinemaIntervalRef.current = setInterval(async () => {
      if (cinemaPausedRef.current) return;
      const now = Date.now();
      if (now - lastSyncEmitRef.current < 500) return;
      lastSyncEmitRef.current = now;
      const currentTime = await playerRef.current?.getCurrentTime() ?? 0;
      socketRef.current?.emit('circle:cinema:sync', { groupId: group._id, action: 'seek', currentTime });
    }, 8000);
    return () => clearInterval(cinemaIntervalRef.current);
  }, [cinemaVideoId, isProyector, group._id]);

  function handleCinemaStart() {
    if (cinemaStartingRef.current) return;
    cinemaStartingRef.current = true;
    const videoId = extractYoutubeId(cinemaYtUrl.trim());
    if (!videoId) {
      setCinemaUrlError('Link invalido. Pega un link de YouTube valido.');
      cinemaStartingRef.current = false;
      return;
    }
    setCinemaUrlError('');
    setShowCinemaInput(false);
    setCinemaYtUrl('');
    socketRef.current?.emit('circle:cinema:start', { groupId: group._id, videoId, startedBy: user.username });
    setProyector(group._id, group.imageUrl);
    cinemaStartingRef.current = false;
  }

  function handleCinemaStop() {
    socketRef.current?.emit('circle:cinema:stop', { groupId: group._id });
  }

  const blockedIds = (user?.blocked || []).map(b => (b._id || b)?.toString());

  const renderMessage = useCallback(({ item, index }) => {
    if (item.type === 'date_separator') {
      return (
        <View style={s.datePill}>
          <Text style={s.datePillTxt}>{item.label}</Text>
        </View>
      );
    }
    const isMe = (item.sender?._id || item.sender)?.toString() === user?._id?.toString();
    const nextItem = flatListData[index + 1];
    const prevMsg = nextItem?.type === 'date_separator' ? null : (nextItem ?? null);
    return (
      <MessageBubble
        msg={item}
        prevMsg={prevMsg}
        isMe={isMe}
        user={user}
        group={group}
        isAdmin={isAdmin}
        blockedIds={blockedIds}
        navigation={navigation}
        onOpenMenu={openMenu}
        onReply={setReplyTo}
        onFullImg={setFullImg}
        onGiftClaim={handleGroupGiftClaim}
      />
    );
  }, [flatListData, user, group, isAdmin, handleGroupGiftClaim]);

  const menuIsMe   = menuMsg && (menuMsg.sender?._id || menuMsg.sender)?.toString() === user?._id?.toString();
  const menuSender = menuMsg?.sender;

  // ─── Determinar si el input debe estar deshabilitado ─────────────────────
  const inputDisabled = isKicked || isBanned || !isMember;

  // ─── Validación gift modal ────────────────────────────────────────────────
  const giftCoinsNum    = parseInt(giftCoins) || 0;
  const giftSlotsNum    = parseInt(giftSlots) || 0;
  const giftCantidadNum = parseInt(giftCantidad) || 0;
  const maxSlots        = group?.members?.length || 99;
  const giftComision    = Math.round(giftCoinsNum * COMMISSION);
  const giftNeto        = giftCoinsNum - giftComision;
  const frameCost       = giftCantidadNum * FRAME_COST_PER_UNIT;
  const isGiftValid     = giftType === 'coins'
    ? giftCoinsNum > 0 && giftCoinsNum <= (user?.coins || 0) && giftSlotsNum >= 1 && giftSlotsNum <= maxSlots
    : !!giftFrame && giftCantidadNum >= 1
        && giftCantidadNum <= (giftFrame?.unidadesEnMano || 0)
        && frameCost <= (user?.coins || 0);

  return (
    <View style={s.root}>
        {/* ── Modal preview imagen ─────────────────────────────────────────────── */}
      <Modal visible={!!imagePreview} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setImagePreview(null)}>
        <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.92)', alignItems:'center', justifyContent:'center', padding:20 }}>
          {imagePreview && <Image source={{ uri: imagePreview }} style={{ width:'100%', height:'60%', borderRadius:16 }} resizeMode="contain" />}
          <View style={{ flexDirection:'row', gap:16, marginTop:20 }}>
            <TouchableOpacity onPress={() => setImagePreview(null)}
              style={{ flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:24, paddingVertical:12, borderRadius:24, borderWidth:1, borderColor:'rgba(239,68,68,0.4)', backgroundColor:'rgba(239,68,68,0.1)' }}>
              <Ionicons name="trash-outline" size={18} color="rgba(239,68,68,0.9)" />
              <Text style={{ color:'rgba(239,68,68,0.9)', fontWeight:'700', fontSize:13 }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={confirmSendImage} disabled={uploading}
              style={{ flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:24, paddingVertical:12, borderRadius:24, backgroundColor:'rgba(0,229,204,0.85)' }}>
              {uploading ? <ActivityIndicator size={16} color="#000" /> : <Ionicons name="send" size={18} color="#000" />}
              <Text style={{ color:'#000', fontWeight:'800', fontSize:13 }}>Enviar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Visor fullscreen ─────────────────────────────────────────────────── */}
      <Modal visible={!!fullImg} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setFullImg(null)}>
        <Pressable style={{ flex:1, backgroundColor:'rgba(0,0,0,0.95)', alignItems:'center', justifyContent:'center', marginBottom: -insets.bottom }} onPress={() => setFullImg(null)}>
          {fullImg && <Image source={{ uri: fullImg }} style={{ width:'95%', height:'70%', borderRadius:12 }} resizeMode="contain" />}
          <Text style={{ color:'rgba(255,255,255,0.4)', marginTop:16, fontSize:12 }}>Toca para cerrar</Text>
        </Pressable>
      </Modal>

      {/* ── Modal opciones del mensaje ───────────────────────────────────────── */}
      <Modal visible={menuVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={closeMenu}>
        <Pressable style={s.menuOverlay} onPress={closeMenu}>
          <Pressable style={[s.menuBox, { paddingBottom: Math.max(insets.bottom, 24) }]} onPress={e => e.stopPropagation()}>

            {/* Preview del mensaje */}
            <View style={s.menuPreview}>
              <Text style={s.menuPreviewName}>{menuIsMe ? 'Tu' : (menuSender?.username || '')}</Text>
              <Text style={s.menuPreviewTxt} numberOfLines={2}>
                {menuMsg?.type === 'image' ? 'Imagen' : menuMsg?.type === 'audio' ? 'Audio' : menuMsg?.type === 'shared_post' ? 'Post compartido' : menuMsg?.type === 'shared_profile' ? 'Perfil compartido' : (menuMsg?.text || '')}
              </Text>
            </View>

            {!banConfirm && !kickConfirm ? (
              <>
                {/* Responder */}
                <TouchableOpacity style={s.menuItem} onPress={() => { setReplyTo(menuMsg); closeMenu(); }}>
                  <Ionicons name="return-down-back-outline" size={18} color={colors.textHi} />
                  <Text style={s.menuItemTxt}>Responder</Text>
                </TouchableOpacity>

                {/* Borrar para todos */}
                {(menuIsMe || isAdmin) && (
                  <TouchableOpacity style={s.menuItem} onPress={() => handleDeleteMessage(menuMsg._id, true)}>
                    <Ionicons name="trash-outline" size={18} color="#ff4444" />
                    <Text style={[s.menuItemTxt, { color:'#ff4444' }]}>Borrar para todos</Text>
                  </TouchableOpacity>
                )}

                {/* Borrar para mi */}
                <TouchableOpacity style={s.menuItem} onPress={() => handleDeleteMessage(menuMsg._id, false)}>
                  <Ionicons name="eye-off-outline" size={18} color={colors.textDim} />
                  <Text style={[s.menuItemTxt, { color: colors.textDim }]}>Borrar para mi</Text>
                </TouchableOpacity>

                {/* Expulsar — solo admin, no es su propio mensaje */}
                {isAdmin && !menuIsMe && menuSender?.username && (
                  <TouchableOpacity
                    style={[s.menuItem, { borderTopWidth:1, borderTopColor:'#091525', marginTop:4 }]}
                    onPress={() => setKickConfirm(true)}>
                    <Ionicons name="exit-outline" size={18} color="#3a5570" />
                    <Text style={[s.menuItemTxt, { color: colors.textDim }]}>Expulsar a {menuSender.username}</Text>
                  </TouchableOpacity>
                )}

                {/* Banear — solo admin, no es su propio mensaje */}
                {isAdmin && !menuIsMe && menuSender?.username && (
                  <TouchableOpacity
                    style={[s.menuItem, { borderTopWidth:1, borderTopColor:'#091525', marginTop:4 }]}
                    onPress={() => setBanConfirm(true)}>
                    <Ionicons name="ban-outline" size={18} color="#ff4444" />
                    <Text style={[s.menuItemTxt, { color:'#ff4444' }]}>Banear a {menuSender.username}</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={[s.menuItem, s.menuCancel]} onPress={closeMenu}>
                  <Text style={[s.menuItemTxt, { color: colors.textDim, textAlign:'center', width:'100%' }]}>Cancelar</Text>
                </TouchableOpacity>
              </>

            ) : kickConfirm ? (
              /* Confirmacion de expulsion */
              <>
                <View style={{ padding:16, alignItems:'center', gap:8 }}>
                  <Text style={{ color:'rgba(255,165,0,0.9)', fontSize:16, fontWeight:'700' }}>Expulsar a {menuSender?.username}</Text>
                  <Text style={{ color: colors.textDim, fontSize:13, textAlign:'center' }}>
                    {group?.isCircle ? 'El usuario sera expulsado pero podra volver a unirse a la fiesta.' : 'El usuario sera expulsado pero podra volver a unirse al grupo.'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[s.menuItem, { backgroundColor:'rgba(255,165,0,0.1)' }]}
                  onPress={() => handleKickUser(menuSender?._id || menuSender, menuSender?.username)}>
                  <Ionicons name="exit-outline" size={18} color="rgba(255,165,0,0.9)" />
                  <Text style={[s.menuItemTxt, { color:'rgba(255,165,0,0.9)' }]}>Confirmar expulsion</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.menuItem, s.menuCancel]} onPress={() => setKickConfirm(false)}>
                  <Text style={[s.menuItemTxt, { color: colors.textDim, textAlign:'center', width:'100%' }]}>Atras</Text>
                </TouchableOpacity>
              </>

            ) : (
              /* Confirmacion de baneo */
              <>
                <View style={{ padding:16, alignItems:'center', gap:8 }}>
                  <Text style={{ color:'#ff4444', fontSize:16, fontWeight:'700' }}>Banear a {menuSender?.username}</Text>
                  <Text style={{ color: colors.textDim, fontSize:13, textAlign:'center' }}>
                    {group?.isCircle ? 'El usuario sera baneado y no podra volver a unirse a esta fiesta.' : 'El usuario sera baneado y no podra volver a unirse al grupo.'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[s.menuItem, { backgroundColor:'rgba(255,68,68,0.1)' }]}
                  onPress={() => handleBanUser(menuSender?._id || menuSender, menuSender?.username, false)}>
                  <Ionicons name="ban-outline" size={18} color="#ff4444" />
                  <Text style={[s.menuItemTxt, { color:'#ff4444' }]}>Banear</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.menuItem, { backgroundColor:'rgba(255,68,68,0.15)' }]}
                  onPress={() => handleBanUser(menuSender?._id || menuSender, menuSender?.username, true)}>
                  <Ionicons name="trash-outline" size={18} color="#ff4444" />
                  <Text style={[s.menuItemTxt, { color:'#ff4444' }]}>Banear y borrar todos sus mensajes</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.menuItem, s.menuCancel]} onPress={() => setBanConfirm(false)}>
                  <Text style={[s.menuItemTxt, { color: colors.textDim, textAlign:'center', width:'100%' }]}>Atras</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <ImageBackground
        source={!group.backgroundUrl ? null : group.backgroundUrl.startsWith('http') ? { uri: group.backgroundUrl } : require('../../assets/chat-bg.jpeg')}
        style={{ flex: 1, backgroundColor: '#020509' }}
        resizeMode="cover"
      >
        <View style={{ position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor: GROUP_BG_PRESETS[group.backgroundUrl] ?? 'rgba(2,5,9,0.6)' }} pointerEvents="none" />
        <StatusBar barStyle="light-content" backgroundColor="transparent" />

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <SafeAreaView edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.textHi} />
          </TouchableOpacity>
          <TouchableOpacity style={s.headerInfo}
            onPress={(isAdmin || isCoAdmin) ? () => navigation.navigate('GroupSettings', { group }) : undefined}>
            {group.imageUrl
              ? <Image source={{ uri: group.imageUrl }} style={s.groupAvatar} />
              : <View style={s.groupAvatarPlaceholder}><Ionicons name="people" size={18} color={colors.c1} /></View>}
            <View style={{ flex:1 }}>
              <Text style={s.groupName} numberOfLines={1}>{group.name}</Text>
              <Text style={s.groupMembers}>{group.members?.length || 0} miembros</Text>
            </View>
          </TouchableOpacity>
          {group.isCircle ? (
            <>
              {(() => {
                const last3 = [...new Map(
                  (group?.members || []).map(m => [m.user?._id?.toString(), m])
                ).values()].slice(-3);
                if (!last3.length) return null;
                return (
                  <View style={s.headerAvatarStack}>
                    {last3.map((m, idx) => {
                      const avatarUrl = m.user?.avatarUrl;
                      const initial   = (m.user?.username || '?')[0].toUpperCase();
                      return (
                        <View key={m.user?._id?.toString() || idx} style={[s.headerStackAvatar, idx > 0 && { marginLeft: -8 }]}>
                          {avatarUrl
                            ? <Image source={{ uri: avatarUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                            : <Text style={s.headerStackInitial}>{initial}</Text>}
                        </View>
                      );
                    })}
                  </View>
                );
              })()}
              {isAdmin && (
                <TouchableOpacity
                  style={s.settingsBtn}
                  onPress={() => {
                    const willDeactivate = group.isActive !== false;
                    Alert.alert(
                      willDeactivate ? 'Desactivar círculo' : 'Activar círculo',
                      willDeactivate ? `¿Desactivar "${group.name}"?` : `¿Activar "${group.name}"?`,
                      [
                        { text: 'Cancelar', style: 'cancel' },
                        {
                          text: willDeactivate ? 'Desactivar' : 'Activar',
                          style: willDeactivate ? 'destructive' : 'default',
                          onPress: async () => {
                            try {
                              const { data } = await api.patch(`/groups/circles/${group._id}/toggle-active`);
                              setGroup(prev => ({ ...prev, isActive: data.group.isActive }));
                            } catch {
                              Alert.alert('Error', 'No se pudo cambiar el estado del círculo');
                            }
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Ionicons name="power" size={20} color={group.isActive !== false ? '#22c55e' : 'rgba(239,68,68,0.85)'} />
                </TouchableOpacity>
              )}
              {(isAdmin || isCoAdmin) && (
                <TouchableOpacity onPress={() => navigation.navigate('GroupSettings', { group })} style={s.settingsBtn}>
                  <Image source={require('../../assets/chats/menu/ic_menu_settings_4.png')} style={{ width: 20, height: 20, resizeMode: 'contain' }} />
                </TouchableOpacity>
              )}
              {!(isAdmin || isCoAdmin) && (
                <TouchableOpacity onPress={() => setInfoVisible(true)} style={s.settingsBtn}>
                  <Image source={require('../../assets/market/icon_notice.png')} style={{ width: 28, height: 28, resizeMode: 'contain' }} />
                </TouchableOpacity>
              )}
            </>
          ) : (
            (isAdmin || isCoAdmin) && (
              <TouchableOpacity onPress={() => navigation.navigate('GroupSettings', { group })} style={s.settingsBtn}>
                <Ionicons name="settings" size={20} color="#ffffff" />
              </TouchableOpacity>
            )
          )}
        </View>
      </SafeAreaView>

      {/* ── Panel Sala de Cine ──────────────────────────────────────────────── */}
      {cinemaVideoId && (
        <View style={s.cinemaPanelOuter}>
          <View style={s.cinemaPanelHeader}>
            <Image source={require('../../assets/chats/Fiesta/ic_panel_screening_room.png')} style={{ width: 16, height: 16, marginRight: 6 }} />
            <Text style={s.cinemaPanelTitle}>Sala de Cine</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={() => setCinemaMinimized(v => !v)} activeOpacity={0.8} style={s.cinemaMiniBtn}>
              <Ionicons name={cinemaMinimized ? 'chevron-down' : 'chevron-up'} size={16} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
            {(isAdmin || isCoAdmin) && (
              <TouchableOpacity onPress={handleCinemaStop} activeOpacity={0.8} style={s.cinemaPowerBtn}>
                <Ionicons name="power" size={18} color="#ef4444" />
              </TouchableOpacity>
            )}
          </View>
          <View style={{ width: CINEMA_W, height: cinemaMinimized ? 0 : CINEMA_H, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <YoutubeIframe
              ref={playerRef}
              videoId={cinemaVideoId}
              height={CINEMA_H}
              width={CINEMA_W}
              play={cinemaPlaying}
              webViewStyle={{ opacity: 0.99 }}
              webViewProps={!isProyector ? { pointerEvents: 'none' } : undefined}
              onChangeState={handleCinemaStateChange}
              initialPlayerParams={{ controls: isProyector ? 1 : 0 }}
            />
            {!isProyector && (
              <View
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
                pointerEvents="box-only"
              />
            )}
          </View>
        </View>
      )}

      {/* ── Cuerpo ───────────────────────────────────────────────────────────── */}
      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
            <ActivityIndicator color={colors.c1} size="large" />
          </View>
        ) : (
          <FlatList
            ref={flatRef}
            style={{ flex: 1 }}
            data={flatListData}
            keyExtractor={(m) => String(m._id)}
            renderItem={renderMessage}
            contentContainerStyle={s.messageList}
            inverted
            removeClippedSubviews={true}
            windowSize={5}
            maxToRenderPerBatch={10}
            initialNumToRender={20}
            updateCellsBatchingPeriod={50}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets={true}
            onScroll={e => {
              const y = e.nativeEvent.contentOffset.y;
              scrollOffsetRef.current = y;
              setShowScrollBtn(y > 150);
              if (y < 100) setNewMsgIndicator(false);
            }}
            scrollEventThrottle={32}
            onEndReached={loadMoreGroupMessages}
            onEndReachedThreshold={0.2}
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            ListFooterComponent={loadingMore
              ? <View style={{ paddingVertical: 12, alignItems: 'center' }}><ActivityIndicator size="small" color={colors.c1} /></View>
              : null
            }
          />
        )}

        {/* ── Banner expulsado ── */}
        {isKicked && (
          <View style={s.kickedBanner}>
            <Ionicons name="exit-outline" size={18} color="rgba(255,165,0,0.9)" />
            <Text style={s.kickedBannerTxt}>Fuiste expulsado de este chat</Text>
            <View style={s.kickedBannerBtns}>
              <TouchableOpacity style={s.kickedBtnLeave} onPress={() => navigation.goBack()}>
                <Text style={s.kickedBtnLeaveTxt}>Salir</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.kickedBtnJoin} onPress={handleJoinGroup}>
                <Text style={s.kickedBtnJoinTxt}>Unirse</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Banner baneado ── */}
        {isBanned && (
          <View style={s.bannedBanner}>
            <Ionicons name="ban-outline" size={18} color="#ff4444" />
            <Text style={s.bannedBannerTxt}>
              {group?.isCircle ? 'Fuiste baneado de esta fiesta' : 'Fuiste baneado de este grupo'}
            </Text>
            <TouchableOpacity style={s.kickedBtnLeave} onPress={() => navigation.goBack()}>
              <Text style={s.kickedBtnLeaveTxt}>Salir</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Barra de union (solo fiestas, no-miembros) ── */}
        {group?.isCircle && !isMember && !isBanned && !isKicked && !dismissedJoinBar && groupLoaded && (
          <View style={s.circleJoinBar}>
            <Text style={s.circleJoinBarTxt}>¿Quieres unirte a esta fiesta?</Text>
            <TouchableOpacity style={s.circleJoinBarBtn} onPress={handleCircleJoin}>
              <Text style={s.circleJoinBarBtnTxt}>Unirme</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setDismissedJoinBar(true)} style={s.circleJoinBarDismiss}>
              <Text style={s.circleJoinBarDismissTxt}>No por ahora</Text>
            </TouchableOpacity>
          </View>
        )}


        {/* ── Banner invitación pendiente ── */}
        {isPending && (
          <View style={s.inviteBanner}>
            <Ionicons name="mail-outline" size={18} color={colors.c1} />
            <Text style={s.inviteBannerTxt}>{group?.isCircle ? 'Te invitaron a unirte a esta fiesta' : 'Te invitaron a unirte a este grupo'}</Text>
            <View style={s.inviteBannerBtns}>
              <TouchableOpacity style={s.inviteBtnDecline} onPress={handleDeclineInvite}>
                <Text style={s.inviteBtnDeclineTxt}>Salir</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.inviteBtnAccept} onPress={handleAcceptInvite}>
                <Text style={s.inviteBtnAcceptTxt}>Unirme</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Popup menciones + Input area ── */}
        {!isKicked && !isBanned && !isPending && (
          <View>
            {mentionSuggestions.length > 0 && (
              <View style={s.mentionPopup}>
                <FlatList
                  data={mentionSuggestions}
                  keyExtractor={m => String(m._id)}
                  keyboardShouldPersistTaps="always"
                  style={{ maxHeight: 200 }}
                  renderItem={({ item: m }) => (
                    <TouchableOpacity style={s.mentionRow} onPress={() => pickMention(m.username)}>
                      {m.special
                        ? <View style={s.mentionAvPlaceholder}><Ionicons name="megaphone-outline" size={14} color={colors.c1} /></View>
                        : m.avatarUrl
                          ? <Image source={{ uri: m.avatarUrl }} style={s.mentionAv} />
                          : <View style={s.mentionAvPlaceholder}><Text style={{ color: colors.c1, fontSize: 11, fontWeight: '700' }}>{m.username?.[0]?.toUpperCase()}</Text></View>
                      }
                      <Text style={s.mentionName}>{m.special ? '@todos — Mencionar a todos' : `@${m.username}`}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}
            <Animated.View style={{ marginBottom: keyboardOffset }}>
            <LinearGradient
              colors={kbVisible ? ['rgba(2,5,9,0.95)', '#050c14'] : ['transparent', 'rgba(2,5,9,0.85)', '#050c14']}
              locations={kbVisible ? [0, 1] : [0, 0.5, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={[s.inputContainer, { paddingBottom: insets.bottom }]}
            >
            {replyTo && (
              <View style={s.replyBar}>
                <View style={{ flex:1 }}>
                  <Text style={s.replyBarUser}>{replyTo.sender?.username || 'usuario'}</Text>
                  <Text style={s.replyBarTxt} numberOfLines={1}>{replyTo.text}</Text>
                </View>
                <TouchableOpacity onPress={() => setReplyTo(null)} style={{ padding:8 }}>
                  <Text style={{ color:'#888', fontSize:16 }}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
            {audioPreview ? (
              <View style={s.audioPreviewRow}>
                <TouchableOpacity onPress={cancelAudioPreview} style={s.audioPreviewCancel}>
                  <Ionicons name="trash-outline" size={18} color="rgba(239,68,68,0.8)" />
                </TouchableOpacity>
                <AudioMessage uri={audioPreview.uri} isMe={true} duration={audioPreview.duration} />
                <TouchableOpacity onPress={sendAudioPreview} disabled={uploading} style={s.audioPreviewSend}>
                  {uploading ? <ActivityIndicator size={16} color="#fff" /> : <Ionicons name="send" size={16} color="#fff" />}
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={[s.inputRow, inputDisabled && { opacity: 0.45 }]}>
                  <View style={s.inputWrap}>
                    <TextInput
                      style={s.input}
                      value={text}
                      onChangeText={handleTextChange}
                      placeholder={!isMember && group?.isCircle ? 'Únete para poder escribir...' : 'Mensaje...'}
                      placeholderTextColor={colors.textDim}
                      multiline
                      maxLength={2000}
                      blurOnSubmit={false}
                      onSubmitEditing={sendMessage}
                      editable={!inputDisabled}
                      onFocus={() => setCinemaMinimized(true)}
                      onBlur={() => setCinemaMinimized(false)}
                    />
                  </View>
                  <TouchableOpacity
                    style={[s.sendBtn, (!text.trim() || sending || inputDisabled) && s.sendBtnDisabled]}
                    onPress={sendMessage}
                    disabled={!text.trim() || sending || inputDisabled}>
                    <Ionicons name="send" size={16} color="#020509" />
                  </TouchableOpacity>
                </View>
                <View style={[s.mediaBtnRow, inputDisabled && { opacity: 0.45 }]}>
                  {isRecording ? (
                    <View style={s.recRow}>
                      <View style={s.recDot} />
                      <Text style={s.recTimer}>
                        {String(Math.floor(recSeconds/60)).padStart(2,'0')}:{String(recSeconds%60).padStart(2,'0')}
                      </Text>
                      <TouchableOpacity onPress={stopRecording} style={s.recStop}>
                        <Ionicons name="stop" size={14} color={colors.c1} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity onLongPress={startRecording} disabled={uploading} style={s.mediaBtn}>
                      <Image source={require('../../assets/chats/menu/icon_record_v2.png')} style={s.menuIcon} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={pickImage} disabled={uploading || isRecording} style={s.mediaBtn}>
                    {uploading
                      ? <ActivityIndicator size={16} color={colors.c1} />
                      : <Image source={require('../../assets/chats/menu/icon_image_small_v2.png')} style={s.menuIcon} />}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => {}} disabled={uploading || isRecording} style={s.mediaBtn}>
                    <Image source={require('../../assets/chats/menu/ic_menu_emoji_v2.png')} style={s.menuIcon} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => {}} disabled={uploading || isRecording} style={s.mediaBtn}>
                    <Image source={require('../../assets/chats/menu/icon_dice_v2.png')} style={s.menuIcon} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={openGiftModal} disabled={uploading || isRecording} style={s.mediaBtn}>
                    <Image source={require('../../assets/chats/menu/ic_menu_more_option_v2.png')} style={s.menuIcon} />
                  </TouchableOpacity>
                  {group?.isCircle && (isAdmin || isCoAdmin) && (
                    <TouchableOpacity onPress={() => setShowCinemaMenu(true)} disabled={uploading || isRecording} style={s.mediaBtn}>
                      <Image source={require('../../assets/chats/Fiesta/ic_panel_screening_room.png')} style={s.menuIcon} />
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
            </LinearGradient>
            </Animated.View>
          </View>
        )}
      </View>
      </ImageBackground>

      {(showScrollBtn || newMsgIndicator) && (
        <TouchableOpacity style={s.scrollDownBtn} onPress={() => {
          flatRef.current?.scrollToOffset({ offset: 0, animated: true });
          setNewMsgIndicator(false);
        }}>
          <Ionicons name="chevron-down" size={20} color={colors.c1} />
          {newMsgIndicator && <View style={s.newMsgDot} />}
        </TouchableOpacity>
      )}

      {/* ── Modal Regalo ─────────────────────────────────────────────────── */}
      <Modal visible={giftModal} transparent animationType="slide" statusBarTranslucent onRequestClose={() => { Keyboard.dismiss(); setGiftModal(false); }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={s.giftOverlay} onPress={() => { Keyboard.dismiss(); setGiftModal(false); }}>
          <Pressable style={s.giftSheet} onPress={() => {}}>
            <View style={s.giftHandle} />

            {/* Header */}
            <View style={s.giftHead}>
              <View style={s.giftHeadLeft}>
                <View style={s.giftHeaderIcon}>
                  <Ionicons name="gift" size={17} color={colors.c2} />
                </View>
                <Text style={s.giftTitle}>Enviar Regalo</Text>
              </View>
              <TouchableOpacity onPress={() => { Keyboard.dismiss(); setGiftModal(false); }} style={s.giftCloseBtn}>
                <Ionicons name="close" size={20} color={colors.textDim} />
              </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={s.giftTabs}>
              <TouchableOpacity
                style={[s.giftTab, giftType === 'coins' && s.giftTabActive]}
                onPress={() => { setGiftType('coins'); setGiftFrame(null); setGiftErr(''); }}
              >
                <CoinIcon size={13} />
                <Text style={[s.giftTabTxt, giftType === 'coins' && s.giftTabTxtActive]}>Monedas</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.giftTab, giftType === 'frame' && s.giftTabActive]}
                onPress={() => { setGiftType('frame'); setGiftErr(''); }}
              >
                <Ionicons name="image-outline" size={13} color={giftType === 'frame' ? colors.c2 : colors.textDim} />
                <Text style={[s.giftTabTxt, giftType === 'frame' && s.giftTabTxtActive]}>Marco</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {giftType === 'coins' ? (
                <>
                  {/* Input de monedas */}
                  <View style={s.giftCoinsRow}>
                    <CoinIcon size={26} />
                    <TextInput
                      style={s.giftCoinsInput}
                      value={giftCoins}
                      onChangeText={v => { setGiftCoins(v.replace(/[^0-9]/g, '')); setGiftErr(''); }}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.textDim}
                    />
                  </View>

                  {/* Saldo */}
                  <View style={s.giftBalanceRow}>
                    <Ionicons name="wallet-outline" size={11} color={colors.textDim} />
                    <Text style={s.giftBalanceTxt}>Saldo disponible: </Text>
                    <CoinIcon size={11} />
                    <Text style={s.giftBalanceTxt}> {formatCoins(user?.coins)}</Text>
                  </View>

                  {/* Desglose comisión */}
                  {giftCoinsNum > 0 && (
                    <View style={s.giftBreakdown}>
                      <View style={s.giftBreakRow}>
                        <Text style={s.giftBreakLbl}>Comisión (15%)</Text>
                        <View style={{ flexDirection:'row', alignItems:'center', gap:3 }}>
                          <Text style={[s.giftBreakVal, { color: colors.c4 }]}>-</Text>
                          <CoinIcon size={11} />
                          <Text style={[s.giftBreakVal, { color: colors.c4 }]}>{giftComision}</Text>
                        </View>
                      </View>
                      <View style={[s.giftBreakRow, s.giftBreakRowTotal]}>
                        <Text style={s.giftBreakLblBold}>Recibirán en total</Text>
                        <View style={{ flexDirection:'row', alignItems:'center', gap:3 }}>
                          <CoinIcon size={11} />
                          <Text style={[s.giftBreakVal, { color: colors.c1, fontWeight:'800' }]}>{giftNeto}</Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Slots */}
                  <Text style={s.giftFieldLbl}>Número de receptores</Text>
                  <View style={s.giftInputRow}>
                    <Ionicons name="people-outline" size={16} color={colors.textDim} />
                    <TextInput
                      style={s.giftInputField}
                      value={giftSlots}
                      onChangeText={v => { setGiftSlots(v.replace(/[^0-9]/g, '')); setGiftErr(''); }}
                      keyboardType="numeric"
                      placeholder={`Mín. 1 · Máx. ${maxSlots}`}
                      placeholderTextColor={colors.textDim}
                    />
                  </View>
                  {giftSlotsNum >= 1 && giftCoinsNum > 0 && (
                    <Text style={s.giftHint}>
                      Cada usuario recibirá aprox. {Math.round(giftNeto / giftSlotsNum * 100) / 100} coins
                    </Text>
                  )}
                </>
              ) : (
                <>
                  {/* Grid de marcos */}
                  <Text style={s.giftFieldLbl}>Selecciona un marco</Text>
                  {giftInvLoad ? (
                    <ActivityIndicator color={colors.c1} style={{ marginVertical: 16 }} />
                  ) : giftInv.length === 0 ? (
                    <View style={s.giftNoFrames}>
                      <Ionicons name="image-outline" size={22} color={colors.textDim} />
                      <Text style={s.giftNoFramesTxt}>No tienes marcos en tu inventario</Text>
                    </View>
                  ) : (
                    <FlatList
                      horizontal
                      data={giftInv}
                      keyExtractor={item => (item.frame || item)._id}
                      showsHorizontalScrollIndicator={false}
                      initialNumToRender={4}
                      maxToRenderPerBatch={4}
                      windowSize={5}
                      contentContainerStyle={{ gap:8, paddingBottom:4 }}
                      style={{ marginBottom:12 }}
                      renderItem={({ item }) => {
                        const fr  = item.frame || item;
                        const sel = giftFrame && (giftFrame.frame || giftFrame)._id === fr._id;
                        return (
                          <TouchableOpacity
                            style={[s.giftFrameThumb, sel && s.giftFrameThumbSel]}
                            onPress={() => { setGiftFrame(item); setGiftErr(''); }}
                            activeOpacity={0.8}
                          >
                            <View style={s.giftFramePreview}>
                              {fr.imageUrl
                                ? <Image source={{ uri: fr.imageUrl }} style={{ width:54, height:54 }} resizeMode="contain" />
                                : <Ionicons name="image-outline" size={18} color={colors.textDim} />}
                              {sel && (
                                <View style={s.giftFrameCheckOverlay}>
                                  <Ionicons name="checkmark-circle" size={16} color={colors.c2} />
                                </View>
                              )}
                            </View>
                            <Text style={s.giftFrameName} numberOfLines={1}>{fr.name}</Text>
                            <Text style={s.giftFrameUnits}>×{item.unidadesEnMano}</Text>
                          </TouchableOpacity>
                        );
                      }}
                    />
                  )}

                  {/* Advertencia marco activo */}
                  {giftFrame && (giftFrame.frame || giftFrame)?._id === user?.profileFrame && (
                    <View style={s.giftWarnBox}>
                      <Ionicons name="warning-outline" size={13} color={colors.c4} />
                      <Text style={s.giftWarnTxt}>Este marco será retirado de tu perfil al enviarlo</Text>
                    </View>
                  )}

                  {/* Input unidades */}
                  {!!giftFrame && (
                    <>
                      <Text style={s.giftFieldLbl}>Unidades a repartir</Text>
                      <View style={s.giftInputRow}>
                        <Ionicons name="layers-outline" size={16} color={colors.textDim} />
                        <TextInput
                          style={s.giftInputField}
                          value={giftCantidad}
                          onChangeText={v => { setGiftCantidad(v.replace(/[^0-9]/g, '')); setGiftErr(''); }}
                          keyboardType="numeric"
                          placeholder={`Máx. ${giftFrame?.unidadesEnMano || 0}`}
                          placeholderTextColor={colors.textDim}
                        />
                      </View>

                      {/* Costo de transferencia */}
                      {giftCantidadNum > 0 && (
                        <View style={s.giftBreakdown}>
                          <View style={s.giftBreakRow}>
                            <Text style={s.giftBreakLbl}>Costo de transferencia</Text>
                            <View style={{ flexDirection:'row', alignItems:'center', gap:3 }}>
                              <CoinIcon size={11} />
                              <Text style={s.giftBreakVal}>{frameCost}</Text>
                            </View>
                          </View>
                          <Text style={s.giftHint}>
                            {FRAME_COST_PER_UNIT} coins por unidad · {giftCantidadNum} {giftCantidadNum === 1 ? 'usuario recibe' : 'usuarios reciben'} 1 unidad
                          </Text>
                        </View>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Mensaje */}
              <Text style={[s.giftFieldLbl, { marginTop: 14 }]}>Mensaje</Text>
              <TextInput
                style={s.giftMsgInput}
                value={giftMsg}
                onChangeText={setGiftMsg}
                placeholder="Escribe un mensaje (opcional)"
                placeholderTextColor={colors.textDim}
                multiline
                maxLength={200}
                textAlignVertical="top"
              />

              {/* Error */}
              {!!giftErr && (
                <View style={s.giftErrBox}>
                  <Ionicons name="alert-circle-outline" size={14} color={colors.c4} />
                  <Text style={s.giftErrTxt}>{giftErr}</Text>
                </View>
              )}

              {/* Botón enviar */}
              <TouchableOpacity
                style={[s.giftSendBtn, (!isGiftValid || sendingGift) && s.giftSendBtnDisabled]}
                onPress={sendGroupGift}
                disabled={!isGiftValid || sendingGift}
              >
                {sendingGift
                  ? <ActivityIndicator size={16} color={colors.black} />
                  : (
                    <>
                      <Ionicons name="gift" size={16} color={!isGiftValid ? colors.textDim : colors.black} />
                      <Text style={[s.giftSendTxt, !isGiftValid && { color: colors.textDim }]}>Enviar Regalo</Text>
                    </>
                  )}
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Visor de imagen de la fiesta ─────────────────────────────────── */}
      <Modal visible={imgViewerVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setImgViewerVisible(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' }} onPress={() => setImgViewerVisible(false)}>
          {group.imageUrl && <Image source={{ uri: group.imageUrl }} style={{ width: '100%', height: '75%' }} resizeMode="contain" />}
          <TouchableOpacity style={{ position: 'absolute', top: 52, right: 16, padding: 8 }} onPress={() => setImgViewerVisible(false)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </Pressable>
      </Modal>

      {/* ── Modal info fiesta (no-admin) ──────────────────────────────────── */}
      <Modal visible={infoVisible} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setInfoVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(2,13,26,0.97)' }} edges={['top', 'bottom']}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' }}>
            <TouchableOpacity onPress={() => setInfoVisible(false)} style={s.settingsBtn}>
              <Ionicons name="close" size={22} color={colors.textHi} />
            </TouchableOpacity>
            <Text style={{ flex: 1, color: colors.textHi, fontSize: 16, fontWeight: '700', textAlign: 'center' }}>Información</Text>
            <TouchableOpacity onPress={() => { setInfoVisible(false); setReportVisible(true); }} style={s.settingsBtn}>
              <Ionicons name="flag-outline" size={20} color={colors.textDim} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 22 }}>
            {/* Logo + nombre + descripción */}
            <View style={{ alignItems: 'center', gap: 12 }}>
              <TouchableOpacity onPress={() => group.imageUrl && setImgViewerVisible(true)} activeOpacity={group.imageUrl ? 0.8 : 1}>
                {group.imageUrl
                  ? <Image source={{ uri: group.imageUrl }} style={{ width: 100, height: 100, borderRadius: 12, borderWidth: 2, borderColor: '#ffffff' }} />
                  : <View style={{ width: 100, height: 100, borderRadius: 12, backgroundColor: 'rgba(0,229,204,0.1)', borderWidth: 2, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="people" size={44} color={colors.c1} />
                    </View>
                }
              </TouchableOpacity>
              <Text style={{ color: colors.textHi, fontSize: 20, fontWeight: '800', textAlign: 'center' }}>{group.name}</Text>
              {!!group.description && (
                <Text style={{ color: colors.textMid, fontSize: 13, textAlign: 'center', lineHeight: 19 }}>{group.description}</Text>
              )}
            </View>

            {/* Reglas */}
            {group.rules?.length > 0 && (
              <View style={{ gap: 10 }}>
                <Text style={{ color: colors.textHi, fontSize: 14, fontWeight: '700' }}>Reglas</Text>
                {group.rules.map((rule, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                    <Text style={{ color: colors.c1, fontWeight: '700', fontSize: 13, minWidth: 18 }}>{i + 1}.</Text>
                    <View style={{ flex: 1 }}>
                      {!!rule.title && <Text style={{ color: colors.textHi, fontSize: 13, fontWeight: '600' }}>{rule.title}</Text>}
                      {!!rule.description && <Text style={{ color: colors.textMid, fontSize: 12, marginTop: 2 }}>{rule.description}</Text>}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Administradores (fila horizontal) */}
            {(() => {
              const admins = (group.members || []).filter(m => m.role === 'admin' || m.role === 'co-admin');
              if (!admins.length) return null;
              return (
                <View style={{ gap: 10 }}>
                  <Text style={{ color: colors.textHi, fontSize: 14, fontWeight: '700' }}>Administradores</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
                    {admins.map((m, i) => {
                      const mu = m.user?.username ? m.user : null;
                      return (
                        <View key={mu?._id || i} style={{ alignItems: 'center', gap: 4, width: 76 }}>
                          <AvatarWithFrame size={44} avatarUrl={mu?.avatarUrl} username={mu?.username || '?'} profileFrame={mu?.profileFrame} frameUrl={mu?.profileFrameUrl} />
                          <Text style={{ color: colors.textHi, fontSize: 11, fontWeight: '600', textAlign: 'center' }} numberOfLines={1}>{mu?.username || '?'}</Text>
                          <View style={[m.role === 'admin' ? s.adminBadge : s.coAdminBadge, { marginLeft: 0, flexShrink: 0 }]}>
                            <Text style={m.role === 'admin' ? s.adminBadgeTxt : s.coAdminBadgeTxt} numberOfLines={1}>{m.role === 'admin' ? 'Admin' : 'Co-admin'}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              );
            })()}

            {/* Miembros normales — grid horizontal */}
            {(() => {
              const regulars = (group.members || []).filter(m => m.role === 'member');
              if (!regulars.length) return null;
              const visible = regulars.slice(0, 8);
              const extra = regulars.length - 8;
              return (
                <View style={{ gap: 10 }}>
                  <Text style={{ color: colors.textHi, fontSize: 14, fontWeight: '700' }}>{regulars.length} miembro{regulars.length !== 1 ? 's' : ''}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
                    {visible.map((m, i) => {
                      const mu = m.user?.username ? m.user : null;
                      return (
                        <View key={mu?._id || i} style={{ alignItems: 'center', gap: 4, width: 60 }}>
                          <AvatarWithFrame size={40} avatarUrl={mu?.avatarUrl} username={mu?.username || '?'} profileFrame={mu?.profileFrame} frameUrl={mu?.profileFrameUrl} />
                          <Text style={{ color: colors.textHi, fontSize: 10, textAlign: 'center' }} numberOfLines={1}>{mu?.username || '?'}</Text>
                        </View>
                      );
                    })}
                    {extra > 0 && (
                      <TouchableOpacity
                        onPress={() => { setMemberSearch(''); setAllMembersVisible(true); }}
                        style={{ alignItems: 'center', justifyContent: 'center', width: 60, gap: 4 }}
                      >
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,229,204,0.1)', borderWidth: 1, borderColor: 'rgba(0,229,204,0.3)', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: colors.c1, fontSize: 11, fontWeight: '700' }}>+{extra}</Text>
                        </View>
                        <Text style={{ color: colors.c1, fontSize: 10, textAlign: 'center' }}>Ver todos</Text>
                      </TouchableOpacity>
                    )}
                  </ScrollView>
                </View>
              );
            })()}

            {/* Botón salir */}
            {isMember && !(isAdmin && (group.members || []).filter(m => m.role === 'admin').length === 1) && (
              <TouchableOpacity
                onPress={() => Alert.alert(
                  'Salir de la fiesta',
                  `¿Seguro que quieres salir de "${group.name}"?`,
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Salir', style: 'destructive', onPress: () => { setInfoVisible(false); handleLeaveWelcome(); } },
                  ]
                )}
                style={{ marginTop: 8, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.45)', backgroundColor: 'rgba(239,68,68,0.08)', alignItems: 'center' }}
              >
                <Text style={{ color: 'rgba(239,68,68,0.9)', fontSize: 14, fontWeight: '700' }}>Salir de la fiesta</Text>
              </TouchableOpacity>
            )}

            <View style={{ height: 8 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── Modal "Ver todos los miembros" ─────────────────────────────── */}
      <Modal visible={allMembersVisible} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setAllMembersVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(2,13,26,0.97)' }} edges={['top', 'bottom']}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' }}>
            <TouchableOpacity onPress={() => setAllMembersVisible(false)} style={s.settingsBtn}>
              <Ionicons name="close" size={22} color={colors.textHi} />
            </TouchableOpacity>
            <Text style={{ flex: 1, color: colors.textHi, fontSize: 16, fontWeight: '700', textAlign: 'center' }}>Miembros</Text>
            <View style={{ width: 34 }} />
          </View>
          <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
            <TextInput
              value={memberSearch}
              onChangeText={setMemberSearch}
              placeholder="Buscar por username..."
              placeholderTextColor={colors.textDim}
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: colors.textHi, fontSize: 13 }}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}>
            {(group.members || [])
              .filter(m => m.role === 'member')
              .filter(m => !memberSearch || (m.user?.username || '').toLowerCase().includes(memberSearch.toLowerCase()))
              .map((m, i) => {
                const mu = m.user?.username ? m.user : null;
                return (
                  <View key={mu?._id || i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <AvatarWithFrame size={38} avatarUrl={mu?.avatarUrl} username={mu?.username || '?'} profileFrame={mu?.profileFrame} frameUrl={mu?.profileFrameUrl} />
                    <Text style={{ flex: 1, color: colors.textHi, fontSize: 13, fontWeight: '500' }}>{mu?.username || 'Usuario'}</Text>
                  </View>
                );
              })}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <ReportModal
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        type="group"
        targetId={group._id}
        targetName={group.name}
      />

      {/* ── Menu Sala de Cine ─────────────────────────────────────────────── */}
      <Modal visible={showCinemaMenu} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setShowCinemaMenu(false)}>
        <Pressable style={s.menuOverlay} onPress={() => setShowCinemaMenu(false)}>
          <Pressable style={[s.cinemaMenuSheet, { paddingBottom: Math.max(insets.bottom, 20) }]} onPress={e => e.stopPropagation()}>
            <View style={s.giftHandle} />
            <Text style={s.cinemaMenuTitle}>Actividades</Text>

            <TouchableOpacity style={s.cinemaMenuItem} onPress={() => { setShowCinemaMenu(false); setShowCinemaInput(true); setCinemaYtUrl(''); setCinemaUrlError(''); }} activeOpacity={0.8}>
              <Image source={require('../../assets/chats/Fiesta/ic_panel_screening_room.png')} style={{ width: 28, height: 28, resizeMode: 'contain' }} />
              <Text style={s.cinemaMenuItemTxt}>Sala de Cine</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.cinemaMenuItem} onPress={() => { setShowCinemaMenu(false); Alert.alert('Proximo', 'Esta funcion estara disponible pronto.'); }} activeOpacity={0.8}>
              <Ionicons name="person-outline" size={22} color={colors.textHi} />
              <Text style={s.cinemaMenuItemTxt}>Rol</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.cinemaMenuItem} onPress={() => { setShowCinemaMenu(false); Alert.alert('Proximo', 'Esta funcion estara disponible pronto.'); }} activeOpacity={0.8}>
              <Ionicons name="musical-notes-outline" size={22} color={colors.textHi} />
              <Text style={s.cinemaMenuItemTxt}>Karaoke</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[s.menuItem, s.menuCancel, { marginTop: 8 }]} onPress={() => setShowCinemaMenu(false)}>
              <Text style={[s.menuItemTxt, { color: colors.textDim, textAlign: 'center', width: '100%' }]}>Cancelar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Modal input YouTube ───────────────────────────────────────────── */}
      <Modal visible={showCinemaInput} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setShowCinemaInput(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={s.cinemaInputOverlay} onPress={() => { Keyboard.dismiss(); setShowCinemaInput(false); }}>
            <Pressable style={[s.cinemaInputBox, { paddingBottom: Math.max(insets.bottom, 20) }]} onPress={e => e.stopPropagation()}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <Image source={require('../../assets/chats/Fiesta/ic_panel_screening_room.png')} style={{ width: 24, height: 24, resizeMode: 'contain' }} />
                <Text style={s.cinemaInputTitle}>Sala de Cine</Text>
              </View>
              <Text style={s.cinemaInputLabel}>Link de YouTube</Text>
              <TextInput
                style={s.cinemaUrlInput}
                value={cinemaYtUrl}
                onChangeText={v => { setCinemaYtUrl(v); setCinemaUrlError(''); }}
                placeholder="https://youtube.com/watch?v=..."
                placeholderTextColor={colors.textDim}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              {!!cinemaUrlError && (
                <Text style={s.cinemaUrlError}>{cinemaUrlError}</Text>
              )}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity style={s.cinemaInputCancel} onPress={() => setShowCinemaInput(false)} activeOpacity={0.8}>
                  <Text style={s.cinemaInputCancelTxt}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.cinemaInputStart} onPress={handleCinemaStart} activeOpacity={0.8}>
                  <Text style={s.cinemaInputStartTxt}>Iniciar</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex:1, backgroundColor: colors.black },

  header:      { flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:12, gap:12 },
  backBtn:     { width:36, height:36, borderRadius:10, backgroundColor:'rgba(255,255,255,0.08)', alignItems:'center', justifyContent:'center' },
  settingsBtn: { padding:6 },
  headerInfo:  { flex:1, flexDirection:'row', alignItems:'center', gap:10 },
  groupAvatar:            { width:38, height:38, borderRadius:10 },
  groupAvatarPlaceholder: { width:38, height:38, borderRadius:10, backgroundColor: colors.surface, borderWidth:1, borderColor: colors.borderC, alignItems:'center', justifyContent:'center' },
  groupName:    { color: colors.textHi, fontSize:14, fontWeight:'700' },
  groupMembers: { color: colors.textDim, fontSize:11 },

  messageList:    { paddingHorizontal:16, paddingVertical:12, gap:4 },
  msgRow:         { flexDirection:'row', alignItems:'flex-end', gap:8, marginBottom:2 },
  msgRowMe:       { flexDirection:'row-reverse' },
  msgSenderRow:   { flexDirection:'row', alignItems:'center', gap:6, marginLeft: AVATAR_SLOT + 8, marginBottom:4 },
  msgSenderRowMe: { flexDirection:'row-reverse', marginLeft:0, marginRight: AVATAR_SLOT + 8, marginBottom:4 },
  msgSenderName:  { color:'rgba(255,255,255,0.65)', fontSize:11, fontWeight:'700' },
  adminBadge:     { backgroundColor:'rgba(0,200,150,0.15)', borderWidth:1, borderColor:'rgba(0,200,150,0.6)', borderRadius:6, paddingHorizontal:5, paddingVertical:1, marginLeft:5 },
  adminBadgeTxt:  { fontSize:9, color:'#00c896', fontWeight:'700', letterSpacing:0.3 },
  coAdminBadge:   { backgroundColor:'rgba(0,200,150,0.15)', borderWidth:1, borderColor:'rgba(0,200,150,0.6)', borderRadius:6, paddingHorizontal:5, paddingVertical:1, marginLeft:5 },
  coAdminBadgeTxt:{ fontSize:9, color:'#00c896', fontWeight:'700', letterSpacing:0.3 },
  platformAdminBadge:    { backgroundColor:'rgba(239,68,68,0.1)', borderRadius:4, borderWidth:1, borderColor:'rgba(239,68,68,0.35)', paddingHorizontal:4, paddingVertical:1 },
  platformAdminBadgeTxt: { color:'#ef4444', fontSize:7.5, fontWeight:'800', letterSpacing:0.3 },
  platformModBadge:      { backgroundColor:'rgba(251,191,36,0.1)', borderRadius:4, borderWidth:1, borderColor:'rgba(251,191,36,0.35)', paddingHorizontal:4, paddingVertical:1 },
  platformModBadgeTxt:   { color:'#fbbf24', fontSize:7.5, fontWeight:'800', letterSpacing:0.3 },
  platformCollabBadge:    { backgroundColor:'rgba(167,139,250,0.1)', borderRadius:4, borderWidth:1, borderColor:'rgba(167,139,250,0.35)', paddingHorizontal:4, paddingVertical:1 },
  platformCollabBadgeTxt: { color:'#a78bfa', fontSize:7.5, fontWeight:'800', letterSpacing:0.3 },

  bubble:      { maxWidth:'75%', borderRadius:10, padding:12, borderWidth:1, gap:4 },
  bubbleMe:    { backgroundColor:'#0d2137', borderWidth:0 },
  bubbleThem:  { backgroundColor: colors.surface, borderWidth:0 },
  bubblePost:  { padding:0, backgroundColor:'transparent', borderColor:'transparent', borderWidth:0 },
  bubbleGift:  { backgroundColor:'rgba(2,5,9,0.75)', borderRadius:16, padding:12, borderWidth:1, borderColor:'rgba(0,229,204,0.2)', maxWidth:'90%' },
  bubbleImage: { padding:0, backgroundColor:'transparent', borderColor:'transparent', borderWidth:0 },
  bubbleText:  { color:'#ffffff', fontSize:14, lineHeight:20 },
  bubbleTime:  { color:'rgba(255,255,255,0.4)', fontSize:9, alignSelf:'flex-end' },

  sysRow: { alignItems:'center', marginVertical:4 },
  sysTxt: { color:'rgba(255,255,255,0.7)', fontSize:11, backgroundColor:'rgba(2,5,9,0.65)', borderRadius:12, paddingHorizontal:12, paddingVertical:5, alignSelf:'center', textAlign:'center' },

  datePill:    { alignSelf:'center', backgroundColor:'rgba(2,5,9,0.55)', borderRadius:10, paddingHorizontal:14, paddingVertical:4, marginVertical:10, borderWidth:1, borderColor:'rgba(255,255,255,0.08)' },
  datePillTxt: { color:'rgba(255,255,255,0.6)', fontSize:11, fontWeight:'500' },

  inputContainer:  { paddingTop: 20, paddingHorizontal: 12 },
  inputRow:        { flexDirection:'row', alignItems:'center', paddingHorizontal:0, paddingVertical:6, gap:8 },
  inputWrap:       { flex:1, flexDirection:'row', alignItems:'center', backgroundColor:'#080f18', borderRadius:12, borderWidth:1, borderColor: colors.border },
  mediaBtnRow:     { flexDirection:'row', gap:12, paddingVertical:10, paddingHorizontal:4 },
  mediaBtn:        { padding:8, justifyContent:'center', alignItems:'center' },
  input:           { flex:1, paddingHorizontal:14, paddingVertical:10, color: colors.textHi, fontSize:14, maxHeight:100 },
  sendBtn:         { width:42, height:42, borderRadius:12, backgroundColor: colors.c1, alignItems:'center', justifyContent:'center', flexShrink:0 },
  sendBtnDisabled: { opacity:0.4 },

  recRow:  { flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:8 },
  recDot:  { width:8, height:8, borderRadius:4, backgroundColor:'rgba(239,68,68,0.9)' },
  recTimer:{ color: colors.c1, fontSize:13, fontWeight:'700', minWidth:38 },
  recStop: { width:28, height:28, borderRadius:14, backgroundColor:'rgba(239,68,68,0.8)', alignItems:'center', justifyContent:'center' },

  replyBar:     { flexDirection:'row', alignItems:'center', backgroundColor:'transparent', paddingHorizontal:12, paddingVertical:8, borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.06)' },
  replyBarUser: { color: colors.c1, fontSize:11, fontWeight:'700' },
  replyBarTxt:  { color:'rgba(255,255,255,0.4)', fontSize:12 },
  replyPreview: { backgroundColor:'rgba(0,229,204,0.08)', borderLeftWidth:3, borderLeftColor:colors.c1, borderRadius:8, paddingHorizontal:10, paddingVertical:6, marginBottom:6 },
  replyUser:    { color: colors.c1, fontSize:10, fontWeight:'700' },
  replyText:    { color:'rgba(255,255,255,0.55)', fontSize:11 },

  audioPreviewRow:    { flexDirection:'row', alignItems:'center', justifyContent:'center', paddingHorizontal:16, paddingVertical:10, gap:12, borderTopWidth:1, borderTopColor:'rgba(255,255,255,0.06)', backgroundColor: colors.surface },
  audioPreviewCancel: { width:36, height:36, borderRadius:18, backgroundColor:'rgba(239,68,68,0.1)', borderWidth:1, borderColor:'rgba(239,68,68,0.3)', alignItems:'center', justifyContent:'center' },
  audioPreviewSend:   { width:36, height:36, borderRadius:18, backgroundColor:'rgba(0,229,204,0.8)', alignItems:'center', justifyContent:'center' },
  scrollDownBtn:      { position:'absolute', bottom:260, right:16, width:38, height:38, borderRadius:19, backgroundColor: colors.surface, borderWidth:1, borderColor: colors.borderC, alignItems:'center', justifyContent:'center', elevation:5 },
  newMsgDot:          { position:'absolute', top:6, right:6, width:8, height:8, borderRadius:4, backgroundColor: colors.c1 },

  menuOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.65)', justifyContent:'flex-end' },
  menuBox:     { backgroundColor: colors.surface, borderTopLeftRadius:20, borderTopRightRadius:20, paddingBottom:24, borderWidth:1, borderColor: colors.borderC, overflow:'hidden' },
  menuPreview: { padding:16, borderBottomWidth:1, borderBottomColor: colors.border, backgroundColor:'rgba(255,255,255,0.03)' },
  menuPreviewName: { color: colors.c1, fontSize:11, fontWeight:'700', marginBottom:3 },
  menuPreviewTxt:  { color: colors.textDim, fontSize:12 },
  menuItem:    { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:20, paddingVertical:15 },
  menuItemTxt: { color: colors.textHi, fontSize:15, fontWeight:'500', flex:1 },
  menuCancel:  { marginTop:4, borderTopWidth:1, borderTopColor: colors.border, justifyContent:'center' },

  // Banner expulsado
  kickedBanner: { flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, paddingVertical:14, paddingHorizontal:16, backgroundColor:'rgba(255,165,0,0.08)', borderTopWidth:1, borderTopColor:'rgba(255,165,0,0.3)' },
  kickedBannerTxt: { color:'rgba(255,165,0,0.9)', fontSize:14, fontWeight:'700', textAlign:'center' },
  kickedBannerBtns: { flexDirection:'row', gap:12, marginTop:4 },
  kickedBtnLeave: { paddingHorizontal:24, paddingVertical:8, borderRadius:20, borderWidth:1, borderColor:'rgba(255,255,255,0.2)', backgroundColor:'rgba(255,255,255,0.06)' },
  kickedBtnLeaveTxt: { color: colors.textDim, fontSize:13, fontWeight:'600' },
  kickedBtnJoin: { paddingHorizontal:24, paddingVertical:8, borderRadius:20, backgroundColor:'rgba(0,229,204,0.15)', borderWidth:1, borderColor:'rgba(0,229,204,0.4)' },
  kickedBtnJoinTxt: { color: colors.c1, fontSize:13, fontWeight:'700' },

  // Banner únete a la fiesta
  circleJoinBar:        { flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:14, paddingVertical:9, backgroundColor:'rgba(0,229,204,0.04)', borderTopWidth:1, borderTopColor:'rgba(0,229,204,0.25)' },
  circleJoinBarTxt:     { flex:1, color: colors.textMid, fontSize:12 },
  circleJoinBarBtn:     { borderRadius:8, borderWidth:1, borderColor:'rgba(0,229,204,0.4)', backgroundColor:'rgba(0,229,204,0.12)', paddingHorizontal:12, paddingVertical:6 },
  circleJoinBarBtnTxt:  { color: colors.c1, fontSize:12, fontWeight:'700' },
  circleJoinBarDismiss: { paddingHorizontal:8, paddingVertical:6 },
  circleJoinBarDismissTxt: { color: colors.textDim, fontSize:12 },


  // Popup menciones
  mentionPopup: {
    maxHeight: 200,
    overflow: 'hidden',
    backgroundColor: '#0b1521',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  mentionRow:   { flexDirection:'row', alignItems:'center', gap:10, paddingHorizontal:14, paddingVertical:10, borderBottomWidth:1, borderBottomColor: colors.border },
  mentionAv:    { width:28, height:28, borderRadius:14 },
  mentionAvPlaceholder: { width:28, height:28, borderRadius:14, backgroundColor:'rgba(0,229,204,0.1)', borderWidth:1, borderColor:'rgba(0,229,204,0.25)', alignItems:'center', justifyContent:'center' },
  mentionName:  { color: colors.textHi, fontSize:13, fontWeight:'600' },

  // Banner baneado
  bannedBanner: { flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, paddingVertical:14, paddingHorizontal:16, backgroundColor:'rgba(255,68,68,0.08)', borderTopWidth:1, borderTopColor:'rgba(255,68,68,0.3)' },
  bannedBannerTxt: { color:'#ff4444', fontSize:14, fontWeight:'700', textAlign:'center' },

  // Banner invitación pendiente
  inviteBanner:     { alignItems:'center', gap:8, paddingVertical:16, paddingHorizontal:16, backgroundColor:'rgba(0,229,204,0.06)', borderTopWidth:1, borderTopColor:'rgba(0,229,204,0.2)' },
  inviteBannerTxt:  { color: colors.textMid, fontSize:13, textAlign:'center' },
  inviteBannerBtns: { flexDirection:'row', gap:12, marginTop:4 },
  inviteBtnDecline: { paddingHorizontal:28, paddingVertical:9, borderRadius:20, borderWidth:1, borderColor:'rgba(255,255,255,0.2)', backgroundColor:'rgba(255,255,255,0.06)' },
  inviteBtnDeclineTxt: { color: colors.textDim, fontSize:13, fontWeight:'600' },
  inviteBtnAccept:  { paddingHorizontal:28, paddingVertical:9, borderRadius:20, backgroundColor:'rgba(0,229,204,0.15)', borderWidth:1, borderColor:'rgba(0,229,204,0.5)' },
  inviteBtnAcceptTxt:  { color: colors.c1, fontSize:13, fontWeight:'700' },

  // Gift modal
  giftOverlay:         { flex:1, backgroundColor:'rgba(0,0,0,0.88)', justifyContent:'flex-end' },
  giftSheet:           { backgroundColor:colors.surface, borderTopLeftRadius:28, borderTopRightRadius:28, borderWidth:1, borderColor:colors.border, borderBottomWidth:0, paddingHorizontal:20, paddingTop:16, paddingBottom:36, maxHeight:'90%' },
  giftHandle:          { width:40, height:4, borderRadius:2, backgroundColor:colors.border, alignSelf:'center', marginBottom:16 },
  giftHead:            { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:16 },
  giftHeadLeft:        { flexDirection:'row', alignItems:'center', gap:10 },
  giftHeaderIcon:      { width:34, height:34, borderRadius:10, backgroundColor:'rgba(41,121,255,0.12)', borderWidth:1, borderColor:'rgba(41,121,255,0.25)', alignItems:'center', justifyContent:'center' },
  giftTitle:           { color:colors.textHi, fontSize:15, fontWeight:'800' },
  giftCloseBtn:        { padding:4 },
  giftTabs:            { flexDirection:'row', gap:8, marginBottom:16 },
  giftTab:             { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, paddingVertical:10, borderRadius:12, backgroundColor:colors.deep, borderWidth:1, borderColor:colors.border },
  giftTabActive:       { backgroundColor:'rgba(41,121,255,0.1)', borderColor:'rgba(41,121,255,0.35)' },
  giftTabTxt:          { color:colors.textDim, fontSize:13, fontWeight:'600' },
  giftTabTxtActive:    { color:colors.c2, fontWeight:'700' },
  giftFieldLbl:        { color:colors.textMid, fontSize:11, fontWeight:'700', marginBottom:8, letterSpacing:0.5 },
  giftCoinsRow:        { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:4, marginBottom:6 },
  giftCoinsInput:      { fontSize:44, fontWeight:'800', color:colors.textHi, minWidth:100, textAlign:'center' },
  giftBalanceRow:      { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:4, marginBottom:14 },
  giftBalanceTxt:      { color:colors.textDim, fontSize:12 },
  giftBreakdown:       { backgroundColor:colors.deep, borderRadius:12, borderWidth:1, borderColor:colors.border, padding:12, marginBottom:14 },
  giftBreakRow:        { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:5 },
  giftBreakRowTotal:   { borderTopWidth:1, borderTopColor:colors.border, marginTop:4, paddingTop:10 },
  giftBreakLbl:        { color:colors.textDim, fontSize:12 },
  giftBreakLblBold:    { color:colors.textHi, fontSize:12, fontWeight:'700' },
  giftBreakVal:        { color:colors.textHi, fontSize:12, fontWeight:'600' },
  giftInputRow:        { flexDirection:'row', alignItems:'center', gap:10, backgroundColor:colors.deep, borderRadius:12, borderWidth:1, borderColor:colors.border, paddingHorizontal:14, paddingVertical:11, marginBottom:8 },
  giftInputField:      { flex:1, color:colors.textHi, fontSize:14 },
  giftHint:            { color:colors.textDim, fontSize:11, marginBottom:10, paddingTop:4 },
  giftNoFrames:        { alignItems:'center', gap:8, paddingVertical:20, marginBottom:8 },
  giftNoFramesTxt:     { color:colors.textDim, fontSize:12, textAlign:'center', lineHeight:18 },
  giftFrameThumb:      { width:70, backgroundColor:colors.deep, borderRadius:10, borderWidth:1, borderColor:colors.border, overflow:'hidden' },
  giftFrameThumbSel:   { borderColor:colors.c2, borderWidth:2, backgroundColor:'rgba(41,121,255,0.08)' },
  giftFramePreview:    { width:70, height:70, alignItems:'center', justifyContent:'center', position:'relative' },
  giftFrameCheckOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(0,0,0,0.3)', alignItems:'center', justifyContent:'center' },
  giftFrameName:       { color:colors.textHi, fontSize:9, fontWeight:'600', paddingHorizontal:5, paddingTop:4, paddingBottom:2 },
  giftFrameUnits:      { color:colors.textDim, fontSize:8, paddingHorizontal:5, paddingBottom:5 },
  giftWarnBox:         { flexDirection:'row', alignItems:'center', gap:7, backgroundColor:'rgba(249,115,22,0.08)', borderRadius:10, borderWidth:1, borderColor:'rgba(249,115,22,0.2)', padding:10, marginBottom:12 },
  giftWarnTxt:         { color:colors.c4, fontSize:11, flex:1 },
  giftMsgInput:        { backgroundColor:colors.deep, borderRadius:12, borderWidth:1, borderColor:colors.border, color:colors.textHi, fontSize:14, paddingHorizontal:14, paddingVertical:11, minHeight:70, marginBottom:12 },
  giftErrBox:          { flexDirection:'row', alignItems:'center', gap:7, backgroundColor:'rgba(249,115,22,0.1)', borderRadius:10, borderWidth:1, borderColor:'rgba(249,115,22,0.25)', padding:10, marginBottom:12 },
  giftErrTxt:          { color:colors.c4, fontSize:12, flex:1 },
  giftSendBtn:         { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:colors.c2, borderRadius:16, paddingVertical:14, marginBottom:4 },
  giftSendBtnDisabled: { backgroundColor:colors.surface, borderWidth:1, borderColor:colors.border },
  giftSendTxt:         { color:colors.black, fontSize:14, fontWeight:'800' },

  menuIcon: { width:25, height:25, resizeMode:'contain' },

  // Sala de Cine
  cinemaPanelOuter: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: 12,
    marginVertical: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cinemaPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cinemaPanelTitle: { color: '#fff', fontSize: 12, fontWeight: '600' },
  cinemaMiniBtn:    { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, padding: 6, marginRight: 6 },
  cinemaPowerBtn:   { backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 20, padding: 6 },
  cinemaMenuSheet:    { backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 12, borderWidth: 1, borderColor: colors.borderC },
  cinemaMenuTitle:    { color: colors.textHi, fontSize: 16, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  cinemaMenuItem:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  cinemaMenuItemTxt:  { color: colors.textHi, fontSize: 15, fontWeight: '500' },
  cinemaInputOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  cinemaInputBox:     { backgroundColor: colors.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: colors.borderC },
  cinemaInputTitle:   { color: colors.textHi, fontSize: 16, fontWeight: '700' },
  cinemaInputLabel:   { color: colors.textDim, fontSize: 12, fontWeight: '600', marginBottom: 8 },
  cinemaUrlInput:     { backgroundColor: colors.deep, borderRadius: 12, borderWidth: 1, borderColor: colors.border, color: colors.textHi, fontSize: 13, paddingHorizontal: 14, paddingVertical: 11 },
  cinemaUrlError:     { color: 'rgba(239,68,68,0.9)', fontSize: 12, marginTop: 8 },
  cinemaInputCancel:  { flex: 1, paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: colors.borderC, alignItems: 'center' },
  cinemaInputCancelTxt: { color: colors.textDim, fontWeight: '600', fontSize: 14 },
  cinemaInputStart:   { flex: 1, paddingVertical: 13, borderRadius: 14, backgroundColor: colors.c1, alignItems: 'center' },
  cinemaInputStartTxt:{ color: colors.black, fontWeight: '800', fontSize: 14 },

  headerAvatarStack:  { flexDirection:'row', alignItems:'center', marginRight: 4 },
  headerStackAvatar:  { width:24, height:24, borderRadius:12, overflow:'hidden', backgroundColor: colors.surface, alignItems:'center', justifyContent:'center', borderWidth:1.5, borderColor: '#ffffff' },
  headerStackInitial: { color: colors.textMid, fontSize:9, fontWeight:'700' },
});
