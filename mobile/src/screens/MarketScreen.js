import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, ActivityIndicator,
  StatusBar, Dimensions, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import CoinIcon from '../components/CoinIcon';
import { formatCoins } from '../utils/formatCoins';
import CustomTabBar from '../components/CustomTabBar';

const { width: W } = Dimensions.get('window');
const COLS   = 3;
const GAP    = 10;
const CARD_W = (W - 32 - GAP * (COLS - 1)) / COLS;

const SORTS = [
  { key: 'reciente',     label: 'Reciente' },
  { key: 'precio_asc',   label: 'Precio asc' },
  { key: 'precio_desc',  label: 'Precio desc' },
  { key: 'populares',    label: 'Más vendidos' },
];

function FrameCardBg({ frame }) {
  if (frame.bgImageUrl)
    return <ExpoImage source={{ uri: frame.bgImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />;
  const grad = typeof frame.bgGradient === 'string' ? JSON.parse(frame.bgGradient || '[]') : (frame.bgGradient || []);
  if (frame.bgType === 'gradient' && grad.length >= 2)
    return <LinearGradient colors={grad} style={StyleSheet.absoluteFill} />;
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: frame.bgColor || '#0d1f2d' }]} />;
}

function FrameCard({ frame, onPress }) {
  const avatarSize = CARD_W * 0.42;
  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.8}>
      <View style={s.cardPreview}>
        <FrameCardBg frame={frame} />
        {frame.logoUrl ? (
          <ExpoImage
            source={{ uri: frame.logoUrl }}
            style={[s.cardAvatar, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}
            contentFit="cover"
          />
        ) : null}
        {frame.imageUrl
          ? <ExpoImage source={{ uri: frame.imageUrl }} style={s.cardImg} contentFit="contain" autoplay />
          : <Ionicons name="sparkles-outline" size={26} color={colors.c1} />}
        <View style={[s.priceBadge, { flexDirection: 'row', alignItems: 'center', gap: 2 }]}>
          <CoinIcon size={9} />
          <Text style={s.priceTxt}>{frame.price}</Text>
        </View>
      </View>
      <Text style={s.cardName} numberOfLines={1}>{frame.name}</Text>
      <Text style={s.cardCreator} numberOfLines={1}>@{frame.creator?.username}</Text>
    </TouchableOpacity>
  );
}

export default function MarketScreen({ navigation }) {
  const { user } = useAuthStore();
  const [frames, setFrames]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort]             = useState('reciente');
  const [query, setQuery]           = useState('');
  const searchTimer = useRef(null);

  useEffect(() => { load(1, sort, query, true); }, []);

  async function load(p, s, q, reset = false) {
    if (reset) setLoading(true); else setLoadingMore(true);
    try {
      const params = { page: p, limit: 18, sort: s };
      if (q) params.q = q;
      const { data } = await api.get('/market/frames', { params });
      const list = data.frames || [];
      setFrames(prev => reset ? list : [...prev, ...list]);
      setTotalPages(data.totalPages || 1);
      setPage(p);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }

  function onRefresh() {
    setRefreshing(true);
    load(1, sort, query, true);
  }

  function onChangeSort(s) {
    setSort(s);
    load(1, s, query, true);
  }

  function onChangeQuery(txt) {
    setQuery(txt);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(1, sort, txt, true), 400);
  }

  function onEndReached() {
    if (!loadingMore && page < totalPages) {
      load(page + 1, sort, query, false);
    }
  }

  function renderItem({ item }) {
    return (
      <FrameCard
        frame={item}
        onPress={() => navigation.navigate('MarketFrameDetail', { frame: item })}
      />
    );
  }

  function renderSeparator() { return <View style={{ width: GAP }} />; }

  function renderEmpty() {
    if (loading) return null;
    return (
      <View style={s.empty}>
        <View style={s.emptyIcon}>
          <Ionicons name="storefront-outline" size={38} color={colors.c1} />
        </View>
        <Text style={s.emptyTitle}>Sin marcos disponibles</Text>
        <Text style={s.emptySub}>
          {query ? 'Sin resultados para esa búsqueda' : 'Aún no hay marcos publicados en el mercado'}
        </Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.black} />
      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.textHi} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>TIENDA</Text>
          <View style={s.coinsBadge}>
            <CoinIcon size={14} />
            <Text style={s.coinsVal}>{formatCoins(user?.coins)}</Text>
          </View>
        </View>

        {/* Search */}
        <View style={s.searchRow}>
          <View style={s.searchBox}>
            <Ionicons name="search-outline" size={15} color={colors.textDim} />
            <TextInput
              style={s.searchInput}
              placeholder="Buscar marcos..."
              placeholderTextColor={colors.textDim}
              value={query}
              onChangeText={onChangeQuery}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => onChangeQuery('')}>
                <Ionicons name="close-circle" size={16} color={colors.textDim} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Sort chips */}
        <View style={s.sortRow}>
          {SORTS.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[s.sortChip, sort === opt.key && s.sortChipActive]}
              onPress={() => onChangeSort(opt.key)}
            >
              <Text style={[s.sortTxt, sort === opt.key && s.sortTxtActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>

      {loading ? (
        <ActivityIndicator color={colors.c1} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          style={{ backgroundColor: colors.black }}
          data={frames}
          keyExtractor={item => item._id}
          renderItem={renderItem}
          numColumns={COLS}
          contentContainerStyle={s.grid}
          columnWrapperStyle={{ gap: GAP }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmpty}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.c1} />}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.c1} style={{ marginVertical: 20 }} /> : null}
        />
      )}

      <CustomTabBar navigation={navigation} activeTab="market" />

    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    justifyContent: 'space-between',
  },
  backBtn:     { padding: 4 },
  headerTitle: { color: colors.textHi, fontSize: 13, fontWeight: '800', letterSpacing: 2.5 },
  coinsBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(251,191,36,0.1)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)' },
  coinsIcon:   { color: 'rgba(251,191,36,1)', fontSize: 12, fontWeight: '800' },
  coinsVal:    { color: 'rgba(251,191,36,1)', fontSize: 12, fontWeight: '800' },

  searchRow:  { paddingHorizontal: 16, marginBottom: 10 },
  searchBox:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 9 },
  searchInput:{ flex: 1, color: colors.textHi, fontSize: 14, padding: 0 },

  sortRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  sortChip:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  sortChipActive: { backgroundColor: 'rgba(0,229,204,0.1)', borderColor: 'rgba(0,229,204,0.35)' },
  sortTxt:        { color: colors.textDim, fontSize: 11, fontWeight: '600' },
  sortTxtActive:  { color: colors.c1 },

  grid: { paddingHorizontal: 16, paddingBottom: 110, paddingTop: 4 },

  card: {
    width: CARD_W, backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden', marginBottom: GAP,
  },
  cardPreview: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  cardImg:    { width: '85%', height: '85%' },
  cardAvatar: { position: 'absolute' },
  priceBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(251,191,36,0.18)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(251,191,36,0.35)' },
  priceTxt:   { color: 'rgba(251,191,36,1)', fontSize: 9, fontWeight: '800' },
  cardName:    { color: colors.textHi, fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingTop: 7, paddingBottom: 2 },
  cardCreator: { color: colors.textDim, fontSize: 9, paddingHorizontal: 8, paddingBottom: 8 },

  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40, marginTop: 60 },
  emptyIcon:  { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(0,229,204,0.08)', borderWidth: 1, borderColor: 'rgba(0,229,204,0.2)', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.textHi, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptySub:   { color: colors.textDim, fontSize: 13, textAlign: 'center', lineHeight: 18 },

});
