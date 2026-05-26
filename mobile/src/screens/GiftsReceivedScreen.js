import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Modal, Pressable, StatusBar, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import CoinIcon from '../components/CoinIcon';
import { formatCoins } from '../utils/formatCoins';

function FrameCardBg({ frame }) {
  const grad = typeof frame.bgGradient === 'string' ? JSON.parse(frame.bgGradient || '[]') : (frame.bgGradient || []);
  if (frame.bgType === 'gradient' && grad.length >= 2)
    return <LinearGradient colors={grad} style={StyleSheet.absoluteFill} />;
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: frame.bgColor || '#0d1f2d' }]} />;
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Ahora mismo';
  if (m < 60) return `Hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Hace ${h}h`;
  return `Hace ${Math.floor(h / 24)}d`;
}

function daysLeft(expiraEn) {
  const diff = new Date(expiraEn).getTime() - Date.now();
  const d = Math.ceil(diff / 86400000);
  return d > 0 ? d : 0;
}

function GiftCard({ gift, onPress }) {
  const emisor = gift.emisor || {};
  const hasCoins = gift.monedas > 0;
  const hasFrames = gift.items?.length > 0;
  const dias = daysLeft(gift.expiraEn);

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.8}>
      <View style={s.cardLeft}>
        <View style={s.avatar}>
          {emisor.avatarUrl
            ? <ExpoImage source={{ uri: emisor.avatarUrl }} style={s.avatarImg} contentFit="cover" />
            : <Ionicons name="person" size={20} color={colors.textDim} />}
        </View>
        <View style={s.giftIcon}>
          <Ionicons name="gift" size={12} color={colors.c3} />
        </View>
      </View>

      <View style={s.cardMid}>
        <Text style={s.senderName}>@{emisor.username}</Text>
        <Text style={s.giftSummary} numberOfLines={1}>
          {hasCoins && `✦${gift.monedas} monedas`}
          {hasCoins && hasFrames && ' + '}
          {hasFrames && `${gift.items.length} marco(s)`}
        </Text>
        {gift.mensaje ? (
          <Text style={s.mensaje} numberOfLines={1}>"{gift.mensaje}"</Text>
        ) : null}
      </View>

      <View style={s.cardRight}>
        <View style={[s.expBadge, dias <= 1 && s.expBadgeUrgent]}>
          <Text style={[s.expTxt, dias <= 1 && s.expTxtUrgent]}>{dias}d</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textDim} style={{ marginTop: 4 }} />
      </View>
    </TouchableOpacity>
  );
}

