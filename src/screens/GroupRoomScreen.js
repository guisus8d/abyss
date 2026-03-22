import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Image, FlatList, StatusBar, SafeAreaView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { connectSocket } from '../services/socket';
import AvatarWithFrame from '../components/AvatarWithFrame';

export default function GroupRoomScreen({ route, navigation }) {
  const { group: initialGroup } = route.params;
  const { user } = useAuthStore();
  const [group, setGroup]     = useState(initialGroup);
  const [messages, setMessages] = useState([]);
  const [text, setText]       = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatRef = useRef(null);
  const socketRef = useRef(null);

  const isAdmin = group?.members?.some(m =>
    (m.user?._id || m.user) === user?._id && m.role === 'admin'
  );

  useEffect(() => {
    loadGroup();
    setupSocket();
    return () => {
      if (socketRef.current) {
        socketRef.current.emit('group:leave', { groupId: group._id });
        socketRef.current.off('group:message');
      }
    };
  }, []);

  async function loadGroup() {
    try {
      const { data } = await api.get(`/groups/${group._id}`);
      setGroup(data.group);
      setMessages(data.group.messages || []);
      await api.post(`/groups/${group._id}/read`);
    } catch {}
    finally { setLoading(false); }
  }

  async function setupSocket() {
    const socket = await connectSocket();
    socketRef.current = socket;
    socket.emit('group:join', { groupId: group._id });
    socket.on('group:message', ({ groupId, message }) => {
      if (groupId === group._id) {
        setMessages(prev => [...prev, message]);
        api.post(`/groups/${group._id}/read`).catch(() => {});
      }
    });
  }

  async function sendMessage() {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const { data } = await api.post(`/groups/${group._id}/message`, { text: text.trim() });
      setMessages(prev => [...prev, data.message]);
      setText('');
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {}
    finally { setSending(false); }
  }

  async function deleteMessage(msgId) {
    try {
      await api.delete(`/groups/${group._id}/message/${msgId}`);
      setMessages(prev => prev.filter(m => m._id !== msgId));
    } catch {}
  }

  async function banUser(userId, username) {
    Alert.alert('Banear', `¿Banear a ${username}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Banear', style: 'destructive', onPress: async () => {
        try {
          await api.post(`/groups/${group._id}/ban/${userId}`);
          setGroup(prev => ({ ...prev, members: prev.members.filter(m => (m.user?._id || m.user) !== userId) }));
        } catch {}
      }},
    ]);
  }

  function renderMessage({ item: msg, index }) {
    const isMe = (msg.sender?._id || msg.sender)?.toString() === user?._id?.toString();
    const sender = msg.sender;
    const prevMsg = messages[index - 1];
    const prevSender = (prevMsg?.sender?._id || prevMsg?.sender)?.toString();
    const thisSender = (sender?._id || sender)?.toString();
    const sameAsPrev = !isMe && prevMsg && prevSender === thisSender;
    const showName = !isMe && !sameAsPrev;
    const showAvatar = !isMe;

    return (
      <View style={{ marginBottom: 4 }}>
        {/* Nombre arriba de la burbuja */}
        {showName && (
          <Text style={s.msgSenderName}>{sender?.username}</Text>
        )}
        <View style={[s.msgRow, isMe && s.msgRowMe]}>
          {/* Avatar arriba a la izquierda */}
          {showAvatar && (
            <TouchableOpacity
              style={{ alignSelf: 'flex-start' }}
              onPress={() => navigation.navigate('PublicProfile', { username: sender?.username })}>
              {showName
                ? <AvatarWithFrame size={30} avatarUrl={sender?.avatarUrl} username={sender?.username}
                    profileFrame={sender?.profileFrame} frameUrl={sender?.profileFrameUrl} />
                : <View style={{ width: 30 }} />}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem]}
            onLongPress={() => {
              if (isAdmin || isMe) {
                Alert.alert('Opciones', '', [
                  { text: 'Borrar mensaje', style: 'destructive', onPress: () => deleteMessage(msg._id) },
                  isAdmin && !isMe ? { text: `Banear a ${sender?.username}`, style: 'destructive', onPress: () => banUser(sender?._id, sender?.username) } : null,
                  { text: 'Cancelar', style: 'cancel' },
                ].filter(Boolean));
              }
            }}
          >
            <Text style={s.bubbleText}>{msg.text}</Text>
            <Text style={s.bubbleTime}>
              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.textHi} />
          </TouchableOpacity>
          <TouchableOpacity style={s.headerInfo} onPress={() => Alert.alert(group.name, group.description || 'Sin descripción')}>
            {group.imageUrl
              ? <Image source={{ uri: group.imageUrl }} style={s.groupAvatar} />
              : <View style={s.groupAvatarPlaceholder}>
                  <Ionicons name="people" size={18} color={colors.c1} />
                </View>}
            <View>
              <Text style={s.groupName} numberOfLines={1}>{group.name}</Text>
              <Text style={s.groupMembers}>{group.members?.length || 0} miembros</Text>
            </View>
          </TouchableOpacity>
          {isAdmin && (
            <TouchableOpacity onPress={() => navigation.navigate('GroupSettings', { group, onUpdate: setGroup })}>
              <Ionicons name="settings-outline" size={20} color={colors.textDim} />
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      {loading
        ? <ActivityIndicator color={colors.c1} style={{ marginTop: 40 }} />
        : <FlatList
            ref={flatRef}
            data={messages}
            keyExtractor={(m, i) => m._id || String(i)}
            renderItem={renderMessage}
            contentContainerStyle={s.messageList}
            onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          />}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            value={text}
            onChangeText={setText}
            placeholder="Mensaje..."
            placeholderTextColor={colors.textDim}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity style={[s.sendBtn, (!text.trim() || sending) && s.sendBtnDisabled]}
            onPress={sendMessage} disabled={!text.trim() || sending}>
            <Ionicons name="send" size={16} color={colors.black} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupAvatar: { width: 38, height: 38, borderRadius: 10 },
  groupAvatarPlaceholder: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderC, alignItems: 'center', justifyContent: 'center' },
  groupName: { color: colors.textHi, fontSize: 14, fontWeight: '700' },
  groupMembers: { color: colors.textDim, fontSize: 11 },

  messageList: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  msgRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 6 },
  msgRowMe: { flexDirection: 'row-reverse' },
  bubble:       { maxWidth: '75%', borderRadius: 16, padding: 10, gap: 4 },
  bubbleMe:     { backgroundColor: 'rgba(0,180,160,0.85)', borderBottomRightRadius: 4 },
  bubbleThem:   { backgroundColor: colors.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  msgSenderName: { color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: '700', marginLeft: 44, marginBottom: 2 },
  bubbleText:   { color: '#ffffff', fontSize: 14, lineHeight: 20 },
  bubbleTime:   { color: 'rgba(255,255,255,0.4)', fontSize: 9, alignSelf: 'flex-end' },

  inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border, gap: 10 },
  input:    { flex: 1, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 10, color: colors.textHi, fontSize: 14, maxHeight: 100 },
  sendBtn:  { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.c1, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
});
