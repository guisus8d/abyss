import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  StatusBar, ActivityIndicator, Alert,
  Dimensions, Modal, ScrollView, TextInput, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import AvatarWithFrame from '../components/AvatarWithFrame';
import CoinIcon from '../components/CoinIcon';
import GenderIcon from '../components/GenderIcon';
import { presetFromId } from '../utils/framePreset';

const { width: W } = Dimensions.get('window');
const AVATAR_SIZE = Math.min(W * 0.50, 200);
const SIDE_W      = 64;

export default function MarketFrameDetailScreen({ route, navigation }) {
  const { frame } = route.params;
  const { user, updateUser } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [buying,          setBuying]          = useState(false);
  const [liked,           setLiked]           = useState(frame.likedByMe || false);
  const [likesCount,      setLikesCount]      = useState(frame.likesCount  || 0);
  const [avatarModal,     setAvatarModal]     = useState(false);
  const [infoModal,       setInfoModal]       = useState(false);
  const [commentsModal,   setCommentsModal]   = useState(false);
  const [comments,        setComments]        = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsCount,   setCommentsCount]   = useState(frame.commentsCount || 0);
  const [commentText,     setCommentText]     = useState('');
  const [commenting,      setCommenting]      = useState(false);

  const creator  = frame.creator;
  const frameUrl = frame.imageUrl || null;

  const hasBgGradient = frame.bgType === 'gradient' && Array.isArray(frame.bgGradient) && frame.bgGradient.length >= 2;
  const hasBgColor    = frame.bgType === 'color' && frame.bgColor;
  const isOwn  = String(creator?._id) === String(user?._id);
  const canBuy = !isOwn && frame.status === 'active' && frame.units > 0;

  const previewAvatarUrl = frame.logoUrl || presetFromId(String(frame._id));
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

  async function openComments() {
    setCommentsModal(true);
    setCommentsLoading(true);
    try {
      const { data } = await api.get(`/market/frames/${frame._id}/comments`);
      setComments(data.comments || []);
    } catch {}
    finally { setCommentsLoading(false); }
  }

  async function handleComment() {
    if (!commentText.trim() || commenting) return;
    setCommenting(true);
    try {
      const { data } = await api.post(`/market/frames/${frame._id}/comment`, { text: commentText.trim() });
      setComments(prev => [data.comment, ...prev]);
      setCommentsCount(c => c + 1);
      setCommentText('');
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'No se pudo comentar');
    } finally { setCommenting(false); }
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      {/* Background — bgImageUrl first, then gradient/color fallback */}
      {frame.bgImageUrl
        ? <ExpoImage source={{ uri: frame.bgImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        : hasBgGradient
          ? <LinearGradient colors={frame.bgGradient} style={StyleSheet.absoluteFill} start={{ x:0,y:0 }} end={{ x:1,y:1 }} />
          : hasBgColor
            ? <View style={[StyleSheet.absoluteFill, { backgroundColor: frame.bgColor }]} />
            : <LinearGradient colors={['#040e0d','#001a18']} style={StyleSheet.absoluteFill} />
      }
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />

      <SafeAreaView style={s.safe}>

        {/* ── Header (top bar con fondo decorativo) ── */}
        <View style={s.header}>
          <ExpoImage
            source={require('../../assets/market/bg_share_merch_nft.png')}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />

          <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.textHi} />
          </TouchableOpacity>

          <View style={s.headerMeta}>
            <View style={s.headerTitleRow}>
              <Image source={require('../../assets/market/icon_exclusive_nft_1.png')} style={s.nftIcon} />
              <Text style={s.headerTitle} numberOfLines={1}>{frame.name}</Text>
            </View>
            {creator && (
              <TouchableOpacity
                style={s.headerCreator}
                onPress={() => navigation.navigate('PublicProfile', { username: creator.username })}
                activeOpacity={0.7}
              >
                <Text style={s.headerCreatorName}>@{creator.username}</Text>
                <GenderIcon gender={creator?.gender} size={11} />
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
            <Image source={require('../../assets/market/icon_notice.png')} style={s.noticeIcon} />
          </TouchableOpacity>
        </View>

        {/* ── Main: avatar centrado + botones derecha ── */}
        <View style={s.main}>

          <View style={{ width: SIDE_W }} />

          <View style={s.centerCol}>
            <TouchableOpacity
              onPress={() => setAvatarModal(true)}
              activeOpacity={0.9}
              style={s.avatarWrap}
            >
              <AvatarWithFrame
                size={AVATAR_SIZE}
                avatarUrl={previewAvatarUrl}
                username="?"
                profileFrame={frame._id}
                frameUrl={frameUrl}
              />
            </TouchableOpacity>
            <View style={s.nameWrap} />
          </View>

          <View style={s.rightCol}>
            <TouchableOpacity style={s.actionBtn} onPress={handleLike} activeOpacity={0.75}>
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={28}
                color={liked ? '#f43f5e' : '#fff'}
              />
              <Text style={[s.actionCount, liked && { color: '#f43f5e' }]}>{likesCount}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.actionBtn} onPress={openComments} activeOpacity={0.75}>
              <Ionicons name="chatbubble-outline" size={26} color="#fff" />
              <Text style={s.actionCount}>{commentsCount}</Text>
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

            {Platform.OS === 'web' && !isOwn ? (
              <TouchableOpacity
                style={[s.btnHalf, s.btnAppOnly]}
                onPress={() => Linking.openURL('https://abyss.social/download')}
                activeOpacity={0.8}
              >
                <Ionicons name="phone-portrait-outline" size={16} color={colors.textDim} />
                <Text style={s.btnAppOnlyTxt}>Solo en la app</Text>
              </TouchableOpacity>
            ) : isOwn ? (
              <View style={[s.btnHalf, s.btnDisabled]}>
                <Ionicons name="person-outline" size={18} color="#e0e0e0" />
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
              <View style={[s.btnHalf, s.btnUnavail]}>
                <Text style={s.btnUnavailTxt}>No disponible</Text>
              </View>
            )}
          </View>

          {canBuy && (
            <Text style={s.btnBuyUnits}>× {frame.units} disponibles</Text>
          )}
        </View>
      </SafeAreaView>

      {/* ── Modal: foto de perfil ampliada ── */}
      <Modal visible={avatarModal} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setAvatarModal(false)}>
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

      {/* ── Modal: comentarios ── */}
      <Modal visible={commentsModal} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setCommentsModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={s.overlay}>
            <View style={[s.modalBox, { paddingBottom: Math.max(insets.bottom, 20) }]}>
              <View style={s.modalHead}>
                <Text style={s.modalTitle}>COMENTARIOS</Text>
                <TouchableOpacity onPress={() => setCommentsModal(false)}>
                  <Ionicons name="close" size={20} color={colors.textDim} />
                </TouchableOpacity>
              </View>

              {commentsLoading ? (
                <ActivityIndicator style={{ marginVertical: 32 }} color={colors.c1} />
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
                  {comments.length === 0 ? (
                    <Text style={s.noComments}>Sé el primero en comentar</Text>
                  ) : comments.map((c, i) => (
                    <View key={c._id || i} style={[s.commentRow, i > 0 && s.commentBorder]}>
                      {c.user?.avatarUrl
                        ? <Image source={{ uri: c.user.avatarUrl }} style={s.commentAvatar} />
                        : (
                          <View style={s.commentAvatarPh}>
                            <Text style={s.commentAvatarLetter}>{c.user?.username?.[0]?.toUpperCase()}</Text>
                          </View>
                        )
                      }
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <Text style={s.commentUsername}>@{c.user?.username}</Text>
                          <GenderIcon gender={c.user?.gender} size={11} />
                        </View>
                        <Text style={s.commentText}>{c.text}</Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}

              <View style={s.commentInputRow}>
                <TextInput
                  style={s.commentInput}
                  placeholder="Escribe un comentario..."
                  placeholderTextColor={colors.textDim}
                  value={commentText}
                  onChangeText={setCommentText}
                  maxLength={500}
                  multiline
                />
                <TouchableOpacity
                  style={s.commentSendBtn}
                  onPress={handleComment}
                  disabled={commenting || !commentText.trim()}
                >
                  {commenting
                    ? <ActivityIndicator size="small" color={colors.c1} />
                    : <Ionicons name="send" size={18} color={commentText.trim() ? colors.c1 : colors.textDim} />
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal: info del marco ── */}
      <Modal visible={infoModal} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setInfoModal(false)}>
        <View style={s.overlay}>
          <View style={[s.modalBox, { paddingBottom: Math.max(insets.bottom, 20) }]}>
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
    overflow: 'hidden',
  },
  headerBtn:   { padding: 4 },
  headerMeta:  { flex: 1, paddingHorizontal: 8, gap: 4 },
  headerTitle: { color: 'rgba(251,191,36,1)', fontSize: 15, fontWeight: '800' },
  headerCreator:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerAvatar:      { width: 20, height: 20, borderRadius: 10 },
  headerAvatarPh:    { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,229,204,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerAvatarLetter:{ color: colors.c1, fontSize: 10, fontWeight: '800' },
  headerCreatorName: { color: '#fff', fontSize: 12, fontWeight: '600' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nftIcon:        { width: 18, height: 18 },
  noticeIcon:     { width: 32, height: 32 },

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
  actionCount: { color: '#fff', fontSize: 11, fontWeight: '700' },

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
    paddingVertical: 15, borderRadius: 20,
  },

  btnPreview:    { backgroundColor: 'rgba(0,229,204,0.12)', borderWidth: 1, borderColor: 'rgba(0,229,204,0.4)' },
  btnPreviewTxt: { color: colors.c1, fontWeight: '700', fontSize: 13 },

  btnBuy:    { backgroundColor: 'rgba(251,191,36,0.12)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.4)' },
  btnBuyTxt: { color: 'rgba(251,191,36,1)', fontWeight: '700', fontSize: 13 },
  btnBuyUnits: { color: colors.textDim, fontSize: 11, textAlign: 'right' },

  btnUnavail:    { backgroundColor: 'rgba(58,85,112,0.12)', borderWidth: 1, borderColor: 'rgba(58,85,112,0.4)' },
  btnUnavailTxt: { color: colors.textDim, fontWeight: '700', fontSize: 13 },

  btnDisabled:    { backgroundColor: '#4a4a4a', borderWidth: 1, borderColor: '#666' },
  btnDisabledTxt: { color: '#e0e0e0', fontWeight: '700', fontSize: 13 },

  btnAppOnly:    { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  btnAppOnlyTxt: { color: colors.textDim, fontWeight: '700', fontSize: 13 },

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

  // ── Comments ──
  noComments:          { color: colors.textDim, fontSize: 12, textAlign: 'center', paddingVertical: 28 },
  commentRow:          { flexDirection: 'row', gap: 10, paddingVertical: 12, alignItems: 'flex-start' },
  commentBorder:       { borderTopWidth: 1, borderTopColor: colors.border },
  commentAvatar:       { width: 28, height: 28, borderRadius: 14 },
  commentAvatarPh:     { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,229,204,0.15)', alignItems: 'center', justifyContent: 'center' },
  commentAvatarLetter: { color: colors.c1, fontSize: 12, fontWeight: '800' },
  commentUsername:     { color: colors.c1, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  commentText:         { color: colors.textHi, fontSize: 12 },
  commentInputRow:     { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 14, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  commentInput:        { flex: 1, color: colors.textHi, fontSize: 13, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, maxHeight: 80, borderWidth: 1, borderColor: colors.borderC },
  commentSendBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,229,204,0.1)', borderWidth: 1, borderColor: 'rgba(0,229,204,0.3)', alignItems: 'center', justifyContent: 'center' },

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