export default function GiftsReceivedScreen({ navigation }) {
  const { user, updateUser } = useAuthStore();
  const [gifts, setGifts]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [errMsg, setErrMsg]     = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { data } = await api.get('/gifts/received');
      setGifts(data.gifts || []);
    } catch (e) { console.log(e); }
    finally { setLoading(false); setRefreshing(false); }
  }

  function onRefresh() { setRefreshing(true); load(); }

  async function accept() {
    if (accepting) return;
    setAccepting(true);
    setErrMsg('');
    try {
      await api.post(`/gifts/${selected._id}/accept`);
      setSelected(null);
      load();
      alert('¡Regalo aceptado! Los items han sido añadidos a tu cuenta.');
    } catch (e) {
      setErrMsg(e.response?.data?.error || 'Error al aceptar');
    } finally { setAccepting(false); }
  }

  async function reject() {
    if (rejecting) return;
    setRejecting(true);
    setErrMsg('');
    try {
      await api.post(`/gifts/${selected._id}/reject`);
      setSelected(null);
      load();
    } catch (e) {
      setErrMsg(e.response?.data?.error || 'Error al rechazar');
    } finally { setRejecting(false); }
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.black} />
      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.textHi} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>REGALOS RECIBIDOS</Text>
          <View style={{ width: 28 }} />
        </View>
      </SafeAreaView>

      {loading ? (
        <ActivityIndicator color={colors.c1} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          style={{ backgroundColor: colors.black }}
          data={gifts}
          keyExtractor={item => item._id}
          renderItem={({ item }) => (
            <GiftCard gift={item} onPress={() => { setErrMsg(''); setSelected(item); }} />
          )}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.c1} />}
          ListEmptyComponent={() => (
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <Ionicons name="gift-outline" size={38} color={colors.c3} />
              </View>
              <Text style={s.emptyTitle}>Sin regalos pendientes</Text>
              <Text style={s.emptySub}>Cuando alguien te envíe un regalo aparecerá aquí</Text>
            </View>
          )}
        />
      )}

      {/* Detail modal */}
      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <Pressable style={s.overlay} onPress={() => setSelected(null)}>
          <Pressable style={s.modalCard} onPress={() => {}}>
            {selected && (
              <>
                <View style={s.modalHandle} />

                <View style={s.modalSender}>
                  <View style={s.modalAvatar}>
                    {selected.emisor?.avatarUrl
                      ? <ExpoImage source={{ uri: selected.emisor.avatarUrl }} style={s.modalAvatarImg} contentFit="cover" />
                      : <Ionicons name="person" size={24} color={colors.textDim} />}
                  </View>
                  <View>
                    <Text style={s.modalSenderName}>@{selected.emisor?.username}</Text>
                    <Text style={s.modalTime}>{timeAgo(selected.createdAt)}</Text>
                  </View>
                  <View style={s.expBadge2}>
                    <Ionicons name="time-outline" size={11} color={colors.c4} />
                    <Text style={s.expBadge2Txt}>{daysLeft(selected.expiraEn)}d restantes</Text>
                  </View>
                </View>

                {selected.mensaje ? (
                  <View style={s.modalMsg}>
                    <Ionicons name="chatbubble-outline" size={13} color={colors.textDim} />
                    <Text style={s.modalMsgTxt}>"{selected.mensaje}"</Text>
                  </View>
                ) : null}

                {/* Contenido */}
                <Text style={s.contentLabel}>CONTENIDO DEL REGALO</Text>

                {selected.monedas > 0 && (
                  <View style={s.contentCoins}>
                    <CoinIcon size={22} />
                    <Text style={s.coinsAmt}>{formatCoins(selected.monedas)}</Text>
                    <Text style={s.coinsSub}>monedas</Text>
                  </View>
                )}

                {selected.items?.length > 0 && (
                  <View style={s.framesRow}>
                    {selected.items.map((item, i) => {
                      const frame = item.frame || {};
                      return (
                        <View key={i} style={s.frameThumb}>
                          <View style={s.framePreview}>
                            <FrameCardBg frame={frame} />
                            {frame.imageUrl && (
                              <ExpoImage source={{ uri: frame.imageUrl }} style={{ width: '80%', height: '80%' }} contentFit="contain" autoplay />
                            )}
                            <View style={s.qtyBadge}>
                              <Text style={s.qtyTxt}>×{item.cantidad}</Text>
                            </View>
                          </View>
                          <Text style={s.frameName} numberOfLines={1}>{frame.name}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}

                {errMsg ? (
                  <View style={s.errBox}>
                    <Ionicons name="alert-circle-outline" size={14} color={colors.c4} />
                    <Text style={s.errTxt}>{errMsg}</Text>
                  </View>
                ) : null}

                <View style={s.actionBtns}>
                  <TouchableOpacity
                    style={[s.rejectBtn, rejecting && { opacity: 0.6 }]}
                    onPress={reject}
                    disabled={rejecting || accepting}
                  >
                    {rejecting
                      ? <ActivityIndicator size={15} color={colors.textDim} />
                      : <Text style={s.rejectTxt}>Rechazar</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.acceptBtn, accepting && { opacity: 0.6 }]}
                    onPress={accept}
                    disabled={accepting || rejecting}
                  >
                    {accepting
                      ? <ActivityIndicator size={15} color={colors.black} />
                      : <>
                          <Ionicons name="checkmark-outline" size={16} color={colors.black} />
                          <Text style={s.acceptTxt}>Aceptar</Text>
                        </>}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
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
  backBtn:     { padding: 4 },
  headerTitle: { color: colors.textHi, fontSize: 13, fontWeight: '800', letterSpacing: 2.5 },

  list: { paddingHorizontal: 16, paddingVertical: 8, paddingBottom: 40 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border,
    padding: 14, marginBottom: 10,
  },
  cardLeft:   { position: 'relative', width: 44, height: 44 },
  avatar:     { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg:  { width: 44, height: 44 },
  giftIcon:   { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(217,70,239,0.15)', borderWidth: 1, borderColor: 'rgba(217,70,239,0.3)', alignItems: 'center', justifyContent: 'center' },
  cardMid:    { flex: 1 },
  senderName: { color: colors.textHi, fontSize: 13, fontWeight: '700', marginBottom: 3 },
  giftSummary:{ color: 'rgba(251,191,36,1)', fontSize: 12, fontWeight: '600', marginBottom: 3 },
  mensaje:    { color: colors.textDim, fontSize: 11, fontStyle: 'italic' },
  cardRight:  { alignItems: 'center' },
  expBadge:       { backgroundColor: 'rgba(0,229,204,0.1)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,229,204,0.25)', paddingHorizontal: 7, paddingVertical: 3 },
  expBadgeUrgent: { backgroundColor: 'rgba(249,115,22,0.1)', borderColor: 'rgba(249,115,22,0.3)' },
  expTxt:         { color: colors.c1, fontSize: 10, fontWeight: '800' },
  expTxtUrgent:   { color: colors.c4 },

  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40, marginTop: 80 },
  emptyIcon:  { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(217,70,239,0.08)', borderWidth: 1, borderColor: 'rgba(217,70,239,0.2)', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.textHi, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptySub:   { color: colors.textDim, fontSize: 13, textAlign: 'center', lineHeight: 18 },

  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: colors.border, padding: 24, paddingBottom: 36 },
  modalHandle:{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20 },

  modalSender:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  modalAvatar:    { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  modalAvatarImg: { width: 48, height: 48 },
  modalSenderName:{ color: colors.textHi, fontSize: 15, fontWeight: '700' },
  modalTime:      { color: colors.textDim, fontSize: 11 },
  expBadge2:      { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(249,115,22,0.08)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)', paddingHorizontal: 8, paddingVertical: 4 },
  expBadge2Txt:   { color: colors.c4, fontSize: 10, fontWeight: '700' },

  modalMsg:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 12, marginBottom: 16 },
  modalMsgTxt: { color: colors.textMid, fontSize: 13, fontStyle: 'italic', flex: 1 },

  contentLabel: { color: colors.textDim, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 14 },

  contentCoins:{ flexDirection: 'row', alignItems: 'baseline', gap: 6, backgroundColor: 'rgba(251,191,36,0.08)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)', padding: 16, marginBottom: 14 },
  coinsSymbol: { color: 'rgba(251,191,36,1)', fontSize: 22, fontWeight: '800' },
  coinsAmt:    { color: colors.textHi, fontSize: 32, fontWeight: '800' },
  coinsSub:    { color: 'rgba(251,191,36,0.7)', fontSize: 13 },

  framesRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  frameThumb:  { width: 80 },
  framePreview:{ width: 80, height: 80, borderRadius: 14, overflow: 'hidden', position: 'relative', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  qtyBadge:    { position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,229,204,0.15)', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(0,229,204,0.3)' },
  qtyTxt:      { color: colors.c1, fontSize: 9, fontWeight: '800' },
  frameName:   { color: colors.textHi, fontSize: 10, fontWeight: '600', marginTop: 5, textAlign: 'center' },

  errBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(249,115,22,0.1)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(249,115,22,0.25)', padding: 12, marginBottom: 14 },
  errTxt:  { color: colors.c4, fontSize: 12, flex: 1 },

  actionBtns: { flexDirection: 'row', gap: 12 },
  rejectBtn:  { flex: 1, paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  rejectTxt:  { color: colors.textDim, fontSize: 14, fontWeight: '600' },
  acceptBtn:  { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16, backgroundColor: colors.c1 },
  acceptTxt:  { color: colors.black, fontSize: 14, fontWeight: '800' },
});
