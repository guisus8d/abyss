import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Image, StatusBar, SafeAreaView, ActivityIndicator,
  Animated, Dimensions, Modal, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import AvatarWithFrame from '../components/AvatarWithFrame';

const { width: W } = Dimensions.get('window');
const COLS     = 3;
const GAP      = 10;
const CARD_W   = (W - 32 - GAP * (COLS - 1)) / COLS;

const TABS = [
  { key: 'frames', label: 'Marcos', icon: 'sparkles-outline' },
  { key: 'catalog', label: 'Catálogo', icon: 'storefront-outline' },
];
const TAB_W = (W - 32) / TABS.length;

function FrameCard({ frame, units, index, onPress }) {
  return (
    <View>
      <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.8}>
        <View style={s.cardPreview}>
          {frame.imageUrl
            ? <Image source={{ uri: frame.imageUrl }} style={s.cardFrame} resizeMode="contain" />
            : <View style={s.cardFramePlaceholder}><Ionicons name="sparkles-outline" size={28} color={colors.c1} /></View>}
          {units !== null && <View style={s.unitsBadge}><Text style={s.unitsTxt}>×{units}</Text></View>}
          {units === null && frame.price && <View style={s.priceBadge}><Text style={s.priceTxt}>✦{frame.price}</Text></View>}
        </View>
        <Text style={s.cardName} numberOfLines={1}>{frame.name}</Text>
        {frame.creator?.username && <Text style={s.cardCreator} numberOfLines={1}>@{frame.creator.username}</Text>}
      </TouchableOpacity>
    </View>
  );
}

