import React, { useState, useEffect, useRef } from 'react';
import {
  View, ActivityIndicator, Text, TextInput, TouchableOpacity, FlatList, Image, Modal, Pressable,
  StyleSheet, StatusBar, SafeAreaView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import AudioMessage from '../components/AudioMessage';
import AvatarWithFrame from '../components/AvatarWithFrame';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { connectSocket } from '../services/socket';

function renderTextWithMentions(text, navigation) {
  const parts = text.split(/(@\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      const username = part.slice(1);
      return (
        <Text
          key={i}
          style={{ fontWeight: '700', color: '#fff' }}
          onPress={() => navigation.navigate('PublicProfile', { username })}
        >
          {part}
        </Text>
      );
    }
    return <Text key={i}>{part}</Text>;
  });
}

function dateLabel(date) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Hoy';
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';

  const days = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const diff = (today - d) / (1000 * 60 * 60 * 24);
  if (diff < 7) return days[d.getDay()];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function timeStr(date) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatRoomScreen({ route, navigation }) {
  const { chat, other, requestMode = false, alreadyRequested = false } = route.params;
  const { user }                = useAuthStore();
  const [messages, setMessages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioPreview, setAudioPreview] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [recSeconds, setRecSeconds] = useState(0);
  const recordingRef = useRef(null);
  const recTimerRef = useRef(null);
  const [fullImg, setFullImg] = useState(null);
  const [text, setText]         = useState('');
  const [typing, setTyping]     = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [reqSent, setReqSent] = useState(alreadyRequested);
  const [sendingReq, setSendingReq] = useState(false);
  const flatRef     = useRef(null);
  const [menuMsg, setMenuMsg]     = useState(null); // mensaje seleccionado
  const [replyTo, setReplyTo]     = useState(null); // mensaje a responder
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const typingTimer = useRef(null);
  const socketRef   = useRef(null);

  async function handleSendRequest() {
    if (reqSent) return;
    setSendingReq(true);
    try {
      await api.post(`/chats/request/${other._id}`);
      setReqSent(true);
    } catch (err) {
      // Si ya existe solicitud, marcar como enviada igual
      setReqSent(true);
    } finally {
      setSendingReq(false);
    }
  }

  function scrollToBottom(animated = true) {
    setTimeout(() => flatRef.current?.scrollToEnd({ animated }), 300);
  }

  useEffect(() => {
    if (requestMode) {
      // Cargar mensajes previos de la solicitud
      api.get('/chats/requests/sent').then(({ data }) => {
        const myReq = data.sent?.find(s => s.to._id === other._id);
        if (myReq?.messages?.length) {
          setMessages(myReq.messages.map(m => ({
            _id: m._id || 'req_' + Math.random(),
            sender: { _id: m.sender },
            text: m.text,
            createdAt: m.createdAt,
          })));
          scrollToBottom(false);
        }
      }).catch(() => {});
      return;
    }

    api.get(`/chats/${chat._id}/messages`)
      .then(({ data }) => {
        setMessages(data.messages || []);
        scrollToBottom(false);
      });

    connectSocket().then(s => {
      socketRef.current = s;
      s.emit('chat:join', { chatId: chat._id.toString() });
      s.emit('chat:read', { chatId: chat._id.toString() }); // marcar como leídos al abrir

      s.on('chat:message', ({ chatId, message }) => {
        if (chatId.toString() === chat._id.toString()) {
          setMessages(prev => {
            const idx = prev.findIndex(m => m._id?.startsWith('temp_'));
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = message;
              return next;
            }
            return [...prev, message];
          });
          // Marcar como leído inmediatamente al recibir
          s.emit('chat:read', { chatId: chat._id.toString() });
          scrollToBottom();
        }
      });

      s.on('chat:typing', ({ userId, isTyping }) => {
        if (userId !== user._id) setTyping(isTyping);
      });
    });

    return () => {
      socketRef.current?.emit('chat:leave', { chatId: chat._id.toString() });
      socketRef.current?.off('chat:message');
      socketRef.current?.off('chat:typing');
    };
  }, []);

  async function handleSend() {
    if (!text.trim()) return;
    const msgText = text.trim();
    const tempMsg = {
      _id: 'temp_' + Date.now(),
      sender: { _id: user._id },
      text: msgText,
      type: 'text',
      mediaUrl: null,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);
    setText('');
    scrollToBottom();

    if (requestMode) {
      // Si no hay solicitud enviada aún, enviarla primero
      if (!reqSent) {
        try {
          await api.post(`/chats/request/${other._id}`);
          setReqSent(true);
        } catch (e) { setReqSent(true); }
      }
      // Guardar mensaje en la solicitud
      try {
        await api.post(`/chats/request/${other._id}/message`, { text: msgText });
      } catch (e) {
        console.log('Error guardando mensaje de solicitud:', e.message);
      }
      return;
    }

    if (!socketRef.current) return;
    socketRef.current.emit('chat:send', {
      chatId: chat._id.toString(),
      text: msgText,
      replyTo: replyTo ? { messageId: replyTo._id, text: replyTo.text, senderUsername: replyTo.sender?.username || '' } : undefined,
    });
    setReplyTo(null);
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
    try {
      setUploading(true);
      const formData = new FormData();
      const blob = await fetch(uri).then(r => r.blob());
      formData.append('file', blob, 'chat.jpg');
      const { data } = await api.post('/chats/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      socketRef.current?.emit('chat:send', { chatId: chat._id.toString(), text: '', type: 'image', mediaUrl: data.url });
    } catch (e) { console.log('confirmSendImage error:', e.message); }
    finally { setUploading(false); }
  }


  async function startRecording() {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true);
      setRecSeconds(0);
      recTimerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
    } catch (e) { console.log('startRecording error:', e.message); }
  }

  async function stopRecording() {
    try {
      setIsRecording(false);
      clearInterval(recTimerRef.current);
      const secs = recSeconds;
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
    try {
      setUploading(true);
      const blob = await fetch(preview.uri).then(r => r.blob());
      const formData = new FormData();
      formData.append('file', blob, 'audio.m4a');
      const { data } = await api.post('/chats/upload', formData, { headers: { 'Content-Type': 'multipart/form-data', 'x-file-type': 'audio' } });
      socketRef.current?.emit('chat:send', { chatId: chat._id.toString(), text: '', type: 'audio', mediaUrl: data.url, audioDuration: preview.duration });
    } catch (e) { console.log('sendAudioPreview error:', e.message); Alert.alert('Error', 'No se pudo enviar el audio'); }
    finally { setUploading(false); }
  }

  function cancelAudioPreview() {
    setAudioPreview(null);
    recordingRef.current = null;
  }

  function handleTyping(val) {
    setText(val);
    // Detectar @ para menciones
    const match = val.match(/@(\w*)$/);
    if (match) {
      const q = match[1].toLowerCase();
      const suggestions = [other].filter(u => u.username.toLowerCase().startsWith(q));
      setMentionSuggestions(suggestions);
    } else {
      setMentionSuggestions([]);
    }
    if (!socketRef.current) return;
    socketRef.current.emit('chat:typing', { chatId: chat._id.toString(), isTyping: true });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socketRef.current?.emit('chat:typing', { chatId: chat._id.toString(), isTyping: false });
    }, 1500);
  }

  function pickMention(username) {
    const newText = text.replace(/@(\w*)$/, `@${username} `);
    setText(newText);
    setMentionSuggestions([]);
  }

  function renderMessage({ item, index }) {
    const showDate = index === 0 || dateLabel(item.createdAt) !== dateLabel(messages[index - 1]?.createdAt);
    const isMe = item.sender?._id === user._id || item.sender === user._id;
    const prevMsg = messages[index - 1];
    const prevSender = prevMsg?.sender?._id || prevMsg?.sender;
    const thisSender = item.sender?._id || item.sender;
    const showName = !isMe && (prevSender?.toString() !== thisSender?.toString());
    const showAvatar = showName;
    return (
      <>
        {showDate && (
          <View style={s.dateSep}>
            <View style={s.dateLine} />
            <Text style={s.dateLabel}>{dateLabel(item.createdAt)}</Text>
            <View style={s.dateLine} />
          </View>
        )}
        {showName && (
          <Text style={s.msgSenderName}>@{other.username}</Text>
        )}
        <View style={[s.msgRow, isMe && s.msgRowMe]}>
        {!isMe && (
          <View style={[{ opacity: showAvatar ? 1 : 0 }]}>
            <AvatarWithFrame
              size={28}
              avatarUrl={other.avatarUrl}
              username={other.username}
              profileFrame={other.profileFrame}
              frameUrl={other.profileFrameUrl}
            />
          </View>
        )}
        <TouchableOpacity
          onLongPress={() => setMenuMsg(item)}
          activeOpacity={0.8}
          style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem]}
        >
          {item.replyTo?.text && (
            <TouchableOpacity style={s.replyPreview} onPress={() => scrollToMsg(item.replyTo.messageId)}>
              <Text style={s.replyUser}>↩ {item.replyTo.senderUsername}</Text>
              <Text style={s.replyText} numberOfLines={1}>{item.replyTo.text}</Text>
            </TouchableOpacity>
          )}
          {item.mediaUrl && item.type === 'audio'
            ? <AudioMessage uri={item.mediaUrl} isMe={isMe} duration={item.audioDuration || 0} />
            : item.mediaUrl && item.type === 'image'
            ? <TouchableOpacity onPress={() => setFullImg(item.mediaUrl)} activeOpacity={0.9}>
                <Image source={{ uri: item.mediaUrl }} style={{ width: 200, height: 200, borderRadius: 10, marginBottom: 4 }} resizeMode="cover" />
              </TouchableOpacity>
            : <Text style={s.bubbleTxt}>{renderTextWithMentions(item.text, navigation)}</Text>}
          <Text style={s.bubbleTime}>{timeStr(item.createdAt)}</Text>
          {item.reactions?.length > 0 && (
            <View style={s.msgReactions}>
              {item.reactions.map((r, i) => (
                <Text key={i} style={s.msgReactionEmoji}>{r.emoji}</Text>
              ))}
            </View>
          )}
        </TouchableOpacity>
      </View>
      </>
    );
  }

  function scrollToMsg(msgId) {
    const idx = messages.findIndex(m => m._id === msgId);
    if (idx < 0) return;
    flatRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
  }

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

  return (
    <View style={s.root}>
      {/* Preview imagen antes de enviar */}
      <Modal visible={!!imagePreview} transparent animationType="fade" onRequestClose={() => setImagePreview(null)}>
        <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.92)', alignItems:'center', justifyContent:'center', padding: 20 }}>
          {imagePreview && <Image source={{ uri: imagePreview }} style={{ width:'100%', height:'60%', borderRadius:16 }} resizeMode="contain" />}
          <View style={{ flexDirection:'row', gap:16, marginTop:20 }}>
            <TouchableOpacity onPress={() => setImagePreview(null)}
              style={{ flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:24, paddingVertical:12, borderRadius:24, borderWidth:1, borderColor:'rgba(239,68,68,0.4)', backgroundColor:'rgba(239,68,68,0.1)' }}>
              <Ionicons name="trash-outline" size={18} color="rgba(239,68,68,0.9)" />
              <Text style={{ color:'rgba(239,68,68,0.9)', fontWeight:'700', fontSize:13 }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={confirmSendImage} disabled={uploading}
              style={{ flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:24, paddingVertical:12, borderRadius:24, backgroundColor:'rgba(0,229,204,0.85)' }}>
              {uploading
                ? <ActivityIndicator size={16} color="#000" />
                : <Ionicons name="send" size={18} color="#000" />}
              <Text style={{ color:'#000', fontWeight:'800', fontSize:13 }}>Enviar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* Visor imagen fullscreen */}
      <Modal visible={!!fullImg} transparent animationType="fade" onRequestClose={() => setFullImg(null)}>
        <Pressable style={{ flex:1, backgroundColor:'rgba(0,0,0,0.95)', alignItems:'center', justifyContent:'center' }} onPress={() => setFullImg(null)}>
          {fullImg && <Image source={{ uri: fullImg }} style={{ width:'95%', height:'70%', borderRadius:12 }} resizeMode="contain" />}
          <Text style={{ color:'rgba(255,255,255,0.4)', marginTop:16, fontSize:12 }}>Toca para cerrar</Text>
        </Pressable>
      </Modal>
      <StatusBar barStyle="light-content" backgroundColor={colors.black} />
      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backTxt}>←</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('PublicProfile', { username: other.username })}
          >
            <AvatarWithFrame
              size={36}
              avatarUrl={other.avatarUrl}
              username={other.username}
              profileFrame={other.profileFrame}
              frameUrl={other.profileFrameUrl}
            />
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.navigate('PublicProfile', { username: other.username })}>
            <Text style={s.headerName}>{other.username}</Text>
            {typing && <Text style={s.typingTxt}>escribiendo...</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(m, i) => String(m._id || i) + '_' + i}
          renderItem={renderMessage}
          contentContainerStyle={s.messagesList}
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            const dist = contentSize.height - layoutMeasurement.height - contentOffset.y;
            setShowScrollBtn(dist > 150);
          }}
          scrollEventThrottle={32}
        />
        {/* Banner de solicitud */}
        {requestMode && (
          <View style={s.reqBanner}>
            <View style={{ flex: 1 }}>
              <Text style={s.reqBannerTitle}>
                {reqSent ? '⏳ Solicitud enviada' : '💬 Enviar solicitud de chat'}
              </Text>
              <Text style={s.reqBannerSub}>
                {reqSent
                  ? `Espera a que ${other.username} acepte tu solicitud`
                  : `${other.username} recibirá una notificación`}
              </Text>
            </View>
            {!reqSent && (
              <TouchableOpacity
                style={s.reqBannerBtn}
                onPress={handleSendRequest}
                disabled={sendingReq}
              >
                <LinearGradient
                  colors={['#006b63', '#00e5cc']}
                  style={s.reqBannerBtnInner}
                  start={{x:0,y:0}} end={{x:1,y:0}}
                >
                  <Text style={s.reqBannerBtnTxt}>
                    {sendingReq ? '...' : 'Enviar'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
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
        {replyTo && (
          <View style={s.replyBar}>
            <View style={{ flex: 1 }}>
              <Text style={s.replyBarUser}>↩ {replyTo.sender?.username || 'usuario'}</Text>
              <Text style={s.replyBarTxt} numberOfLines={1}>{replyTo.text}</Text>
            </View>
            <TouchableOpacity onPress={() => setReplyTo(null)} style={{ padding: 8 }}>
              <Text style={{ color: '#888', fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        {audioPreview ? (
          /* Preview audio grabado */
          <View style={s.audioPreviewRow}>
            <TouchableOpacity onPress={cancelAudioPreview} style={s.audioPreviewCancel}>
              <Ionicons name="trash-outline" size={18} color="rgba(239,68,68,0.8)" />
            </TouchableOpacity>
            <AudioMessage uri={audioPreview.uri} isMe={true} duration={audioPreview.duration} />
            <TouchableOpacity onPress={sendAudioPreview} disabled={uploading} style={s.audioPreviewSend}>
              {uploading
                ? <ActivityIndicator size={16} color="#fff" />
                : <Ionicons name="send" size={16} color="#fff" />}
            </TouchableOpacity>
          </View>
        ) : (
        <View style={s.inputRow}>
          <TouchableOpacity onPress={sendImage} disabled={uploading || isRecording} style={s.mediaBtn}>
            {uploading ? <ActivityIndicator size={16} color={colors.c1} /> : <Ionicons name="image-outline" size={20} color={colors.textDim} />}
          </TouchableOpacity>
          {isRecording ? (
            <View style={s.recRow}>
              <View style={s.recDot} />
              <Text style={s.recTimer}>{String(Math.floor(recSeconds/60)).padStart(2,'0')}:{String(recSeconds%60).padStart(2,'0')}</Text>
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
            placeholder="Mensaje..."
            placeholderTextColor={colors.textDim}
            value={text}
            onChangeText={handleTyping}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <TouchableOpacity onPress={handleSend} disabled={!text.trim()}>
            <LinearGradient
              colors={text.trim() ? ['#006b63','#00e5cc'] : ['#1a2a2a','#1a2a2a']}
              style={s.sendBtn}
            >
              <Text style={s.sendTxt}>↑</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
        )}
      </KeyboardAvoidingView>

      {showScrollBtn && (
        <TouchableOpacity style={s.scrollDownBtn} onPress={() => scrollToBottom()}>
          <Text style={s.scrollDownTxt}>↓</Text>
        </TouchableOpacity>
      )}
      {/* Modal menu long press */}
      <Modal visible={!!menuMsg} transparent animationType="fade" onRequestClose={() => setMenuMsg(null)}>
        <Pressable style={s.modalOverlay} onPress={() => setMenuMsg(null)}>
          <View style={s.menuBox}>
            <Text style={s.menuTitle} numberOfLines={1}>{menuMsg?.text}</Text>
            <View style={s.emojiRow}>
              {['❤️','😂','😮','😢','🔥','👏'].map(e => (
                <TouchableOpacity key={e} onPress={() => reactToMsg(e)} style={s.emojiBtn}>
                  <Text style={{ fontSize: 26 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={s.menuItem} onPress={() => { setReplyTo(menuMsg); setMenuMsg(null); }}>
              <Text style={s.menuItemTxt}>↩ Responder</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.menuItem} onPress={deleteForMe}>
              <Text style={[s.menuItemTxt, { color: '#ff4444' }]}>🗑 Borrar para mí</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black, overflow: 'hidden', maxWidth: '100%' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12,
  },
  backBtn:     { padding: 4 },
  backTxt:     { color: colors.c1, fontSize: 22 },
  headerAv:    {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,229,204,0.1)',
    borderWidth: 1, borderColor: colors.borderC,
    alignItems: 'center', justifyContent: 'center',
  },
  headerAvTxt: { color: colors.c1, fontWeight: 'bold' },
  headerAvImg: { width: 36, height: 36, borderRadius: 18 },
  msgAvatarImg:{ width: 28, height: 28, borderRadius: 14 },
  headerName:  { color: colors.textHi, fontWeight: '600', fontSize: 14 },
  typingTxt:   { color: colors.c1, fontSize: 10, opacity: 0.7 },
  messagesList:{ padding: 16, paddingBottom: 20 },
  msgRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 10 },
  msgRowMe:    { flexDirection: 'row-reverse' },
  msgAvatar:   {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,229,204,0.1)',
    borderWidth: 1, borderColor: colors.borderC,
    alignItems: 'center', justifyContent: 'center',
  },
  msgAvatarTxt:{ color: colors.c1, fontSize: 11, fontWeight: 'bold' },
  bubble:      { maxWidth: '75%', borderRadius: 16, padding: 12, borderWidth: 1 },
  bubbleMe:    { backgroundColor: 'rgba(0,100,90,0.4)', borderColor: 'rgba(0,229,204,0.2)', borderBottomRightRadius: 4 },
  bubbleThem:  { backgroundColor: colors.card, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bubbleTxt:   { color: '#ffffff', fontSize: 14, lineHeight: 20 },
  bubbleTime:  { color: colors.textDim, fontSize: 9, marginTop: 4, textAlign: 'right' },
  mediaBtn:    { padding: 8, justifyContent: 'center', alignItems: 'center' },
  mediaBtnActive: { backgroundColor: 'rgba(0,229,204,0.1)', borderRadius: 20 },
  recRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 },
  recDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(239,68,68,0.9)' },
  recTimer: { color: colors.c1, fontSize: 13, fontWeight: '700', minWidth: 38 },
  recStop:  { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(239,68,68,0.8)', alignItems: 'center', justifyContent: 'center' },
  audioPreviewRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', backgroundColor: colors.surface },
  audioPreviewCancel: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', alignItems: 'center', justifyContent: 'center' },
  audioPreviewSend:   { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,229,204,0.8)', alignItems: 'center', justifyContent: 'center' },
  inputRow:    {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.deep,
    overflow: 'hidden',
  },
  input: {
    flex: 1, minWidth: 0, flexShrink: 1,
    backgroundColor: 'rgba(8,20,36,0.95)',
    borderWidth: 1, borderColor: colors.border, borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10,
    color: colors.textHi, fontSize: 14,
  },
  sendBtn: { width: 42, height: 42, minWidth: 42, maxWidth: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sendTxt:       { color: colors.black, fontSize: 18, fontWeight: 'bold' },
  reqBanner: {
    flexDirection: 'row', alignItems: 'center',
    margin: 12, padding: 14,
    backgroundColor: 'rgba(0,229,204,0.06)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(0,229,204,0.2)',
    gap: 12,
  },
  reqBannerTitle: { color: colors.textHi, fontSize: 13, fontWeight: '600', marginBottom: 2 },
  reqBannerSub:   { color: colors.textDim, fontSize: 11 },
  reqBannerBtn:   { },
  reqBannerBtnInner: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  reqBannerBtnTxt:   { color: '#001a18', fontSize: 12, fontWeight: '700' },
  dateSep:   { flexDirection: 'row', alignItems: 'center', marginVertical: 12, paddingHorizontal: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  menuBox:   { backgroundColor: colors.surface, borderRadius: 16, padding: 16, width: 280, borderWidth: 1, borderColor: colors.borderC },
  menuTitle: { color: colors.textDim, fontSize: 12, marginBottom: 12, fontStyle: 'italic' },
  emojiRow:  { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  emojiBtn:  { padding: 6 },
  menuItem:  { paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border },
  menuItemTxt: { color: colors.textHi, fontSize: 15, textAlign: 'center' },
  replyBar:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#333' },
  replyBarUser: { color: '#aaa', fontSize: 11, fontWeight: '700' },
  replyBarTxt:  { color: '#666', fontSize: 12 },
  replyPreview: { backgroundColor: 'rgba(255,255,255,0.06)', borderLeftWidth: 2, borderLeftColor: '#555', paddingLeft: 8, paddingVertical: 4, marginBottom: 6, borderRadius: 4 },
  replyUser:    { color: '#aaa', fontSize: 10, fontWeight: '700' },
  replyText:    { color: '#666', fontSize: 11 },
  msgReactions: { flexDirection: 'row', gap: 2, marginTop: 4 },
  msgReactionEmoji: { fontSize: 16 },
  msgSenderName: { color: '#888', fontSize: 11, marginBottom: 2, marginLeft: 40 },
  mentionDropdown: { backgroundColor: '#1a1a1a', borderTopWidth: 1, borderTopColor: '#333' },
  mentionItem:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, gap: 4, borderBottomWidth: 1, borderBottomColor: '#222' },
  mentionAt:       { color: '#666', fontSize: 14 },
  mentionName:     { color: '#eee', fontSize: 14, fontWeight: '600' },
  dateLine:  { flex: 1, height: 1, backgroundColor: colors.border },
  dateLabel: { color: colors.textDim, fontSize: 11, marginHorizontal: 10 },
  scrollDownBtn: {
    position: 'absolute', bottom: 80, right: 16,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.borderC,
    alignItems: 'center', justifyContent: 'center',
    elevation: 5,
  },
  scrollDownTxt: { color: colors.c1, fontSize: 20, fontWeight: 'bold' },
});
