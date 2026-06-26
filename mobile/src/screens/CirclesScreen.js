import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

export default function CirclesScreen({ navigation }) {
  const { user } = useAuthStore();
  const insets   = useSafeAreaInsets();

  const [circles, setCircles] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    loadCircles();
  }, []));

  async function loadCircles() {
    setLoading(true);
    try {
      const { data } = await api.get('/groups/circles/mine');
      setCircles(data.circles || []);
    } catch {
      setCircles([]);
    } finally {
      setLoading(false);
    }
  }

  function renderCircle({ item }) {
    const tags   = (item.hashtags || []).slice(0, 3);
    const unread = item.unreadCounts?.[user?._id] || 0;

    return (
      <TouchableOpacity
        style={s.card}
        activeOpacity={0.75}
        onPress={() => navigation.navigate('GroupRoom', { group: item })}
      >
        <View style={s.cardImg}>
          {item.imageUrl
            ? <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            : <Text style={s.cardImgLetter}>{item.name?.[0]?.toUpperCase()}</Text>}
        </View>

        <View style={s.cardBody}>
          <View style={s.cardTitleRow}>
            <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
            {unread > 0 && (
              <View style={s.badge}>
                <Text style={s.badgeTxt}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            )}
          </View>

          {tags.length > 0 && (
            <View style={s.tagsRow}>
              {tags.map(t => (
                <View key={t} style={s.tag}>
                  <Text style={s.tagTxt}>#{t}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={s.membersCount}>
            <Ionicons name="people-outline" size={12} color={colors.textDim} />{' '}
            {item.membersCount ?? item.members?.length ?? 0} miembros
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
      </TouchableOpacity>
    );
  }

  function EmptyState() {
    return (
      <View style={s.empty}>
        <Ionicons name="planet-outline" size={64} color={colors.textDim} />
        <Text style={s.emptyTitle}>Aún no estás en ninguna fiesta.</Text>
        <Text style={s.emptySubtitle}>¡Únete o crea una!</Text>
        <TouchableOpacity style={s.emptyBtn} onPress={() => navigation.navigate('CircleCreate')}>
          <Ionicons name="add" size={18} color={colors.black} />
          <Text style={s.emptyBtnTxt}>Crear fiesta</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={s.header}>
        <Text style={s.headerTitle}>Fiestas</Text>
        <TouchableOpacity style={s.headerBtn} onPress={() => navigation.navigate('CircleCreate')}>
          <Ionicons name="add" size={24} color={colors.c1} />
        </TouchableOpacity>
      </View>

      {loading
        ? <ActivityIndicator color={colors.c1} style={{ marginTop: 48 }} />
        : (
          <FlatList
            data={circles}
            keyExtractor={item => item._id}
            renderItem={renderCircle}
            ListEmptyComponent={<EmptyState />}
            contentContainerStyle={circles.length === 0 ? { flex: 1 } : { paddingBottom: insets.bottom + 16 }}
            ItemSeparatorComponent={() => <View style={s.separator} />}
          />
        )
      }
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: colors.black },

  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle:   { color: colors.textHi, fontSize: 20, fontWeight: '700' },
  headerBtn:     { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(0,229,204,0.1)', alignItems: 'center', justifyContent: 'center' },

  card:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  cardImg:       { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.surface, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  cardImgLetter: { color: colors.c1, fontSize: 22, fontWeight: '700' },
  cardBody:      { flex: 1, gap: 4 },
  cardTitleRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardName:      { color: colors.textHi, fontSize: 15, fontWeight: '600', flex: 1 },

  badge:         { backgroundColor: colors.c1, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeTxt:      { color: colors.black, fontSize: 11, fontWeight: '700' },

  tagsRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag:           { backgroundColor: 'rgba(0,229,204,0.08)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  tagTxt:        { color: colors.c1, fontSize: 11 },

  membersCount:  { color: colors.textDim, fontSize: 12, marginTop: 2 },

  separator:     { height: 1, backgroundColor: colors.border, marginLeft: 80 },

  empty:         { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 40 },
  emptyTitle:    { color: colors.textHi, fontSize: 16, fontWeight: '600', textAlign: 'center', marginTop: 16 },
  emptySubtitle: { color: colors.textDim, fontSize: 14, textAlign: 'center' },
  emptyBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.c1, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: 12 },
  emptyBtnTxt:   { color: colors.black, fontWeight: '700', fontSize: 14 },
});
