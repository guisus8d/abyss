import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, StatusBar, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';
import api from '../services/api';
import AvatarWithFrame from '../components/AvatarWithFrame';

const RANK_ICONS = [
  { name: 'trophy', color: '#FFD700', size: 28 },
  { name: 'medal',  color: '#C0C0C0', size: 22 },
  { name: 'medal',  color: '#CD7F32', size: 22 },
];
const PODIUM_COLORS = {
  0: { grad: ['#FFD700','#FFA500'], text: '#7a5c00' },
  1: { grad: ['#C0C0C0','#999999'], text: '#444' },
  2: { grad: ['#CD7F32','#8B4513'], text: '#4a2200' },
};
const BAR_HEIGHTS = { 0: 80, 1: 56, 2: 40 };

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
  const rest = users.slice(3, 10);

  // Orden visual: 2º izq, 1º centro, 3º der
  const podiumOrder = [top3[1], top3[0], top3[2]];
  const podiumRanks = [1, 0, 2];

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.black} />
      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backTxt}>←</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>TOP SEMANAL</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <FlatList
        data={rest}
        keyExtractor={u => u._id}
        ListHeaderComponent={(
          <View>
            <View style={s.podiumWrap}>
              {podiumOrder.map((u, i) => {
                if (!u) return <View key={i} style={{ flex: 1 }} />;
                const rank = podiumRanks[i];
                const isFirst = rank === 0;
                const pc = PODIUM_COLORS[rank];
                return (
                  <TouchableOpacity
                    key={u._id}
                    style={s.podiumSlot}
                    onPress={() => navigation.navigate('PublicProfile', { username: u.username })}
                  >
                    <Ionicons
                      name={RANK_ICONS[rank].name}
                      size={RANK_ICONS[rank].size}
                      color={RANK_ICONS[rank].color}
                      style={{ marginBottom: isFirst ? 8 : 6 }}
                    />

                    <AvatarWithFrame
                      size={isFirst ? 80 : 58}
                      avatarUrl={u.avatarUrl}
                      username={u.username}
                      profileFrame={u.profileFrame}
              frameUrl={u.profileFrameUrl}
                    />

                    <Text style={[s.podiumUser, isFirst && s.podiumUserFirst]} numberOfLines={1}>
                      {u.username}
                    </Text>

                    <LinearGradient colors={pc.grad} style={s.xpPill} start={{x:0,y:0}} end={{x:1,y:0}}>
                      <Text style={[s.xpPillTxt, { color: pc.text }]}>{u.xp} XP</Text>
                    </LinearGradient>

                    <LinearGradient
                      colors={pc.grad}
                      style={[s.bar, { height: BAR_HEIGHTS[rank] }]}
                      start={{x:0,y:0}} end={{x:1,y:0}}
                    >
                      <Text style={[s.barTxt, { color: pc.text }]}>#{rank + 1}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })}
            </View>

            {rest.length > 0 && (
              <View style={s.divider}>
                <View style={s.divLine} />
                <Text style={s.divTxt}>CLASIFICACIÓN</Text>
                <View style={s.divLine} />
              </View>
            )}
          </View>
        )}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={s.row}
            onPress={() => navigation.navigate('PublicProfile', { username: item.username })}
          >
            <Ionicons name='flame' size={16} color={colors.c1} style={{ width: 32 }} />
            <AvatarWithFrame
              size={42}
              avatarUrl={item.avatarUrl}
              username={item.username}
              profileFrame={item.profileFrame}
              frameUrl={item.profileFrameUrl}
              style={{ marginHorizontal: 12 }}
            />
            <Text style={s.rowUser}>{item.username}</Text>
            <Text style={s.rowXp}>{item.xp} XP</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={users.length === 0 ? (
          <View style={s.empty}><Text style={s.emptyTxt}>Sin datos aún</Text></View>
        ) : null}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.black },
  header:      {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 4, color: colors.c1 },
  backBtn:     { padding: 8, width: 40 },
  backTxt:     { color: colors.c1, fontSize: 22 },

  podiumWrap: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center',
    paddingHorizontal: 12, paddingTop: 28, gap: 6,
  },
  podiumSlot:      { flex: 1, alignItems: 'center' },
  podiumUser:      { color: colors.textMid, fontSize: 11, fontWeight: '600', marginTop: 8, marginBottom: 4, textAlign: 'center' },
  podiumUserFirst: { color: colors.textHi, fontSize: 13, fontWeight: '700' },
  xpPill:          { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 8 },
  xpPillTxt:       { fontSize: 10, fontWeight: '900' },
  bar:             { width: '100%', alignItems: 'center', justifyContent: 'center', borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  barTxt:          { fontSize: 16, fontWeight: '900' },

  divider: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 20, gap: 10 },
  divLine: { flex: 1, height: 1, backgroundColor: colors.border },
  divTxt:  { color: colors.textDim, fontSize: 9, letterSpacing: 3 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rowRank: { color: colors.textDim, fontSize: 13, fontWeight: '700', width: 32 },
  rowUser: { flex: 1, color: colors.textHi, fontSize: 14, fontWeight: '600' },
  rowXp:   { color: colors.c1, fontSize: 13, fontWeight: '700' },

  empty:    { alignItems: 'center', paddingVertical: 40 },
  emptyTxt: { color: colors.textDim, fontSize: 14 },
});
