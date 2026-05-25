import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, StatusBar, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { colors } from '../theme/colors';
import api from '../services/api';
import CoinIcon from '../components/CoinIcon';
import { formatCoins } from '../utils/formatCoins';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Ahora';
  if (m < 60) return `Hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `Hace ${d}d`;
  return new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

const STATUS_LABEL = {
  pendiente:  'Pendiente',
  aceptado:   'Completado',
  rechazado:  'Rechazado',
  expirado:   'Expirado',
};

const STATUS_COLOR = {
  pendiente:  { bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.3)',  text: '#fbbf24' },
  aceptado:   { bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.3)',   text: '#22c55e' },
  rechazado:  { bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)',  text: '#ef4444' },
  expirado:   { bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.2)', text: '#64748b' },
};

function giftSummary(gift) {
  const parts = [];
  if (gift.monedas > 0) parts.push(`${formatCoins(gift.monedas)} coins`);
  if (gift.items?.length > 0) {
    gift.items.forEach(it => {
      const name = it.frame?.name || 'Marco';
      parts.push(`${name} ×${it.cantidad}`);
    });
  }
  return parts.join(' · ') || 'Regalo';
}

// ─── Componente fila Enviado ──────────────────────────────────────────────────

function SentRow({ gift }) {
  const receptor = gift.receptor;
  const sc       = STATUS_COLOR[gift.estado] || STATUS_COLOR.pendiente;
  const isGrupal = gift.tipo === 'grupal';
  const claimed  = gift.reclamaciones?.length ?? 0;

  return (
    <View style={s.row}>
      <View style={s.rowAvatar}>
        {receptor?.avatarUrl
          ? <ExpoImage source={{ uri: receptor.avatarUrl }} style={s.avatarImg} contentFit="cover" />
          : <Ionicons name={isGrupal ? 'people-outline' : 'person'} size={20} color={colors.textDim} />}
      </View>

      <View style={s.rowBody}>
        <View style={s.rowTopLine}>
          <Text style={s.rowUsername} numberOfLines={1}>
            {isGrupal ? 'Regalo grupal' : `@${receptor?.username || '?'}`}
          </Text>
          <Text style={s.rowTime}>{timeAgo(gift.createdAt)}</Text>
        </View>

        <View style={s.rowSummaryLine}>
          {gift.monedas > 0 && <CoinIcon size={11} />}
          <Text style={s.rowSummary} numberOfLines={1}>{giftSummary(gift)}</Text>
        </View>

        <View style={s.rowBottomLine}>
          <View style={[s.statusBadge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
            <Text style={[s.statusTxt, { color: sc.text }]}>{STATUS_LABEL[gift.estado] || gift.estado}</Text>
          </View>
          {isGrupal && (
            <View style={s.slotsChip}>
              <Ionicons name="people-outline" size={10} color={colors.textDim} />
              <Text style={s.slotsTxt}>{claimed}/{gift.slots} reclamados</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Componente fila Recibido ─────────────────────────────────────────────────

function ReceivedRow({ gift }) {
  const emisor = gift.emisor;
  const sc     = STATUS_COLOR[gift.estado] || STATUS_COLOR.pendiente;

  return (
    <View style={s.row}>
      <View style={s.rowAvatar}>
        {emisor?.avatarUrl
          ? <ExpoImage source={{ uri: emisor.avatarUrl }} style={s.avatarImg} contentFit="cover" />
          : <Ionicons name="person" size={20} color={colors.textDim} />}
      </View>

      <View style={s.rowBody}>
        <View style={s.rowTopLine}>
          <Text style={s.rowUsername} numberOfLines={1}>@{emisor?.username || '?'}</Text>
          <Text style={s.rowTime}>{timeAgo(gift.createdAt)}</Text>
        </View>

        <View style={s.rowSummaryLine}>
          {gift.monedas > 0 && <CoinIcon size={11} />}
          <Text style={s.rowSummary} numberOfLines={1}>{giftSummary(gift)}</Text>
        </View>

        <View style={s.rowBottomLine}>
          <View style={[s.statusBadge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
            <Text style={[s.statusTxt, { color: sc.text }]}>{STATUS_LABEL[gift.estado] || gift.estado}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function MyGiftsScreen({ navigation }) {
  const [tab, setTab]               = useState('sent');
  const [sent, setSent]             = useState([]);
  const [received, setReceived]     = useState([]);
  const [loadingSent, setLoadingSent]         = useState(true);
  const [loadingReceived, setLoadingReceived] = useState(true);
  const [refreshingSent, setRefreshingSent]   = useState(false);
  const [refreshingReceived, setRefreshingReceived] = useState(false);

  const loadSent = useCallback(async (refresh = false) => {
    if (refresh) setRefreshingSent(true); else setLoadingSent(true);
    try {
      const { data } = await api.get('/gifts/sent', { params: { limit: 50 } });
      setSent(data.gifts || []);
    } catch (_) {}
    finally { setLoadingSent(false); setRefreshingSent(false); }
  }, []);

  const loadReceived = useCallback(async (refresh = false) => {
    if (refresh) setRefreshingReceived(true); else setLoadingReceived(true);
    try {
      const { data } = await api.get('/gifts/received', { params: { all: true, limit: 50 } });
      setReceived(data.gifts || []);
    } catch (_) {}
    finally { setLoadingReceived(false); setRefreshingReceived(false); }
  }, []);

  useEffect(() => { loadSent(); loadReceived(); }, []);

  function EmptyState({ icon, title, sub }) {
    return (
      <View style={s.empty}>
        <View style={s.emptyIcon}>
          <Ionicons name={icon} size={32} color={colors.c2} />
        </View>
        <Text style={s.emptyTitle}>{title}</Text>
        <Text style={s.emptySub}>{sub}</Text>
      </View>
    );
  }

  const isSent = tab === 'sent';
  const loading = isSent ? loadingSent : loadingReceived;
  const data    = isSent ? sent : received;
  const refreshing   = isSent ? refreshingSent : refreshingReceived;
  const onRefresh    = () => isSent ? loadSent(true) : loadReceived(true);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.black} />
      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.textHi} />
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <View style={s.headerIconWrap}>
              <Ionicons name="gift" size={16} color={colors.c2} />
            </View>
            <Text style={s.headerTitle}>Mis Regalos</Text>
          </View>
          <View style={{ width: 28 }} />
        </View>

        {/* Tabs */}
        <View style={s.tabs}>
          <TouchableOpacity
            style={[s.tab, isSent && s.tabActive]}
            onPress={() => setTab('sent')}
          >
            <Ionicons name="paper-plane-outline" size={14} color={isSent ? colors.c2 : colors.textDim} />
            <Text style={[s.tabTxt, isSent && s.tabTxtActive]}>Enviados</Text>
            {sent.length > 0 && (
              <View style={[s.tabCount, isSent && s.tabCountActive]}>
                <Text style={[s.tabCountTxt, isSent && s.tabCountTxtActive]}>{sent.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tab, !isSent && s.tabActive]}
            onPress={() => setTab('received')}
          >
            <Ionicons name="download-outline" size={14} color={!isSent ? colors.c2 : colors.textDim} />
            <Text style={[s.tabTxt, !isSent && s.tabTxtActive]}>Recibidos</Text>
            {received.length > 0 && (
              <View style={[s.tabCount, !isSent && s.tabCountActive]}>
                <Text style={[s.tabCountTxt, !isSent && s.tabCountTxtActive]}>{received.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {loading ? (
        <ActivityIndicator color={colors.c1} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={item => item._id}
          renderItem={({ item }) =>
            isSent
              ? <SentRow gift={item} />
              : <ReceivedRow gift={item} />
          }
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.c1} />
          }
          ListEmptyComponent={() =>
            isSent
              ? <EmptyState icon="paper-plane-outline" title="Sin regalos enviados" sub="Los regalos que envíes aparecerán aquí" />
              : <EmptyState icon="download-outline"   title="Sin regalos recibidos" sub="Los regalos que recibas aparecerán aquí" />
          }
          ItemSeparatorComponent={() => <View style={s.separator} />}
        />
      )}
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn:     { padding: 4 },
  headerCenter:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIconWrap: {
    width: 30, height: 30, borderRadius: 9,
    backgroundColor: 'rgba(41,121,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(41,121,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: colors.textHi, fontSize: 15, fontWeight: '800' },

  tabs: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, paddingBottom: 12,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  tabActive:  { backgroundColor: 'rgba(41,121,255,0.1)', borderColor: 'rgba(41,121,255,0.35)' },
  tabTxt:     { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  tabTxtActive:{ color: colors.c2, fontWeight: '700' },
  tabCount:    { backgroundColor: colors.border, borderRadius: 8, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabCountActive: { backgroundColor: 'rgba(41,121,255,0.2)' },
  tabCountTxt:    { color: colors.textDim, fontSize: 10, fontWeight: '800' },
  tabCountTxtActive: { color: colors.c2 },

  list:      { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 },
  separator: { height: 1, backgroundColor: colors.border, marginVertical: 2 },

  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingVertical: 14,
  },
  rowAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImg:  { width: 44, height: 44 },
  rowBody:    { flex: 1, gap: 5 },
  rowTopLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowUsername:{ color: colors.textHi, fontSize: 13, fontWeight: '700', flex: 1 },
  rowTime:    { color: colors.textDim, fontSize: 11, marginLeft: 8 },
  rowSummaryLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rowSummary: { color: colors.textMid, fontSize: 12, flex: 1 },
  rowBottomLine:  { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },

  statusBadge: {
    borderRadius: 7, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  statusTxt: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

  slotsChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.surface,
    borderRadius: 7, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  slotsTxt: { color: colors.textDim, fontSize: 10, fontWeight: '600' },

  empty:      { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40, gap: 12 },
  emptyIcon:  {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: 'rgba(41,121,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(41,121,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { color: colors.textHi, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  emptySub:   { color: colors.textDim, fontSize: 13, textAlign: 'center', lineHeight: 18 },
});
