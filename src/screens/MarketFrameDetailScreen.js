import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  StatusBar, ActivityIndicator, Alert,
  Dimensions, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import AvatarWithFrame from '../components/AvatarWithFrame';
import CoinIcon from '../components/CoinIcon';

const { width: W } = Dimensions.get('window');
const AVATAR_SIZE = Math.min(W * 0.38, 150);
const SIDE_W      = 64;

export default function MarketFrameDetailScreen({ route, navigation }) {
  const { frame } = route.params;
  const { user, updateUser } = useAuthStore();

  const [buying,       setBuying]       = useState(false);
  const [liked,        setLiked]        = useState(frame.likedByMe || false);
  const [likesCount,   setLikesCount]   = useState(frame.likesCount  || 0);
  const [avatarModal,  setAvatarModal]  = useState(false);
  const [infoModal,    setInfoModal]    = useState(false);

  const creator  = frame.creator;
  const frameUrl = frame.imageUrl || null;

  const hasBgGradient = frame.bgType === 'gradient' && Array.isArray(frame.bgGradient) && frame.bgGradient.length >= 2;
  const hasBgColor    = frame.bgType === 'color' && frame.bgColor;
  const isOwn  = String(creator?._id) === String(user?._id);
  const canBuy = !isOwn && frame.status === 'active' && frame.units > 0;

  const displayAvatarUrl = creator?.avatarUrl;
  const displayUsername  = creator?.username;

  async function handleBuy() {
    if (buying) return;
    setBuying(true);
    try {
      const { data } = await api.post(`/market/frames/${frame._id}/buy`);
      if (updateUser) updateUser({ ...user, coins: data.newCoins });
      Alert.alert('Marco comprado', `Te quedan ${data.newCoins} monedas`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'No se pudo comprar');
    } finally { setBuying(false); }
  }

  async function handleLike() {
    const next = !liked;
    setLiked(next);
    setLikesCount(c => next ? c + 1 : Math.max(0, c - 1));
    try {
      await api.post(`/market/frames/${frame._id}/like`);
    } catch {
      setLiked(!next);
      setLikesCount(c => next ? Math.max(0, c - 1) : c + 1);
    }
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      {/* Background */}
      {hasBgGradient
        ? <LinearGradient colors={frame.bgGradient} style={StyleSheet.absoluteFill} start={{ x:0,y:0 }} end={{ x:1,y:1 }} />
        : hasBgColor
          ? <View style={[StyleSheet.absoluteFill, { backgroundColor: frame.bgColor }]} />
          : <LinearGradient colors={['#040e0d','#001a18']} style={StyleSheet.absoluteFill} />
      }
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />

      <SafeAreaView style={s.safe}>

        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.textHi} />
          </TouchableOpacity>

          <View style={s.headerMeta}>
            <Text style={s.headerTitle} numberOfLines={1}>{frame.name}</Text>
            {creator && (
              <TouchableOpacity
                style={s.headerCreator}
                onPress={() => navigation.navigate('PublicProfile', { username: creator.username })}
                activeOpacity={0.7}
              >
                <Text style={s.headerCreatorName}>@{creator.username}</Text>
                {creator.avatarUrl
                  ? <Image source={{ uri: creator.avatarUrl }} style={s.headerAvatar} />
                  : (
                    <View style={s.headerAvatarPh}>
                      <Text style={s.headerAvatarLetter}>{creator.username?.[0]?.toUpperCase()}</Text>
                    </View>
                  )
                }
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={s.headerBtn} onPress={() => setInfoModal(true)}>
            <Ionicons name="information-circle-outline" size={24} color={colors.textDim} />
          </TouchableOpacity>
        </View>

        {/* ── Main: avatar centrado + botones derecha ── */}
        <View style={s.main}>

          {/* Espacio izquierdo para equilibrar los botones derechos */}
          <View style={{ width: SIDE_W }} />

          {/* Columna central: foto del creador con el marco */}
          <View style={s.centerCol}>
            <TouchableOpacity
              onPress={() => setAvatarModal(true)}
              activeOpacity={0.9}
              style={s.avatarWrap}
            >
              <AvatarWithFrame
                size={AVATAR_SIZE}
                avatarUrl={displayAvatarUrl}
                username={displayUsername}
                profileFrame={frame._id}
                frameUrl={frameUrl}
              />
            </TouchableOpacity>

            <View style={s.nameWrap} />
          </View>

          {/* Columna derecha: like + comentar */}
          <View style={s.rightCol}>
            <TouchableOpacity style={s.actionBtn} onPress={handleLike} activeOpacity={0.75}>
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={28}
                color={liked ? '#f43f5e' : colors.textDim}
              />
              <Text style={[s.actionCount, liked && { color: '#f43f5e' }]}>{likesCount}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.actionBtn} activeOpacity={0.75}>
              <Ionicons name="chatbubble-outline" size={26} color={colors.textDim} />
              <Text style={s.actionCount}>{frame.commentsCount || 0}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Sección inferior ── */}
        <View style={s.bottom}>

          {/* Botones: Previsualizar | Comprar */}
          <View style={s.btnRow}>

            <TouchableOpacity
              style={[s.btnHalf, s.btnPreview]}
              onPress={() => navigation.navigate('FramePreview', { frame })}
              activeOpacity={0.8}
            >
              <Text style={s.btnPreviewTxt}>Previsualizar</Text>
            </TouchableOpacity>

            {isOwn ? (
              <View style={[s.btnHalf, s.btnDisabled]}>
                <Ionicons name="person-outline" size={18} color={colors.textDim} />
                <Text style={s.btnDisabledTxt}>Tuyo</Text>
              </View>
            ) : canBuy ? (
              <TouchableOpacity
                style={[s.btnHalf, s.btnBuy]}
                onPress={handleBuy}
                disabled={buying}
                activeOpacity={0.85}
              >
                {buying
                  ? <ActivityIndicator size="small" color="#1a0e00" />
                  : <>
                      <CoinIcon size={16} />
                      <Text style={s.btnBuyTxt}>{frame.price}</Text>
                    </>
                }
              </TouchableOpacity>
            ) : (
              <View style={[s.btnHalf, s.btnDisabled]}>
                <Ionicons name="close-circle-outline" size={18} color={colors.textDim} />
                <Text style={s.btnDisabledTxt}>Agotado</Text>
              </View>
            )}
          </View>

          {canBuy && (
            <Text style={s.btnBuyUnits}>× {frame.units} disponibles</Text>
          )}
        </View>
      </SafeAreaView>

      {/* ── Modal: foto de perfil ampliada ── */}
      <Modal visible={avatarModal} transparent animationType="fade" onRequestClose={() => setAvatarModal(false)}>
        <TouchableOpacity style={s.avatarOverlay} activeOpacity={1} onPress={() => setAvatarModal(false)}>
          <View style={s.avatarModalInner}>
            {displayAvatarUrl ? (
              <Image source={{ uri: displayAvatarUrl }} style={s.avatarModalImg} />
            ) : (
              <View style={s.avatarModalPh}>
                <Text style={s.avatarModalLetter}>{displayUsername?.[0]?.toUpperCase()}</Text>
              </View>
            )}
            {displayUsername ? (
              <Text style={s.avatarModalName}>@{displayUsername}</Text>
            ) : null}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Modal: info del marco ── */}
      <Modal visible={infoModal} transparent animationType="slide" onRequestClose={() => setInfoModal(false)}>
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>INFO DEL MARCO</Text>
              <TouchableOpacity onPress={() => setInfoModal(false)}>
                <Ionicons name="close" size={20} color={colors.textDim} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                { label: 'Nombre',      value: frame.name },
                { label: 'Descripción', value: frame.description || '—' },
                { label: 'Creador',     value: creator?.username || '—' },
                { label: 'Precio',      value: frame.price ? `${frame.price} monedas` : '—' },
                { label: 'Unidades',    value: String(frame.units || 0) },
                { label: 'Vendidos',    value: String(frame.totalSold || 0) },
                { label: 'Estado',      value: frame.status || '—' },
                { label: 'Creado',      value: frame.createdAt
                    ? new Date(frame.createdAt).toLocaleDateString('es-MX', { day:'2-digit', month:'long', year:'numeric' })
                    : '—' },
              ].map((row, i) => (
                <View key={i} style={[s.infoRow, i > 0 && s.infoRowBorder]}>
                  <Text style={s.infoLabel}>{row.label}</Text>
                  <Text style={s.infoValue} numberOfLines={4}>{row.value}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex:1, backgroundColor: colors.black },
  safe: { flex:1 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 8,
  },
  headerBtn:   { padding: 4 },
  headerMeta:  { flex: 1, paddingHorizontal: 8, gap: 4 },
  headerTitle: { color: 'rgba(251,191,36,1)', fontSize: 15, fontWeight: '800' },
  headerCreator:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerAvatar:      { width: 20, height: 20, borderRadius: 10 },
  headerAvatarPh:    { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,229,204,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerAvatarLetter:{ color: colors.c1, fontSize: 10, fontWeight: '800' },
  headerCreatorName: { color: colors.textDim, fontSize: 12, fontWeight: '600' },

  // ── Main area ──
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },

  centerCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },

  avatarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00e5cc',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },

  nameWrap: { alignItems: 'center', minHeight: 28 },
  creatorName: { color: colors.textDim, fontSize: 14, fontWeight: '600' },

  rightCol: {
    width: SIDE_W,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  actionBtn:   { alignItems: 'center', gap: 4 },
  actionCount: { color: colors.textDim, fontSize: 11, fontWeight: '700' },

  // ── Bottom section ──
  bottom: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },

  btnRow:  { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  btnHalf: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    paddingVertical: 15, borderRadius: 18,
  },

  btnPreview:    { backgroundColor: 'rgba(0,229,204,0.12)', borderWidth: 1, borderColor: 'rgba(0,229,204,0.4)' },
  btnPreviewTxt: { color: colors.c1, fontWeight: '700', fontSize: 13 },

  btnBuy:    { backgroundColor: 'rgba(251,191,36,0.12)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.4)' },
  btnBuyTxt: { color: 'rgba(251,191,36,1)', fontWeight: '700', fontSize: 13 },
  btnBuyUnits: { color: colors.textDim, fontSize: 11, textAlign: 'right' },

  btnDisabled:  {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  btnDisabledTxt: { color: colors.textDim, fontWeight: '700', fontSize: 13 },

  // ── Avatar modal ──
  avatarOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarModalInner: { alignItems: 'center', gap: 16 },
  avatarModalImg:   { width: 230, height: 230, borderRadius: 115, borderWidth: 3, borderColor: 'rgba(255,255,255,0.18)' },
  avatarModalPh:    { width: 230, height: 230, borderRadius: 115, backgroundColor: 'rgba(0,229,204,0.15)', alignItems: 'center', justifyContent: 'center' },
  avatarModalLetter:{ color: colors.c1, fontSize: 90, fontWeight: '800' },
  avatarModalName:  { color: colors.textHi, fontSize: 15, fontWeight: '700' },

  // ── Info modal ──
  overlay:    { flex:1, backgroundColor:'rgba(0,0,0,0.75)', justifyContent:'flex-end' },
  modalBox:   { backgroundColor:colors.surface, borderTopLeftRadius:24, borderTopRightRadius:24, borderWidth:1, borderColor:colors.border, padding:24, maxHeight:'72%' },
  modalHead:  { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:20 },
  modalTitle: { color:colors.c1, fontSize:11, fontWeight:'900', letterSpacing:4 },
  infoRow:    { paddingVertical:13, flexDirection:'row', gap:12 },
  infoRowBorder: { borderTopWidth:1, borderTopColor:colors.border },
  infoLabel:  { color:colors.textDim, fontSize:11, width:100 },
  infoValue:  { flex:1, color:colors.textHi, fontSize:12, fontWeight:'600' },
});
