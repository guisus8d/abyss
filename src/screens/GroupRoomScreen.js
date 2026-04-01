import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Image, FlatList, StatusBar, ActivityIndicator,
  Modal, Pressable, Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { AudioRecorder, AudioQuality, setAudioModeAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { connectSocket } from '../services/socket';
import { useFocusEffect } from '@react-navigation/native';
import AvatarWithFrame from '../components/AvatarWithFrame';
import AudioMessage from '../components/AudioMessage';

const AVATAR_SLOT = 38;

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
      return <Text key={i} style={{ fontWeight:'700', color:'#fff' }} onPress={() => navigation.navigate('PublicProfile', { username })}>{part}</Text>;
    }
    if (/^https?:\/\//.test(part)) {
      const postId = part.match(/abyss\.social\/post\/([a-f0-9]{24})/i)?.[1];
      if (postId) return <Text key={i} style={{ color:'#00e5cc', fontWeight:'600' }} onPress={() => navigation.navigate('PostDetail', { postId })}>🔗 Ver post en Abyss</Text>;
      return <Text key={i} style={{ color:'#00e5cc', textDecorationLine:'underline' }} onPress={() => Linking.openURL(part).catch(() => {})}>{part}</Text>;
    }
    return <Text key={i}>{part}</Text>;
  });
}

