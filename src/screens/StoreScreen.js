import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, StatusBar, Dimensions, RefreshControl, ScrollView,
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
const GAP    = 10;
const CARD_W = (W - 32 - GAP * (COLS - 1)) / COLS;

const NIVEL_LABELS = { 1: 'Novato', 2: 'Aprendiz', 3: 'Artesano', 4: 'Experto', 5: 'Maestro' };
const NIVEL_COLORS = { 1: colors.textDim, 2: colors.c5, 3: colors.c1, 4: colors.c2, 5: colors.c3 };

function FrameCardBg({ frame }) {
  const grad = typeof frame.bgGradient === 'string' ? JSON.parse(frame.bgGradient || '[]') : (frame.bgGradient || []);
  if (frame.bgType === 'gradient' && grad.length >= 2)
    return <LinearGradient colors={grad} style={StyleSheet.absoluteFill} />;
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: frame.bgColor || '#0d1f2d' }]} />;
}

function FrameCard({ frame, onPress }) {
  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.8}>
      <View style={s.cardPreview}>
        <FrameCardBg frame={frame} />
        {frame.imageUrl
          ? <ExpoImage source={{ uri: frame.imageUrl }} style={s.cardImg} contentFit="contain" autoplay />
          : <Ionicons name="sparkles-outline" size={26} color={colors.c1} />}
        <View style={s.priceBadge}>
          <Text style={s.priceTxt}>✦{frame.price}</Text>
        </View>
        <View style={s.unitsBadge}>
          <Text style={s.unitsTxt}>{frame.units} u.</Text>
        </View>
      </View>
      <Text style={s.cardName} numberOfLines={1}>{frame.name}</Text>
      {frame.totalSold > 0 && (
        <Text style={s.cardSold} numberOfLines={1}>{frame.totalSold} vendidos</Text>
      )}
    </TouchableOpacity>
  );
}

