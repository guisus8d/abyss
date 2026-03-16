import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, SafeAreaView, ActivityIndicator, Alert,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import AvatarWithFrame from '../components/AvatarWithFrame';

const { width: W } = Dimensions.get('window');
const AVATAR_SIZE = Math.min(W * 0.45, 180);

export default function FrameDetailScreen({ route, navigation }) {
  const { frame, units } = route.params;
  const { user, updateUser } = useAuthStore();
  const [equipping, setEquipping] = useState(false);

  const isEquipped = user?.profileFrame === frame._id;

  // Resuelve la URL del marco: sistema usa ID 'frame_001', custom usa imageUrl
  const frameUrl = frame._id === 'frame_001' ? null : frame.imageUrl;
  const profileFrameProp = frame._id === 'frame_001' ? 'frame_001' : (frame.imageUrl ? frame._id : null);

  async function handleEquip() {
    if (equipping) return;
    setEquipping(true);
    try {
      const frameId = isEquipped ? 'default' : frame._id;
      const { data } = await api.patch('/users/me/profile', { profileFrame: frameId });
      if (updateUser) updateUser(data.user);
      Alert.alert(
        isEquipped ? 'Marco quitado' : '✅ Marco equipado',
        isEquipped ? '' : `"${frame.name}" está ahora activo en tu perfil`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el marco');
    } finally {
      setEquipping(false);
    }
  }

  function handleSell() {
    Alert.alert('Próximamente', 'La función de venta estará disponible en la siguiente actualización. 🚀');
  }

  const hasBgGradient = frame.bgType === 'gradient' && Array.isArray(frame.bgGradient) && frame.bgGradient.length >= 2;
  const hasBgColor    = frame.bgType === 'color' && frame.bgColor;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      {/* Fondo */}
      {hasBgGradient
        ? <LinearGradient colors={frame.bgGradient} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
        : hasBgColor
          ? <View style={[StyleSheet.absoluteFill, { backgroundColor: frame.bgColor }]} />
          : <LinearGradient colors={['#040e0d', '#001a18']} style={StyleSheet.absoluteFill} />
      }
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.52)' }]} />

      <SafeAreaView style={s.safe}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.textHi} />
          </TouchableOpacity>
          {units !== null && units !== undefined && (
            <View style={s.unitsBadge}>
              <Ionicons name="layers-outline" size={11} color={colors.c1} />
              <Text style={s.unitsTxt}>×{units} unidades</Text>
            </View>
          )}
        </View>

        {/* Preview */}
        <View style={s.preview}>
          <View style={s.glow} />
          <AvatarWithFrame
            size={AVATAR_SIZE}
            avatarUrl={user?.avatarUrl}
            username={user?.username}
            profileFrame={profileFrameProp}
            frameUrl={frameUrl}
          />
          {isEquipped && (
            <View style={s.equippedBadge}>
              <Ionicons name="checkmark-circle" size={14} color={colors.c1} />
              <Text style={s.equippedTxt}>Equipado</Text>
            </View>
          )}
          <Text style={s.frameName}>{frame.name}</Text>
          {frame.description ? <Text style={s.frameDesc}>{frame.description}</Text> : null}
          {frame.creator?.username && (
            <Text style={s.frameCreator}>por @{frame.creator.username}</Text>
          )}
        </View>

        <View style={s.divider} />

        {/* Botones */}
        <View style={s.actions}>
          <TouchableOpacity style={s.equipBtn} onPress={handleEquip} disabled={equipping} activeOpacity={0.8}>
            <LinearGradient
              colors={isEquipped ? ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)'] : ['#006b63', '#00e5cc']}
              style={s.equipBtnInner}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              {equipping ? (
                <ActivityIndicator size="small" color={isEquipped ? colors.textDim : '#001a18'} />
              ) : (
                <>
                  <Ionicons
                    name={isEquipped ? 'close-circle-outline' : 'checkmark-circle-outline'}
                    size={20}
                    color={isEquipped ? colors.textDim : '#001a18'}
                  />
                  <Text style={[s.equipBtnTxt, isEquipped && { color: colors.textDim }]}>
                    {isEquipped ? 'Quitar marco' : 'Ponérselo'}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={s.sellBtn} onPress={handleSell} activeOpacity={0.8}>
            <Ionicons name="storefront-outline" size={20} color="rgba(251,191,36,0.85)" />
            <Text style={s.sellBtnTxt}>Venderlo</Text>
            <View style={s.soonTag}>
              <Text style={s.soonTagTxt}>PRONTO</Text>
            </View>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  backBtn: { padding: 4 },
  unitsBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,229,204,0.1)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(0,229,204,0.25)',
    paddingHorizontal: 10, paddingVertical: 4,
  },
  unitsTxt: { color: colors.c1, fontSize: 11, fontWeight: '700' },
  preview: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, gap: 12,
  },
  glow: {
    position: 'absolute',
    width: AVATAR_SIZE * 1.6, height: AVATAR_SIZE * 1.6,
    borderRadius: AVATAR_SIZE * 0.8,
    backgroundColor: 'rgba(0,229,204,0.08)',
  },
  equippedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,229,204,0.12)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(0,229,204,0.3)',
    paddingHorizontal: 10, paddingVertical: 4,
  },
  equippedTxt:  { color: colors.c1, fontSize: 11, fontWeight: '700' },
  frameName:    { color: colors.textHi, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  frameDesc:    { color: colors.textDim, fontSize: 13, textAlign: 'center', lineHeight: 19, maxWidth: W * 0.75 },
  frameCreator: { color: 'rgba(0,229,204,0.5)', fontSize: 11 },
  divider:      { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 24 },
  actions:      { paddingHorizontal: 24, paddingVertical: 28, gap: 12 },
  equipBtn:     { borderRadius: 18, overflow: 'hidden' },
  equipBtnInner:{
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16, borderRadius: 18,
  },
  equipBtnTxt: { color: '#001a18', fontWeight: '800', fontSize: 16 },
  sellBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 15, borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)',
    backgroundColor: 'rgba(251,191,36,0.06)',
  },
  sellBtnTxt: { color: 'rgba(251,191,36,0.85)', fontWeight: '700', fontSize: 15 },
  soonTag: {
    backgroundColor: 'rgba(251,191,36,0.12)', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)',
  },
  soonTagTxt: { color: 'rgba(251,191,36,0.6)', fontSize: 8, fontWeight: '800', letterSpacing: 1 },
});
