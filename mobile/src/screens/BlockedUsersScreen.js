import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import api from '../services/api';
import AvatarWithFrame from '../components/AvatarWithFrame';

export default function BlockedUsersScreen({ navigation }) {
  const [blocked,   setBlocked]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [unblocking, setUnblocking] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/social/blocked');
      setBlocked(data.blocked || []);
    } catch { Alert.alert('Error', 'No se pudo cargar la lista'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleUnblock(user) {
    Alert.alert(
      `Desbloquear a ${user.username}`,
      '¿Quieres desbloquear a este usuario?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desbloquear',
          onPress: async () => {
            setUnblocking(user._id);
            try {
              await api.post(`/social/block/${user.username}`);
              setBlocked(prev => prev.filter(u => u._id !== user._id));
            } catch { Alert.alert('Error', 'No se pudo desbloquear'); }
            finally { setUnblocking(null); }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={colors.textHi} />
        </TouchableOpacity>
        <Text style={s.title}>Usuarios bloqueados</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.c1} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          style={{ backgroundColor: colors.black }}
          data={blocked}
          keyExtractor={u => u._id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20 }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="ban-outline" size={48} color={colors.textDim} />
              <Text style={s.emptyTxt}>No has bloqueado a nadie</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={s.row}>
              <AvatarWithFrame
                size={44}
                avatarUrl={item.avatarUrl}
                username={item.username}
                profileFrame={item.profileFrame}
                frameUrl={item.profileFrameUrl}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.username}>{item.username}</Text>
                <Text style={s.xp}>XP {item.xp || 0}</Text>
              </View>
              <TouchableOpacity
                style={s.unblockBtn}
                onPress={() => handleUnblock(item)}
                disabled={unblocking === item._id}
                activeOpacity={0.8}
              >
                {unblocking === item._id
                  ? <ActivityIndicator size="small" color={colors.textHi} />
                  : <Text style={s.unblockTxt}>Desbloquear</Text>}
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.black },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn:{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title:  { color: colors.textHi, fontSize: 16, fontWeight: '700' },

  row:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  username:   { color: colors.textHi, fontSize: 14, fontWeight: '600' },
  xp:         { color: colors.textDim, fontSize: 11, marginTop: 2 },
  unblockBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: colors.border, minWidth: 100, alignItems: 'center' },
  unblockTxt: { color: colors.textMid, fontSize: 12, fontWeight: '600' },

  empty:    { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTxt: { color: colors.textDim, fontSize: 14 },
});
