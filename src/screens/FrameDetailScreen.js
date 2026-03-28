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

const { width: W } = Dimensions.get('window');
const AVATAR_SIZE = Math.min(W * 0.42, 170);

export default function FrameDetailScreen({ route, navigation }) {
  const { frame, units, mode = 'owner' } = route.params;
  const { user, updateUser } = useAuthStore();

  const [equipping, setEquipping]   = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [infoModal, setInfoModal]   = useState(false);
  const [buying, setBuying]         = useState(false);

  const isOwner    = mode === 'owner';
  const isEquipped = user?.profileFrame === frame._id;

  const frameUrl         = frame._id === 'frame_001' ? null : frame.imageUrl;
  const profileFrameProp = frame._id === 'frame_001' ? 'frame_001' : (frame.imageUrl ? frame._id : null);

  const previewFrameUrl  = previewing ? frameUrl  : (isOwner ? frameUrl  : null);
  const previewFrameProp = previewing ? profileFrameProp : (isOwner ? profileFrameProp : null);

  const hasBgGradient = frame.bgType === 'gradient' && Array.isArray(frame.bgGradient) && frame.bgGradient.length >= 2;
  const hasBgColor    = frame.bgType === 'color' && frame.bgColor;

  async function handleEquip() {
    if (equipping) return;
    setEquipping(true);
    try {
      const frameId = isEquipped ? 'default' : frame._id;
      const payload = { profileFrame: frameId, profileFrameUrl: frameId !== 'default' ? (frame.imageUrl || null) : null };
      const { data } = await api.patch('/users/me/profile', payload);
      if (updateUser) updateUser(data.user);
      Alert.alert(
        isEquipped ? 'Marco quitado' : 'Marco equipado',
        isEquipped ? '' : `"${frame.name}" esta activo en tu perfil`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el marco');
    } finally { setEquipping(false); }
  }

  function handleSell() {
    Alert.alert('Proximamente', 'La tienda propia estara disponible en la siguiente actualizacion.');
  }

  async function handleBuy() {
    if (buying) return;
    setBuying(true);
    try {
      const { data } = await api.post(`/frames/${frame._id}/buy`);
      if (updateUser) updateUser({ ...user, coins: data.newCoins });
      Alert.alert('Marco comprado', `Te quedan ${data.newCoins} monedas`, [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'No se pudo comprar');
    } finally { setBuying(false); }
  }

  const creator = frame.creator;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      {hasBgGradient
        ? <LinearGradient colors={frame.bgGradient} style={StyleSheet.absoluteFill} start={{ x:0,y:0 }} end={{ x:1,y:1 }} />
        : hasBgColor
          ? <View style={[StyleSheet.absoluteFill, { backgroundColor: frame.bgColor }]} />
          : <LinearGradient colors={['#040e0d','#001a18']} style={StyleSheet.absoluteFill} />
      }
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />

      <SafeAreaView style={s.safe}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.textHi} />
          </TouchableOpacity>

          <View style={s.headerCenter}>
            <Text style={s.headerFrameName} numberOfLines={1}>{frame.name}</Text>
            {creator?.username && (
              <TouchableOpacity
                style={s.creatorRow}
                onPress={() => navigation.navigate('PublicProfile', { username: creator.username })}
                activeOpacity={0.7}
              >
                {creator.avatarUrl
                  ? <Image source={{ uri: creator.avatarUrl }} style={s.creatorAvatar} />
                  : <View style={s.creatorAvatarPh}>
                      <Text style={s.creatorAvatarTxt}>{creator.username[0].toUpperCase()}</Text>
                    </View>
                }
                <Text style={s.creatorName}>@{creator.username}</Text>
                <Ionicons name="chevron-forward" size={11} color={colors.textDim} />
              </TouchableOpacity>
            )}
          </View>

          <View style={s.headerRight}>
            {isOwner && units !== null && units !== undefined && (
              <View style={s.unitsBadge}>
                <Ionicons name="layers-outline" size={11} color={colors.c1} />
                <Text style={s.unitsTxt}>x{units}</Text>
              </View>
            )}
            <TouchableOpacity style={s.infoBtn} onPress={() => setInfoModal(true)}>
              <Ionicons name="information-circle-outline" size={24} color={colors.textDim} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Preview */}
        <View style={s.preview}>
          <View style={s.glow} />
          <AvatarWithFrame
            size={AVATAR_SIZE}
            avatarUrl={user?.avatarUrl}
            username={user?.username}
            profileFrame={previewFrameProp}
            frameUrl={previewFrameUrl}
          />
          {isEquipped && isOwner && (
            <View style={s.badge}>
              <Ionicons name="checkmark-circle" size={14} color={colors.c1} />
              <Text style={s.badgeTxt}>Equipado</Text>
            </View>
          )}
          {previewing && !isOwner && (
            <View style={[s.badge, s.badgePreview]}>
              <Ionicons name="eye-outline" size={14} color="rgba(251,191,36,1)" />
              <Text style={[s.badgeTxt, { color: 'rgba(251,191,36,1)' }]}>Previsualizando</Text>
            </View>
          )}
        </View>

        <View style={s.divider} />

        {/* Botones */}
        <View style={s.actions}>
          {isOwner ? (
            <>
              <TouchableOpacity style={s.mainBtn} onPress={handleEquip} disabled={equipping} activeOpacity={0.85}>
                <LinearGradient
                  colors={isEquipped ? ['rgba(255,255,255,0.08)','rgba(255,255,255,0.04)'] : ['#006b63','#00e5cc']}
                  style={s.btnInner} start={{ x:0,y:0 }} end={{ x:1,y:0 }}
                >
                  {equipping ? <ActivityIndicator size="small" color={isEquipped ? colors.textDim : '#001a18'} /> : (
                    <>
                      <Ionicons name={isEquipped ? 'close-circle-outline' : 'checkmark-circle-outline'} size={20} color={isEquipped ? colors.textDim : '#001a18'} />
                      <Text style={[s.mainBtnTxt, isEquipped && { color: colors.textDim }]}>
                        {isEquipped ? 'Quitar marco' : 'Ponerme este marco'}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={s.secBtn} onPress={handleSell} activeOpacity={0.8}>
                <Ionicons name="storefront-outline" size={18} color="rgba(251,191,36,0.85)" />
                <Text style={s.secBtnTxt}>Venderlo</Text>
                <View style={s.soonTag}><Text style={s.soonTagTxt}>PRONTO</Text></View>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[s.secBtn, previewing && s.secBtnActive]}
                onPress={() => setPreviewing(v => !v)}
                activeOpacity={0.8}
              >
                <Ionicons name={previewing ? 'eye-off-outline' : 'eye-outline'} size={18} color="rgba(251,191,36,0.85)" />
                <Text style={s.secBtnTxt}>{previewing ? 'Quitar preview' : 'Previsualizar'}</Text>
              </TouchableOpacity>

              {frame.status === 'active' && frame.units > 0 ? (
                <TouchableOpacity style={s.mainBtn} onPress={handleBuy} disabled={buying} activeOpacity={0.85}>
                  <LinearGradient colors={['#7c4d00','#f97316']} style={s.btnInner} start={{ x:0,y:0 }} end={{ x:1,y:0 }}>
                    {buying ? <ActivityIndicator size="small" color="#fff" /> : (
                      <>
                        <Ionicons name="bag-outline" size={20} color="#fff" />
                        <Text style={[s.mainBtnTxt, { color: '#fff' }]}>Comprar · {frame.price} monedas</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <View style={[s.secBtn, { opacity: 0.35 }]}>
                  <Ionicons name="close-circle-outline" size={18} color={colors.textDim} />
                  <Text style={[s.secBtnTxt, { color: colors.textDim }]}>No disponible en tienda</Text>
                </View>
              )}
            </>
          )}
        </View>
      </SafeAreaView>

      {/* Modal Info */}
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
                { label: 'Descripcion', value: frame.description || '—' },
                { label: 'Creador',     value: creator?.username ? `@${creator.username}` : '—' },
                { label: 'ID',          value: frame._id },
                { label: 'Vendidos',    value: String(frame.totalSold || 0) },
                { label: 'Precio',      value: frame.price ? `${frame.price} monedas` : '—' },
                { label: 'Estado',      value: frame.status || '—' },
                { label: 'Creado',      value: frame.createdAt ? new Date(frame.createdAt).toLocaleDateString('es-MX', { day:'2-digit', month:'long', year:'numeric' }) : '—' },
              ].map((row, i) => (
                <View key={i} style={[s.infoRow, i > 0 && s.infoRowBorder]}>
                  <Text style={s.infoLabel}>{row.label}</Text>
                  <Text style={s.infoValue} numberOfLines={row.label === 'ID' ? 1 : 4}>{row.value}</Text>
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

  header: { flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:12, gap:10 },
  backBtn: { padding:4 },
  headerCenter: { flex:1, gap:4 },
  headerFrameName: { color:'rgba(251,191,36,1)', fontSize:15, fontWeight:'800' },
  creatorRow: { flexDirection:'row', alignItems:'center', gap:5 },
  creatorAvatar: { width:18, height:18, borderRadius:9, borderWidth:1, borderColor:'rgba(255,255,255,0.15)' },
  creatorAvatarPh: { width:18, height:18, borderRadius:9, backgroundColor:'rgba(0,229,204,0.15)', alignItems:'center', justifyContent:'center' },
  creatorAvatarTxt: { color:colors.c1, fontSize:8, fontWeight:'800' },
  creatorName: { color:colors.textDim, fontSize:11 },
  headerRight: { flexDirection:'row', alignItems:'center', gap:6 },
  unitsBadge: { flexDirection:'row', alignItems:'center', gap:4, backgroundColor:'rgba(0,229,204,0.1)', borderRadius:10, borderWidth:1, borderColor:'rgba(0,229,204,0.25)', paddingHorizontal:8, paddingVertical:3 },
  unitsTxt: { color:colors.c1, fontSize:11, fontWeight:'700' },
  infoBtn: { padding:4 },

  preview: { flex:1, alignItems:'center', justifyContent:'center', gap:14 },
  glow: { position:'absolute', width:AVATAR_SIZE*1.6, height:AVATAR_SIZE*1.6, borderRadius:AVATAR_SIZE*0.8, backgroundColor:'rgba(0,229,204,0.07)' },
  badge: { flexDirection:'row', alignItems:'center', gap:4, backgroundColor:'rgba(0,229,204,0.12)', borderRadius:10, borderWidth:1, borderColor:'rgba(0,229,204,0.3)', paddingHorizontal:10, paddingVertical:4 },
  badgePreview: { backgroundColor:'rgba(251,191,36,0.1)', borderColor:'rgba(251,191,36,0.35)' },
  badgeTxt: { color:colors.c1, fontSize:11, fontWeight:'700' },

  divider: { height:1, backgroundColor:'rgba(255,255,255,0.06)', marginHorizontal:24, marginBottom:4 },
  actions: { paddingHorizontal:24, paddingVertical:20, gap:12 },

  mainBtn:    { borderRadius:18, overflow:'hidden' },
  btnInner:   { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, paddingVertical:16, borderRadius:18 },
  mainBtnTxt: { color:'#001a18', fontWeight:'800', fontSize:15 },

  secBtn: { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, paddingVertical:14, borderRadius:18, borderWidth:1, borderColor:'rgba(251,191,36,0.25)', backgroundColor:'rgba(251,191,36,0.06)' },
  secBtnActive: { borderColor:'rgba(251,191,36,0.5)', backgroundColor:'rgba(251,191,36,0.12)' },
  secBtnTxt: { color:'rgba(251,191,36,0.85)', fontWeight:'700', fontSize:14 },
  soonTag: { backgroundColor:'rgba(251,191,36,0.12)', borderRadius:6, paddingHorizontal:6, paddingVertical:2, borderWidth:1, borderColor:'rgba(251,191,36,0.2)' },
  soonTagTxt: { color:'rgba(251,191,36,0.6)', fontSize:8, fontWeight:'800', letterSpacing:1 },

  overlay: { flex:1, backgroundColor:'rgba(0,0,0,0.75)', justifyContent:'flex-end' },
  modalBox: { backgroundColor:colors.surface, borderTopLeftRadius:24, borderTopRightRadius:24, borderWidth:1, borderColor:colors.border, padding:24, maxHeight:'72%' },
  modalHead: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:20 },
  modalTitle: { color:colors.c1, fontSize:11, fontWeight:'900', letterSpacing:4 },
  infoRow: { paddingVertical:13, flexDirection:'row', gap:12 },
  infoRowBorder: { borderTopWidth:1, borderTopColor:colors.border },
  infoLabel: { color:colors.textDim, fontSize:11, width:100 },
  infoValue: { flex:1, color:colors.textHi, fontSize:12, fontWeight:'600' },
});
