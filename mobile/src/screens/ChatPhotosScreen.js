import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity, ActivityIndicator,
  StyleSheet, Dimensions, Modal, Pressable, StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import api from '../services/api';

const { width } = Dimensions.get('window');
const COLS = 3;
const CELL = (width - 4) / COLS;

export default function ChatPhotosScreen({ navigation, route }) {
  const { chatId, groupId, otherUsername } = route.params;
  const mediaEndpoint = groupId
    ? `/groups/${groupId}/media/images`
    : `/chats/${chatId}/media/images`;
  const insets = useSafeAreaInsets();

  const [images,   setImages]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [page,     setPage]     = useState(1);
  const [hasMore,  setHasMore]  = useState(false);
  const [loadMore, setLoadMore] = useState(false);
  const [fullImg,  setFullImg]  = useState(null);

  useEffect(() => { fetchImages(1); }, []);

  async function fetchImages(p) {
    if (p === 1) setLoading(true); else setLoadMore(true);
    try {
      const { data } = await api.get(`${mediaEndpoint}?page=${p}&limit=30`);
      const imgs = data.images || [];
      setImages(prev => p === 1 ? imgs : [...prev, ...imgs]);
      setPage(data.page);
      setHasMore(data.page < data.pages);
    } catch (e) { console.log('ChatPhotos fetch error:', e.message); }
    finally { setLoading(false); setLoadMore(false); }
  }

  const renderItem = useCallback(({ item }) => (
    <TouchableOpacity onPress={() => setFullImg(item.mediaUrl)} activeOpacity={0.85}>
      <Image source={{ uri: item.mediaUrl }} style={s.cell} resizeMode="cover" />
    </TouchableOpacity>
  ), []);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.textHi} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Fotos</Text>
            <Text style={s.headerSub}>{otherUsername}</Text>
          </View>
        </View>
      </SafeAreaView>

      {loading ? (
        <ActivityIndicator color={colors.c1} style={{ marginTop: 60 }} />
      ) : images.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="images-outline" size={48} color={colors.textDim} />
          <Text style={s.emptyTxt}>Sin fotos aún</Text>
        </View>
      ) : (
        <FlatList
          data={images}
          keyExtractor={i => i._id.toString()}
          numColumns={COLS}
          renderItem={renderItem}
          onEndReached={() => { if (hasMore && !loadMore) fetchImages(page + 1); }}
          onEndReachedThreshold={0.4}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          ListFooterComponent={loadMore ? <ActivityIndicator color={colors.c1} style={{ marginVertical: 16 }} /> : null}
          columnWrapperStyle={{ gap: 2 }}
          ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
        />
      )}

      {/* Visor fullscreen */}
      <Modal visible={!!fullImg} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setFullImg(null)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' }}
          onPress={() => setFullImg(null)}
        >
          {fullImg && (
            <Image source={{ uri: fullImg }} style={{ width: '95%', height: '70%', borderRadius: 12 }} resizeMode="contain" />
          )}
          <Text style={{ color: 'rgba(255,255,255,0.4)', marginTop: 16, fontSize: 12 }}>Toca para cerrar</Text>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.black },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn:     { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.textHi, fontWeight: '700', fontSize: 15 },
  headerSub:   { color: colors.textDim, fontSize: 11, marginTop: 1 },
  cell:        { width: CELL, height: CELL },
  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTxt:    { color: colors.textDim, fontSize: 14 },
});
