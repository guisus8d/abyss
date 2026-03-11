import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, StatusBar, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { colors } from '../theme/colors';
import api from '../services/api';
import AvatarWithFrame from '../components/AvatarWithFrame';

export default function FollowListScreen({ route, navigation }) {
  const { username, type } = route.params;
  const [list, setList]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/social/${type}/${username}`)
      .then(({ data }) => setList(data[type] || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.black} />
      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backTxt}>←</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>
            {type === 'followers' ? 'SEGUIDORES' : 'SIGUIENDO'}
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      {loading ? (
        <ActivityIndicator color={colors.c1} style={{ marginTop: 40 }} />
      ) : list.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTxt}>Sin {type === 'followers' ? 'seguidores' : 'seguidos'} aún</Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={u => u._id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.item}
              onPress={() => navigation.navigate('PublicProfile', { username: item.username })}
            >
              <AvatarWithFrame
                size={44}
                avatarUrl={item.avatarUrl}
                username={item.username}
                profileFrame={item.profileFrame}
                style={{ marginRight: 12 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={s.username}>@{item.username}</Text>
                <Text style={s.xp}>XP {item.xp || 0}</Text>
              </View>
              <Text style={s.arrow}>›</Text>
            </TouchableOpacity>
          )}
        />
      )}
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
  headerTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 6, color: colors.c1 },
  backBtn:     { padding: 8, width: 40 },
  backTxt:     { color: colors.c1, fontSize: 22 },
  item:        {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  username: { color: colors.textHi, fontWeight: '600', fontSize: 14 },
  xp:       { color: colors.textDim, fontSize: 11, marginTop: 2 },
  arrow:    { color: colors.textDim, fontSize: 20 },
  empty:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTxt: { color: colors.textDim, fontSize: 14 },
});
