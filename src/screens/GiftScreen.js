import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, ActivityIndicator, Modal, Pressable,
  StatusBar, Dimensions, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

const { width: W } = Dimensions.get('window');
const COLS   = 3;
const GAP    = 8;
const CARD_W = (W - 48 - GAP * (COLS - 1)) / COLS;
const COMMISSION = 0.15;

function FrameCardBg({ frame }) {
  const grad = typeof frame.bgGradient === 'string' ? JSON.parse(frame.bgGradient || '[]') : (frame.bgGradient || []);
  if (frame.bgType === 'gradient' && grad.length >= 2)
    return <LinearGradient colors={grad} style={StyleSheet.absoluteFill} />;
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: frame.bgColor || '#0d1f2d' }]} />;
}

const STEPS = ['recipient', 'content', 'confirm'];

export default function GiftScreen({ navigation }) {
  const { user, updateUser } = useAuthStore();
  const [step, setStep]       = useState('recipient');
  const [recipient,setRecipient] = useState('');
  const [recipientData, setRecipientData] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchErr, setSearchErr] = useState('');

  const [giftType, setGiftType] = useState('coins'); // 'coins' | 'frames'
  const [coinsAmt, setCoinsAmt] = useState('');
  const [inventory, setInventory]   = useState([]);
  const [invLoading, setInvLoading] = useState(false);
  const [selectedFrames, setSelectedFrames] = useState([]); // [{frameId, cantidad, frame}]

  const [mensaje, setMensaje] = useState('');
  const [sending, setSending] = useState(false);
  const [errMsg, setErrMsg]   = useState('');
  const [successModal, setSuccessModal] = useState(false);

  async function searchRecipient() {
    if (!recipient.trim()) return;
    setSearchLoading(true);
    setSearchErr('');
    setRecipientData(null);
    try {
      const { data } = await api.get('/users/search', { params: { q: recipient.trim(), limit: 1 } });
      const found = (data.users || [])[0];
      if (!found) { setSearchErr('Usuario no encontrado'); return; }
      if (found.username === user?.username) { setSearchErr('No puedes enviarte un regalo a ti mismo'); return; }
      setRecipientData(found);
    } catch (e) {
      setSearchErr(e.response?.data?.error || 'Error al buscar usuario');
    } finally {
      setSearchLoading(false);
    }
  }

  async function loadInventory() {
    setInvLoading(true);
    try {
      const { data } = await api.get('/frames/my');
      setInventory(data.frames || []);
    } catch (e) { console.log(e); }
    finally { setInvLoading(false); }
  }

  useEffect(() => {
    if (step === 'content' && giftType === 'frames' && inventory.length === 0) {
      loadInventory();
    }
  }, [step, giftType]);

  function toggleFrame(ownership) {
    const frame = ownership.frame || ownership;
    const frameId = frame._id;
    const existing = selectedFrames.find(f => f.frameId === frameId);
    if (existing) {
      setSelectedFrames(prev => prev.filter(f => f.frameId !== frameId));
    } else {
      setSelectedFrames(prev => [...prev, { frameId, cantidad: 1, frame, maxUnits: ownership.units }]);
    }
  }

  function isFrameSelected(ownership) {
    const frame = ownership.frame || ownership;
    return selectedFrames.some(f => f.frameId === frame._id);
  }

  async function send() {
    if (sending) return;
    setErrMsg('');

    const coins = parseInt(coinsAmt) || 0;
    const items = selectedFrames.map(f => ({ frameId: f.frameId, cantidad: f.cantidad }));

    if (giftType === 'coins' && coins <= 0) { setErrMsg('Ingresa una cantidad de monedas'); return; }
    if (giftType === 'frames' && items.length === 0) { setErrMsg('Selecciona al menos un marco'); return; }

    setSending(true);
    try {
      const payload = {
        receptorUsername: recipientData.username,
        mensaje: mensaje.trim(),
        monedas: giftType === 'coins' ? coins : 0,
        items:   giftType === 'frames' ? items : [],
      };
      await api.post('/gifts', payload);
      if (giftType === 'coins') {
        updateUser({ ...user, coins: (user?.coins || 0) - coins });
      }
      setSuccessModal(true);
    } catch (e) {
      setErrMsg(e.response?.data?.error || 'Error al enviar regalo');
    } finally {
      setSending(false);
    }
  }

  const coinsNum    = parseInt(coinsAmt) || 0;
  const comision    = Math.round(coinsNum * COMMISSION);
  const montoNeto   = coinsNum - comision;

  function renderStepRecipient() {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.stepBody}>
          <View style={s.stepIcon}>
            <Ionicons name="gift-outline" size={36} color={colors.c3} />
          </View>
          <Text style={s.stepTitle}>¿A quién le envías el regalo?</Text>
          <Text style={s.stepSub}>Busca al usuario por su nombre de usuario</Text>

          <View style={s.searchRow}>
            <TextInput
              style={s.searchInput}
              placeholder="@username"
              placeholderTextColor={colors.textDim}
              value={recipient}
              onChangeText={t => { setRecipient(t); setRecipientData(null); setSearchErr(''); }}
              autoCapitalize="none"
              returnKeyType="search"
              onSubmitEditing={searchRecipient}
            />
            <TouchableOpacity style={s.searchBtn} onPress={searchRecipient} disabled={searchLoading}>
              {searchLoading
                ? <ActivityIndicator size={16} color={colors.black} />
                : <Ionicons name="search" size={16} color={colors.black} />}
            </TouchableOpacity>
          </View>

          {searchErr ? (
            <View style={s.errBox}>
              <Ionicons name="alert-circle-outline" size={14} color={colors.c4} />
              <Text style={s.errTxt}>{searchErr}</Text>
            </View>
          ) : null}

          {recipientData && (
            <View style={s.recipientCard}>
              <View style={s.recipientAvatar}>
                {recipientData.avatarUrl
                  ? <ExpoImage source={{ uri: recipientData.avatarUrl }} style={s.avatarImg} contentFit="cover" />
                  : <Ionicons name="person" size={22} color={colors.textDim} />}
              </View>
              <View>
                <Text style={s.recipientName}>{recipientData.displayName || recipientData.username}</Text>
                <Text style={s.recipientUser}>@{recipientData.username}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={20} color={colors.c1} style={{ marginLeft: 'auto' }} />
            </View>
          )}

          {recipientData && (
            <TouchableOpacity style={s.nextBtn} onPress={() => setStep('content')}>
              <Text style={s.nextBtnTxt}>Continuar</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.black} />
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  function renderStepContent() {
    const ownedFrames = inventory;
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.stepBody} style={{ flex: 1 }}>
          <Text style={s.stepTitle}>¿Qué quieres regalar?</Text>

          {/* Type tabs */}
          <View style={s.typeTabs}>
            <TouchableOpacity
              style={[s.typeTab, giftType === 'coins' && s.typeTabActive]}
              onPress={() => setGiftType('coins')}
            >
              <Text style={s.typeTabIcon}>✦</Text>
              <Text style={[s.typeTabTxt, giftType === 'coins' && s.typeTabTxtActive]}>Monedas</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.typeTab, giftType === 'frames' && s.typeTabActive]}
              onPress={() => { setGiftType('frames'); if (inventory.length === 0) loadInventory(); }}
            >
              <Ionicons name="sparkles-outline" size={14} color={giftType === 'frames' ? colors.c3 : colors.textDim} />
              <Text style={[s.typeTabTxt, giftType === 'frames' && s.typeTabTxtActive]}>Marcos</Text>
            </TouchableOpacity>
          </View>

          {giftType === 'coins' ? (
            <>
              <View style={s.coinsWrap}>
                <Text style={s.coinsSymbol}>✦</Text>
                <TextInput
                  style={s.coinsInput}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textDim}
                  value={coinsAmt}
                  onChangeText={setCoinsAmt}
                />
              </View>
              <Text style={s.coinsBalance}>Tu saldo: ✦{user?.coins ?? 0}</Text>

              {coinsNum > 0 && (
                <View style={s.commissionBox}>
                  <View style={s.commRow}>
                    <Text style={s.commLbl}>Enviado</Text>
                    <Text style={s.commVal}>✦{coinsNum}</Text>
                  </View>
                  <View style={s.commRow}>
                    <Text style={s.commLbl}>Comisión plataforma (15%)</Text>
                    <Text style={[s.commVal, { color: colors.c4 }]}>-✦{comision}</Text>
                  </View>
                  <View style={[s.commRow, s.commRowTotal]}>
                    <Text style={s.commLblBold}>Recibirá</Text>
                    <Text style={[s.commVal, { color: colors.c1, fontWeight: '800' }]}>✦{montoNeto}</Text>
                  </View>
                </View>
              )}
            </>
          ) : (
            <>
              <Text style={s.selectHint}>Toca un marco para seleccionarlo/deseleccionarlo</Text>
              {invLoading ? (
                <ActivityIndicator color={colors.c1} style={{ marginTop: 30 }} />
              ) : ownedFrames.length === 0 ? (
                <View style={s.noFrames}>
                  <Ionicons name="sparkles-outline" size={30} color={colors.textDim} />
                  <Text style={s.noFramesTxt}>No tienes marcos en tu colección</Text>
                </View>
              ) : (
                <View style={s.framesGrid}>
                  {ownedFrames.map((ownership) => {
                    const frame = ownership.frame || ownership;
                    const sel = isFrameSelected(ownership);
                    return (
                      <TouchableOpacity
                        key={frame._id}
                        style={[s.frameThumb, sel && s.frameThumbActive]}
                        onPress={() => toggleFrame(ownership)}
                        activeOpacity={0.8}
                      >
                        <View style={s.frameThumbPreview}>
                          <FrameCardBg frame={frame} />
                          {frame.imageUrl && (
                            <ExpoImage source={{ uri: frame.imageUrl }} style={{ width: '85%', height: '85%' }} contentFit="contain" autoplay />
                          )}
                          {sel && (
                            <View style={s.frameCheckOverlay}>
                              <Ionicons name="checkmark-circle" size={22} color={colors.c3} />
                            </View>
                          )}
                        </View>
                        <Text style={s.frameThumbName} numberOfLines={1}>{frame.name}</Text>
                        <Text style={s.frameThumbUnits}>×{ownership.units}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </>
          )}

          {/* Message */}
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>Mensaje (opcional)</Text>
            <TextInput
              style={s.msgInput}
              value={mensaje}
              onChangeText={setMensaje}
              placeholder="Escribe algo bonito..."
              placeholderTextColor={colors.textDim}
              multiline
              maxLength={200}
              textAlignVertical="top"
            />
            <Text style={s.charCount}>{mensaje.length}/200</Text>
          </View>

          <TouchableOpacity style={s.nextBtn} onPress={() => { setErrMsg(''); setStep('confirm'); }}>
            <Text style={s.nextBtnTxt}>Revisar regalo</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.black} />
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  function renderStepConfirm() {
    const coinsN = parseInt(coinsAmt) || 0;
    const com    = Math.round(coinsN * COMMISSION);
    const net    = coinsN - com;
    return (
      <ScrollView contentContainerStyle={s.stepBody}>
        <View style={s.confirmCard}>
          <Text style={s.confirmTitle}>Confirmar regalo</Text>

          <View style={s.confirmRow}>
            <Text style={s.confirmLbl}>Para</Text>
            <Text style={s.confirmVal}>@{recipientData?.username}</Text>
          </View>

          {giftType === 'coins' && coinsN > 0 && (
            <>
              <View style={s.confirmRow}>
                <Text style={s.confirmLbl}>Monedas enviadas</Text>
                <Text style={s.confirmVal}>✦{coinsN}</Text>
              </View>
              <View style={s.confirmRow}>
                <Text style={s.confirmLbl}>Comisión (15%)</Text>
                <Text style={[s.confirmVal, { color: colors.c4 }]}>-✦{com}</Text>
              </View>
              <View style={[s.confirmRow, { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4, paddingTop: 12 }]}>
                <Text style={[s.confirmLbl, { fontWeight: '700', color: colors.textHi }]}>Recibirá</Text>
                <Text style={[s.confirmVal, { color: colors.c1, fontWeight: '800' }]}>✦{net}</Text>
              </View>
            </>
          )}

          {giftType === 'frames' && selectedFrames.length > 0 && (
            <View style={s.confirmRow}>
              <Text style={s.confirmLbl}>Marcos</Text>
              <Text style={s.confirmVal}>{selectedFrames.map(f => f.frame.name).join(', ')}</Text>
            </View>
          )}

          {mensaje.trim() && (
            <View style={[s.confirmRow, { alignItems: 'flex-start' }]}>
              <Text style={s.confirmLbl}>Mensaje</Text>
              <Text style={[s.confirmVal, { flex: 1, textAlign: 'right' }]}>{mensaje}</Text>
            </View>
          )}

          <View style={s.expiryNote}>
            <Ionicons name="time-outline" size={13} color={colors.textDim} />
            <Text style={s.expiryTxt}>El destinatario tiene 7 días para aceptar el regalo</Text>
          </View>
        </View>

        {errMsg ? (
          <View style={s.errBox}>
            <Ionicons name="alert-circle-outline" size={14} color={colors.c4} />
            <Text style={s.errTxt}>{errMsg}</Text>
          </View>
        ) : null}

        <View style={s.confirmBtns}>
          <TouchableOpacity style={s.backBtn2} onPress={() => setStep('content')}>
            <Text style={s.backBtn2Txt}>Volver</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.sendBtn, sending && { opacity: 0.6 }]} onPress={send} disabled={sending}>
            {sending
              ? <ActivityIndicator size={16} color={colors.black} />
              : <>
                  <Ionicons name="gift-outline" size={16} color={colors.black} />
                  <Text style={s.sendBtnTxt}>Enviar regalo</Text>
                </>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.black} />
      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBack}>
            <Ionicons name="arrow-back" size={20} color={colors.textHi} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>ENVIAR REGALO</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Progress */}
        <View style={s.progress}>
          {STEPS.map((st, i) => (
            <View key={st} style={s.progressItem}>
              <View style={[s.progressDot, STEPS.indexOf(step) >= i && s.progressDotActive]}>
                <Text style={[s.progressDotTxt, STEPS.indexOf(step) >= i && s.progressDotTxtActive]}>{i + 1}</Text>
              </View>
              {i < STEPS.length - 1 && (
                <View style={[s.progressLine, STEPS.indexOf(step) > i && s.progressLineActive]} />
              )}
            </View>
          ))}
        </View>
      </SafeAreaView>

      {step === 'recipient' && renderStepRecipient()}
      {step === 'content'   && renderStepContent()}
      {step === 'confirm'   && renderStepConfirm()}

      {/* Success modal */}
      <Modal visible={successModal} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={s.successOverlay}>
          <View style={s.successCard}>
            <View style={s.successIcon}>
              <Ionicons name="gift" size={42} color={colors.c3} />
            </View>
            <Text style={s.successTitle}>¡Regalo enviado!</Text>
            <Text style={s.successSub}>
              @{recipientData?.username} tiene 7 días para aceptarlo. Si no lo hace, tu regalo te será devuelto.
            </Text>
            <TouchableOpacity style={s.successBtn} onPress={() => { setSuccessModal(false); navigation.goBack(); }}>
              <Text style={s.successBtnTxt}>Listo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  headerBack:  { padding: 4 },
  headerTitle: { color: colors.textHi, fontSize: 13, fontWeight: '800', letterSpacing: 2.5 },

  progress:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 32, paddingBottom: 14 },
  progressItem:     { flexDirection: 'row', alignItems: 'center', flex: 1 },
  progressDot:      { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  progressDotActive:{ backgroundColor: 'rgba(217,70,239,0.15)', borderColor: colors.c3 },
  progressDotTxt:   { color: colors.textDim, fontSize: 11, fontWeight: '700' },
  progressDotTxtActive: { color: colors.c3 },
  progressLine:     { flex: 1, height: 1, backgroundColor: colors.border },
  progressLineActive:{ backgroundColor: colors.c3 },

  stepBody: { padding: 24, paddingTop: 8 },
  stepIcon: { alignSelf: 'center', width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(217,70,239,0.08)', borderWidth: 1, borderColor: 'rgba(217,70,239,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  stepTitle:{ color: colors.textHi, fontSize: 17, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  stepSub:  { color: colors.textDim, fontSize: 13, textAlign: 'center', marginBottom: 24 },

  searchRow:  { flexDirection: 'row', gap: 10, marginBottom: 14 },
  searchInput:{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, color: colors.textHi, fontSize: 14, paddingHorizontal: 14, paddingVertical: 12 },
  searchBtn:  { backgroundColor: colors.c1, borderRadius: 14, width: 46, alignItems: 'center', justifyContent: 'center' },

  errBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(249,115,22,0.1)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(249,115,22,0.25)', padding: 12, marginBottom: 16 },
  errTxt:  { color: colors.c4, fontSize: 12, flex: 1 },

  recipientCard:  { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(0,229,204,0.06)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0,229,204,0.2)', padding: 14, marginBottom: 20 },
  recipientAvatar:{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg:      { width: 44, height: 44 },
  recipientName:  { color: colors.textHi, fontSize: 14, fontWeight: '700' },
  recipientUser:  { color: colors.textDim, fontSize: 12 },

  nextBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.c1, borderRadius: 18, paddingVertical: 15, marginTop: 8 },
  nextBtnTxt: { color: colors.black, fontSize: 15, fontWeight: '800' },

  typeTabs:       { flexDirection: 'row', gap: 10, marginBottom: 20 },
  typeTab:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  typeTabActive:  { backgroundColor: 'rgba(217,70,239,0.1)', borderColor: 'rgba(217,70,239,0.3)' },
  typeTabTxt:     { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  typeTabTxtActive:{ color: colors.c3 },
  typeTabIcon:    { color: colors.textDim, fontSize: 14, fontWeight: '800' },

  coinsWrap:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 },
  coinsSymbol:   { color: 'rgba(251,191,36,1)', fontSize: 36, fontWeight: '800' },
  coinsInput:    { fontSize: 48, fontWeight: '800', color: colors.textHi, minWidth: 120, textAlign: 'center' },
  coinsBalance:  { color: colors.textDim, fontSize: 12, textAlign: 'center', marginBottom: 16 },

  commissionBox: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 20 },
  commRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  commRowTotal:  { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4, paddingTop: 12 },
  commLbl:       { color: colors.textDim, fontSize: 13 },
  commLblBold:   { color: colors.textHi, fontSize: 13, fontWeight: '700' },
  commVal:       { color: colors.textHi, fontSize: 13, fontWeight: '600' },

  selectHint: { color: colors.textDim, fontSize: 12, textAlign: 'center', marginBottom: 14 },
  noFrames:   { alignItems: 'center', gap: 8, paddingVertical: 30 },
  noFramesTxt:{ color: colors.textDim, fontSize: 13 },

  framesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, marginBottom: 20 },
  frameThumb:       { width: CARD_W, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  frameThumbActive: { borderColor: colors.c3, borderWidth: 2, backgroundColor: 'rgba(217,70,239,0.06)' },
  frameThumbPreview:{ width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  frameCheckOverlay:{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  frameThumbName:   { color: colors.textHi, fontSize: 10, fontWeight: '600', paddingHorizontal: 6, paddingTop: 5, paddingBottom: 2 },
  frameThumbUnits:  { color: colors.textDim, fontSize: 9, paddingHorizontal: 6, paddingBottom: 6 },

  fieldWrap:  { marginBottom: 16 },
  fieldLabel: { color: colors.textMid, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  msgInput:   { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, color: colors.textHi, fontSize: 14, paddingHorizontal: 14, paddingVertical: 12, minHeight: 80 },
  charCount:  { color: colors.textDim, fontSize: 10, textAlign: 'right', marginTop: 4 },

  confirmCard:   { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 20, marginBottom: 20 },
  confirmTitle:  { color: colors.textHi, fontSize: 16, fontWeight: '800', marginBottom: 16 },
  confirmRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  confirmLbl:    { color: colors.textDim, fontSize: 13 },
  confirmVal:    { color: colors.textHi, fontSize: 13, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  expiryNote:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  expiryTxt:     { color: colors.textDim, fontSize: 11, flex: 1 },

  confirmBtns: { flexDirection: 'row', gap: 12 },
  backBtn2:    { flex: 1, paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  backBtn2Txt: { color: colors.textDim, fontSize: 14, fontWeight: '600' },
  sendBtn:     { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16, backgroundColor: colors.c3 },
  sendBtnTxt:  { color: colors.black, fontSize: 14, fontWeight: '800' },

  successOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  successCard:    { width: '100%', backgroundColor: colors.surface, borderRadius: 24, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  successIcon:    { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(217,70,239,0.1)', borderWidth: 1, borderColor: 'rgba(217,70,239,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  successTitle:   { color: colors.textHi, fontSize: 20, fontWeight: '800', marginBottom: 10 },
  successSub:     { color: colors.textDim, fontSize: 13, textAlign: 'center', lineHeight: 18, marginBottom: 24 },
  successBtn:     { backgroundColor: colors.c1, borderRadius: 16, paddingHorizontal: 40, paddingVertical: 14 },
  successBtnTxt:  { color: colors.black, fontSize: 15, fontWeight: '800' },
});
