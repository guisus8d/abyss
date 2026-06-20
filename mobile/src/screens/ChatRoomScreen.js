import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
  View, Animated, Easing, LayoutAnimation, ActivityIndicator, Alert, Text, TextInput, TouchableOpacity,
  FlatList, Image, ImageBackground, Keyboard, Modal, Platform,
  Pressable, StyleSheet, StatusBar, Linking, ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import AudioMessage    from '../components/AudioMessage';
import SharedProfileBubble from '../components/SharedProfileBubble';
import AvatarWithFrame from '../components/AvatarWithFrame';
import CoinIcon from '../components/CoinIcon';
import GenderIcon from '../components/GenderIcon';
import GiftBubble from '../components/GiftBubble';
import { Ionicons }    from '@expo/vector-icons';
import { colors }      from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api              from '../services/api';
import { connectSocket } from '../services/socket';
import AsyncStorage     from '@react-native-async-storage/async-storage';

// ─── Presets de fondo de chat ────────────────────────────────────────────────
const CHAT_BG_PRESETS = [
  { id: 'default', label: 'Original',    type: 'image' },
  { id: 'night',   label: 'Noche',       type: 'color', color: '#020D1A' },
  { id: 'void',    label: 'Void',        type: 'color', color: '#050505' },
  { id: 'purple',  label: 'Deep Purple', type: 'color', color: '#0D0714' },
  { id: 'teal',    label: 'Deep Teal',   type: 'color', color: '#030F10' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSenderId(sender) {
  if (!sender) return '';
  if (typeof sender === 'string') return sender;
  const id = sender._id ?? sender.id ?? sender;
  return id?.toString?.() ?? '';
}

function dateLabel(date) {
  const d = new Date(date), today = new Date(), yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString())     return 'Hoy';
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
  const days   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const diff   = (today - d) / (1000 * 60 * 60 * 24);
  if (diff < 7) return days[d.getDay()];
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function timeStr(date) {
  return new Date(date).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
}

// ─── Texto enriquecido SIN fetch ──────────────────────────────────────────────

function renderRichText(text, navigation) {
  if (!text) return null;
  const parts = text.split(/(@\w+|https?:\/\/[^\s]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      const username = part.slice(1);
      return (
        <Text key={i} style={{ fontWeight:'700', color: colors.c1 }}
          onPress={() => navigation.navigate('PublicProfile', { username })}>
          {part}
        </Text>
      );
    }
    if (/^https?:\/\//.test(part)) {
      const postId = part.match(/abyss\.social\/post\/([a-f0-9]{24})/i)?.[1];
      if (postId) {
        return (
          <Text key={i} style={{ color:'#00e5cc', fontWeight:'600' }}
            onPress={() => navigation.navigate('PostDetail', { postId })}>
            {'🔗 Ver post en Abyss'}
          </Text>
        );
      }
      return (
        <Text key={i} style={{ color:'#00e5cc', textDecorationLine:'underline' }}
          onPress={() => Linking.openURL(part).catch(() => {})}>
          {part}
        </Text>
      );
    }
    return <Text key={i}>{part}</Text>;
  });
}

function RichMessage({ text, navigation, textStyle, onLongPress }) {
  if (!text) return null;
  return (
    <Text style={textStyle} onLongPress={onLongPress}>
      {renderRichText(text, navigation)}
    </Text>
  );
}

// ─── Tarjeta shared_post — CERO fetch ────────────────────────────────────────

function SharedPostBubble({ sharedPost, navigation, isMe, onLongPress }) {
  if (!sharedPost?.postId) return null;
  const hasImage  = !!sharedPost.imageUrl;
  const isNews    = sharedPost.postType === 'news';
  const bgColor   = isMe ? 'rgba(0,140,126,0.22)' : 'rgba(13,29,46,0.9)';
  const borderCol = isMe ? 'rgba(0,229,204,0.30)' : 'rgba(255,255,255,0.09)';
  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('PostDetail', { postId: sharedPost.postId.toString() })}
      onLongPress={onLongPress}
      activeOpacity={0.82}
      style={{ borderRadius:14, borderWidth:1, overflow:'hidden', width:224, marginBottom:4, backgroundColor:bgColor, borderColor:borderCol }}>
      <View style={sp.cardHeader}>
        <View style={sp.accentBar} />
        <View style={{ flex:1, gap:2 }}>
          {isNews && <View style={sp.newsBadge}><Text style={sp.newsBadgeTxt}>NOTICIA</Text></View>}
          <Text style={sp.authorTxt}>{sharedPost.authorUsername}</Text>
        </View>
        <Ionicons name="open-outline" size={13} color="rgba(0,229,204,0.5)" />
      </View>
      {hasImage && <Image source={{ uri: sharedPost.imageUrl }} style={sp.img} resizeMode="cover" />}
      <View style={sp.cardBody}>
        {!!sharedPost.title   && <Text style={sp.title}   numberOfLines={2}>{sharedPost.title}</Text>}
        {!!sharedPost.content && <Text style={sp.content} numberOfLines={hasImage ? 1 : 3}>{sharedPost.content}</Text>}
      </View>
      <View style={sp.footer}>
        <Ionicons name="arrow-forward-circle-outline" size={12} color="rgba(0,229,204,0.45)" />
        <Text style={sp.footerTxt}>Ver post completo</Text>
      </View>
    </TouchableOpacity>
  );
}

const sp = StyleSheet.create({
  cardHeader:   { flexDirection:'row', alignItems:'center', paddingHorizontal:10, paddingVertical:9, gap:7, borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.06)' },
  accentBar:    { width:2, height:16, backgroundColor:'#00e5cc', borderRadius:1 },
  newsBadge:    { backgroundColor:'rgba(251,191,36,0.14)', borderRadius:4, paddingHorizontal:5, paddingVertical:1, alignSelf:'flex-start' },
  newsBadgeTxt: { color:'rgba(251,191,36,0.9)', fontSize:8, fontWeight:'800', letterSpacing:1 },
  authorTxt:    { color:'#00e5cc', fontSize:11, fontWeight:'700' },
  img:          { width:'100%', height:110 },
  cardBody:     { paddingHorizontal:10, paddingVertical:8, gap:3 },
  title:        { color:'#e8f4f8', fontSize:13, fontWeight:'700', lineHeight:18 },
  content:      { color:'rgba(232,244,248,0.58)', fontSize:12, lineHeight:17 },
  footer:       { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:10, paddingBottom:8 },
  footerTxt:    { color:'rgba(0,229,204,0.45)', fontSize:10, fontWeight:'600' },
});

const AVATAR_SLOT = 36;
const _imgDimCache = {};
const REC_BAR_HEIGHTS = [16, 24, 20, 30, 18, 28, 22, 14];

