import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, Animated, Modal, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, StatusBar, Image,
} from 'react-native';
const BlurView = Platform.OS !== 'web'
  ? require('expo-blur').BlurView
  : View;
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';
import api from '../services/api';
import { connectSocket } from '../services/socket';

const CHAT_DURATION     = 6; // TODO: volver a 300 antes de producción
const DECISION_DURATION = 30;

function formatTime(s) {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

export default function MeetTextScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [phase,           setPhase]           = useState('select');
  const [genderPref,      setGenderPref]      = useState('any');
  const [waitingCount,    setWaitingCount]    = useState(0);
  const [messages,        setMessages]        = useState([]);
  const [inputText,       setInputText]       = useState('');
  const [chatSeconds,     setChatSeconds]     = useState(CHAT_DURATION);
  const [decisionSeconds, setDecisionSeconds] = useState(DECISION_DURATION);
  const [joiningChat,     setJoiningChat]     = useState(false);
  const [dotsCount,       setDotsCount]       = useState(0);
  const [partnerData,     setPartnerData]     = useState(null);

  const roomIdRef        = useRef(null);
  const socketRef        = useRef(null);
  const chatTimerRef     = useRef(null);
  const decisionTimerRef = useRef(null);
  const dotsTimerRef     = useRef(null);
  const genderPrefRef    = useRef('any');

  const ring1       = useRef(new Animated.Value(0)).current;
  const ring2       = useRef(new Animated.Value(0)).current;
  const ring3       = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressRef  = useRef(null); // handle para detener la animación

  useEffect(() => { genderPrefRef.current = genderPref; }, [genderPref]);
  useEffect(() => { fetchWaitingCount(); }, []);

  async function fetchWaitingCount() {
    try {
      const { data } = await api.get('/meet/text/waiting-count');
      setWaitingCount(data.count || 0);
    } catch (_) {}
  }

  // ── Pulso de espera ───────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'waiting') return;

    function makeRingAnim(anim, delay) {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 1800, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0,    useNativeDriver: true }),
        ]),
      );
    }
    const a1 = makeRingAnim(ring1, 0);
    const a2 = makeRingAnim(ring2, 600);
    const a3 = makeRingAnim(ring3, 1200);
    a1.start(); a2.start(); a3.start();
    dotsTimerRef.current = setInterval(() => setDotsCount(d => (d + 1) % 4), 500);

    return () => {
      a1.stop(); a2.stop(); a3.stop();
      ring1.setValue(0); ring2.setValue(0); ring3.setValue(0);
      clearInterval(dotsTimerRef.current);
    };
  }, [phase]);

  // ── Socket ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    connectSocket().then(socket => {
      if (!mounted) return;
      socketRef.current = socket;

      socket.on('meet:matched', ({ roomId, startedAt, partner }) => {
        roomIdRef.current = roomId;
        socket.emit('meet:join_room', { roomId });
        setPartnerData(partner || null);
        setMessages([]);
        setChatSeconds(CHAT_DURATION);
        setPhase('chat');
        startChatTimer(new Date(startedAt));
      });

      socket.on('meet:message', msg => {
        setMessages(prev => [{ ...msg, fromMe: false }, ...prev]);
      });

      socket.on('meet:partner-left', () => {
        clearChatTimer();
        clearDecisionTimer();
        Alert.alert('Tu pareja se fue', 'El otro usuario ha salido del chat.', [
          { text: 'OK', onPress: resetToWaiting },
        ]);
      });

      socket.on('meet:match-accepted', ({ chatId, partner }) => {
        console.log('[meet:match-accepted] socket payload:', JSON.stringify({ chatId, partner }));
        clearDecisionTimer();
        navigation.replace('ChatRoom', {
          chat:  { _id: chatId },
          other: {
            avatarUrl:       partner?.avatarUrl       || null,
            username:        partner?.username         || 'Usuario',
            profileFrame:    partner?.profileFrame     || null,
            profileFrameUrl: partner?.profileFrameUrl  || null,
            banned:          false,
            blocked:         false,
          },
        });
      });

      socket.on('meet:match-rejected', () => {
        clearDecisionTimer();
        setJoiningChat(false);
        Alert.alert('Sin conexion', 'La otra persona paso. Buscando de nuevo...', [
          { text: 'OK', onPress: resetToWaiting },
        ]);
      });
    });

    return () => { mounted = false; };
  }, []);

  useFocusEffect(
    useCallback(() => {
      return () => { leaveSession(); };
    }, []),
  );

  // ── Timers ────────────────────────────────────────────────────────────────
  function startChatTimer(startedAt) {
    clearChatTimer();
    const elapsed   = Math.floor((Date.now() - startedAt.getTime()) / 1000);
    const remaining = Math.max(0, CHAT_DURATION - elapsed);
    setChatSeconds(remaining);

    // Barra de progreso: arranca desde el progreso actual y llega a 1 en `remaining` segundos
    progressAnim.setValue(1 - remaining / CHAT_DURATION);
    if (progressRef.current) progressRef.current.stop();
    progressRef.current = Animated.timing(progressAnim, {
      toValue:         1,
      duration:        remaining * 1000,
      useNativeDriver: false,
    });
    progressRef.current.start();

    if (remaining === 0) { enterDecisionPhase(); return; }

    chatTimerRef.current = setInterval(() => {
      setChatSeconds(s => {
        if (s <= 1) { clearChatTimer(); enterDecisionPhase(); return 0; }
        return s - 1;
      });
    }, 1000);
  }

  function clearChatTimer() {
    if (chatTimerRef.current) { clearInterval(chatTimerRef.current); chatTimerRef.current = null; }
    if (progressRef.current)  { progressRef.current.stop(); progressRef.current = null; }
  }

  function enterDecisionPhase() {
    setPhase('decision');
    setDecisionSeconds(DECISION_DURATION);
    decisionTimerRef.current = setInterval(() => {
      setDecisionSeconds(s => {
        if (s <= 1) { clearDecisionTimer(); handleDecision(false); return 0; }
        return s - 1;
      });
    }, 1000);
  }

  function clearDecisionTimer() {
    if (decisionTimerRef.current) { clearInterval(decisionTimerRef.current); decisionTimerRef.current = null; }
  }

  function resetToWaiting() {
    clearChatTimer();
    clearDecisionTimer();
    progressAnim.setValue(0);
    roomIdRef.current = null;
    setPartnerData(null);
    setMessages([]);
    setInputText('');
    setChatSeconds(CHAT_DURATION);
    setDecisionSeconds(DECISION_DURATION);
    setJoiningChat(false);
    setPhase('waiting');
    joinQueue();
  }

  async function joinQueue() {
    try {
      const { data } = await api.post('/meet/text/join', { genderPreference: genderPrefRef.current });
      if (data.matched) {
        const socket = socketRef.current;
        roomIdRef.current = data.roomId;
        if (socket) socket.emit('meet:join_room', { roomId: data.roomId });
        setPartnerData(data.partner || null);
        setMessages([]);
        setChatSeconds(CHAT_DURATION);
        setPhase('chat');
        startChatTimer(new Date(data.startedAt));
      }
    } catch {
      Alert.alert('Error', 'No se pudo conectar. Intenta de nuevo.');
      setPhase('select');
    }
  }

  async function leaveSession() {
    clearChatTimer();
    clearDecisionTimer();
    const socket = socketRef.current;
    if (socket) {
      socket.off('meet:matched');
      socket.off('meet:message');
      socket.off('meet:partner-left');
      socket.off('meet:match-accepted');
      socket.off('meet:match-rejected');
    }
    roomIdRef.current = null;
    try { await api.post('/meet/text/leave'); } catch (_) {}
  }

  function handleBuscar() {
    fetchWaitingCount();
    setPhase('waiting');
    joinQueue();
  }

  async function handleCancel() {
    await leaveSession();
    setPhase('select');
  }

  function sendMessage() {
    const text = inputText.trim();
    if (!text || !roomIdRef.current || !socketRef.current) return;
    socketRef.current.emit('meet:message', { roomId: roomIdRef.current, text });
    setMessages(prev => [{
      id:        Date.now().toString(),
      text,
      fromMe:    true,
      createdAt: new Date().toISOString(),
    }, ...prev]);
    setInputText('');
  }

  async function handleDecision(accept) {
    clearDecisionTimer();
    if (accept) setJoiningChat(true);
    try {
      const { data } = await api.post('/meet/text/match-decision', { accept });
      console.log('[match-decision] response:', JSON.stringify(data));
      if (data.chatId) {
        navigation.replace('ChatRoom', {
          chat:  { _id: data.chatId },
          other: {
            avatarUrl:       data.partner?.avatarUrl       || null,
            username:        data.partner?.username         || 'Usuario',
            profileFrame:    data.partner?.profileFrame     || null,
            profileFrameUrl: data.partner?.profileFrameUrl  || null,
            banned:          false,
            blocked:         false,
          },
        });
      } else if (data.waiting) {
        // Esperando al partner — llegará meet:match-accepted por socket
      } else {
        setJoiningChat(false);
        resetToWaiting();
      }
    } catch (e) {
      console.log('[match-decision] error:', e?.response?.data ?? e?.message);
      setJoiningChat(false);
      Alert.alert('Error', 'No se pudo procesar tu decision.');
    }
  }

  // ── Renders ───────────────────────────────────────────────────────────────

  function renderSelect() {
    return (
      <View style={s.centerWrap}>
        <Text style={s.mainTitle}>Meet Texto</Text>
        <Text style={s.mainSubtitle}>Chatea con alguien nuevo de forma anonima</Text>

        <View style={s.genderSection}>
          <Text style={s.genderLabel}>Quiero hablar con</Text>
          <View style={s.genderRow}>
            {[
              { key: 'male',   label: 'Hombre' },
              { key: 'female', label: 'Mujer' },
              { key: 'any',    label: 'Cualquiera' },
            ].map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[s.genderPill, genderPref === opt.key && s.genderPillActive]}
                onPress={() => setGenderPref(opt.key)}
                activeOpacity={0.7}
              >
                <Text style={[s.genderPillText, genderPref === opt.key && s.genderPillTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {waitingCount > 0 && (
          <Text style={s.waitingHint}>{waitingCount} {waitingCount === 1 ? 'persona' : 'personas'} en espera</Text>
        )}

        <TouchableOpacity style={s.primaryBtn} onPress={handleBuscar} activeOpacity={0.8}>
          <Text style={s.primaryBtnText}>Buscar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderWaiting() {
    const dots   = '.'.repeat(dotsCount);
    const mkRing = (anim) => ({
      transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.8] }) }],
      opacity:   anim.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.5, 0.35, 0] }),
    });

    return (
      <View style={s.centerWrap}>
        <View style={s.pulseContainer}>
          <Animated.View style={[s.ring, mkRing(ring1)]} />
          <Animated.View style={[s.ring, mkRing(ring2)]} />
          <Animated.View style={[s.ring, mkRing(ring3)]} />
          <View style={s.pulseCore}>
            <Ionicons name="chatbubble-ellipses-outline" size={28} color={colors.c1} />
          </View>
        </View>

        <Text style={s.searchingText}>Buscando{dots}</Text>
        {waitingCount > 0 && (
          <Text style={s.waitingHint}>{waitingCount} {waitingCount === 1 ? 'persona' : 'personas'} en espera</Text>
        )}

        <TouchableOpacity style={s.ghostBtn} onPress={handleCancel} activeOpacity={0.7}>
          <Text style={s.ghostBtnText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderChat() {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 56 : 0}
      >
        {/* Avatar anonimo */}
        <View style={s.anonSection}>
          <View style={s.anonAvatarWrap}>
            {partnerData?.avatarUrl ? (
              <Image source={{ uri: partnerData.avatarUrl }} style={s.anonAvatarImg} />
            ) : (
              <View style={s.anonAvatarBase}>
                <Ionicons name="person" size={34} color="rgba(232,244,248,0.25)" />
              </View>
            )}
            <BlurView
              intensity={80}
              tint="dark"
              style={[StyleSheet.absoluteFill, { borderRadius: 36 }]}
            />
          </View>
          <Text style={s.anonLabel}>Identidad oculta</Text>
        </View>

        <FlatList
          data={messages}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={[s.bubble, item.fromMe ? s.bubbleMe : s.bubbleThem]}>
              <Text style={[s.bubbleText, item.fromMe ? s.bubbleTextMe : s.bubbleTextThem]}>
                {item.text}
              </Text>
            </View>
          )}
          inverted
          contentContainerStyle={s.messageList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.emptyChat}>
              <Text style={s.emptyChatText}>Di hola para empezar</Text>
            </View>
          }
        />

        <View style={[s.inputRow, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <TextInput
            style={s.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Escribe algo..."
            placeholderTextColor={colors.textDim}
            multiline={false}
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            style={[s.sendBtn, !inputText.trim() && s.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim()}
            activeOpacity={0.7}
          >
            <Ionicons name="send" size={16} color={inputText.trim() ? colors.black : colors.textDim} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  function renderDecisionModal() {
    return (
      <Modal transparent statusBarTranslucent visible={phase === 'decision'} animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            {joiningChat ? (
              <>
                <ActivityIndicator size="large" color={colors.c1} style={{ marginBottom: 12 }} />
                <Text style={s.modalWaitingText}>Esperando al otro usuario...</Text>
              </>
            ) : (
              <>
                <Text style={s.modalQuestion}>¿Quieres conectar con esta persona?</Text>
                <Text style={s.modalTimer}>{decisionSeconds}s</Text>
                <View style={s.modalButtons}>
                  <TouchableOpacity style={[s.modalBtn, s.modalBtnAccept]} onPress={() => handleDecision(true)} activeOpacity={0.8}>
                    <Text style={s.modalBtnAcceptText}>Conectar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.modalBtn, s.modalBtnReject]} onPress={() => handleDecision(false)} activeOpacity={0.8}>
                    <Text style={s.modalBtnRejectText}>Pasar</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    );
  }

  const showChatHeader = phase === 'chat' || phase === 'decision';

  const barWidth = progressAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      <SafeAreaView edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={colors.textHi} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>
            {showChatHeader ? 'Chat anonimo' : 'Meet Texto'}
          </Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Barra de progreso — solo en fase chat/decision */}
        {showChatHeader && (
          <View style={s.progressWrap}>
            <View style={s.progressTrack}>
              <Animated.View style={[s.progressFill, { width: barWidth }]} />
            </View>
            <Text style={s.progressTime}>{formatTime(chatSeconds)}</Text>
          </View>
        )}
      </SafeAreaView>

      {phase === 'select'                         && renderSelect()}
      {phase === 'waiting'                        && renderWaiting()}
      {(phase === 'chat' || phase === 'decision') && renderChat()}
      {renderDecisionModal()}
    </View>
  );
}

const RING_SIZE = 160;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },

  // ── Header ──
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingVertical:   12,
  },
  backBtn:     { padding: 4 },
  headerTitle: { color: colors.textHi, fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },

  // ── Barra de progreso ──
  progressWrap: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingBottom:     10,
    gap:               8,
  },
  progressTrack: {
    flex:            1,
    height:          4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius:    2,
    overflow:        'hidden',
  },
  progressFill: {
    height:          '100%',
    backgroundColor: colors.c1,
    borderRadius:    2,
  },
  progressTime: {
    color:    colors.textDim,
    fontSize: 10,
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'right',
  },

  // ── Select / Waiting ──
  centerWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, gap: 20,
  },
  mainTitle:    { color: colors.textHi, fontSize: 26, fontWeight: '800', textAlign: 'center' },
  mainSubtitle: { color: colors.textDim, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  genderSection: { alignItems: 'center', gap: 12, width: '100%' },
  genderLabel:   { color: colors.textMid, fontSize: 13 },
  genderRow:     { flexDirection: 'row', gap: 8 },
  genderPill: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1,
    borderColor: colors.borderC, backgroundColor: colors.surface,
  },
  genderPillActive:     { backgroundColor: 'rgba(0,229,204,0.12)', borderColor: colors.c1 },
  genderPillText:       { color: colors.textMid, fontSize: 13, fontWeight: '600' },
  genderPillTextActive: { color: colors.c1 },

  waitingHint: { color: colors.textDim, fontSize: 12 },

  primaryBtn: {
    backgroundColor: colors.c1, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 48, marginTop: 8,
  },
  primaryBtnText: { color: colors.black, fontSize: 15, fontWeight: '800' },

  ghostBtn: {
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 40,
    borderWidth: 1, borderColor: colors.borderC, marginTop: 8,
  },
  ghostBtnText: { color: colors.textMid, fontSize: 14, fontWeight: '600' },

  // ── Pulse ──
  pulseContainer: { width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute', width: RING_SIZE, height: RING_SIZE,
    borderRadius: RING_SIZE / 2, borderWidth: 1.5, borderColor: colors.c1,
  },
  pulseCore: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(0,229,204,0.1)',
    borderWidth: 1, borderColor: 'rgba(0,229,204,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  searchingText: { color: colors.textHi, fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  // ── Avatar anonimo ──
  anonSection: {
    alignItems:    'center',
    paddingTop:    16,
    paddingBottom: 10,
    gap:           6,
  },
  anonAvatarWrap: {
    width: 72, height: 72, borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  anonAvatarImg:  { width: 72, height: 72, borderRadius: 36 },
  anonAvatarBase: {
    width: '100%', height: '100%',
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  anonLabel: { color: colors.textDim, fontSize: 11, fontWeight: '500' },

  // ── Chat ──
  messageList: { paddingHorizontal: 16, paddingVertical: 8 },
  bubble: {
    maxWidth: '78%', borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8,
  },
  bubbleMe:       { alignSelf: 'flex-end', backgroundColor: colors.c1, borderBottomRightRadius: 4 },
  bubbleThem:     { alignSelf: 'flex-start', backgroundColor: colors.card, borderBottomLeftRadius: 4 },
  bubbleText:     { fontSize: 14, lineHeight: 20 },
  bubbleTextMe:   { color: colors.black },
  bubbleTextThem: { color: colors.textHi },

  emptyChat:     { alignItems: 'center', paddingTop: 40 },
  emptyChatText: { color: colors.textDim, fontSize: 13 },

  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingTop: 8, gap: 8,
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.black,
  },
  input: {
    flex: 1, backgroundColor: colors.surface,
    borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10,
    color: colors.textHi, fontSize: 14,
    borderWidth: 1, borderColor: colors.borderC,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.c1, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.surface },

  // ── Modal decision ──
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: colors.card, borderRadius: 20, padding: 28,
    width: '100%', alignItems: 'center', gap: 16,
    borderWidth: 1, borderColor: colors.borderC,
  },
  modalQuestion:    { color: colors.textHi, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  modalTimer:       { color: colors.c1, fontSize: 32, fontWeight: '800' },
  modalWaitingText: { color: colors.textMid, fontSize: 14, textAlign: 'center' },
  modalButtons:     { flexDirection: 'row', gap: 12, width: '100%' },
  modalBtn:         { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  modalBtnAccept:     { backgroundColor: colors.c1 },
  modalBtnReject:     { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderC },
  modalBtnAcceptText: { color: colors.black, fontSize: 15, fontWeight: '800' },
  modalBtnRejectText: { color: colors.textMid, fontSize: 15, fontWeight: '600' },
});
