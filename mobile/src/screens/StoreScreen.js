import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, StatusBar, Dimensions, RefreshControl,
  Modal, Pressable, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import CoinIcon from '../components/CoinIcon';
import { presetFromId } from '../utils/framePreset';

const { width: W } = Dimensions.get('window');
const COLS   = 3;
const GAP    = 10;
const CARD_W = (W - 32 - GAP * (COLS - 1)) / COLS;
const XP_MINIMO = 100;

const NIVEL_LABELS = { 1: 'Novato', 2: 'Aprendiz', 3: 'Artesano', 4: 'Experto', 5: 'Maestro' };
const NIVEL_COLORS = { 1: colors.textDim, 2: colors.c5, 3: colors.c1, 4: colors.c2, 5: colors.c3 };

function FrameCardBg({ frame }) {
  if (frame.bgImageUrl)
    return <ExpoImage source={{ uri: frame.bgImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />;
  const grad = typeof frame.bgGradient === 'string' ? JSON.parse(frame.bgGradient || '[]') : (frame.bgGradient || []);
  if (frame.bgType === 'gradient' && grad.length >= 2)
    return <LinearGradient colors={grad} style={StyleSheet.absoluteFill} />;
  return <ExpoImage source={require('../../assets/chat-bg.jpeg')} style={StyleSheet.absoluteFill} contentFit="cover" />;
}

function FrameCard({ frame, onPress }) {
  const avatarSize = CARD_W * 0.62;
  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.8}>
      <View style={s.cardPreview}>
        <FrameCardBg frame={frame} />
        <ExpoImage
          source={frame.logoUrl ? { uri: frame.logoUrl } : presetFromId(String(frame._id))}
          style={[s.cardAvatar, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}
          contentFit="cover"
        />
        {frame.imageUrl
          ? <ExpoImage source={{ uri: frame.imageUrl }} style={s.cardImg} contentFit="contain" autoplay />
          : <Ionicons name="sparkles-outline" size={26} color={colors.c1} />}
      </View>
      <Text style={s.cardName} numberOfLines={1}>{frame.name}</Text>
      <View style={s.cardPriceRow}>
        <CoinIcon size={9} />
        <Text style={s.cardPriceTxt}>{frame.price}</Text>
      </View>
      <Text style={s.cardUnits}>{frame.units} u. disponibles</Text>
    </TouchableOpacity>
  );
}

// Tarjeta de inventario para el selector de publicación
function InvCard({ item, onPress }) {
  const frame   = item.frame || item;
  const inHand  = item.unidadesEnMano ?? item.units ?? 0;
  const canSell = inHand > 0;
  return (
    <TouchableOpacity
      style={[s.invCard, !canSell && { opacity: 0.4 }]}
      onPress={() => canSell && onPress(item)}
      activeOpacity={0.8}
      disabled={!canSell}
    >
      <View style={s.invPreview}>
        <FrameCardBg frame={frame} />
        {frame.imageUrl && (
          <ExpoImage source={{ uri: frame.imageUrl }} style={{ width: '80%', height: '80%' }} contentFit="contain" autoplay />
        )}
      </View>
      <Text style={s.invName} numberOfLines={1}>{frame.name}</Text>
      <Text style={[s.invUnits, { color: canSell ? colors.c1 : colors.textDim }]}>
        {canSell ? `×${inHand} disponibles` : 'Sin unidades'}
      </Text>
    </TouchableOpacity>
  );
}

export default function StoreScreen({ navigation, route }) {
  const { user } = useAuthStore();
  const targetUsername = route.params?.username || user?.username;
  const isOwn = targetUsername === user?.username;

  const [store, setStore]     = useState(null);
  const [frames, setFrames]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Publish flow
  const [invSheet, setInvSheet]       = useState(false);
  const [inventory, setInventory]     = useState([]);
  const [invLoading, setInvLoading]   = useState(false);
  const [publishTarget, setPublishTarget] = useState(null); // frame item
  const [pubPrice, setPubPrice]       = useState('');
  const [pubUnits, setPubUnits]       = useState('1');
  const [publishing, setPublishing]   = useState(false);
  const [pubErr, setPubErr]           = useState('');

  useEffect(() => { loadStore(); }, [targetUsername]);

  async function loadStore() {
    try {
      if (isOwn) {
        const [statsRes, pubRes] = await Promise.all([
          api.get('/store/me/stats').catch(() => ({ data: null })),
          api.get(`/store/${targetUsername}`).catch(() => ({ data: null })),
        ]);
        if (statsRes.data) { setStore(statsRes.data.store); }
        if (pubRes.data)   { setFrames(pubRes.data.frames || []); if (!statsRes.data) setStore(pubRes.data.store); }
        if (!statsRes.data?.store && !pubRes.data?.store) setStore(null);
      } else {
        const { data } = await api.get(`/store/${targetUsername}`);
        setStore(data.store);
        setFrames(data.frames || []);
      }
    } catch (e) {
      if (e.response?.status === 404) setStore(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function openPublishSheet() {
    setInvSheet(true);
    if (inventory.length > 0) return;
    setInvLoading(true);
    try {
      const { data } = await api.get('/frames/me/inventory');
      setInventory(data.inventory || []);
    } catch (e) { console.log(e); }
    finally { setInvLoading(false); }
  }

  function selectForPublish(item) {
    const frame = item.frame || item;
    setPublishTarget(item);
    setPubPrice(String(frame.price || 50));
    setPubUnits('1');
    setPubErr('');
  }

  async function confirmPublish() {
    if (!publishTarget) return;
    const frame   = publishTarget.frame || publishTarget;
    const units   = parseInt(pubUnits) || 0;
    const price   = parseInt(pubPrice) || 0;
    const maxU    = publishTarget.unidadesEnMano ?? publishTarget.units ?? 0;

    if (price <= 0) { setPubErr('El precio debe ser mayor a 0'); return; }
    if (units <= 0) { setPubErr('Las unidades deben ser mayor a 0'); return; }
    if (units > maxU) { setPubErr(`Solo tienes ${maxU} unidades disponibles`); return; }
    if ((user?.xp || 0) < XP_MINIMO) { setPubErr(`Necesitas ${XP_MINIMO} XP para publicar marcos`); return; }

    setPublishing(true);
    setPubErr('');
    try {
      await api.patch(`/frames/${frame._id}/publish`, { units, price });
      setPublishTarget(null);
      setInvSheet(false);
      setInventory([]);
      loadStore();
    } catch (e) {
      setPubErr(e.response?.data?.error || 'Error al publicar');
    } finally { setPublishing(false); }
  }

  function onRefresh() { setRefreshing(true); loadStore(); }

  const nivel      = store?.nivel || 1;
  const nivelColor = NIVEL_COLORS[nivel] || colors.textDim;

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

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.black} />
      <SafeAreaView>
        {/* Nav header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.textHi} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>TIENDA</Text>
          <View style={s.headerRight}>
            {isOwn ? (
              <TouchableOpacity
                style={s.editBtn}
                onPress={() => navigation.navigate('CreateStore', { store, onCreated: () => loadStore() })}
              >
                <Ionicons name="pencil-outline" size={18} color={colors.c1} />
              </TouchableOpacity>
            ) : <View style={{ width: 28 }} />}
            <View style={[s.nivelBadge, { borderColor: nivelColor + '40' }]}>
              <Text style={[s.nivelTxt, { color: nivelColor }]}>Nv. {nivel} · {NIVEL_LABELS[nivel]}</Text>
            </View>
          </View>
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
              {store.banner
                ? <ExpoImage source={{ uri: store.banner }} style={StyleSheet.absoluteFill} contentFit="cover" />
                : <LinearGradient colors={['#091525', '#020509']} style={StyleSheet.absoluteFill} />}
              <View style={s.bannerOverlay} />
            </View>

            {/* Identidad */}
            <View style={s.identity}>
              <View style={s.logoWrap}>
                {store.logo
                  ? <ExpoImage source={{ uri: store.logo }} style={s.logo} contentFit="cover" />
                  : <View style={s.logoPlaceholder}><Ionicons name="storefront" size={36} color={colors.c1} /></View>}
              </View>
              <Text style={s.storeName}>{store.nombre}</Text>
            </View>

            {store.descripcion ? (
              <Text style={s.desc}>{store.descripcion}</Text>
            ) : null}

            <View style={s.sectionLabel}>
              <Ionicons name="sparkles-outline" size={13} color={colors.textDim} />
              <Text style={s.sectionLabelTxt}>MARCOS EN VENTA ({frames.length})</Text>
              {isOwn && (
                <TouchableOpacity style={s.publishBtn} onPress={openPublishSheet}>
                  <Ionicons name="add-outline" size={14} color={colors.black} />
                  <Text style={s.publishBtnTxt}>Publicar</Text>
                </TouchableOpacity>
              )}
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
              <TouchableOpacity style={s.publishBtnLarge} onPress={openPublishSheet}>
                <Ionicons name="add-outline" size={16} color={colors.black} />
                <Text style={s.publishBtnTxt}>Publicar un marco</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        renderItem={({ item }) => (
          <FrameCard frame={item} onPress={() => navigation.navigate('Market')} />
        )}
      />

      {/* ── Inventory Sheet ── */}
      <Modal
        visible={invSheet}
        transparent
        animationType="slide"
        onRequestClose={() => { setInvSheet(false); setPublishTarget(null); }}
      >
        <Pressable style={s.sheetOverlay} onPress={() => { setInvSheet(false); setPublishTarget(null); }}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <View style={s.sheetHandle} />

            {publishTarget ? (
              // ── Confirm modal ──
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <TouchableOpacity onPress={() => setPublishTarget(null)} style={s.sheetBack}>
                  <Ionicons name="arrow-back" size={18} color={colors.textDim} />
                  <Text style={s.sheetBackTxt}>Volver al inventario</Text>
                </TouchableOpacity>

                <Text style={s.sheetTitle}>Publicar marco</Text>
                <Text style={s.sheetSub}>{(publishTarget.frame || publishTarget).name}</Text>

                <View style={s.pubFields}>
                  <View style={s.pubField}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={s.pubFieldLbl}>Precio (coins)</Text>
                      <CoinIcon size={11} />
                    </View>
                    <TextInput
                      style={s.pubInput}
                      value={pubPrice}
                      onChangeText={setPubPrice}
                      keyboardType="numeric"
                      placeholder="50"
                      placeholderTextColor={colors.textDim}
                    />
                  </View>
                  <View style={s.pubField}>
                    <Text style={s.pubFieldLbl}>
                      Unidades (máx. {publishTarget.unidadesEnMano ?? publishTarget.units ?? 0})
                    </Text>
                    <TextInput
                      style={s.pubInput}
                      value={pubUnits}
                      onChangeText={setPubUnits}
                      keyboardType="numeric"
                      placeholder="1"
                      placeholderTextColor={colors.textDim}
                    />
                  </View>
                </View>

                {pubErr ? (
                  <View style={s.errBox}>
                    <Ionicons name="alert-circle-outline" size={13} color={colors.c4} />
                    <Text style={s.errTxt}>{pubErr}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[s.confirmBtn, publishing && { opacity: 0.6 }]}
                  onPress={confirmPublish}
                  disabled={publishing}
                >
                  {publishing
                    ? <ActivityIndicator size={16} color={colors.black} />
                    : <Text style={s.confirmBtnTxt}>Publicar en la tienda</Text>}
                </TouchableOpacity>
              </KeyboardAvoidingView>
            ) : (
              // ── Inventory list ──
              <>
                <Text style={s.sheetTitle}>Selecciona un marco</Text>
                <Text style={s.sheetSub}>Elige qué marco quieres poner a la venta</Text>
                {invLoading ? (
                  <ActivityIndicator color={colors.c1} style={{ marginTop: 30 }} />
                ) : inventory.length === 0 ? (
                  <View style={s.noInv}>
                    <Ionicons name="sparkles-outline" size={32} color={colors.textDim} />
                    <Text style={s.noInvTxt}>No tienes marcos en tu inventario</Text>
                    <TouchableOpacity onPress={() => { setInvSheet(false); navigation.navigate('CreateFrame'); }}>
                      <Text style={s.noInvLink}>Crear un marco →</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <FlatList
                    data={inventory}
                    keyExtractor={item => (item.frame?._id || item._id)}
                    numColumns={3}
                    columnWrapperStyle={{ gap: 10 }}
                    contentContainerStyle={{ gap: 10, paddingBottom: 20 }}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                      <InvCard item={item} onPress={selectForPublish} />
                    )}
                  />
                )}
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
  editBtn:     { padding: 4 },
  headerRight: { alignItems: 'flex-end', gap: 4 },

  banner:        { height: 130, position: 'relative', backgroundColor: colors.deep },
  bannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2,5,9,0.4)' },

  identity: { alignItems: 'center', marginTop: -44, marginBottom: 16, paddingHorizontal: 16 },
  logoWrap: { marginBottom: 10 },
  logo:     { width: 88, height: 88, borderRadius: 22, borderWidth: 2, borderColor: '#fff' },
  logoPlaceholder: { width: 88, height: 88, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  storeName: { color: colors.textHi, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  nivelBadge: { alignSelf: 'flex-end', borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  nivelTxt:   { fontSize: 11, fontWeight: '700' },

  desc: { color: colors.textMid, fontSize: 13, lineHeight: 18, paddingHorizontal: 16, marginBottom: 14 },

  sectionLabel:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, marginBottom: 10 },
  sectionLabelTxt: { flex: 1, color: colors.textDim, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  publishBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.c1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  publishBtnLarge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.c1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, marginTop: 8 },
  publishBtnTxt:   { color: colors.black, fontSize: 11, fontWeight: '800' },

  grid: { paddingHorizontal: 16, paddingBottom: 40 },
  card: {
    width: CARD_W, backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden', marginBottom: GAP,
  },
  cardPreview: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  cardImg:      { width: '85%', height: '85%' },
  cardAvatar:   { position: 'absolute' },
  cardUnits:    { color: colors.c1, fontSize: 8, fontWeight: '700', paddingHorizontal: 8, paddingBottom: 7 },
  cardName:     { color: colors.textHi, fontSize: 13, fontWeight: '700', paddingHorizontal: 8, paddingTop: 7, paddingBottom: 2 },
  cardPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingBottom: 8 },
  cardPriceTxt: { color: 'rgba(251,191,36,1)', fontSize: 10, fontWeight: '800' },

  noStore:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 40 },
  noStoreIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(0,229,204,0.08)', borderWidth: 1, borderColor: 'rgba(0,229,204,0.2)', alignItems: 'center', justifyContent: 'center' },
  noStoreTitle:{ color: colors.textHi, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  noStoreSub:  { color: colors.textDim, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  createBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.c1, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 12, marginTop: 4 },
  createBtnTxt:{ color: colors.black, fontSize: 14, fontWeight: '800' },

  empty:    { alignItems: 'center', paddingTop: 40, gap: 8 },
  emptyTxt: { color: colors.textDim, fontSize: 13, textAlign: 'center' },

  // Inventory sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderColor: colors.border, borderBottomWidth: 0,
    padding: 24, paddingBottom: 36, maxHeight: '80%',
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20 },
  sheetTitle:  { color: colors.textHi, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  sheetSub:    { color: colors.textDim, fontSize: 12, marginBottom: 18 },
  sheetBack:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  sheetBackTxt:{ color: colors.textDim, fontSize: 13 },

  // Inv cards
  invCard:    { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  invPreview: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  invName:    { color: colors.textHi, fontSize: 10, fontWeight: '600', paddingHorizontal: 6, paddingTop: 5, paddingBottom: 2 },
  invUnits:   { color: colors.c1, fontSize: 9, paddingHorizontal: 6, paddingBottom: 8 },

  noInv:    { alignItems: 'center', gap: 10, paddingVertical: 30 },
  noInvTxt: { color: colors.textDim, fontSize: 13 },
  noInvLink:{ color: colors.c1, fontSize: 13, fontWeight: '600' },

  // Publish form
  pubFields:    { gap: 14, marginBottom: 16 },
  pubField:     {},
  pubFieldLbl:  { color: colors.textMid, fontSize: 11, fontWeight: '700', marginBottom: 8 },
  pubInput:     { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, color: colors.textHi, fontSize: 18, fontWeight: '700', paddingHorizontal: 14, paddingVertical: 12 },

  errBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(249,115,22,0.1)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(249,115,22,0.25)', padding: 12, marginBottom: 14 },
  errTxt:  { color: colors.c4, fontSize: 12, flex: 1 },

  confirmBtn:    { backgroundColor: colors.c1, borderRadius: 18, paddingVertical: 15, alignItems: 'center' },
  confirmBtnTxt: { color: colors.black, fontSize: 15, fontWeight: '800' },
});
