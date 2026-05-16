import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, StatusBar, ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';
import api from '../services/api';
import AvatarWithFrame from '../components/AvatarWithFrame';

const W = Dimensions.get('window').width;

const GOLD   = '#FFD700';
const SILVER = '#C0C0C0';
const BRONZE = '#CD7F32';

const PODIUM = [
  { rank: 0, color: GOLD,   gradBg: ['#2a1f00','#1a1200'], gradBadge: ['#FFD700','#FFA500'], badgeText: '#3d2800', size: 72, label: '#1' },
  { rank: 1, color: SILVER, gradBg: ['#1e1e1e','#111111'], gradBadge: ['#C0C0C0','#888888'], badgeText: '#2a2a2a', size: 58, label: '#2' },
  { rank: 2, color: BRONZE, gradBg: ['#1f1008','#130900'], gradBadge: ['#CD7F32','#8B4513'], badgeText: '#3a1800', size: 58, label: '#3' },
];

// Visual order: 2nd left · 1st center · 3rd right
const PODIUM_ORDER = [1, 0, 2];

function MedalIcon({ rank, size = 28 }) {
  if (rank === 0) return <Ionicons name="trophy" size={size} color={GOLD} />;
  if (rank === 1) return <Ionicons name="medal" size={size} color={SILVER} />;
  return <Ionicons name="medal" size={size} color={BRONZE} />;
}