export default function StoreScreen({ navigation, route }) {
  const { user } = useAuthStore();
  const targetUsername = route.params?.username || user?.username;
  const isOwn = targetUsername === user?.username;

  const [store, setStore]     = useState(null);
  const [owner, setOwner]     = useState(null);
  const [frames, setFrames]   = useState([]);
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errMsg, setErrMsg]   = useState('');

  useEffect(() => { loadStore(); }, [targetUsername]);

  async function loadStore() {
    setErrMsg('');
    try {
      if (isOwn) {
        const [statsRes, pubRes] = await Promise.all([
          api.get('/store/me/stats').catch(e => ({ data: null, err: e })),
          api.get(`/store/${targetUsername}`).catch(e => ({ data: null, err: e })),
        ]);
        if (statsRes.data) {
          setStore(statsRes.data.store);
          setStats(statsRes.data);
        }
        if (pubRes.data) {
          setOwner(pubRes.data.user);
          setFrames(pubRes.data.frames || []);
          if (!statsRes.data) setStore(pubRes.data.store);
        }
        if (!statsRes.data?.store && !pubRes.data?.store) {
          setStore(null);
        }
      } else {
        const { data } = await api.get(`/store/${targetUsername}`);
        setStore(data.store);
        setOwner(data.user);
        setFrames(data.frames || []);
      }
    } catch (e) {
      const status = e.response?.status;
      if (status === 404) {
        setStore(null);
      } else {
        setErrMsg(e.response?.data?.error || 'Error al cargar tienda');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function onRefresh() { setRefreshing(true); loadStore(); }

  if (loading) {
    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor={colors.black} />
        <SafeAreaView>
          <View style={s.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
              <Ionicons name="arrow-back" size={20} color={colors.textHi} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>TIENDA</Text>
            <View style={{ width: 28 }} />
          </View>
        </SafeAreaView>
        <ActivityIndicator color={colors.c1} style={{ marginTop: 50 }} />
      </View>
    );
  }

  // No store state
  if (!store) {
    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor={colors.black} />
        <SafeAreaView>
          <View style={s.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
              <Ionicons name="arrow-back" size={20} color={colors.textHi} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>TIENDA</Text>
            <View style={{ width: 28 }} />
          </View>
        </SafeAreaView>
        <View style={s.noStore}>
          <View style={s.noStoreIcon}>
            <Ionicons name="storefront-outline" size={42} color={colors.c1} />
          </View>
          <Text style={s.noStoreTitle}>
            {isOwn ? 'Aún no tienes tienda' : `@${targetUsername} no tiene tienda`}
          </Text>
          <Text style={s.noStoreSub}>
            {isOwn ? 'Crea tu tienda para vender marcos a la comunidad' : 'Este usuario no ha abierto su tienda todavía'}
          </Text>
          {isOwn && (
            <TouchableOpacity
              style={s.createBtn}
              onPress={() => navigation.navigate('CreateStore', { onCreated: () => loadStore() })}
            >
              <Ionicons name="add-outline" size={18} color={colors.black} />
              <Text style={s.createBtnTxt}>Crear mi tienda</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  const nivel     = store.nivel || 1;
  const nivelColor = NIVEL_COLORS[nivel] || colors.textDim;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.black} />
      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.textHi} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>TIENDA</Text>
          {isOwn ? (
            <TouchableOpacity
              style={s.editBtn}
              onPress={() => navigation.navigate('CreateStore', { store, onCreated: () => loadStore() })}
            >
              <Ionicons name="pencil-outline" size={18} color={colors.c1} />
            </TouchableOpacity>
          ) : <View style={{ width: 28 }} />}
        </View>
      </SafeAreaView>

      <FlatList
        style={{ backgroundColor: colors.black }}
        data={frames}
        keyExtractor={item => item._id}
        numColumns={COLS}
        contentContainerStyle={s.grid}
        columnWrapperStyle={{ gap: GAP }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.c1} />}
        ListHeaderComponent={() => (
          <>
            {/* Banner */}
            <View style={s.banner}>
              {store.banner ? (
                <ExpoImage source={{ uri: store.banner }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <LinearGradient colors={['#091525', '#020509']} style={StyleSheet.absoluteFill} />
              )}
              <View style={s.bannerOverlay} />
            </View>

            {/* Store identity */}
            <View style={s.identity}>
              <View style={s.logoWrap}>
                {store.logo
                  ? <ExpoImage source={{ uri: store.logo }} style={s.logo} contentFit="cover" />
                  : <View style={s.logoPlaceholder}><Ionicons name="storefront" size={28} color={colors.c1} /></View>}
              </View>
              <View style={s.identityInfo}>
                <Text style={s.storeName}>{store.nombre}</Text>
                <View style={[s.nivelBadge, { borderColor: nivelColor + '40' }]}>
                  <Text style={[s.nivelTxt, { color: nivelColor }]}>Nv. {nivel} · {NIVEL_LABELS[nivel]}</Text>
                </View>
              </View>
            </View>

            {store.descripcion ? (
              <Text style={s.desc}>{store.descripcion}</Text>
            ) : null}

            {/* Stats (own store only) */}
            {isOwn && stats && (
              <View style={s.statsRow}>
                <View style={s.statItem}>
                  <Text style={s.statVal}>{store.ventasTotales || 0}</Text>
                  <Text style={s.statLbl}>Ventas</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.statItem}>
                  <Text style={[s.statVal, { color: 'rgba(251,191,36,1)' }]}>✦{store.ingresosTotal || 0}</Text>
                  <Text style={s.statLbl}>Ingresos</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.statItem}>
                  <Text style={s.statVal}>{store.marcosActivos || 0}</Text>
                  <Text style={s.statLbl}>Activos</Text>
                </View>
              </View>
            )}

            {/* Divider */}
            <View style={s.sectionLabel}>
              <Ionicons name="sparkles-outline" size={13} color={colors.textDim} />
              <Text style={s.sectionLabelTxt}>MARCOS EN VENTA ({frames.length})</Text>
            </View>
          </>
        )}
        ListEmptyComponent={() => (
          <View style={s.empty}>
            <Ionicons name="cube-outline" size={32} color={colors.textDim} />
            <Text style={s.emptyTxt}>
              {isOwn ? 'Publica marcos desde tu inventario' : 'Sin marcos disponibles'}
            </Text>
            {isOwn && (
              <TouchableOpacity onPress={() => navigation.navigate('Collection')}>
                <Text style={s.emptyLink}>Ir a mi colección →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        renderItem={({ item }) => (
          <FrameCard
            frame={item}
            onPress={() => navigation.navigate('Market')}
          />
        )}
      />
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
  editBtn:     { padding: 4 },

  banner:        { height: 140, position: 'relative', backgroundColor: colors.deep },
  bannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2,5,9,0.45)' },

  identity: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, marginTop: -28, marginBottom: 12 },
  logoWrap: { marginRight: 12 },
  logo:     { width: 64, height: 64, borderRadius: 18, borderWidth: 2, borderColor: colors.border },
  logoPlaceholder: { width: 64, height: 64, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  identityInfo: { flex: 1, paddingBottom: 4 },
  storeName:    { color: colors.textHi, fontSize: 18, fontWeight: '800', marginBottom: 4 },
  nivelBadge:   { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  nivelTxt:     { fontSize: 11, fontWeight: '700' },

  desc: { color: colors.textMid, fontSize: 13, lineHeight: 18, paddingHorizontal: 16, marginBottom: 16 },

  statsRow: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 16,
    backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16,
  },
  statItem:    { flex: 1, alignItems: 'center' },
  statVal:     { color: colors.textHi, fontSize: 18, fontWeight: '800', marginBottom: 2 },
  statLbl:     { color: colors.textDim, fontSize: 11 },
  statDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: 8 },

  sectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, marginBottom: 10 },
  sectionLabelTxt: { color: colors.textDim, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },

  grid: { paddingHorizontal: 16, paddingBottom: 40 },
  card: {
    width: CARD_W, backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden', marginBottom: GAP,
  },
  cardPreview: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  cardImg:     { width: '85%', height: '85%' },
  priceBadge:  { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(251,191,36,0.15)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)' },
  priceTxt:    { color: 'rgba(251,191,36,1)', fontSize: 9, fontWeight: '800' },
  unitsBadge:  { position: 'absolute', bottom: 5, left: 5, backgroundColor: 'rgba(0,229,204,0.1)', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(0,229,204,0.25)' },
  unitsTxt:    { color: colors.c1, fontSize: 8, fontWeight: '700' },
  cardName:    { color: colors.textHi, fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingTop: 7, paddingBottom: 2 },
  cardSold:    { color: colors.textDim, fontSize: 9, paddingHorizontal: 8, paddingBottom: 8 },

  noStore:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 40 },
  noStoreIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(0,229,204,0.08)', borderWidth: 1, borderColor: 'rgba(0,229,204,0.2)', alignItems: 'center', justifyContent: 'center' },
  noStoreTitle:{ color: colors.textHi, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  noStoreSub:  { color: colors.textDim, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  createBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.c1, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 12, marginTop: 4 },
  createBtnTxt:{ color: colors.black, fontSize: 14, fontWeight: '800' },

  empty:    { alignItems: 'center', paddingTop: 40, gap: 8 },
  emptyTxt: { color: colors.textDim, fontSize: 13, textAlign: 'center' },
  emptyLink:{ color: colors.c1, fontSize: 13, fontWeight: '600' },
});
