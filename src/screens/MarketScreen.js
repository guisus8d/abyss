import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, ActivityIndicator, Modal, Pressable,
  StatusBar, Dimensions, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

const { width: W } = Dimensions.get('window');
const COLS   = 3;
const GAP    = 10;
const CARD_W = (W - 32 - GAP * (COLS - 1)) / COLS;

const SORTS = [
  { key: 'reciente',     label: 'Reciente' },
  { key: 'precio_asc',   label: 'Precio ↑' },
  { key: 'precio_desc',  label: 'Precio ↓' },
  { key: 'populares',    label: '+Vendidos' },
];

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
        {frame.units <= 3 && frame.units > 0 && (
          <View style={s.urgentBadge}>
            <Text style={s.urgentTxt}>¡{frame.units} left!</Text>
          </View>
        )}
      </View>
      <Text style={s.cardName} numberOfLines={1}>{frame.name}</Text>
      <Text style={s.cardCreator} numberOfLines={1}>@{frame.creator?.username}</Text>
    </TouchableOpacity>
  );
}

export default function MarketScreen({ navigation }) {
  const { user, updateUser } = useAuthStore();
  const [frames, setFrames]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort]           = useState('reciente');
  const [query, setQuery]         = useState('');
  const [selected, setSelected]   = useState(null);
  const [buying, setBuying]       = useState(false);
  const [errMsg, setErrMsg]       = useState('');
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

  async function handleBuy() {
    if (buying || !selected) return;
    setBuying(true);
    setErrMsg('');
    try {
      const { data } = await api.post(`/market/frames/${selected._id}/buy`);
      updateUser({ ...user, coins: data.newCoins });
      setSelected(null);
      load(1, sort, query, true);
      alert(`Marco adquirido ✦ te quedan ${data.newCoins} monedas`);
    } catch (e) {
      setErrMsg(e.response?.data?.error || 'Error al comprar');
    } finally {
      setBuying(false);
    }
  }

  function renderItem({ item }) {
    return <FrameCard frame={item} onPress={() => { setErrMsg(''); setSelected(item); }} />;
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

  const canBuy = selected
    && selected.units > 0
    && String(selected.creator?._id) !== String(user?._id);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.black} />
      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.textHi} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>MERCADO</Text>
          <View style={s.coinsBadge}>
            <Text style={s.coinsIcon}>✦</Text>
            <Text style={s.coinsVal}>{user?.coins ?? 0}</Text>
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

      {/* Detail modal */}
      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <Pressable style={s.overlay} onPress={() => setSelected(null)}>
          <Pressable style={s.modalCard} onPress={() => {}}>
            {selected && (
              <>
                <View style={s.modalPreview}>
                  <FrameCardBg frame={selected} />
                  {selected.imageUrl && (
                    <ExpoImage
                      source={{ uri: selected.imageUrl }}
                      style={StyleSheet.absoluteFill}
                      contentFit="contain"
                      autoplay
                    />
                  )}
                </View>

                <Text style={s.modalName}>{selected.name}</Text>
                {selected.description ? (
                  <Text style={s.modalDesc}>{selected.description}</Text>
                ) : null}

                <View style={s.modalMeta}>
                  <View style={s.metaItem}>
                    <Ionicons name="person-outline" size={12} color={colors.textDim} />
                    <Text style={s.metaTxt}>@{selected.creator?.username}</Text>
                  </View>
                  <View style={s.metaItem}>
                    <Ionicons name="cube-outline" size={12} color={colors.textDim} />
                    <Text style={s.metaTxt}>{selected.units} disponibles</Text>
                  </View>
                  {selected.totalSold > 0 && (
                    <View style={s.metaItem}>
                      <Ionicons name="bag-outline" size={12} color={colors.textDim} />
                      <Text style={s.metaTxt}>{selected.totalSold} vendidos</Text>
                    </View>
                  )}
                </View>

                {errMsg ? (
                  <View style={s.errBox}>
                    <Ionicons name="alert-circle-outline" size={14} color={colors.c4} />
                    <Text style={s.errTxt}>{errMsg}</Text>
                  </View>
                ) : null}

                <View style={s.modalBtns}>
                  <TouchableOpacity style={s.btnClose} onPress={() => setSelected(null)}>
                    <Text style={s.btnCloseTxt}>Cerrar</Text>
                  </TouchableOpacity>
                  {canBuy ? (
                    <TouchableOpacity style={s.btnBuy} onPress={handleBuy} disabled={buying}>
                      {buying
                        ? <ActivityIndicator size={16} color="#000" />
                        : <Text style={s.btnBuyTxt}>✦{selected.price} · Comprar</Text>}
                    </TouchableOpacity>
                  ) : (
                    <View style={[s.btnBuy, { opacity: 0.4 }]}>
                      <Text style={s.btnBuyTxt}>
                        {String(selected.creator?._id) === String(user?._id)
                          ? 'Tuyo'
                          : 'Agotado'}
                      </Text>
                    </View>
                  )}
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

  grid: { paddingHorizontal: 16, paddingBottom: 32, paddingTop: 4 },

  card: {
    width: CARD_W, backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden', marginBottom: GAP,
  },
  cardPreview: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  cardImg:     { width: '85%', height: '85%' },
  priceBadge:  { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(251,191,36,0.18)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(251,191,36,0.35)' },
  priceTxt:    { color: 'rgba(251,191,36,1)', fontSize: 9, fontWeight: '800' },
  urgentBadge: { position: 'absolute', bottom: 5, left: 5, backgroundColor: 'rgba(249,115,22,0.18)', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(249,115,22,0.35)' },
  urgentTxt:   { color: colors.c4, fontSize: 8, fontWeight: '800' },
  cardName:    { color: colors.textHi, fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingTop: 7, paddingBottom: 2 },
  cardCreator: { color: colors.textDim, fontSize: 9, paddingHorizontal: 8, paddingBottom: 8 },

  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40, marginTop: 60 },
  emptyIcon:  { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(0,229,204,0.08)', borderWidth: 1, borderColor: 'rgba(0,229,204,0.2)', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.textHi, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptySub:   { color: colors.textDim, fontSize: 13, textAlign: 'center', lineHeight: 18 },

  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', backgroundColor: colors.surface, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: colors.border },

  modalPreview: { width: 130, height: 130, borderRadius: 20, overflow: 'hidden', alignSelf: 'center', marginBottom: 16, position: 'relative', borderWidth: 1, borderColor: colors.border },

  modalName: { color: colors.textHi, fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  modalDesc: { color: colors.textDim, fontSize: 13, textAlign: 'center', marginBottom: 14, lineHeight: 19 },

  modalMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 16 },
  metaItem:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  metaTxt:   { color: colors.textDim, fontSize: 11 },

  errBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(249,115,22,0.1)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(249,115,22,0.25)', paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14 },
  errTxt:  { color: colors.c4, fontSize: 12, flex: 1 },

  modalBtns:  { flexDirection: 'row', gap: 12 },
  btnClose:   { flex: 1, paddingVertical: 13, borderRadius: 16, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  btnCloseTxt:{ color: colors.textDim, fontSize: 14, fontWeight: '600' },
  btnBuy:     { flex: 1, paddingVertical: 13, borderRadius: 16, backgroundColor: 'rgba(251,191,36,0.9)', alignItems: 'center' },
  btnBuyTxt:  { color: '#000', fontSize: 14, fontWeight: '800' },
});
