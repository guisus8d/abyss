import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, StatusBar, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import CoinIcon from '../components/CoinIcon';
import { formatCoins } from '../utils/formatCoins';

const FILTERS = [
  { key: '',              label: 'Todas' },
  { key: 'compra_marco',  label: 'Compras' },
  { key: 'regalo_coins',  label: 'Regalos ✦' },
  { key: 'regalo_marco',  label: 'Regalos marcos' },
  { key: 'reembolso',     label: 'Reembolsos' },
];

const TIPO_CONFIG = {
  compra_marco:  { icon: 'bag-handle-outline', label: 'Compra de marco',   color: 'rgba(251,191,36,1)' },
  regalo_coins:  { icon: 'gift-outline',        label: 'Regalo de monedas', color: colors.c3 },
  regalo_marco:  { icon: 'sparkles-outline',    label: 'Regalo de marco',   color: colors.c3 },
  comision:      { icon: 'receipt-outline',     label: 'Comisión',          color: colors.c4 },
  reembolso:     { icon: 'refresh-outline',     label: 'Reembolso',         color: colors.c1 },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'Ahora';
  if (m < 60)  return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30)  return `${d}d`;
  return new Date(dateStr).toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

function TxCard({ tx, userId }) {
  const cfg    = TIPO_CONFIG[tx.tipo] || { icon: 'swap-horizontal-outline', label: tx.tipo, color: colors.textDim };
  const isEmit = String(tx.emisor?._id || tx.emisor) === String(userId);
  const sign   = isEmit ? '-' : '+';
  const amt    = isEmit ? tx.monto : tx.montoNeto;
  const other  = isEmit ? tx.receptor : tx.emisor;

  return (
    <View style={s.txCard}>
      <View style={[s.txIcon, { backgroundColor: cfg.color + '15', borderColor: cfg.color + '30' }]}>
        <Ionicons name={cfg.icon} size={18} color={cfg.color} />
      </View>

      <View style={s.txMid}>
        <Text style={s.txLabel}>{cfg.label}</Text>
        {tx.item?.name && (
          <Text style={s.txItem} numberOfLines={1}>{tx.item.name}</Text>
        )}
        <View style={s.txMeta}>
          {other?.username && (
            <Text style={s.txUser}>@{other.username}</Text>
          )}
          <Text style={s.txTime}>{timeAgo(tx.createdAt)}</Text>
        </View>
      </View>

      <View style={s.txAmtWrap}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Text style={[s.txAmt, { color: isEmit ? colors.c4 : colors.c1 }]}>{sign}</Text>
          <CoinIcon size={13} />
          <Text style={[s.txAmt, { color: isEmit ? colors.c4 : colors.c1 }]}>{amt}</Text>
        </View>
        {!isEmit && tx.comision > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Text style={s.txComision}>com. </Text>
            <CoinIcon size={10} />
            <Text style={s.txComision}>{tx.comision}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function TransactionsScreen({ navigation }) {
  const { user } = useAuthStore();
  const [tipo, setTipo]           = useState('');
  const [txs, setTxs]             = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [balance, setBalance]     = useState(null);

  useEffect(() => { loadBalance(); load(1, tipo, true); }, []);

  async function loadBalance() {
    try {
      const { data } = await api.get('/coins/balance');
      setBalance(data);
    } catch (e) { console.log(e); }
  }

  async function load(p, t, reset = false) {
    if (reset) setLoading(true); else setLoadingMore(true);
    try {
      const params = { page: p, limit: 20 };
      if (t) params.tipo = t;
      const { data } = await api.get('/transactions/me', { params });
      const list = data.transactions || [];
      setTxs(prev => reset ? list : [...prev, ...list]);
      setTotalPages(data.totalPages || 1);
      setPage(p);
    } catch (e) { console.log(e); }
    finally { setLoading(false); setLoadingMore(false); setRefreshing(false); }
  }

  function onFilter(t) {
    setTipo(t);
    load(1, t, true);
  }

  function onRefresh() { setRefreshing(true); load(1, tipo, true); }

  function onEndReached() {
    if (!loadingMore && page < totalPages) load(page + 1, tipo, false);
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.black} />
      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.textHi} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>HISTORIAL</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Balance */}
        {balance && (
          <View style={s.balanceCard}>
            <View style={s.balanceItem}>
              <Text style={s.balanceLbl}>Disponible</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <CoinIcon size={20} />
                <Text style={s.balanceVal}>{formatCoins(balance.coins)}</Text>
              </View>
            </View>
            {balance.coinsReservadas > 0 && (
              <>
                <View style={s.balanceDivider} />
                <View style={s.balanceItem}>
                  <Text style={s.balanceLbl}>En espera</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <CoinIcon size={20} />
                    <Text style={[s.balanceVal, { color: colors.textMid }]}>{formatCoins(balance.coinsReservadas)}</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        )}

        {/* Filters */}
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={item => item.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filtersRow}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.chip, tipo === item.key && s.chipActive]}
              onPress={() => onFilter(item.key)}
            >
              <Text style={[s.chipTxt, tipo === item.key && s.chipTxtActive]}>{item.label}</Text>
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>

      {loading ? (
        <ActivityIndicator color={colors.c1} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          style={{ backgroundColor: colors.black }}
          data={txs}
          keyExtractor={item => item._id}
          renderItem={({ item }) => <TxCard tx={item} userId={user?._id} />}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.c1} />}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.c1} style={{ marginVertical: 20 }} /> : null}
          ListEmptyComponent={() => (
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <Ionicons name="receipt-outline" size={36} color={colors.textDim} />
              </View>
              <Text style={s.emptyTitle}>Sin transacciones</Text>
              <Text style={s.emptySub}>Aquí aparecerán tus compras, regalos y reembolsos</Text>
            </View>
          )}
        />
      )}
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

  balanceCard: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 14,
    backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 20, paddingVertical: 14,
  },
  balanceItem:    { flex: 1, alignItems: 'center' },
  balanceLbl:     { color: colors.textDim, fontSize: 11, marginBottom: 4 },
  balanceVal:     { color: 'rgba(251,191,36,1)', fontSize: 20, fontWeight: '800' },
  balanceDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: 12 },

  filtersRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 10 },
  chip:       { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: 'rgba(0,229,204,0.1)', borderColor: 'rgba(0,229,204,0.35)' },
  chipTxt:    { color: colors.textDim, fontSize: 12, fontWeight: '600' },
  chipTxtActive: { color: colors.c1 },

  list: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 4 },

  txCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    padding: 14, marginBottom: 8,
  },
  txIcon:    { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  txMid:     { flex: 1 },
  txLabel:   { color: colors.textHi, fontSize: 13, fontWeight: '700', marginBottom: 2 },
  txItem:    { color: colors.textDim, fontSize: 11, marginBottom: 3 },
  txMeta:    { flexDirection: 'row', gap: 8, alignItems: 'center' },
  txUser:    { color: colors.c1, fontSize: 11 },
  txTime:    { color: colors.textDim, fontSize: 11 },
  txAmtWrap: { alignItems: 'flex-end' },
  txAmt:     { fontSize: 14, fontWeight: '800' },
  txComision:{ color: colors.textDim, fontSize: 10, marginTop: 2 },

  empty:      { flex: 1, alignItems: 'center', gap: 12, paddingHorizontal: 40, marginTop: 80 },
  emptyIcon:  { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.textHi, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptySub:   { color: colors.textDim, fontSize: 13, textAlign: 'center', lineHeight: 18 },
});
