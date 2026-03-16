import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, SafeAreaView, ActivityIndicator, Alert,
  FlatList, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import AvatarWithFrame from '../components/AvatarWithFrame';

const { width: W } = Dimensions.get('window');
const COLS        = 3;
const GAP         = 10;
const CARD_W      = (W - 32 - GAP * (COLS - 1)) / COLS;
const PREVIEW_SIZE = Math.min(W * 0.38, 150);

const SYSTEM_FRAME = {
  _id: 'frame_001',
  name: 'Marco Estelar',
  description: 'El marco original de Abyss',
  imageUrl: null,
  isSystem: true,
};

export default function FrameSelectorScreen({ navigation }) {
  const { user, updateUser } = useAuthStore();
  const [owned, setOwned]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);
  const [equipping, setEquipping] = useState(false);

  const activeFrameId = user?.profileFrame || 'default';

  useEffect(() => { loadFrames(); }, []);

  async function loadFrames() {
    setLoading(true);
    try {
      const { data } = await api.get('/frames/my');
      const frames = data.frames || [];
      const allFrames = (user?.xp || 0) >= 10
        ? [SYSTEM_FRAME, ...frames]
        : frames;
      setOwned(allFrames);
      // Pre-seleccionar el marco activo
      const current = allFrames.find(item => {
        const id = item.frame ? item.frame._id : item._id;
        return id === activeFrameId;
      });
      if (current) setSelected(current.frame || current);
    } catch (e) { console.log(e); }
    finally { setLoading(false); }
  }

  // Obtiene frameUrl y profileFrame prop correctos para AvatarWithFrame
  function resolveFrameProps(frameObj) {
    if (!frameObj) return { profileFrame: null, frameUrl: null };
    if (frameObj._id === 'frame_001' || frameObj.isSystem)
      return { profileFrame: 'frame_001', frameUrl: null };
    return { profileFrame: frameObj._id, frameUrl: frameObj.imageUrl || null };
  }

  async function handleEquip() {
    if (!selected || equipping) return;
    setEquipping(true);
    try {
      const frameId = selected._id === activeFrameId ? 'default' : selected._id;
      const frameUrl = frameId === 'default' ? null : (selected.imageUrl || null);
      const { data } = await api.patch('/users/me/profile', { profileFrame: frameId, profileFrameUrl: frameUrl });
      if (updateUser) updateUser(data.user);
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el marco');
    } finally { setEquipping(false); }
  }

  async function handleRemove() {
    setEquipping(true);
    try {
      const { data } = await api.patch('/users/me/profile', { profileFrame: 'default' });
      if (updateUser) updateUser(data.user);
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'No se pudo quitar el marco');
    } finally { setEquipping(false); }
  }

  const isSelectedEquipped = selected?._id === activeFrameId;
  const hasActiveFrame     = activeFrameId !== 'default' && !!activeFrameId;

  const previewProps = resolveFrameProps(selected);

  function renderCard({ item }) {
    const frameObj     = item.frame || item;
    const units        = item.units !== undefined ? item.units : null;
    const isActive     = frameObj._id === activeFrameId;
    const isSelectedCard = selected?._id === frameObj._id;
    const cardProps    = resolveFrameProps(frameObj);

    return (
      <TouchableOpacity
        style={[s.card, isSelectedCard && s.cardSelected, isActive && !isSelectedCard && s.cardActive]}
        onPress={() => setSelected(frameObj)}
        activeOpacity={0.75}
      >
        <View style={s.cardPreview}>
          <AvatarWithFrame
            size={CARD_W * 0.65}
            avatarUrl={user?.avatarUrl}
            username={user?.username}
            profileFrame={cardProps.profileFrame}
            frameUrl={cardProps.frameUrl}
          />
          {isActive && (
            <View style={s.activeDot}>
              <Ionicons name="checkmark-circle" size={14} color={colors.c1} />
            </View>
          )}
          {units !== null && !isActive && (
            <View style={s.unitsBadge}><Text style={s.unitsTxt}>×{units}</Text></View>
          )}
        </View>
        <Text style={[s.cardName, isActive && { color: colors.c1 }]} numberOfLines={1}>
          {frameObj.name}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.c1} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>MARCO DE PERFIL</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      {/* Preview */}
      <View style={s.previewSection}>
        <View style={s.previewGlow} />
        <AvatarWithFrame
          size={PREVIEW_SIZE}
          avatarUrl={user?.avatarUrl}
          username={user?.username}
          profileFrame={previewProps.profileFrame}
          frameUrl={previewProps.frameUrl}
        />
        {selected
          ? <Text style={s.previewName}>{selected.name}</Text>
          : <Text style={s.previewHint}>Sin marco</Text>
        }
      </View>

      {/* Subtítulo */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionLabel}>TUS MARCOS</Text>
        {hasActiveFrame && (
          <TouchableOpacity onPress={handleRemove} disabled={equipping}>
            <Text style={s.removeLink}>Quitar marco</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Grid */}
      {loading ? (
        <ActivityIndicator color={colors.c1} style={{ marginTop: 32 }} />
      ) : owned.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="sparkles-outline" size={36} color={colors.textDim} />
          <Text style={s.emptyTxt}>Aún no tienes marcos</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Collection')}>
            <Text style={s.emptyLink}>Ver colección →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={owned}
          keyExtractor={(item, i) => (item.frame?._id || item._id || String(i))}
          renderItem={renderCard}
          numColumns={COLS}
          contentContainerStyle={s.grid}
          columnWrapperStyle={{ gap: GAP }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Botón equipar */}
      {selected && (
        <View style={s.footer}>
          <TouchableOpacity
            style={s.equipBtn}
            onPress={isSelectedEquipped ? handleRemove : handleEquip}
            disabled={equipping}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={isSelectedEquipped
                ? ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)']
                : ['#006b63', '#00e5cc']}
              style={s.equipBtnInner}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              {equipping ? (
                <ActivityIndicator size="small" color={isSelectedEquipped ? colors.textDim : '#001a18'} />
              ) : (
                <>
                  <Ionicons
                    name={isSelectedEquipped ? 'close-circle-outline' : 'checkmark-circle-outline'}
                    size={20}
                    color={isSelectedEquipped ? colors.textDim : '#001a18'}
                  />
                  <Text style={[s.equipBtnTxt, isSelectedEquipped && { color: colors.textDim }]}>
                    {isSelectedEquipped ? 'Quitar marco' : `Equipar "${selected.name}"`}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn:     { width: 40 },
  headerTitle: { fontSize: 13, fontWeight: '900', letterSpacing: 5, color: colors.c1 },
  previewSection: {
    alignItems: 'center', paddingVertical: 28, gap: 10,
    backgroundColor: 'rgba(0,229,204,0.03)',
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  previewGlow: {
    position: 'absolute',
    width: PREVIEW_SIZE * 1.5, height: PREVIEW_SIZE * 1.5,
    borderRadius: PREVIEW_SIZE * 0.75,
    backgroundColor: 'rgba(0,229,204,0.06)',
  },
  previewName: { color: colors.textHi, fontSize: 15, fontWeight: '700' },
  previewHint: { color: colors.textDim, fontSize: 13 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  sectionLabel: { color: colors.textDim, fontSize: 9, fontWeight: '700', letterSpacing: 3 },
  removeLink:   { color: 'rgba(239,68,68,0.7)', fontSize: 11, fontWeight: '600' },
  grid: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 4 },
  card: {
    width: CARD_W, backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden', marginBottom: GAP,
  },
  cardSelected: { borderColor: colors.c1, backgroundColor: 'rgba(0,229,204,0.07)' },
  cardActive:   { borderColor: 'rgba(0,229,204,0.4)' },
  cardPreview: {
    width: '100%', aspectRatio: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  activeDot:  { position: 'absolute', top: 6, right: 6 },
  unitsBadge: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: 'rgba(0,229,204,0.15)', borderRadius: 8,
    paddingHorizontal: 5, paddingVertical: 2,
    borderWidth: 1, borderColor: 'rgba(0,229,204,0.25)',
  },
  unitsTxt: { color: colors.c1, fontSize: 9, fontWeight: '800' },
  cardName: {
    color: colors.textMid, fontSize: 10, fontWeight: '600',
    paddingHorizontal: 7, paddingVertical: 7, textAlign: 'center',
  },
  empty:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 40 },
  emptyTxt: { color: colors.textDim, fontSize: 14 },
  emptyLink:{ color: colors.c1, fontSize: 13, fontWeight: '600', marginTop: 4 },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingBottom: 28, paddingTop: 12,
    backgroundColor: 'rgba(2,5,9,0.95)',
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  equipBtn:      { borderRadius: 16, overflow: 'hidden' },
  equipBtnInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 15, borderRadius: 16,
  },
  equipBtnTxt: { color: '#001a18', fontWeight: '800', fontSize: 15 },
});
