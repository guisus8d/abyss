import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Image, FlatList,
  StyleSheet, ActivityIndicator, StatusBar, Dimensions, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import api from '../services/api';
import { CIRCLE_HASHTAGS, getHashtagColor } from '../constants/circleHashtags';

const SCREEN_W  = Dimensions.get('window').width;
const CARD_W    = Math.floor((SCREEN_W - 12 * 2 - 8) / 2);
const CARD_H    = 100;
const PAGE_SIZE = 8;

export default function CirclesScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [circles,      setCircles]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [hasMore,      setHasMore]      = useState(true);
  const [activeFilter, setActiveFilter] = useState('todos');
  const pageRef = useRef(1);

  useFocusEffect(useCallback(() => {
    load();
  }, [activeFilter]));

  async function load() {
    setLoading(true);
    pageRef.current = 1;
    try {
      const params = { limit: PAGE_SIZE, page: 1 };
      if (activeFilter !== 'todos' && activeFilter !== 'populares') params.hashtag = activeFilter;
      const { data } = await api.get('/groups/circles/public', { params });
      setCircles(data.circles || []);
      setHasMore(data.hasMore ?? false);
    } catch {
      setCircles([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      const nextPage = pageRef.current + 1;
      const params = { limit: PAGE_SIZE, page: nextPage };
      if (activeFilter !== 'todos' && activeFilter !== 'populares') params.hashtag = activeFilter;
      const { data } = await api.get('/groups/circles/public', { params });
      const incoming = data.circles || [];
      if (incoming.length > 0) {
        setCircles(prev => [...prev, ...incoming]);
        pageRef.current = nextPage;
      }
      setHasMore(data.hasMore ?? false);
    } catch {
      // keep current list on error
    } finally {
      setLoadingMore(false);
    }
  }

  const displayedCircles = useMemo(() => {
    if (activeFilter === 'populares') {
      return [...circles].sort((a, b) => (b.membersCount || 0) - (a.membersCount || 0));
    }
    return circles;
  }, [circles, activeFilter]);

  const pills = useMemo(() => [
    { key: 'todos',     label: 'Todos',     color: colors.c1 },
    { key: 'populares', label: 'Populares', color: '#2979ff' },
    ...CIRCLE_HASHTAGS.map(tag => ({ key: tag, label: `#${tag}`, color: getHashtagColor(tag) })),
  ], []);

  function emptyText() {
    if (activeFilter === 'todos' || activeFilter === 'populares') return 'No hay fiestas publicas aun';
    return `No hay fiestas con #${activeFilter} aun`;
  }

  function renderCard({ item }) {
    return (
      <TouchableOpacity
        style={[s.card, !item.isActive && { opacity: 0.45 }]}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('GroupRoom', { group: item })}
      >
        {item.imageUrl
          ? <Image
              source={{ uri: item.imageUrl }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              fadeDuration={Platform.OS === 'android' ? 0 : undefined}
            />
          : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]} />}

        <LinearGradient
          colors={['rgba(0,0,0,0.8)', 'transparent']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '60%', justifyContent: 'flex-start', padding: 7 }}
        >
          <Text style={s.cardName} numberOfLines={2}>{item.name}</Text>
        </LinearGradient>

        <LinearGradient
          colors={['rgba(0,0,0,0.75)', 'transparent']}
          start={{ x: 0, y: 1 }} end={{ x: 0, y: 0 }}
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%' }}
        />

        {item.hashtags?.length > 0 && (
          <View style={s.cardHashtags}>
            {item.hashtags.slice(0, 2).map((tag) => {
              const c = getHashtagColor(tag);
              return (
                <View key={tag} style={[s.cardHashtagPill, { borderColor: c + '55', backgroundColor: c + '18' }]}>
                  <Text style={[s.cardHashtagTxt, { color: c }]}>#{tag}</Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={s.cardMembersBadge}>
          <Text style={s.cardMembersBadgeTxt}>{item.membersCount ?? 0}</Text>
          <Ionicons name="people" size={8} color="#fff" />
        </View>
      </TouchableOpacity>
    );
  }

  function renderFooter() {
    if (!loadingMore) return null;
    return <ActivityIndicator color={colors.c1} style={{ marginVertical: 20 }} />;
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Fiestas</Text>
        <TouchableOpacity style={s.headerBtn} onPress={() => navigation.navigate('CircleCreate')}>
          <Ionicons name="add" size={24} color={colors.c1} />
        </TouchableOpacity>
      </View>

      {/* Filter pills */}
      <View style={s.pillsWrap}>
        {pills.map(pill => {
          const active = activeFilter === pill.key;
          return (
            <TouchableOpacity
              key={pill.key}
              style={[
                s.pill,
                active
                  ? { borderColor: pill.color, backgroundColor: pill.color + '30' }
                  : { borderColor: 'transparent', backgroundColor: 'rgba(255,255,255,0.05)' },
              ]}
              onPress={() => setActiveFilter(pill.key)}
              activeOpacity={0.75}
            >
              <Text style={[s.pillTxt, { color: active ? pill.color : colors.textMid }]}>{pill.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {loading ? (
        <ActivityIndicator color={colors.c1} style={{ marginTop: 48 }} />
      ) : displayedCircles.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="planet-outline" size={48} color={colors.textDim} />
          <Text style={s.emptyTxt}>{emptyText()}</Text>
        </View>
      ) : (
        <FlatList
          data={displayedCircles}
          keyExtractor={item => item._id}
          renderItem={renderCard}
          numColumns={2}
          contentContainerStyle={[s.cardsContent, { paddingBottom: insets.bottom + 16 }]}
          columnWrapperStyle={s.columnWrapper}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: colors.black },

  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle:{ color: colors.textHi, fontSize: 20, fontWeight: '700' },
  headerBtn:  { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(0,229,204,0.1)', alignItems: 'center', justifyContent: 'center' },

  pillsWrap:  { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 6, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 10 },
  pill:       { borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  pillTxt:    { fontSize: 11, fontWeight: '600' },

  cardsContent:   { paddingHorizontal: 12, paddingTop: 16 },
  columnWrapper:  { gap: 8, marginBottom: 8 },

  card:         { width: CARD_W, height: CARD_H, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  cardName:     { color: '#fff', fontSize: 10, fontWeight: '800' },
  cardHashtags: { position: 'absolute', bottom: 6, left: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  cardHashtagPill:  { borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1 },
  cardHashtagTxt:   { fontSize: 9, fontWeight: '600' },
  cardMembersBadge: { position: 'absolute', bottom: 6, right: 6, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  cardMembersBadgeTxt: { color: '#fff', fontSize: 9, fontWeight: '600' },

  empty:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyTxt: { color: colors.textDim, fontSize: 14, textAlign: 'center' },
});
