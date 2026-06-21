import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Image, StatusBar, ActivityIndicator, Alert, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { presetFromId } from '../utils/framePreset';
import CoinIcon from '../components/CoinIcon';
import { formatCoins } from '../utils/formatCoins';

const { width: W } = Dimensions.get('window');
const COLS     = 3;
const GAP      = 10;
const CARD_W   = (W - 32 - GAP * (COLS - 1)) / COLS;


function FrameCard({ frame, units, onPress, onLongPress }) {
  const avatarSize = CARD_W * 0.62;

  function CardBg() {
    if (frame.bgImageUrl)
      return <ExpoImage source={{ uri: frame.bgImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />;
    const grad = typeof frame.bgGradient === 'string' ? JSON.parse(frame.bgGradient || '[]') : (frame.bgGradient || []);
    if (frame.bgType === 'gradient' && grad.length >= 2)
      return <LinearGradient colors={grad} style={StyleSheet.absoluteFill} />;
    return <ExpoImage source={require('../../assets/chat-bg.jpeg')} style={StyleSheet.absoluteFill} contentFit="cover" />;
  }

  return (
    <View>
      <TouchableOpacity style={s.card} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.8} delayLongPress={400}>
        <View style={s.cardPreview}>
          <CardBg />
          <ExpoImage
            source={frame.logoUrl ? { uri: frame.logoUrl } : presetFromId(String(frame._id))}
            style={[s.cardAvatar, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}
            contentFit="cover"
          />
          {frame.imageUrl
            ? <ExpoImage source={{ uri: frame.imageUrl }} style={s.cardFrame} contentFit="contain" autoplay />
            : <View style={s.cardFramePlaceholder}><Ionicons name="sparkles-outline" size={28} color={colors.c1} /></View>}
          {units !== null && (
            <View style={s.unitsBadge}>
              <Ionicons name="albums-outline" size={9} color={colors.c1} />
              <Text style={s.unitsTxt}>×{units}</Text>
            </View>
          )}
        </View>
        <Text style={s.cardName} numberOfLines={1}>{frame.name}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function CollectionScreen({ navigation }) {
  const { user, updateUser } = useAuthStore();
  const [owned, setOwned]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const { data } = await api.get('/frames/my');
      setOwned(data.frames || []);
    } catch (e) { console.log(e); }
    finally { setLoading(false); }
  }

  function handleDelete(frame) {
    const isEquipped = String(user?.profileFrame) === String(frame._id);
    const msg = isEquipped
      ? `"${frame.name}" está equipado actualmente. Al eliminarlo se desequipará y perderás todas tus unidades. Esta acción no se puede deshacer.`
      : `¿Eliminar "${frame.name}"? Perderás todas tus unidades. Esta acción no se puede deshacer.`;
    Alert.alert('Eliminar marco', msg, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => confirmDelete(frame) },
    ]);
  }

  async function confirmDelete(frame) {
    if (deleting) return;
    setDeleting(true);
    try {
      const { data } = await api.delete(`/frames/my/${frame._id}`);
      if (data.profileCleared) {
        updateUser({ ...user, profileFrame: 'default', profileFrameUrl: null });
      }
      await loadAll();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'No se pudo eliminar el marco');
    } finally { setDeleting(false); }
  }

  async function expandSlots() {
    try {
      const { data } = await api.post('/frames/slots/expand');
      updateUser({ ...user, coins: data.coins, collectionSlots: data.collectionSlots });
      alert(`Colección expandida — ${data.collectionSlots} slots`);
    } catch (e) {
      alert(e.response?.data?.error || 'Error');
    }
  }

  function renderFrameCard({ item }) {
    const frame = item.frame || item;
    const units = item.units !== undefined ? item.units : null;
    return (
      <FrameCard
        frame={frame}
        units={units}
        onPress={() => navigation.navigate('FrameDetail', { frame, units })}
        onLongPress={() => handleDelete(frame)}
      />
    );
  }


  function renderEmpty(icon, title, sub) {
    return (
      <View style={s.empty}>
        <View style={s.emptyIcon}>
          <Ionicons name={icon} size={40} color={colors.c1} />
        </View>
        <Text style={s.emptyTitle}>{title}</Text>
        <Text style={s.emptySub}>{sub}</Text>
      </View>
    );
  }

  const slotsUsed = owned.length;
  const slotsTotal = user?.collectionSlots || 10;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.textHi} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>MI COLECCIÓN</Text>
          <TouchableOpacity onPress={() => navigation.navigate('CreateFrame')} style={s.createBtn}>
            <Ionicons name="add" size={22} color={colors.c1} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Info slots y monedas */}
      <View style={s.infoRow}>
        <View style={s.infoItem}>
          <Ionicons name="albums-outline" size={14} color={colors.textDim} />
          <Text style={s.infoTxt}>{slotsUsed}/{slotsTotal} slots</Text>
          {slotsTotal < 500 && (
            <TouchableOpacity onPress={expandSlots} style={s.expandBtn}>
              <Text style={s.expandTxt}>+1 (10✦)</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={s.infoItem}>
          <CoinIcon size={13} />
          <Text style={s.coinsVal}>{formatCoins(user?.coins ?? 50)}</Text>
        </View>
      </View>

      {/* Contenido */}
      {loading ? (
        <ActivityIndicator color={colors.c1} style={{ marginTop: 40 }} />
      ) : owned.length === 0 ? (
        renderEmpty('sparkles-outline', 'Colección vacía', 'Desbloquea marcos con XP o cómpralos en el mercado')
      ) : (
        <FlatList
          style={{ backgroundColor: colors.black }}
          data={owned}
          keyExtractor={(item, i) => item._id || String(i)}
          renderItem={renderFrameCard}
          numColumns={COLS}
          contentContainerStyle={s.grid}
          columnWrapperStyle={{ gap: GAP }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    justifyContent: 'space-between',
  },
  backBtn:    { padding: 4 },
  headerTitle:{ color: colors.textHi, fontSize: 13, fontWeight: '800', letterSpacing: 2.5 },
  createBtn:  { padding: 4 },

  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 16, marginBottom: 12,
  },
  infoItem:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoTxt:   { color: colors.textDim, fontSize: 12 },
  expandBtn: {
    backgroundColor: 'rgba(251,191,36,0.1)', borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)',
    paddingHorizontal: 8, paddingVertical: 2,
  },
  expandTxt: { color: 'rgba(251,191,36,1)', fontSize: 10, fontWeight: '700' },
  coinIcon:  { color: 'rgba(251,191,36,1)', fontSize: 12, fontWeight: '800' },
  coinsVal:  { color: 'rgba(251,191,36,1)', fontSize: 13, fontWeight: '800' },

  grid: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 4 },

  card: {
    width: CARD_W,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden', marginBottom: GAP,
  },
  cardPreview: {
    width: '100%', aspectRatio: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  cardAvatar:          { position: 'absolute' },
  cardFrame:           { width: '85%', height: '85%' },
  cardFramePlaceholder:{ alignItems: 'center', justifyContent: 'center', flex: 1 },
  unitsBadge: {
    position: 'absolute', top: 6, right: 6,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,229,204,0.18)',
    borderRadius: 12, paddingHorizontal: 5, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(0,229,204,0.35)',
  },
  unitsTxt:  { color: colors.c1, fontSize: 9, fontWeight: '800' },
  cardName:  { color: colors.textHi, fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingTop: 8, paddingBottom: 8 },

  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40, marginTop: 60 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(0,229,204,0.08)', borderWidth: 1, borderColor: 'rgba(0,229,204,0.2)', alignItems: 'center', justifyContent: 'center' },
  emptyTitle:{ color: colors.textHi, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptySub:  { color: colors.textDim, fontSize: 13, textAlign: 'center', lineHeight: 18 },

});