// ─── Mensaje de sistema ───────────────────────────────────────────────────────
function SystemMessage({ msg }) {
  const icons = { join: '👋', leave: '🚪', kick: '🦵', ban: '🚫' };
  const icon  = icons[msg.systemAction] || 'ℹ️';
  return (
    <View style={s.sysRow}>
      <Text style={s.sysTxt}>{icon} {msg.text}</Text>
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
        <Text style={{ color:'#00e5cc', fontSize:11, fontWeight:'700', flex:1 }}>@{sharedPost.authorUsername}</Text>
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
  msg, index, reversedMessages, isMe, user, group, isAdmin,
  navigation, onOpenMenu, onReply, onFullImg,
}) {
  const sender       = msg.sender;
  const prevMsg      = reversedMessages[index + 1];
  const prevSenderId = (prevMsg?.sender?._id || prevMsg?.sender)?.toString();
  const thisSenderId = (sender?._id || sender)?.toString();
  const sameAsPrev   = prevMsg && prevMsg.type !== 'system' && prevSenderId === thisSenderId;
  const showAvatar   = !sameAsPrev && msg.type !== 'system';
  const showDate     = !prevMsg || dateLabel(msg.createdAt) !== dateLabel(prevMsg.createdAt);

  // Mensaje de sistema
  if (msg.type === 'system') {
    return (
      <>
        <SystemMessage msg={msg} />
        {showDate && (
          <View style={s.dateSep}>
            <View style={s.dateLine} /><Text style={s.dateLabel}>{dateLabel(msg.createdAt)}</Text><View style={s.dateLine} />
          </View>
        )}
      </>
    );
  }

  const displayName  = isMe ? (user?.username || 'Tú') : (sender?.username || '');
  const senderRole   = group?.members?.find(m => (m.user?._id || m.user)?.toString() === thisSenderId)?.role;
  const senderIsAdmin = senderRole === 'admin';
  const isPostType   = msg.type === 'shared_post';
  const isDeleted    = msg.deletedFor?.map(d => d.toString()).includes(user?._id?.toString());

  return (
    <>
      {showDate && (
        <View style={s.dateSep}>
          <View style={s.dateLine} /><Text style={s.dateLabel}>{dateLabel(msg.createdAt)}</Text><View style={s.dateLine} />
        </View>
      )}

      <View style={{ marginBottom: 4 }}>
        {showAvatar && (
          <View style={[s.msgSenderRow, isMe && s.msgSenderRowMe]}>
            <Text style={s.msgSenderName}>{displayName}</Text>
            {senderIsAdmin && (
              <View style={s.adminBadge}><Text style={s.adminBadgeTxt}>Admin</Text></View>
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
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem, isPostType && s.bubblePost]}
            delayLongPress={350}
            onLongPress={() => !isDeleted && onOpenMenu(msg)}
            activeOpacity={0.85}
          >
            {isDeleted ? (
              <Text style={[s.bubbleText, { opacity:0.4, fontStyle:'italic' }]}>Mensaje eliminado</Text>
            ) : (
              <>
                {msg.replyTo?.text && (
                  <View style={s.replyPreview}>
                    <Text style={s.replyUser}>↩ {msg.replyTo.senderUsername}</Text>
                    <Text style={s.replyText} numberOfLines={1}>{msg.replyTo.text}</Text>
                  </View>
                )}
                {msg.type === 'shared_post' && msg.sharedPost
                  ? <SharedPostBubble sharedPost={msg.sharedPost} navigation={navigation} isMe={isMe} onPress={() => onOpenMenu(msg)} />
                  : msg.type === 'audio' && msg.mediaUrl
                  ? <AudioMessage uri={msg.mediaUrl} isMe={isMe} duration={msg.audioDuration || 0} />
                  : msg.type === 'image' && msg.mediaUrl
                  ? (
                    <TouchableOpacity onPress={() => onFullImg(msg.mediaUrl)} activeOpacity={0.9}>
                      <Image source={{ uri: msg.mediaUrl }} style={{ width:200, height:200, borderRadius:10, marginBottom:4 }} resizeMode="cover" />
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
            {!isPostType && !isDeleted && (
              <Text style={s.bubbleTime}>{timeStr(msg.createdAt)}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
});

// ─── GroupRoomScreen ──────────────────────────────────────────────────────────
export default function GroupRoomScreen({ route, navigation }) {
  const { group: initialGroup } = route.params;
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [group,        setGroup]        = useState(initialGroup);
  const [messages,     setMessages]     = useState([]);
  const [text,         setText]         = useState('');
  const [loading,      setLoading]      = useState(true);
  const [sending,      setSending]      = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [isRecording,  setIsRecording]  = useState(false);
  const [recSeconds,   setRecSeconds]   = useState(0);
  const [audioPreview, setAudioPreview] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [fullImg,      setFullImg]      = useState(null);
  const [replyTo,      setReplyTo]      = useState(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  // Modal de opciones personalizado
  const [menuMsg,      setMenuMsg]      = useState(null);
  const [menuVisible,  setMenuVisible]  = useState(false);
  const [banConfirm,   setBanConfirm]   = useState(false);

  const flatRef      = useRef(null);
  const socketRef    = useRef(null);
  const recordingRef = useRef(null);
  const recTimerRef  = useRef(null);
  const recSecsRef   = useRef(0);
  const sendingRef   = useRef(false);

  const isAdmin = group?.members?.some(
    m => ((m.user?._id || m.user)?.toString()) === user?._id?.toString() && m.role === 'admin'
  );

  const reversedMessages = useMemo(() => [...messages].reverse(), [messages]);

  useFocusEffect(useCallback(() => {
    api.get(`/groups/${group._id}`)
      .then(({ data }) => setGroup(data.group))
      .catch(() => {});
  }, [group._id]));

  useEffect(() => {
    loadGroup();
    setupSocket();
    return () => {
      if (socketRef.current) {
        socketRef.current.emit('group:leave', { groupId: group._id });
        socketRef.current.off('group:message');
        socketRef.current.off('group:message_deleted');
      }
      clearInterval(recTimerRef.current);
    };
  }, []);

  async function loadGroup() {
    try {
      const { data } = await api.get(`/groups/${group._id}`);
      setGroup(data.group);
      setMessages(data.group.messages || []);
      api.post(`/groups/${group._id}/read`).catch(() => {});
    } catch (e) { console.log('loadGroup error:', e.message); }
    finally { setLoading(false); }
  }

  async function setupSocket() {
    const socket = await connectSocket();
    socketRef.current = socket;

    // Limpiar listeners viejos
    socket.off('group:message');
    socket.off('group:message_deleted');

    socket.emit('group:join', { groupId: group._id });

    socket.on('group:message', ({ groupId, message }) => {
      if (groupId.toString() !== group._id.toString()) return;
      setMessages(prev =>
        prev.some(m => m._id?.toString() === message._id?.toString()) ? prev : [...prev, message]
      );
      flatRef.current?.scrollToOffset({ offset: 0, animated: true });
      api.post(`/groups/${group._id}/read`).catch(() => {});
    });

    // Borrado en tiempo real — actualiza a todos los miembros al instante
    socket.on('group:message_deleted', ({ groupId, msgId }) => {
      if (groupId.toString() !== group._id.toString()) return;
      setMessages(prev => prev.filter(m => m._id?.toString() !== msgId?.toString()));
    });
  }

  function openMenu(msg) {
    setMenuMsg(msg);
    setMenuVisible(true);
    setBanConfirm(false);
  }

  function closeMenu() {
    setMenuVisible(false);
    setMenuMsg(null);
    setBanConfirm(false);
  }

  async function handleDeleteMessage(msgId, forAll) {
    closeMenu();
    try {
      await api.delete(`/groups/${group._id}/message/${msgId}?forAll=${forAll}`);
      if (forAll) {
        // El socket ya lo borrará para todos; pero también lo borramos localmente
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

  async function handleBanUser(userId, username) {
    closeMenu();
    try {
      await api.post(`/groups/${group._id}/ban/${userId}`);
      setGroup(prev => ({
        ...prev,
        members: prev.members.filter(m => (m.user?._id || m.user)?.toString() !== userId?.toString()),
      }));
    } catch {}
  }

  function sendMessage() {
    if (!text.trim() || sendingRef.current) return;
    sendingRef.current = true;
    setText('');
    socketRef.current?.emit('group:message', {
      groupId: group._id,
      text:    text.trim(),
      type:    'text',
      replyTo: replyTo ? {
        messageId:      replyTo._id,
        text:           replyTo.text,
        senderUsername: replyTo.sender?.username || '',
      } : undefined,
    });
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
    try {
      setUploading(true);
      const formData = new FormData();
      const blob = await fetch(uri).then(r => r.blob());
      formData.append('file', blob, 'group.jpg');
      const { data } = await api.post('/chats/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      socketRef.current?.emit('group:message', { groupId: group._id, text: '', type: 'image', mediaUrl: data.url });
    } catch (e) { console.log('confirmSendImage error:', e.message); }
    finally { setUploading(false); }
  }

  async function startRecording() {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) return;
      await setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const recorder = new AudioRecorder({ quality: AudioQuality.HIGH });
      await recorder.prepareToRecordAsync();
      recorder.record();
      recordingRef.current = recorder;
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
      await recordingRef.current?.stop();
      const uri = recordingRef.current?.uri;
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
    try {
      setUploading(true);
      const blob = await fetch(preview.uri).then(r => r.blob());
      const formData = new FormData();
      formData.append('file', blob, 'audio.m4a');
      const { data } = await api.post('/chats/upload', formData, { headers: { 'Content-Type': 'multipart/form-data', 'x-file-type': 'audio' } });
      socketRef.current?.emit('group:message', { groupId: group._id, text: '', type: 'audio', mediaUrl: data.url, audioDuration: preview.duration });
    } catch (e) { console.log('sendAudioPreview error:', e.message); }
    finally { setUploading(false); }
  }

  function cancelAudioPreview() { setAudioPreview(null); recordingRef.current = null; }

  const renderMessage = useCallback(({ item: msg, index }) => {
    const isMe = (msg.sender?._id || msg.sender)?.toString() === user?._id?.toString();
    return (
      <MessageBubble
        msg={msg}
        index={index}
        isMe={isMe}
        reversedMessages={reversedMessages}
        user={user}
        group={group}
        isAdmin={isAdmin}
        navigation={navigation}
        onOpenMenu={openMenu}
        onReply={setReplyTo}
        onFullImg={setFullImg}
      />
    );
  }, [reversedMessages, user, group, isAdmin]);

  // Datos del mensaje en el menú
  const menuIsMe    = menuMsg && (menuMsg.sender?._id || menuMsg.sender)?.toString() === user?._id?.toString();
  const menuSender  = menuMsg?.sender;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      {/* ── Modal preview imagen ─────────────────────────────────────────────── */}
      <Modal visible={!!imagePreview} transparent animationType="fade" onRequestClose={() => setImagePreview(null)}>
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
      <Modal visible={!!fullImg} transparent animationType="fade" onRequestClose={() => setFullImg(null)}>
        <Pressable style={{ flex:1, backgroundColor:'rgba(0,0,0,0.95)', alignItems:'center', justifyContent:'center' }} onPress={() => setFullImg(null)}>
          {fullImg && <Image source={{ uri: fullImg }} style={{ width:'95%', height:'70%', borderRadius:12 }} resizeMode="contain" />}
          <Text style={{ color:'rgba(255,255,255,0.4)', marginTop:16, fontSize:12 }}>Toca para cerrar</Text>
        </Pressable>
      </Modal>

      {/* ── Modal opciones del mensaje ───────────────────────────────────────── */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={closeMenu}>
        <Pressable style={s.menuOverlay} onPress={closeMenu}>
          <Pressable style={s.menuBox} onPress={e => e.stopPropagation()}>
            {/* Preview del mensaje */}
            <View style={s.menuPreview}>
              <Text style={s.menuPreviewName}>{menuIsMe ? 'Tú' : (menuSender?.username || '')}</Text>
              <Text style={s.menuPreviewTxt} numberOfLines={2}>
                {menuMsg?.type === 'image' ? '📷 Imagen' : menuMsg?.type === 'audio' ? '🎵 Audio' : menuMsg?.type === 'shared_post' ? '🔗 Post compartido' : (menuMsg?.text || '')}
              </Text>
            </View>

            {!banConfirm ? (
              <>
                {/* Responder */}
                <TouchableOpacity style={s.menuItem} onPress={() => { setReplyTo(menuMsg); closeMenu(); }}>
                  <Ionicons name="return-down-back-outline" size={18} color={colors.textHi} />
                  <Text style={s.menuItemTxt}>Responder</Text>
                </TouchableOpacity>

                {/* Borrar para todos — propio o admin */}
                {(menuIsMe || isAdmin) && (
                  <TouchableOpacity style={s.menuItem} onPress={() => handleDeleteMessage(menuMsg._id, true)}>
                    <Ionicons name="trash-outline" size={18} color="#ff4444" />
                    <Text style={[s.menuItemTxt, { color:'#ff4444' }]}>Borrar para todos</Text>
                  </TouchableOpacity>
                )}

                {/* Borrar solo para mí */}
                <TouchableOpacity style={s.menuItem} onPress={() => handleDeleteMessage(menuMsg._id, false)}>
                  <Ionicons name="eye-off-outline" size={18} color={colors.textDim} />
                  <Text style={[s.menuItemTxt, { color: colors.textDim }]}>Borrar para mí</Text>
                </TouchableOpacity>

                {/* Banear — solo admin y no es su propio mensaje */}
                {isAdmin && !menuIsMe && menuSender?.username && (
                  <TouchableOpacity style={[s.menuItem, { borderTopWidth:1, borderTopColor:'rgba(255,68,68,0.2)', marginTop:4 }]}
                    onPress={() => setBanConfirm(true)}>
                    <Ionicons name="ban-outline" size={18} color="#ff4444" />
                    <Text style={[s.menuItemTxt, { color:'#ff4444' }]}>Banear a {menuSender.username}</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={[s.menuItem, s.menuCancel]} onPress={closeMenu}>
                  <Text style={[s.menuItemTxt, { color: colors.textDim, textAlign:'center', width:'100%' }]}>Cancelar</Text>
                </TouchableOpacity>
              </>
            ) : (
              /* Confirmación de baneo */
              <>
                <View style={{ padding:16, alignItems:'center', gap:8 }}>
                  <Text style={{ color:'#ff4444', fontSize:16, fontWeight:'700' }}>🚫 Banear a {menuSender?.username}</Text>
                  <Text style={{ color: colors.textDim, fontSize:13, textAlign:'center' }}>
                    El usuario será expulsado y no podrá volver a unirse al grupo.
                  </Text>
                </View>
                <TouchableOpacity style={[s.menuItem, { backgroundColor:'rgba(255,68,68,0.1)' }]}
                  onPress={() => handleBanUser(menuSender?._id || menuSender, menuSender?.username)}>
                  <Ionicons name="ban-outline" size={18} color="#ff4444" />
                  <Text style={[s.menuItemTxt, { color:'#ff4444' }]}>Confirmar baneo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.menuItem, s.menuCancel]} onPress={() => setBanConfirm(false)}>
                  <Text style={[s.menuItemTxt, { color: colors.textDim, textAlign:'center', width:'100%' }]}>Atrás</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.textHi} />
          </TouchableOpacity>
          <TouchableOpacity style={s.headerInfo}
            onPress={() => isAdmin && navigation.navigate('GroupSettings', { group })}>
            {group.imageUrl
              ? <Image source={{ uri: group.imageUrl }} style={s.groupAvatar} />
              : <View style={s.groupAvatarPlaceholder}><Ionicons name="people" size={18} color={colors.c1} /></View>}
            <View style={{ flex:1 }}>
              <Text style={s.groupName} numberOfLines={1}>{group.name}</Text>
              <Text style={s.groupMembers}>{group.members?.length || 0} miembros</Text>
            </View>
          </TouchableOpacity>
          {isAdmin && (
            <TouchableOpacity onPress={() => navigation.navigate('GroupSettings', { group })} style={s.settingsBtn}>
              <Ionicons name="settings-outline" size={20} color={colors.textDim} />
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      {/* ── Cuerpo ───────────────────────────────────────────────────────────── */}
      <View style={{ flex: 1 }}>
        {/* FIX: el spinner ocupa flex:1 para no desplazar el inputRow */}
        {loading ? (
          <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
            <ActivityIndicator color={colors.c1} size="large" />
          </View>
        ) : (
          <FlatList
            ref={flatRef}
            style={{ flex: 1 }}
            data={reversedMessages}
            keyExtractor={(m) => String(m._id)}
            renderItem={renderMessage}
            contentContainerStyle={s.messageList}
            inverted
            removeClippedSubviews={true}
            windowSize={5}
            maxToRenderPerBatch={10}
            initialNumToRender={15}
            updateCellsBatchingPeriod={50}
            keyboardShouldPersistTaps="handled"
            onScroll={(e) => setShowScrollBtn(e.nativeEvent.contentOffset.y > 150)}
            scrollEventThrottle={32}
          />
        )}

        {replyTo && (
          <View style={s.replyBar}>
            <View style={{ flex:1 }}>
              <Text style={s.replyBarUser}>↩ {replyTo.sender?.username || 'usuario'}</Text>
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
          <View style={[s.inputRow, { paddingBottom: insets.bottom > 0 ? insets.bottom : 10 }]}>
            <TouchableOpacity onPress={pickImage} disabled={uploading || isRecording} style={s.mediaBtn}>
              {uploading ? <ActivityIndicator size={16} color={colors.c1} /> : <Ionicons name="image-outline" size={20} color={colors.textDim} />}
            </TouchableOpacity>
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
                <Ionicons name="mic-outline" size={20} color={colors.textDim} />
              </TouchableOpacity>
            )}
            <TextInput
              style={s.input}
              value={text}
              onChangeText={setText}
              placeholder="Mensaje..."
              placeholderTextColor={colors.textDim}
              multiline
              maxLength={2000}
              blurOnSubmit={false}
              onSubmitEditing={sendMessage}
            />
            <TouchableOpacity
              style={[s.sendBtn, (!text.trim() || sending) && s.sendBtnDisabled]}
              onPress={sendMessage}
              disabled={!text.trim() || sending}>
              <Ionicons name="send" size={16} color={colors.black} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {showScrollBtn && (
        <TouchableOpacity style={s.scrollDownBtn} onPress={() => flatRef.current?.scrollToOffset({ offset:0, animated:true })}>
          <Ionicons name="chevron-down" size={20} color={colors.c1} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex:1, backgroundColor: colors.black },

  // Header
  header:      { flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:12, borderBottomWidth:1, borderBottomColor: colors.border, gap:12 },
  backBtn:     { width:36, height:36, borderRadius:10, backgroundColor:'rgba(255,255,255,0.08)', alignItems:'center', justifyContent:'center' },
  settingsBtn: { padding:6 },
  headerInfo:  { flex:1, flexDirection:'row', alignItems:'center', gap:10 },
  groupAvatar:            { width:38, height:38, borderRadius:10 },
  groupAvatarPlaceholder: { width:38, height:38, borderRadius:10, backgroundColor: colors.surface, borderWidth:1, borderColor: colors.borderC, alignItems:'center', justifyContent:'center' },
  groupName:    { color: colors.textHi, fontSize:14, fontWeight:'700' },
  groupMembers: { color: colors.textDim, fontSize:11 },

  // Mensajes
  messageList:    { paddingHorizontal:16, paddingVertical:12, gap:4 },
  msgRow:         { flexDirection:'row', alignItems:'flex-end', gap:8, marginBottom:2 },
  msgRowMe:       { flexDirection:'row-reverse' },
  msgSenderRow:   { flexDirection:'row', alignItems:'center', gap:6, marginLeft: AVATAR_SLOT + 8, marginBottom:4 },
  msgSenderRowMe: { flexDirection:'row-reverse', marginLeft:0, marginRight: AVATAR_SLOT + 8, marginBottom:4 },
  msgSenderName:  { color:'rgba(255,255,255,0.65)', fontSize:11, fontWeight:'700' },
  adminBadge:     { backgroundColor:'rgba(0,200,120,0.12)', borderRadius:4, borderWidth:1, borderColor:'rgba(0,200,120,0.4)', paddingHorizontal:4, paddingVertical:1 },
  adminBadgeTxt:  { color:'rgba(0,220,130,1)', fontSize:7.5, fontWeight:'800', letterSpacing:0.3 },

  bubble:      { maxWidth:'75%', borderRadius:16, padding:10, gap:4 },
  bubbleMe:    { backgroundColor:'rgba(0,180,160,0.85)', borderBottomRightRadius:4 },
  bubbleThem:  { backgroundColor: colors.surface, borderBottomLeftRadius:4, borderWidth:1, borderColor: colors.border },
  bubblePost:  { padding:0, backgroundColor:'transparent', borderColor:'transparent', borderWidth:0 },
  bubbleText:  { color:'#ffffff', fontSize:14, lineHeight:20 },
  bubbleTime:  { color:'rgba(255,255,255,0.4)', fontSize:9, alignSelf:'flex-end' },

  // Mensaje de sistema
  sysRow: { alignItems:'center', marginVertical:8 },
  sysTxt: { color:'rgba(255,255,255,0.45)', fontSize:11, backgroundColor:'rgba(255,255,255,0.06)', paddingHorizontal:12, paddingVertical:4, borderRadius:20, overflow:'hidden', textAlign:'center' },

  // Separador de fecha
  dateSep:   { flexDirection:'row', alignItems:'center', marginVertical:10, paddingHorizontal:8 },
  dateLine:  { flex:1, height:1, backgroundColor: colors.border },
  dateLabel: { color: colors.textDim, fontSize:11, marginHorizontal:10 },

  // Input
  inputRow:        { flexDirection:'row', alignItems:'center', paddingHorizontal:12, paddingVertical:10, borderTopWidth:1, borderTopColor: colors.border, gap:8 },
  mediaBtn:        { padding:8, justifyContent:'center', alignItems:'center' },
  input:           { flex:1, backgroundColor: colors.surface, borderRadius:16, borderWidth:1, borderColor: colors.border, paddingHorizontal:14, paddingVertical:10, color: colors.textHi, fontSize:14, maxHeight:100 },
  sendBtn:         { width:36, height:36, borderRadius:18, backgroundColor: colors.c1, alignItems:'center', justifyContent:'center' },
  sendBtnDisabled: { opacity:0.4 },

  recRow:  { flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:8 },
  recDot:  { width:8, height:8, borderRadius:4, backgroundColor:'rgba(239,68,68,0.9)' },
  recTimer:{ color: colors.c1, fontSize:13, fontWeight:'700', minWidth:38 },
  recStop: { width:28, height:28, borderRadius:14, backgroundColor:'rgba(239,68,68,0.8)', alignItems:'center', justifyContent:'center' },

  replyBar:     { flexDirection:'row', alignItems:'center', backgroundColor:'rgba(255,255,255,0.05)', paddingHorizontal:12, paddingVertical:8, borderTopWidth:1, borderTopColor:'rgba(255,255,255,0.08)' },
  replyBarUser: { color:'rgba(0,229,204,0.8)', fontSize:11, fontWeight:'700' },
  replyBarTxt:  { color:'rgba(255,255,255,0.4)', fontSize:12 },
  replyPreview: { backgroundColor:'rgba(255,255,255,0.06)', borderLeftWidth:2, borderLeftColor:'rgba(0,229,204,0.5)', paddingLeft:8, paddingVertical:4, marginBottom:6, borderRadius:4 },
  replyUser:    { color:'rgba(0,229,204,0.8)', fontSize:10, fontWeight:'700' },
  replyText:    { color:'rgba(255,255,255,0.4)', fontSize:11 },

  audioPreviewRow:    { flexDirection:'row', alignItems:'center', justifyContent:'center', paddingHorizontal:16, paddingVertical:10, gap:12, borderTopWidth:1, borderTopColor:'rgba(255,255,255,0.06)', backgroundColor: colors.surface },
  audioPreviewCancel: { width:36, height:36, borderRadius:18, backgroundColor:'rgba(239,68,68,0.1)', borderWidth:1, borderColor:'rgba(239,68,68,0.3)', alignItems:'center', justifyContent:'center' },
  audioPreviewSend:   { width:36, height:36, borderRadius:18, backgroundColor:'rgba(0,229,204,0.8)', alignItems:'center', justifyContent:'center' },
  scrollDownBtn:      { position:'absolute', bottom:130, right:16, width:38, height:38, borderRadius:19, backgroundColor: colors.surface, borderWidth:1, borderColor: colors.borderC, alignItems:'center', justifyContent:'center', elevation:5 },

  // Modal opciones
  menuOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.65)', justifyContent:'flex-end' },
  menuBox:     { backgroundColor: colors.surface, borderTopLeftRadius:20, borderTopRightRadius:20, paddingBottom:24, borderWidth:1, borderColor: colors.borderC, overflow:'hidden' },
  menuPreview: { padding:16, borderBottomWidth:1, borderBottomColor: colors.border, backgroundColor:'rgba(255,255,255,0.03)' },
  menuPreviewName: { color: colors.c1, fontSize:11, fontWeight:'700', marginBottom:3 },
  menuPreviewTxt:  { color: colors.textDim, fontSize:12 },
  menuItem:    { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:20, paddingVertical:15 },
  menuItemTxt: { color: colors.textHi, fontSize:15, fontWeight:'500', flex:1 },
  menuCancel:  { marginTop:4, borderTopWidth:1, borderTopColor: colors.border, justifyContent:'center' },
});