function PodiumCard({ user, rank, navigation }) {
  const p = PODIUM[rank];
  return (
    <TouchableOpacity
      style={[s.podiumCard, rank === 0 && s.podiumCardFirst]}
      onPress={() => navigation.navigate('PublicProfile', { username: user.username })}
      activeOpacity={0.8}
    >
      <LinearGradient colors={p.gradBg} style={StyleSheet.absoluteFill} />

      {/* Medalla / corona */}
      <View style={s.medalWrap}>
        <MedalIcon rank={rank} size={rank === 0 ? 30 : 22} />
      </View>

      <AvatarWithFrame
        size={p.size}
        avatarUrl={user.avatarUrl}
        username={user.username}
        profileFrame={user.profileFrame}
        frameUrl={user.profileFrameUrl}
      />

      <Text style={[s.podiumName, { color: p.color }]} numberOfLines={1}>
        {user.username}
      </Text>

      <LinearGradient colors={p.gradBadge} style={s.xpBadge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <Text style={[s.xpBadgeTxt, { color: p.badgeText }]}>{user.xp} XP</Text>
      </LinearGradient>

      {/* Barra de podio */}
      <LinearGradient
        colors={p.gradBadge}
        style={[s.podiumBar, { height: rank === 0 ? 52 : rank === 1 ? 36 : 24 }]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
      >
        <Text style={[s.podiumBarTxt, { color: p.badgeText }]}>{p.label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function RankColor(index) {
  if (index === 0) return '#ffffff';
  if (index === 1) return colors.textHi;
  if (index < 4) return colors.textMid;
  return colors.textDim;
}

export default function TopScreen({ navigation }) {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    api.get('/users/top')
      .then(({ data }) => setUsers(data.users || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []));

  if (loading) return (
    <View style={s.root}>
      <ActivityIndicator color={colors.c1} style={{ marginTop: 80 }} />
    </View>
  );

  const top3 = users.slice(0, 3);
  const rest = users.slice(3);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Header ── */}
      <LinearGradient colors={['#1a1000', colors.black]} style={s.headerGrad}>
        <SafeAreaView edges={['top']}>
          <View style={s.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={s.headerCenter}>
              <Ionicons name="trophy" size={22} color={GOLD} />
              <Text style={s.headerTitle}>Top Semanal</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>
          <Text style={s.headerSub}>Los más destacados de la semana</Text>
        </SafeAreaView>
      </LinearGradient>

      <FlatList
        data={rest}
        keyExtractor={u => u._id}
        ListHeaderComponent={(
          <View>
            {/* ── Podio ── */}
            {top3.length > 0 && (
              <View style={s.podiumWrap}>
                {PODIUM_ORDER.map((rank, i) => {
                  const u = top3[rank];
                  if (!u) return <View key={i} style={{ flex: 1 }} />;
                  return <PodiumCard key={u._id} user={u} rank={rank} navigation={navigation} />;
                })}
              </View>
            )}

            {/* ── Divisor ── */}
            {rest.length > 0 && (
              <View style={s.divider}>
                <View style={s.divLine} />
                <View style={s.divPill}>
                  <Ionicons name="flame" size={11} color={colors.c1} />
                  <Text style={s.divTxt}>CLASIFICACIÓN</Text>
                </View>
                <View style={s.divLine} />
              </View>
            )}
          </View>
        )}
        renderItem={({ item, index }) => {
          const pos = index + 4;
          return (
            <TouchableOpacity
              style={s.row}
              onPress={() => navigation.navigate('PublicProfile', { username: item.username })}
              activeOpacity={0.7}
            >
              <Text style={[s.rowRank, { color: RankColor(index) }]}>#{pos}</Text>
              <AvatarWithFrame
                size={40}
                avatarUrl={item.avatarUrl}
                username={item.username}
                profileFrame={item.profileFrame}
                frameUrl={item.profileFrameUrl}
              />
              <Text style={s.rowName} numberOfLines={1}>{item.username}</Text>
              <View style={s.rowXpWrap}>
                <Text style={s.rowXp}>{item.xp}</Text>
                <Text style={s.rowXpLabel}>XP</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={colors.textDim} />
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={users.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="trophy-outline" size={48} color={colors.textDim} />
            <Text style={s.emptyTxt}>Sin datos aún</Text>
          </View>
        ) : null}
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },

  // Header
  headerGrad:   { paddingBottom: 16 },
  headerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle:  { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  headerSub:    { color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center', letterSpacing: 1 },
  backBtn:      { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)' },

  // Podio
  podiumWrap: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center',
    paddingHorizontal: 8, paddingTop: 24, paddingBottom: 4, gap: 6,
  },
  podiumCard: {
    flex: 1, alignItems: 'center',
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    paddingTop: 14, paddingBottom: 0, paddingHorizontal: 4,
    position: 'relative',
  },
  podiumCardFirst: {
    borderColor: 'rgba(255,215,0,0.25)',
  },
  medalWrap: { marginBottom: 8 },
  podiumName: { fontSize: 11, fontWeight: '700', marginTop: 8, marginBottom: 6, textAlign: 'center' },
  xpBadge:    { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 8 },
  xpBadgeTxt: { fontSize: 10, fontWeight: '900' },
  podiumBar:  {
    width: '100%', alignItems: 'center', justifyContent: 'center',
    borderTopLeftRadius: 4, borderTopRightRadius: 4, marginTop: 2,
  },
  podiumBarTxt: { fontSize: 13, fontWeight: '900', paddingVertical: 4 },

  // Divisor
  divider: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 20, gap: 10 },
  divLine: { flex: 1, height: 1, backgroundColor: colors.border },
  divPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: 'rgba(0,229,204,0.07)', borderWidth: 1, borderColor: 'rgba(0,229,204,0.15)' },
  divTxt:  { color: colors.c1, fontSize: 9, fontWeight: '700', letterSpacing: 2 },

  // Filas
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rowRank:    { fontSize: 13, fontWeight: '800', width: 32 },
  rowName:    { flex: 1, color: colors.textHi, fontSize: 14, fontWeight: '600' },
  rowXpWrap:  { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  rowXp:      { color: colors.c1, fontSize: 14, fontWeight: '800' },
  rowXpLabel: { color: colors.textDim, fontSize: 10, fontWeight: '600' },

  // Vacío
  empty:    { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTxt: { color: colors.textDim, fontSize: 14 },
});
