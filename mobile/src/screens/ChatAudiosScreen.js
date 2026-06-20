import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity, ActivityIndicator,
  StyleSheet, StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import api from '../services/api';
import AudioMessage from '../components/AudioMessage';

function pad(n) { return String(Math.floor(n)).padStart(2, '0'); }
function fmtDate(iso) {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ChatAudiosScreen({ navigation, route }) {
  const { chatId, otherUsername } = route.params;
  const insets = useSafeAreaInsets();

  const [audios,   setAudios]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [page,     setPage]     = useState(1);
  const [hasMore,  setHasMore]  = useState(false);
  const [loadMore, setLoadMore] = useState(false);

  useEffect(() => { fetchAudios(1); }, []);

  async function fetchAudios(p) {
    if (p === 1) setLoading(true); else setLoadMore(true);
    try {
      const { data } = await api.get(`/chats/${chatId}/media/audios?page=${p}&limit=20`);
      const list = data.audios || [];
      setAudios(prev => p === 1 ? list : [...prev, ...list]);
      setPage(data.page);
      setHasMore(data.page < data.pages);
    } catch (e) { console.log('ChatAudios fetch error:', e.message); }
    finally { setLoading(false); setLoadMore(false); }
  }

  const renderItem = useCallback(({ item }) => (
    <View style={s.row}>
      <View style={s.avatarWrap}>
        {item.sender?.avatarUrl
          ? <Image source={{ uri: item.sender.avatarUrl }} style={s.avatar} />
          : <Text style={s.avatarInitial}>{item.sender?.username?.[0]?.toUpperCase()}</Text>}
      </View>
      <View style={s.audioWrap}>
        <AudioMessage uri={item.mediaUrl} isMe={false} duration={item.audioDuration ?? 0} />
      </View>
      <View style={s.meta}>
        <Text style={s.sender}>{item.sender?.username}</Text>
        <Text style={s.date}>{fmtDate(item.createdAt)}</Text>
      </View>
    </View>
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
            <Text style={s.headerTitle}>Audios</Text>
            <Text style={s.headerSub}>{otherUsername}</Text>
          </View>
        </View>
      </SafeAreaView>

      {loading ? (
        <ActivityIndicator color={colors.c1} style={{ marginTop: 60 }} />
      ) : audios.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="mic-outline" size={48} color={colors.textDim} />
          <Text style={s.emptyTxt}>Sin audios aún</Text>
        </View>
      ) : (
        <FlatList
          data={audios}
          keyExtractor={i => i._id.toString()}
          renderItem={renderItem}
          onEndReached={() => { if (hasMore && !loadMore) fetchAudios(page + 1); }}
          onEndReachedThreshold={0.4}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16, paddingTop: 8 }}
          ListFooterComponent={loadMore ? <ActivityIndicator color={colors.c1} style={{ marginVertical: 16 }} /> : null}
          ItemSeparatorComponent={() => <View style={s.separator} />}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: colors.black },
  header:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn:       { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerTitle:   { color: colors.textHi, fontWeight: '700', fontSize: 15 },
  headerSub:     { color: colors.textDim, fontSize: 11, marginTop: 1 },

  row:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  avatarWrap:    { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.deep, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatar:        { width: 38, height: 38, borderRadius: 19 },
  avatarInitial: { color: colors.c1, fontWeight: '700', fontSize: 15 },
  audioWrap:     { flex: 1, backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  meta:          { alignItems: 'flex-end', gap: 2, minWidth: 60 },
  sender:        { color: colors.textMid, fontSize: 11, fontWeight: '600' },
  date:          { color: colors.textDim, fontSize: 10 },
  separator:     { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },
  empty:         { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTxt:      { color: colors.textDim, fontSize: 14 },
});