// ─── MessageBubble — React.memo: solo re-renderiza si sus props cambian ───────
// Esta es la clave del fix: antes, al llegar 1 mensaje nuevo, las 50 burbujas
// se re-renderizaban. Ahora solo la nueva (o la que cambia sus props).

const MessageBubble = memo(function MessageBubble({
  item,
  olderMsg,
  isMe,
  myId,
  navigation,
  onLongPress,
  onScrollToMsg,
  onFullImg,
  onGiftAction,
  user,
  other,
}) {
  const [imgSize, setImgSize] = useState(() =>
    item.mediaUrl ? (_imgDimCache[item.mediaUrl] ?? null) : null
  );

  const olderIsMe   = !!myId && !!olderMsg && getSenderId(olderMsg.sender) === myId;
  const sameAsOlder = olderMsg && (isMe ? olderIsMe : !olderIsMe);
  const showAvatar  = !sameAsOlder;
  const isPostType  = item.type === 'shared_post' || item.type === 'shared_profile';
  const isGiftType  = item.type === 'gift';
  const isImageType = item.type === 'image' && !!item.mediaUrl;

  const senderAvatar   = item.sender?.avatarUrl       ?? (isMe ? user.avatarUrl       : other.avatarUrl);
  const senderName     = item.sender?.username        ?? (isMe ? user.username        : other.username);
  const senderFrame    = item.sender?.profileFrame    ?? (isMe ? user.profileFrame    : other.profileFrame);
  const senderFrameUrl = item.sender?.profileFrameUrl ?? (isMe ? user.profileFrameUrl : other.profileFrameUrl);

  useEffect(() => {
    if (!isImageType || imgSize) return;
    Image.getSize(
      item.mediaUrl,
      (w, h) => {
        const dim = { w, h };
        _imgDimCache[item.mediaUrl] = dim;
        setImgSize(dim);
      },
      () => setImgSize({ w: 4, h: 3 }),
    );
  }, [item.mediaUrl]);

  const IMG_MAX_W = 180;
  const IMG_MAX_H = 260;
  let imgDispW = 120;
  let imgDispH = 90;
  if (imgSize) {
    const natRatio = imgSize.w / imgSize.h;
    imgDispW = IMG_MAX_W;
    imgDispH = IMG_MAX_W / natRatio;
    if (imgDispH > IMG_MAX_H) {
      imgDispH = IMG_MAX_H;
      imgDispW = IMG_MAX_H * natRatio;
    }
  }

  return (
    <>
      <View style={[s.msgRow, isMe && s.msgRowMe]}>
        <View style={{ width: AVATAR_SLOT, alignSelf:'flex-start', alignItems:'center' }}>
          {showAvatar && (
            <AvatarWithFrame size={28} avatarUrl={senderAvatar} username={senderName}
              profileFrame={senderFrame} frameUrl={senderFrameUrl} banned={!isMe && !!other?.banned} />
          )}
        </View>
  <TouchableOpacity
    onLongPress={onLongPress}
    onPress={isImageType ? () => onFullImg(item.mediaUrl) : undefined}
    activeOpacity={0.8}
    style={[
      s.bubble,
      isMe ? s.bubbleMe : s.bubbleThem,
      isPostType && s.bubblePost,
      isGiftType && s.bubbleGift,
      isImageType && { backgroundColor:'transparent', padding:0, borderRadius:0, borderWidth:0, maxWidth: IMG_MAX_W },
    ]}>

  {item.replyTo?.text && (
    <TouchableOpacity style={s.replyPreview} onPress={() => onScrollToMsg(item.replyTo.messageId)}>
      <Text style={s.replyUser}>{item.replyTo.senderUsername}</Text>
      <Text style={s.replyText} numberOfLines={1}>{item.replyTo.text}</Text>
    </TouchableOpacity>
  )}

  {item.type === 'gift'
    ? <GiftBubble giftData={item.giftData} giftId={item.giftId} isMe={isMe} myId={myId} onGiftAction={onGiftAction} />
    : item.type === 'shared_profile'
    ? <SharedProfileBubble sharedProfile={item.sharedProfile} navigation={navigation}
        isMe={isMe} onLongPress={onLongPress} />
    : item.type === 'shared_post'
    ? <SharedPostBubble sharedPost={item.sharedPost} navigation={navigation}
        isMe={isMe} onLongPress={onLongPress} />
    : item.type === 'audio' && item.mediaUrl
    ? <AudioMessage uri={item.mediaUrl} isMe={isMe} duration={item.audioDuration || 0} onLongPress={onLongPress} />
    : item.type === 'image' && item.mediaUrl
    ? imgSize
      ? <Image
          source={{ uri: item.mediaUrl }}
          style={{ width: imgDispW, height: imgDispH }}
          resizeMode="cover"
        />
      : <View style={{ width: 120, height: 90, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="small" color={colors.textDim} />
        </View>
    : <RichMessage text={item.text} navigation={navigation}
        textStyle={s.bubbleTxt} onLongPress={onLongPress} />
  }

  {!isPostType && !isGiftType && !isImageType && (
    <Text style={s.bubbleTime}>
      {timeStr(item.createdAt)}
    </Text>
  )}

  {item.reactions?.length > 0 && (
    <View style={s.msgReactions}>
      {item.reactions.map((r, i) => <Text key={i} style={s.msgReactionEmoji}>{r.emoji}</Text>)}
    </View>
  )}

</TouchableOpacity>
      </View>
      {showAvatar && (
        <Text style={[s.msgSenderName, isMe && { textAlign:'right', marginLeft:0, marginRight: AVATAR_SLOT + 8 }]}>
          {senderName}
        </Text>
      )}
    </>
  );
});

// ─── ChatRoomScreen ───────────────────────────────────────────────────────────

export default function ChatRoomScreen({ route, navigation }) {
  const { chat, other } = route.params;
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const myId = user?._id?.toString() ?? '';

  const [messages,           setMessages]           = useState([]);
  const [uploading,          setUploading]          = useState(false);
  const [isRecording,        setIsRecording]        = useState(false);
  const [audioPreview,       setAudioPreview]       = useState(null);
  const [imagePreview,       setImagePreview]       = useState(null);
  const [recSeconds,         setRecSeconds]         = useState(0);
  const [fullImg,            setFullImg]            = useState(null);
  const [text,               setText]               = useState('');
  const [typing,             setTyping]             = useState(false);
  const [showScrollBtn,      setShowScrollBtn]      = useState(false);
  const [menuMsg,            setMenuMsg]            = useState(null);
  const [replyTo,            setReplyTo]            = useState(null);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [isBlocked,          setIsBlocked]          = useState(other?.blocked ?? false);
  const [kbVisible,          setKbVisible]          = useState(false);
  const [hasMore,            setHasMore]            = useState(false);
  const [loadingMore,        setLoadingMore]        = useState(false);
  const [newMsgIndicator,    setNewMsgIndicator]    = useState(false);

  // ── Regalo ────────────────────────────────────────────────────────────────
  const [giftModal,     setGiftModal]     = useState(false);
  const [giftType,      setGiftType]      = useState('coins');
  const [giftCoins,     setGiftCoins]     = useState('');
  const [giftFrame,     setGiftFrame]     = useState(null);
  const [giftCantidad,  setGiftCantidad]  = useState('1');
  const [giftMsg,       setGiftMsg]       = useState('');
  const [giftInv,       setGiftInv]       = useState([]);
  const [giftInvLoad,   setGiftInvLoad]   = useState(false);
  const [sendingGift,   setSendingGift]   = useState(false);
  const [giftErr,       setGiftErr]       = useState('');

  // ── Ajustes de chat ────────────────────────────────────────────────────────
  const [chatBg, setChatBg] = useState('default');

  const flatRef        = useRef(null);
  const socketRef      = useRef(null);
  const recordingRef   = useRef(null);
  const recTimerRef    = useRef(null);
  const recSecondsRef  = useRef(0);
  const typingTimer    = useRef(null);
  const sendingRef     = useRef(false);
  const keyboardOffset = useRef(new Animated.Value(0)).current;
  const sendAnim       = useRef(new Animated.Value(0)).current;
  const recBarAnims    = useRef(Array.from({ length: 8 }, () => new Animated.Value(0.3))).current;
  const micPulseAnim   = useRef(new Animated.Value(1)).current;
  const pendingAudioDurationsRef = useRef({});
  const msgSkipRef      = useRef(0);
  const loadingMoreRef  = useRef(false);
  const scrollOffsetRef = useRef(0);

  // Mensajes más recientes primero, con separadores de fecha como items propios
  const flatListData = useMemo(() => {
    const reversed = [...messages].reverse();
    const result = [];
    for (let i = 0; i < reversed.length; i++) {
      result.push(reversed[i]);
      const next = reversed[i + 1];
      if (!next || dateLabel(reversed[i].createdAt) !== dateLabel(next.createdAt)) {
        result.push({ _id: `sep_${dateLabel(reversed[i].createdAt)}`, type: 'date_separator', label: dateLabel(reversed[i].createdAt) });
      }
    }
    return result;
  }, [messages]);

  useEffect(() => {
    const loadBg = () => {
      Promise.all([
        AsyncStorage.getItem(`chatBg_${chat._id}`),
        AsyncStorage.getItem('chatBg_default'),
      ]).then(([specific, fallback]) => {
        setChatBg(specific || fallback || 'default');
      }).catch(() => {});
    };
    loadBg();
    const unsub = navigation.addListener('focus', loadBg);
    return unsub;
  }, [chat._id, navigation]);

  useEffect(() => {
    const eventShow = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const eventHide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(eventShow, (e) => {
      setKbVisible(true);
      Animated.timing(keyboardOffset, {
        toValue: e.endCoordinates.height,
        duration: e.duration || 250,
        useNativeDriver: false,
      }).start();
    });
    const hide = Keyboard.addListener(eventHide, (e) => {
      setKbVisible(false);
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: e.duration || 250,
        useNativeDriver: false,
      }).start();
    });
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (!chat?._id) return;
    let mounted = true;

    api.get(`/chats/${chat._id}/messages?limit=50`).then(({ data }) => {
      setMessages(data.messages || []);
      setHasMore(data.hasMore ?? false);
      msgSkipRef.current = 50;
    }).catch(() => {});

    connectSocket().then(s => {
      if (!mounted) return;                   // component unmounted before promise resolved
      socketRef.current = s;
      s.off('chat:message');
      s.off('chat:typing');

      s.emit('chat:join', { chatId: chat._id.toString() });
      s.emit('chat:read', { chatId: chat._id.toString() });

      s.on('chat:message', ({ chatId, message }) => {
        if (chatId.toString() !== chat._id.toString()) return;
        let msg = message;
        if (msg.type === 'audio' && msg.mediaUrl && !msg.audioDuration) {
          const stored = pendingAudioDurationsRef.current[msg.mediaUrl];
          if (stored) {
            msg = { ...msg, audioDuration: stored };
            delete pendingAudioDurationsRef.current[message.mediaUrl];
          }
        }
        setMessages(prev => {
          const msgId = msg._id?.toString();
          if (msgId && prev.some(m => m._id?.toString() === msgId)) return prev;
          return [...prev, msg];
        });
        s.emit('chat:read', { chatId: chat._id.toString() });
        const isOwnMsg = getSenderId(msg.sender) === myId;
        if (isOwnMsg || scrollOffsetRef.current < 100) {
          setTimeout(() => flatRef.current?.scrollToOffset({ offset: 0, animated: true }), 50);
        } else {
          setNewMsgIndicator(true);
        }
      });

      s.on('chat:typing', ({ userId, isTyping }) => {
        if (userId !== myId) setTyping(isTyping);
      });

      s.on('gift:update', ({ giftId, estado, slotsReclamados, reclamadoPor }) => {
        setMessages(prev => prev.map(m => {
          if (m.giftId?.toString() !== giftId?.toString()) return m;
          const patch = {};
          if (estado          !== undefined) patch.estado          = estado;
          if (slotsReclamados !== undefined) patch.slotsReclamados = slotsReclamados;
          if (reclamadoPor    !== undefined) patch.reclamadoPor    = reclamadoPor;
          return { ...m, giftData: { ...(m.giftData || {}), ...patch } };
        }));
      });
    });

    return () => {
      mounted = false;
      if (recTimerRef.current) clearInterval(recTimerRef.current);
      socketRef.current?.off('chat:message');
      socketRef.current?.off('chat:typing');
      socketRef.current?.off('gift:update');
      socketRef.current?.emit('chat:leave', { chatId: chat._id.toString() });
    };
  }, []);

  useEffect(() => {
    if (isRecording) {
      recBarAnims.forEach((anim, i) => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, { toValue: 1,   duration: 250 + i * 70, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0.2, duration: 250 + i * 55, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          ])
        ).start();
      });
      Animated.loop(
        Animated.sequence([
          Animated.timing(micPulseAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
          Animated.timing(micPulseAnim, { toValue: 1,   duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      recBarAnims.forEach(anim => {
        anim.stopAnimation();
        Animated.timing(anim, { toValue: 0.3, duration: 150, useNativeDriver: true }).start();
      });
      micPulseAnim.stopAnimation();
      Animated.timing(micPulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    }
  }, [isRecording]);

  async function openGiftModal() {
    setGiftModal(true);
    setGiftType('coins');
    setGiftCoins('');
    setGiftFrame(null);
    setGiftCantidad('1');
    setGiftMsg('');
    setGiftErr('');
    setGiftInvLoad(true);
    try {
      const { data } = await api.get('/frames/me/inventory');
      setGiftInv((data.inventory || []).filter(i => (i.unidadesEnMano || 0) > 0));
    } catch {}
    finally { setGiftInvLoad(false); }
  }

  async function sendGift() {
    if (giftType === 'coins' && (!giftCoins || parseInt(giftCoins) <= 0)) {
      setGiftErr('Ingresa un monto válido'); return;
    }
    if (giftType === 'frame' && !giftFrame) {
      setGiftErr('Selecciona un marco'); return;
    }
    const cant = Math.max(1, parseInt(giftCantidad) || 1);
    setSendingGift(true);
    setGiftErr('');
    try {
      const { data } = await api.post('/gifts', {
        receptorUsername: other.username,
        monedas: giftType === 'coins' ? parseInt(giftCoins) : 0,
        items:   giftType === 'frame' ? [{ frameId: (giftFrame.frame || giftFrame)._id, cantidad: cant }] : [],
        mensaje: giftMsg.trim(),
      });
      const gift = data.gift;
      socketRef.current?.emit('chat:send', {
        chatId:   chat._id.toString(),
        type:     'gift',
        text:     '',
        giftId:   gift._id,
        giftData: {
          monedas:         gift.monedas || 0,
          items:           (gift.items || []).map(i => ({ name: i.frame?.name, cantidad: i.cantidad, imageUrl: i.frame?.imageUrl || null })),
          mensaje:         gift.mensaje || '',
          estado:          'pendiente',
          emisorUsername:  user.username,
          tipo:            'privado',
          slots:           1,
          slotsReclamados: 0,
          reclamadoPor:    [],
        },
      });
      setGiftModal(false);
      flatRef.current?.scrollToOffset({ offset: 0, animated: true });
      setNewMsgIndicator(false);
    } catch (e) {
      setGiftErr(e.response?.data?.error || 'Error al enviar regalo');
    } finally { setSendingGift(false); }
  }

  const handleGiftAction = useCallback(async (giftId, action) => {
    try {
      await api.post(`/gifts/${giftId}/${action}`);
      setMessages(prev => prev.map(m =>
        (m.giftId?.toString?.() === giftId?.toString?.() || m.giftId === giftId)
          ? { ...m, giftData: { ...(m.giftData || {}), estado: action === 'accept' ? 'aceptado' : 'rechazado' } }
          : m
      ));
      Alert.alert(
        action === 'accept' ? 'Regalo aceptado ✓' : 'Regalo rechazado',
        action === 'accept' ? 'El regalo fue añadido a tu cuenta' : 'Las monedas/marcos fueron devueltos'
      );
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'No se pudo procesar el regalo');
    }
  }, []);

  const loadMoreMessages = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const { data } = await api.get(`/chats/${chat._id}/messages?limit=50&skip=${msgSkipRef.current}`);
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

  async function handleSend() {
    const msgText = text.trim();
    if (!msgText || sendingRef.current) return;
    sendingRef.current = true;
    setText('');
    flatRef.current?.scrollToOffset({ offset: 0, animated: true });
    setNewMsgIndicator(false);
    try {
      socketRef.current?.emit('chat:send', {
        chatId: chat._id.toString(), text: msgText,
        replyTo: replyTo ? { messageId: replyTo._id, text: replyTo.text, senderUsername: replyTo.sender?.username || '' } : undefined,
      });
    } catch (e) { console.log('handleSend error:', e.message); }
    finally { sendingRef.current = false; setReplyTo(null); }
  }

  async function sendImage() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 });
      if (result.canceled) return;
      setImagePreview(result.assets[0].uri);
    } catch (e) { console.log('sendImage error:', e.message); }
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
      formData.append('file', { uri, type: 'image/jpeg', name: 'chat.jpg' });
      const BASE_URL = process.env.EXPO_PUBLIC_API_URL;
      const res  = await fetch(`${BASE_URL}/chats/upload`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
        body:    formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      socketRef.current?.emit('chat:send', { chatId: chat._id.toString(), text: '', type: 'image', mediaUrl: data.url });
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
      setIsRecording(true);
      recSecondsRef.current = 0;
      setRecSeconds(0);
      recTimerRef.current = setInterval(() => {
        recSecondsRef.current += 1;
        setRecSeconds(recSecondsRef.current);
      }, 1000);
    } catch (e) { console.log('startRecording error:', e.message); }
  }

  async function stopRecording() {
    try {
      setIsRecording(false);
      clearInterval(recTimerRef.current);
      const secs = recSecondsRef.current;
      recSecondsRef.current = 0;
      setRecSeconds(0);
      await recordingRef.current?.stopAndUnloadAsync();
      const uri = recordingRef.current?.getURI();
      if (!uri) return;
      setAudioPreview({ uri, duration: secs });
    } catch (e) { console.log('stopRecording error:', e.message); }
    finally { setUploading(false); recordingRef.current = null; }
  }

  async function sendAudioPreview() {
    if (!audioPreview) return;
    const preview = audioPreview;
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
      pendingAudioDurationsRef.current[data.url] = preview.duration;
      socketRef.current?.emit('chat:send', { chatId: chat._id.toString(), text: '', type: 'audio', mediaUrl: data.url, audioDuration: preview.duration });
    } catch (e) { console.log('sendAudioPreview error:', e.message); }
    finally { setUploading(false); }
  }

  function cancelAudioPreview() { setAudioPreview(null); recordingRef.current = null; }

  function handleTyping(val) {
    setText(val);
    const match = val.match(/@(\w*)$/);
    if (match) {
      const q = match[1].toLowerCase();
      setMentionSuggestions([other].filter(u => u.username.toLowerCase().startsWith(q)));
    } else { setMentionSuggestions([]); }
    if (!socketRef.current) return;
    socketRef.current.emit('chat:typing', { chatId: chat._id.toString(), isTyping: true });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socketRef.current?.emit('chat:typing', { chatId: chat._id.toString(), isTyping: false });
    }, 1500);
  }

  function pickMention(username) {
    setText(text.replace(/@(\w*)$/, `@${username} `));
    setMentionSuggestions([]);
  }

  const scrollToMsg = useCallback((msgId) => {
    const idx = flatListData.findIndex(m => m._id === msgId);
    if (idx < 0) return;
    flatRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
  }, [flatListData]);

  async function reactToMsg(emoji) {
    if (!menuMsg) return;
    setMenuMsg(null);
    try {
      const { data } = await api.post(`/chats/${chat._id}/message/${menuMsg._id}/react`, { emoji });
      setMessages(prev => prev.map(m => m._id === menuMsg._id ? { ...m, reactions: data.reactions } : m));
    } catch(e) { console.log('react msg error:', e.message); }
  }

  async function deleteForMe() {
    if (!menuMsg) return;
    const msgId = menuMsg._id;
    setMenuMsg(null);
    try {
      await api.delete(`/chats/${chat._id}/message/${msgId}`);
      setMessages(prev => prev.filter(m => m._id !== msgId));
    } catch(e) { console.log('delete msg error:', e.message); }
  }

  const renderMessage = useCallback(({ item, index }) => {
    if (item.type === 'date_separator') {
      return (
        <View style={s.datePill}>
          <Text style={s.datePillTxt}>{item.label}</Text>
        </View>
      );
    }
    const isMe = !!myId && getSenderId(item.sender) === myId;
    // El item siguiente en flatListData puede ser un separador; saltar uno si hace falta
    let raw = flatListData[index + 1];
    const olderMsg = raw?.type === 'date_separator' ? (flatListData[index + 2] ?? null) : (raw ?? null);
    return (
      <MessageBubble
        item={item}
        olderMsg={olderMsg}
        isMe={isMe}
        myId={myId}
        navigation={navigation}
        onLongPress={() => setMenuMsg(item)}
        onScrollToMsg={scrollToMsg}
        onFullImg={setFullImg}
        onGiftAction={handleGiftAction}
        user={user}
        other={other}
      />
    );
  }, [flatListData, myId, scrollToMsg]);

  return (
    <View style={s.root}>
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

      <Modal visible={!!fullImg} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setFullImg(null)}>
        <Pressable style={{ flex:1, backgroundColor:'rgba(0,0,0,0.95)', alignItems:'center', justifyContent:'center', marginBottom: -insets.bottom }} onPress={() => setFullImg(null)}>
          {fullImg && <Image source={{ uri: fullImg }} style={{ width:'95%', height:'70%', borderRadius:12 }} resizeMode="contain" />}
          <Text style={{ color:'rgba(255,255,255,0.4)', marginTop:16, fontSize:12 }}>Toca para cerrar</Text>
        </Pressable>
      </Modal>

      <ImageBackground
        source={chatBg?.startsWith('http') ? { uri: chatBg } : require('../../assets/chat-bg.jpeg')}
        style={{ flex: 1, backgroundColor: '#050c14' }}
        resizeMode="cover"
      >
        {(() => {
          const isCustomUrl = chatBg?.startsWith('http');
          const p = isCustomUrl ? null : (CHAT_BG_PRESETS.find(x => x.id === chatBg) ?? CHAT_BG_PRESETS[0]);
          return (
            <View
              style={{ position:'absolute', top:0, left:0, right:0, bottom:0,
                backgroundColor: p?.type === 'color' ? p.color : 'rgba(2,5,9,0.6)' }}
              pointerEvents="none"
            />
          );
        })()}
      <StatusBar barStyle="light-content" backgroundColor="transparent" />

      <SafeAreaView edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.textHi} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('PublicProfile', { username: other.username })}>
            <AvatarWithFrame size={38} avatarUrl={other.avatarUrl} username={other.username}
              profileFrame={other.profileFrame} frameUrl={other.profileFrameUrl} banned={!!other.banned} />
          </TouchableOpacity>
          <TouchableOpacity style={{ flex:1 }} onPress={() => navigation.navigate('PublicProfile', { username: other.username })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={s.headerName}>{other.username}</Text>
              <GenderIcon gender={other?.gender} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.navigate('ChatSettings', { chatId: chat._id.toString(), otherUsername: other.username, currentBg: chatBg })}>
            <Image source={require('../../assets/chats/menu/ic_menu_settings_4.png')} style={{ width:20, height:20, resizeMode:'contain' }} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View style={{ flex:1 }}>
          <View style={{ flex:1 }}>
            <FlatList
              ref={flatRef}
              style={{ flex: 1 }}
              data={flatListData}
              keyExtractor={(m) => String(m._id)}
              renderItem={renderMessage}
              inverted
              contentContainerStyle={s.messagesList}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets={true}
              removeClippedSubviews={true}
              windowSize={5}
              maxToRenderPerBatch={10}
              initialNumToRender={15}
              updateCellsBatchingPeriod={50}
              onScroll={e => {
                const y = e.nativeEvent.contentOffset.y;
                scrollOffsetRef.current = y;
                setShowScrollBtn(y > 150);
                if (y < 100) setNewMsgIndicator(false);
              }}
              scrollEventThrottle={32}
              onEndReached={loadMoreMessages}
              onEndReachedThreshold={0.2}
              maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
              ListFooterComponent={loadingMore
                ? <View style={{ paddingVertical: 12, alignItems: 'center' }}><ActivityIndicator size="small" color={colors.c1} /></View>
                : null
              }
            />
          </View>

        {isBlocked && (
          <View style={s.blockedBanner}>
            <Ionicons name="ban-outline" size={16} color="rgba(239,68,68,0.8)" />
            <Text style={s.blockedBannerTxt}>Has bloqueado a {other.username}. No puedes enviar mensajes.</Text>
          </View>
        )}

        {mentionSuggestions.length > 0 && (
          <View style={s.mentionDropdown}>
            {mentionSuggestions.map(u => (
              <TouchableOpacity key={u._id} style={s.mentionItem} onPress={() => pickMention(u.username)}>
                <Text style={s.mentionAt}>@</Text>
                <Text style={s.mentionName}>{u.username}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {typing && (
          <View style={s.typingBar}>
            <Text style={s.typingBarTxt}>{other.username} está escribiendo...</Text>
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
          <View style={s.recPreviewContainer}>
            <View style={{ alignItems: 'center' }}>
              <AudioMessage uri={audioPreview.uri} isMe duration={audioPreview.duration} />
            </View>
            <View style={s.recPreviewBtns}>
              <TouchableOpacity onPress={cancelAudioPreview} style={s.recPreviewCancel}>
                <Text style={s.recPreviewCancelTxt}>✕ Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={sendAudioPreview} disabled={uploading} style={s.recPreviewSend}>
                {uploading
                  ? <ActivityIndicator size={16} color="#020509" />
                  : <Text style={s.recPreviewSendTxt}>➤ Enviar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        ) : isRecording ? (
          <View style={s.recContainer}>
            <Animated.View style={{ opacity: micPulseAnim }}>
              <Ionicons name="mic" size={32} color="rgba(239,68,68,0.9)" />
            </Animated.View>
            <Text style={s.recTimerLarge}>
              {String(Math.floor(recSeconds / 60)).padStart(2, '0')}:{String(recSeconds % 60).padStart(2, '0')}
            </Text>
            <Text style={s.recGrabandoTxt}>Grabando...</Text>
            <View style={s.recBarsWrap}>
              {recBarAnims.map((anim, i) => (
                <Animated.View
                  key={i}
                  style={{ width: 3, height: REC_BAR_HEIGHTS[i], backgroundColor: 'rgba(239,68,68,0.75)', borderRadius: 2, marginHorizontal: 1, transform: [{ scaleY: anim }] }}
                />
              ))}
            </View>
            <TouchableOpacity onPress={stopRecording} style={s.recStopBtnNew}>
              <Ionicons name="stop-circle-outline" size={32} color={colors.c1} />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={s.inputRow}>
              <View style={s.inputWrap}>
                <TextInput
                  style={s.input}
                  placeholder="Mensaje..."
                  placeholderTextColor={colors.textDim}
                  value={text}
                  onChangeText={handleTyping}
                  onSubmitEditing={Platform.OS !== 'web' ? handleSend : undefined}
                  returnKeyType="send"
                  onKeyPress={Platform.OS === 'web' ? (e) => { if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) { e.preventDefault?.(); handleSend(); } } : undefined}
                  blurOnSubmit={false}
                />
                <TouchableOpacity style={s.stickerBtn} onPress={() => {}}>
                  <Ionicons name="happy-outline" size={20} color={colors.textDim} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={handleSend}
                disabled={!text.trim()}
                style={[s.sendBtn, { opacity: text.length > 0 ? 1 : 0.3 }]}
              >
                <Ionicons name="send" size={18} color="#020509" />
              </TouchableOpacity>
            </View>
            <View style={s.mediaBtnRow}>
              <TouchableOpacity onLongPress={startRecording} disabled={uploading} style={s.mediaBtn}>
                <Image source={require('../../assets/chats/menu/icon_record_v2.png')} style={s.menuIcon} />
              </TouchableOpacity>
              <TouchableOpacity onPress={sendImage} disabled={uploading} style={s.mediaBtn}>
                {uploading
                  ? <ActivityIndicator size={16} color={colors.c1} />
                  : <Image source={require('../../assets/chats/menu/icon_image_small_v2.png')} style={s.menuIcon} />}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {}} style={s.mediaBtn}>
                <Image source={require('../../assets/chats/menu/ic_menu_emoji_v2.png')} style={s.menuIcon} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {}} style={s.mediaBtn}>
                <Image source={require('../../assets/chats/menu/icon_dice_v2.png')} style={s.menuIcon} />
              </TouchableOpacity>
              <TouchableOpacity onPress={openGiftModal} disabled={uploading} style={s.mediaBtn}>
                <Image source={require('../../assets/chats/menu/ic_menu_more_option_v2.png')} style={s.menuIcon} />
              </TouchableOpacity>
            </View>
          </>
        )}
        </LinearGradient>
        </Animated.View>
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

      <Modal visible={!!menuMsg} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setMenuMsg(null)}>
        <Pressable style={s.modalOverlay} onPress={() => setMenuMsg(null)}>
          <View style={s.menuBox}>
            <Text style={s.menuTitle} numberOfLines={1}>
              {menuMsg?.type === 'shared_post' ? 'Post compartido' : menuMsg?.text}
            </Text>
            <View style={s.emojiRow}>
              {['❤️','😂','😮','😢','🔥','👏'].map(e => (
                <TouchableOpacity key={e} onPress={() => reactToMsg(e)} style={s.emojiBtn}>
                  <Text style={{ fontSize:26 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {menuMsg?.type !== 'shared_post' && (
              <TouchableOpacity style={s.menuItem} onPress={() => { setReplyTo(menuMsg); setText('@' + (menuMsg.sender?.username || '') + ' '); setMenuMsg(null); }}>
                <Text style={s.menuItemTxt}>↩ Responder</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.menuItem} onPress={deleteForMe}>
              <Text style={[s.menuItemTxt, { color:'#ff4444' }]}>🗑 Borrar para mí</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ── Modal Regalo ───────────────────────────────────────────────────── */}
      <Modal visible={giftModal} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setGiftModal(false)}>
        <Pressable style={s.giftOverlay} onPress={() => setGiftModal(false)}>
          <Pressable style={[s.giftSheet, { paddingBottom: Math.max(insets.bottom, 20) }]} onPress={() => {}}>
            <View style={s.giftHandle} />
            <View style={s.giftHead}>
              <Text style={s.giftSheetTitle}>🎁 Enviar regalo a @{other?.username}</Text>
              <TouchableOpacity onPress={() => setGiftModal(false)}>
                <Ionicons name="close" size={20} color={colors.textDim} />
              </TouchableOpacity>
            </View>

            {/* Toggle tipo */}
            <View style={s.giftToggle}>
              <TouchableOpacity
                style={[s.giftToggleBtn, giftType === 'coins' && s.giftToggleBtnActive]}
                onPress={() => { setGiftType('coins'); setGiftFrame(null); setGiftErr(''); }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <CoinIcon size={12} />
                  <Text style={[s.giftToggleTxt, giftType === 'coins' && s.giftToggleTxtActive]}>Monedas</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.giftToggleBtn, giftType === 'frame' && s.giftToggleBtnActive]}
                onPress={() => { setGiftType('frame'); setGiftErr(''); }}
              >
                <Text style={[s.giftToggleTxt, giftType === 'frame' && s.giftToggleTxtActive]}>🖼 Marco</Text>
              </TouchableOpacity>
            </View>

            {giftType === 'coins' && (
              <View style={s.giftField}>
                <Text style={s.giftFieldLbl}>Cantidad de monedas</Text>
                <TextInput
                  style={s.giftInput}
                  value={giftCoins}
                  onChangeText={v => setGiftCoins(v.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  placeholder="Ej: 100"
                  placeholderTextColor={colors.textDim}
                />
                {parseInt(giftCoins) > 0 && (
                  <View style={s.giftCommissionCard}>
                    <Ionicons name="information-circle-outline" size={13} color={colors.textDim} />
                    <Text style={s.giftNote}>El destinatario recibirá <Text style={{ color: 'rgba(251,191,36,0.9)', fontWeight: '700' }}>{Math.round(parseInt(giftCoins) * 0.85)} coins</Text> (se aplica 15% de comisión)</Text>
                  </View>
                )}
              </View>
            )}

            {giftType === 'frame' && (
              <View style={s.giftField}>
                <Text style={s.giftFieldLbl}>Selecciona un marco de tu inventario</Text>
                {giftInvLoad ? (
                  <ActivityIndicator color={colors.c1} style={{ marginVertical: 20 }} />
                ) : giftInv.length === 0 ? (
                  <Text style={s.giftEmptyInv}>No tienes marcos disponibles en tu inventario</Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                    {giftInv.map(item => {
                      const fr = item.frame || item;
                      const selected = giftFrame && (giftFrame.frame || giftFrame)._id === fr._id;
                      return (
                        <TouchableOpacity
                          key={fr._id}
                          style={[s.giftFrameCard, selected && s.giftFrameCardSelected]}
                          onPress={() => { setGiftFrame(item); setGiftErr(''); }}
                          activeOpacity={0.8}
                        >
                          {fr.imageUrl
                            ? <Image source={{ uri: fr.imageUrl }} style={s.giftFrameImg} resizeMode="contain" />
                            : <Ionicons name="sparkles-outline" size={24} color={colors.c1} />}
                          <Text style={s.giftFrameName} numberOfLines={1}>{fr.name}</Text>
                          <Text style={s.giftFrameUnits}>×{item.unidadesEnMano || 0}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
                {giftFrame && (
                  <>
                    <Text style={[s.giftFieldLbl, { marginTop: 12 }]}>Unidades a enviar</Text>
                    <TextInput
                      style={s.giftInput}
                      value={giftCantidad}
                      onChangeText={v => setGiftCantidad(v.replace(/[^0-9]/g, '') || '1')}
                      keyboardType="numeric"
                      placeholder="1"
                      placeholderTextColor={colors.textDim}
                    />
                    <View style={[s.giftCommissionCard, { marginTop: 4 }]}>
                      <Ionicons name="information-circle-outline" size={13} color={colors.textDim} />
                      <Text style={s.giftNote}>
                        Costo de transferencia:{' '}
                        <Text style={{ color: 'rgba(251,191,36,0.9)', fontWeight: '700' }}>
                          {(parseInt(giftCantidad) || 1) * 5} coins
                        </Text>
                        {' '}({parseInt(giftCantidad) || 1} unidad{(parseInt(giftCantidad) || 1) > 1 ? 'es' : ''} × 5)
                      </Text>
                    </View>
                  </>
                )}
              </View>
            )}

            <View style={s.giftField}>
              <Text style={s.giftFieldLbl}>Mensaje (opcional)</Text>
              <TextInput
                style={[s.giftInput, { height: 70, textAlignVertical: 'top' }]}
                value={giftMsg}
                onChangeText={setGiftMsg}
                placeholder="Con mis mejores deseos! 🎁"
                placeholderTextColor={colors.textDim}
                multiline
                maxLength={200}
              />
            </View>

            {!!giftErr && (
              <View style={s.giftErrBox}>
                <Ionicons name="alert-circle-outline" size={14} color={colors.c4} />
                <Text style={s.giftErrTxt}>{giftErr}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[s.giftSendBtn, sendingGift && { opacity: 0.6 }]}
              onPress={sendGift}
              disabled={sendingGift}
            >
              {sendingGift
                ? <ActivityIndicator size={16} color={colors.black} />
                : <><Text style={s.giftSendTxt}>Enviar regalo</Text><Text style={s.giftSendIcon}>🎁</Text></>}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex:1, backgroundColor: colors.black, overflow:'hidden', maxWidth:'100%' },
  header:       { flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:10, gap:12 },
  backBtn:      { width:36, height:36, borderRadius:10, backgroundColor:'rgba(255,255,255,0.08)', alignItems:'center', justifyContent:'center' },
  headerName:   { color: colors.textHi, fontWeight:'700', fontSize:15 },
  typingBar:    { paddingHorizontal:16, paddingVertical:4 },
  typingBarTxt: { color: colors.textDim, fontSize:11, fontStyle:'italic' },
  messagesList: { padding:16, paddingBottom:20 },
  msgRow:       { flexDirection:'row', alignItems:'flex-end', gap:8, marginBottom:10 },
  msgRowMe:     { flexDirection:'row-reverse' },
  msgSenderName:{ color:'rgba(255,255,255,0.7)', fontSize:11, fontWeight:'700', marginLeft: AVATAR_SLOT + 8, marginBottom:2 },
  bubble:       { maxWidth:'75%', borderRadius:10, padding:12, borderWidth:1 },
  bubbleMe:     { backgroundColor:'#0d2137', borderWidth:0 },
  bubbleThem:   { backgroundColor: colors.card, borderWidth:0 },
  bubblePost:   { padding:0, backgroundColor:'transparent', borderColor:'transparent' },
  bubbleGift:   { padding:0, backgroundColor:'transparent', borderColor:'transparent', maxWidth:'90%' },
  bubbleTxt:    { color:'#ffffff', fontSize:14, lineHeight:20 },
  bubbleTime:   { color: colors.textDim, fontSize:9, marginTop:4, textAlign:'right' },
  inputContainer:     { paddingTop: 20, paddingHorizontal: 12 },
  mediaBtnRow:        { flexDirection:'row', gap:2, paddingVertical:10, paddingHorizontal:12 },
  mediaBtn:           { padding:8, justifyContent:'center', alignItems:'center' },
  menuIcon:           { width:25, height:25, resizeMode:'contain' },
  recContainer:       { alignItems:'center', paddingVertical:20, backgroundColor:'rgba(2,5,9,0.95)', borderRadius:20, marginBottom:10, gap:10 },
  recTimerLarge:      { fontSize:32, fontWeight:'700', color:'#fff' },
  recGrabandoTxt:     { color:'rgba(255,255,255,0.4)', fontSize:12 },
  recBarsWrap:        { flexDirection:'row', alignItems:'center', height:36, gap:2 },
  recStopBtnNew:      { marginTop:4, padding:6 },
  recPreviewContainer:{ paddingHorizontal:4, paddingVertical:14, gap:12 },
  recPreviewBtns:     { flexDirection:'row', gap:12 },
  recPreviewCancel:   { flex:1, borderRadius:12, paddingVertical:12, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(239,68,68,0.5)', backgroundColor:'transparent' },
  recPreviewCancelTxt:{ color:'rgba(239,68,68,0.9)', fontWeight:'700', fontSize:14 },
  recPreviewSend:     { flex:1, borderRadius:12, paddingVertical:12, alignItems:'center', justifyContent:'center', backgroundColor:colors.c1 },
  recPreviewSendTxt:  { color:'#020509', fontWeight:'800', fontSize:14 },
  inputRow:     { flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:0, paddingVertical:6 },
  inputWrap:    { flex:1, minWidth:0, flexDirection:'row', alignItems:'center', position:'relative' },
  input:        { flex:1, backgroundColor:'#080f18', borderWidth:1, borderColor: colors.border, borderRadius:12, paddingHorizontal:16, paddingRight:40, paddingVertical:10, color: colors.textHi, fontSize:14 },
  stickerBtn:   { position:'absolute', right:10, top:0, bottom:0, justifyContent:'center', alignItems:'center', width:28 },
  sendBtn:      { width:42, height:42, borderRadius:12, backgroundColor:colors.c1, alignItems:'center', justifyContent:'center', flexShrink:0 },
  blockedBanner:    { flexDirection:'row', alignItems:'center', gap:8, margin:12, padding:12, backgroundColor:'rgba(239,68,68,0.07)', borderRadius:12, borderWidth:1, borderColor:'rgba(239,68,68,0.25)' },
  blockedBannerTxt: { flex:1, color:'rgba(239,68,68,0.8)', fontSize:12 },
  datePill:     { alignSelf:'center', backgroundColor:'rgba(2,5,9,0.55)', borderRadius:10, paddingHorizontal:14, paddingVertical:4, marginVertical:10, borderWidth:1, borderColor:'rgba(255,255,255,0.08)' },
  datePillTxt:  { color:'rgba(255,255,255,0.6)', fontSize:11, fontWeight:'500' },
  modalOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.6)', justifyContent:'center', alignItems:'center' },
  menuBox:      { backgroundColor: colors.surface, borderRadius:16, padding:16, width:280, borderWidth:1, borderColor: colors.borderC },
  menuTitle:    { color: colors.textDim, fontSize:12, marginBottom:12, fontStyle:'italic' },
  emojiRow:     { flexDirection:'row', justifyContent:'space-around', marginBottom:12 },
  emojiBtn:     { padding:6 },
  menuItem:     { paddingVertical:12, borderTopWidth:1, borderTopColor: colors.border },
  menuItemTxt:  { color: colors.textHi, fontSize:15, textAlign:'center' },
  replyBar:     { flexDirection:'row', alignItems:'center', backgroundColor:'transparent', paddingHorizontal:12, paddingVertical:8, borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.06)' },
  replyBarUser: { color:'#aaa', fontSize:11, fontWeight:'700' },
  replyBarTxt:  { color:'#666', fontSize:12 },
  replyPreview: { backgroundColor:'rgba(0,229,204,0.08)', borderLeftWidth:3, borderLeftColor:colors.c1, borderRadius:8, paddingHorizontal:10, paddingVertical:6, marginBottom:6 },
  replyUser:    { color:colors.c1, fontSize:10, fontWeight:'700' },
  replyText:    { color:'rgba(255,255,255,0.55)', fontSize:11 },
  msgReactions:     { flexDirection:'row', gap:2, marginTop:4 },
  msgReactionEmoji: { fontSize:16 },
  mentionDropdown:  { backgroundColor:'#1a1a1a', borderTopWidth:1, borderTopColor:'#333' },
  mentionItem:      { flexDirection:'row', alignItems:'center', paddingVertical:10, paddingHorizontal:16, gap:4, borderBottomWidth:1, borderBottomColor:'#222' },
  mentionAt:        { color:'#666', fontSize:14 },
  mentionName:      { color:'#eee', fontSize:14, fontWeight:'600' },
  scrollDownBtn:    { position:'absolute', bottom:260, right:16, width:38, height:38, borderRadius:19, backgroundColor: colors.surface, borderWidth:1, borderColor: colors.borderC, alignItems:'center', justifyContent:'center', elevation:5 },
  newMsgDot:        { position:'absolute', top:6, right:6, width:8, height:8, borderRadius:4, backgroundColor: colors.c1 },

  // Gift modal
  giftOverlay:      { flex:1, backgroundColor:'rgba(0,0,0,0.72)', justifyContent:'flex-end' },
  giftSheet:        { backgroundColor:colors.surface, borderTopLeftRadius:28, borderTopRightRadius:28, borderWidth:1, borderColor:colors.border, borderBottomWidth:0, padding:20, paddingBottom:36, maxHeight:'85%' },
  giftHandle:       { width:40, height:4, borderRadius:2, backgroundColor:colors.border, alignSelf:'center', marginBottom:16 },
  giftHead:         { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:16 },
  giftSheetTitle:   { color:colors.textHi, fontSize:15, fontWeight:'700' },
  giftToggle:       { flexDirection:'row', backgroundColor:colors.deep, borderRadius:14, padding:4, marginBottom:16, gap:4 },
  giftToggleBtn:    { flex:1, paddingVertical:8, borderRadius:11, alignItems:'center' },
  giftToggleBtnActive: { backgroundColor:colors.c3 },
  giftToggleTxt:    { color:colors.textDim, fontSize:13, fontWeight:'600' },
  giftToggleTxtActive: { color:'#fff', fontWeight:'800' },
  giftField:        { marginBottom:14 },
  giftFieldLbl:     { color:colors.textMid, fontSize:11, fontWeight:'700', marginBottom:8, letterSpacing:0.5 },
  giftInput:        { backgroundColor:colors.deep, borderRadius:14, borderWidth:1, borderColor:colors.border, color:colors.textHi, fontSize:15, paddingHorizontal:14, paddingVertical:11 },
  giftNote:         { color:colors.textDim, fontSize:11, flex:1 },
  giftCommissionCard: { flexDirection:'row', alignItems:'flex-start', gap:6, backgroundColor:'rgba(255,255,255,0.04)', borderRadius:10, borderWidth:1, borderColor:colors.border, padding:10, marginTop:8 },
  giftEmptyInv:     { color:colors.textDim, fontSize:13, textAlign:'center', paddingVertical:20 },
  giftFrameCard:    { width:90, height:100, backgroundColor:colors.deep, borderRadius:12, borderWidth:1, borderColor:colors.border, alignItems:'center', justifyContent:'center', marginRight:10, padding:8 },
  giftFrameCardSelected: { borderColor:colors.c3, backgroundColor:'rgba(168,85,247,0.1)' },
  giftFrameImg:     { width:50, height:50, marginBottom:4 },
  giftFrameName:    { color:colors.textHi, fontSize:9, fontWeight:'600', textAlign:'center' },
  giftFrameUnits:   { color:colors.c1, fontSize:8 },
  giftErrBox:       { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'rgba(249,115,22,0.1)', borderRadius:12, borderWidth:1, borderColor:'rgba(249,115,22,0.25)', padding:10, marginBottom:12 },
  giftErrTxt:       { color:colors.c4, fontSize:12, flex:1 },
  giftSendBtn:      { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:colors.c3, borderRadius:18, paddingVertical:14, marginTop:4 },
  giftSendTxt:      { color:'#fff', fontSize:15, fontWeight:'800' },
  giftSendIcon:     { fontSize:16 },


});