export default function CollectionScreen({ navigation }) {
  const { user, updateUser } = useAuthStore();
  const [tab, setTab]           = useState('frames');
  const [owned, setOwned]       = useState([]);
  const [catalog, setCatalog]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);
  const [buying, setBuying]     = useState(false);
  const tabAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [ownedRes, catRes] = await Promise.all([
        api.get('/frames/my'),
        api.get('/frames'),
      ]);
      setOwned(ownedRes.data.frames || []);
      setCatalog(catRes.data.frames || []);
    } catch (e) { console.log(e); }
    finally { setLoading(false); }
  }

  function switchTab(key) {
    const idx = TABS.findIndex(t => t.key === key);
    Animated.spring(tabAnim, { toValue: idx * TAB_W, useNativeDriver: true, tension: 80, friction: 10 }).start();
    setTab(key);
  }

  async function handleBuy(frame) {
    if (buying) return;
    setBuying(true);
    try {
      const { data } = await api.post(`/frames/${frame._id}/buy`);
      updateUser({ ...user, coins: data.newCoins });
      await loadAll();
      setSelected(null);
      alert(`✦ Marco adquirido — te quedan ${data.newCoins} monedas`);
    } catch (e) {
      alert(e.response?.data?.error || 'Error al comprar');
    } finally { setBuying(false); }
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

  function renderFrameCard({ item, index }) {
    const frame = item.frame || item;
    const units = item.units !== undefined ? item.units : null;
    return (
      <FrameCard frame={frame} units={units} index={index} onPress={() => setSelected({ frame, units })} />
    );
  }


          {/* Preview del marco */}
          <View style={s.cardPreview}>
            {frame.imageUrl ? (
              <Image source={{ uri: frame.imageUrl }} style={s.cardFrame} resizeMode="contain" />
            ) : (
              <View style={s.cardFramePlaceholder}>
                <Ionicons name="sparkles-outline" size={28} color={colors.c1} />
              </View>
            )}
            {/* Badge unidades */}
            {units !== null && (
              <View style={s.unitsBadge}>
                <Text style={s.unitsTxt}>×{units}</Text>
              </View>
            )}
            {/* Badge precio en catálogo */}
            {units === null && frame.price && (
              <View style={s.priceBadge}>
                <Text style={s.priceTxt}>✦{frame.price}</Text>
              </View>
            )}
          </View>

          {/* Nombre */}
          <Text style={s.cardName} numberOfLines={1}>{frame.name}</Text>
          {frame.creator?.username && (
            <Text style={s.cardCreator} numberOfLines={1}>@{frame.creator.username}</Text>
          )}
        </TouchableOpacity>
      </Animated.View>
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
          <Text style={s.coinIcon}>✦</Text>
          <Text style={s.coinsVal}>{user?.coins ?? 50}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={s.tabBar}>
        <Animated.View style={[s.tabIndicator, { width: TAB_W, transform: [{ translateX: tabAnim }] }]} />
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <TouchableOpacity key={t.key} style={[s.tabBtn, { width: TAB_W }]} onPress={() => switchTab(t.key)}>
              <Ionicons name={t.icon} size={15} color={active ? colors.c1 : colors.textDim} />
              <Text style={[s.tabLabel, active && s.tabLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Contenido */}
      {loading ? (
        <ActivityIndicator color={colors.c1} style={{ marginTop: 40 }} />
      ) : tab === 'frames' ? (
        owned.length === 0
          ? renderEmpty('sparkles-outline', 'Colección vacía', 'Desbloquea marcos con XP o cómpralos en el catálogo')
          : (
            <FlatList
              data={owned}
              keyExtractor={(item, i) => item._id || String(i)}
              renderItem={renderFrameCard}
              numColumns={COLS}
              contentContainerStyle={s.grid}
              columnWrapperStyle={{ gap: GAP }}
              showsVerticalScrollIndicator={false}
            />
          )
      ) : (
        catalog.length === 0
          ? renderEmpty('storefront-outline', 'Sin marcos en el catálogo', 'Sé el primero en publicar un marco')
          : (
            <FlatList
              data={catalog}
              keyExtractor={(item) => item._id}
              renderItem={({ item, index }) => renderFrameCard({ item: { frame: item }, index })}
              numColumns={COLS}
              contentContainerStyle={s.grid}
              columnWrapperStyle={{ gap: GAP }}
              showsVerticalScrollIndicator={false}
            />
          )
      )}

      {/* Modal detalle */}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={s.modalOverlay} onPress={() => setSelected(null)}>
          <Pressable style={s.modalCard} onPress={() => {}}>
            {selected && (() => {
              const frame = selected.frame;
              const units = selected.units;
              return (
                <>
                  {/* Preview grande */}
                  <View style={s.modalPreview}>
                    <AvatarWithFrame
                      size={80}
                      avatarUrl={user?.avatarUrl}
                      username={user?.username}
                      profileFrame={frame._id === 'frame_001' ? 'frame_001' : null}
                    />
                    {frame.imageUrl && (
                      <Image source={{ uri: frame.imageUrl }} style={s.modalFrameImg} resizeMode="contain" />
                    )}
                  </View>

                  <Text style={s.modalName}>{frame.name}</Text>
                  {frame.description ? <Text style={s.modalDesc}>{frame.description}</Text> : null}

                  {/* Info */}
                  <View style={s.modalInfo}>
                    {frame.creator?.username && (
                      <View style={s.modalInfoItem}>
                        <Ionicons name="person-outline" size={13} color={colors.textDim} />
                        <Text style={s.modalInfoTxt}>@{frame.creator.username}</Text>
                      </View>
                    )}
                    {frame.totalSold > 0 && (
                      <View style={s.modalInfoItem}>
                        <Ionicons name="bag-outline" size={13} color={colors.textDim} />
                        <Text style={s.modalInfoTxt}>{frame.totalSold} vendidos</Text>
                      </View>
                    )}
                    {units !== null && (
                      <View style={s.modalInfoItem}>
                        <Ionicons name="layers-outline" size={13} color={colors.c1} />
                        <Text style={[s.modalInfoTxt, { color: colors.c1 }]}>×{units} unidades</Text>
                      </View>
                    )}
                    {frame.units > 0 && (
                      <View style={s.modalInfoItem}>
                        <Ionicons name="cube-outline" size={13} color={colors.textDim} />
                        <Text style={s.modalInfoTxt}>{frame.units} disponibles</Text>
                      </View>
                    )}
                  </View>

                  {/* Botones */}
                  <View style={s.modalBtns}>
                    <TouchableOpacity style={s.modalClose} onPress={() => setSelected(null)}>
                      <Text style={s.modalCloseTxt}>Cerrar</Text>
                    </TouchableOpacity>
                    {units === null && frame.units > 0 && (
                      <TouchableOpacity
                        style={s.modalBuy}
                        onPress={() => handleBuy(frame)}
                        disabled={buying}
                      >
                        {buying
                          ? <ActivityIndicator size={16} color="#000" />
                          : <Text style={s.modalBuyTxt}>✦{frame.price} · Comprar</Text>}
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              );
            })()}
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

  tabBar: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, padding: 4, position: 'relative', overflow: 'hidden',
  },
  tabIndicator: {
    position: 'absolute', top: 4, bottom: 4, left: 4,
    backgroundColor: 'rgba(0,229,204,0.12)',
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,229,204,0.2)',
  },
  tabBtn:       { alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 3 },
  tabLabel:     { color: colors.textDim, fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
  tabLabelActive:{ color: colors.c1 },

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
  cardFrame:           { width: '85%', height: '85%' },
  cardFramePlaceholder:{ alignItems: 'center', justifyContent: 'center', flex: 1 },
  unitsBadge: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: 'rgba(0,229,204,0.15)',
    borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: 'rgba(0,229,204,0.3)',
  },
  unitsTxt:  { color: colors.c1, fontSize: 9, fontWeight: '800' },
  priceBadge:{
    position: 'absolute', top: 6, right: 6,
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)',
  },
  priceTxt:  { color: 'rgba(251,191,36,1)', fontSize: 9, fontWeight: '800' },
  cardName:  { color: colors.textHi, fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingTop: 8, paddingBottom: 2 },
  cardCreator:{ color: colors.textDim, fontSize: 9, paddingHorizontal: 8, paddingBottom: 8 },

  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40, marginTop: 60 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(0,229,204,0.08)', borderWidth: 1, borderColor: 'rgba(0,229,204,0.2)', alignItems: 'center', justifyContent: 'center' },
  emptyTitle:{ color: colors.textHi, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptySub:  { color: colors.textDim, fontSize: 13, textAlign: 'center', lineHeight: 18 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard:    { width: '100%', backgroundColor: colors.surface, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: colors.border },
  modalPreview: { width: 120, height: 120, alignSelf: 'center', marginBottom: 16, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  modalFrameImg:{ position: 'absolute', width: 120, height: 120 },
  modalName:    { color: colors.textHi, fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  modalDesc:    { color: colors.textDim, fontSize: 13, textAlign: 'center', marginBottom: 16, lineHeight: 18 },
  modalInfo:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 20 },
  modalInfoItem:{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  modalInfoTxt: { color: colors.textDim, fontSize: 11 },
  modalBtns:    { flexDirection: 'row', gap: 12 },
  modalClose:   { flex: 1, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  modalCloseTxt:{ color: colors.textDim, fontSize: 14, fontWeight: '600' },
  modalBuy:     { flex: 1, paddingVertical: 12, borderRadius: 16, backgroundColor: 'rgba(251,191,36,0.85)', alignItems: 'center' },
  modalBuyTxt:  { color: '#000', fontSize: 14, fontWeight: '800' },
});

