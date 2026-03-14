import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  SafeAreaView, ScrollView, TextInput, Image, Alert,
  ActivityIndicator, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import api from '../services/api';

const ROLE_COLORS = {
  admin: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)', text: '#ef4444', label: 'ADMIN' },
  mod:   { bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.4)', text: 'rgba(251,191,36,1)', label: 'MOD' },
  user:  { bg: 'rgba(255,255,255,0.04)', border: colors.border, text: colors.textDim, label: 'USER' },
};

export default function ModPanelScreen({ navigation, route }) {
  const { currentUser } = route.params || {};
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [banModal, setBanModal]   = useState(null); // user object
  const [banReason, setBanReason] = useState('');
  const [acting, setActing]       = useState(false);

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers(q = '') {
    setLoading(true);
    try {
      const { data } = await api.get(`/users/mod/users${q ? `?q=${q}` : ''}`);
      setUsers(data.users || []);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo cargar');
    } finally {
      setLoading(false);
    }
  }

  async function handleBan(user) {
    if (!banReason.trim()) return Alert.alert('Error', 'Escribe un motivo');
    setActing(true);
    try {
      await api.post(`/users/mod/ban/${user._id}`, { reason: banReason });
      setBanModal(null);
      setBanReason('');
      loadUsers(search);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo banear');
    } finally {
      setActing(false);
    }
  }

  async function handleUnban(userId) {
    Alert.alert('Desbanear', '¿Seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desbanear', onPress: async () => {
        try {
          await api.post(`/users/mod/unban/${userId}`);
          loadUsers(search);
        } catch (err) {
          Alert.alert('Error', err.response?.data?.error || 'Error');
        }
      }},
    ]);
  }

  async function handleSetRole(userId, role) {
    Alert.alert('Cambiar rol', `¿Asignar rol "${role}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', onPress: async () => {
        try {
          await api.post(`/users/mod/setrole/${userId}`, { role });
          loadUsers(search);
        } catch (err) {
          Alert.alert('Error', err.response?.data?.error || 'Error');
        }
      }},
    ]);
  }

  const stats = {
    total:  users.length,
    banned: users.filter(u => u.banned).length,
    mods:   users.filter(u => u.role === 'mod' || u.role === 'admin').length,
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color="rgba(239,68,68,0.8)" />
          </TouchableOpacity>
          <View>
            <Text style={s.headerTitle}>PANEL MOD</Text>
            <Text style={s.headerSub}>@{currentUser?.username}</Text>
          </View>
          <View style={s.modBadge}>
            <Ionicons name="shield-checkmark" size={16} color="rgba(251,191,36,1)" />
          </View>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statVal}>{stats.total}</Text>
            <Text style={s.statLbl}>USUARIOS</Text>
          </View>
          <View style={[s.statCard, { borderColor: 'rgba(239,68,68,0.3)' }]}>
            <Text style={[s.statVal, { color: 'rgba(239,68,68,0.8)' }]}>{stats.banned}</Text>
            <Text style={s.statLbl}>BANEADOS</Text>
          </View>
          <View style={[s.statCard, { borderColor: 'rgba(251,191,36,0.3)' }]}>
            <Text style={[s.statVal, { color: 'rgba(251,191,36,1)' }]}>{stats.mods}</Text>
            <Text style={s.statLbl}>MODS</Text>
          </View>
        </View>

        {/* Buscador */}
        <View style={s.searchRow}>
          <Ionicons name="search" size={16} color={colors.textDim} />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={v => { setSearch(v); loadUsers(v); }}
            placeholder="Buscar usuario..."
            placeholderTextColor={colors.textDim}
          />
          {search ? <TouchableOpacity onPress={() => { setSearch(''); loadUsers(''); }}>
            <Ionicons name="close" size={16} color={colors.textDim} />
          </TouchableOpacity> : null}
        </View>

        {/* Lista usuarios */}
        {loading ? (
          <ActivityIndicator color={colors.c1} style={{ marginTop: 40 }} />
        ) : users.map(u => {
          const role = ROLE_COLORS[u.role] || ROLE_COLORS.user;
          return (
            <View key={u._id} style={[s.userRow, u.banned && s.userRowBanned]}>
              {/* Avatar */}
              <View style={s.userAv}>
                {u.avatarUrl
                  ? <Image source={{ uri: u.avatarUrl }} style={{ width: '100%', height: '100%', borderRadius: 20 }} />
                  : <Text style={s.userAvTxt}>{u.username?.[0]?.toUpperCase()}</Text>}
              </View>

              {/* Info */}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[s.userName, u.banned && { color: colors.textDim, textDecorationLine: 'line-through' }]}>
                    @{u.username}
                  </Text>
                  <View style={[s.roleBadge, { backgroundColor: role.bg, borderColor: role.border }]}>
                    <Text style={[s.roleBadgeTxt, { color: role.text }]}>{role.label}</Text>
                  </View>
                  {u.banned && (
                    <View style={s.bannedBadge}>
                      <Text style={s.bannedBadgeTxt}>BANEADO</Text>
                    </View>
                  )}
                </View>
                <Text style={s.userEmail}>{u.email}</Text>
                {u.banned && u.bannedReason ? (
                  <Text style={s.banReason}>↳ {u.bannedReason}</Text>
                ) : null}
              </View>

              {/* Acciones */}
              <View style={s.actions}>
                {u.role !== 'admin' && !(u.role === 'mod' && currentUser?.role !== 'admin') && (
                  u.banned ? (
                    <TouchableOpacity style={s.actionBtn} onPress={() => handleUnban(u._id)}>
                      <Ionicons name="checkmark-circle-outline" size={20} color={colors.c1} />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={s.actionBtn} onPress={() => { setBanModal(u); setBanReason(''); }}>
                      <Ionicons name="ban-outline" size={20} color="rgba(239,68,68,0.7)" />
                    </TouchableOpacity>
                  )
                )}
                {currentUser?.role === 'admin' && u.role !== 'admin' && (
                  <TouchableOpacity style={s.actionBtn} onPress={() =>
                    handleSetRole(u._id, u.role === 'mod' ? 'user' : 'mod')}>
                    <Ionicons
                      name={u.role === 'mod' ? 'shield-outline' : 'shield-checkmark-outline'}
                      size={20}
                      color="rgba(251,191,36,0.8)"
                    />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={s.actionBtn}
                  onPress={() => navigation.navigate('PublicProfile', { username: u.username })}>
                  <Ionicons name="person-outline" size={20} color={colors.textDim} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal banear */}
      <Modal visible={!!banModal} transparent animationType="fade" onRequestClose={() => setBanModal(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>BANEAR USUARIO</Text>
            <Text style={s.modalUser}>@{banModal?.username}</Text>
            <TextInput
              style={s.modalInput}
              value={banReason}
              onChangeText={setBanReason}
              placeholder="Motivo del ban..."
              placeholderTextColor={colors.textDim}
              autoFocus
            />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setBanModal(null)}>
                <Text style={s.cancelBtnTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.banBtn} onPress={() => handleBan(banModal)} disabled={acting}>
                {acting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.banBtnTxt}>Banear</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: colors.black },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(239,68,68,0.2)' },
  backBtn:    { width: 40 },
  headerTitle:{ fontSize: 13, fontWeight: '900', letterSpacing: 5, color: 'rgba(239,68,68,0.9)' },
  headerSub:  { fontSize: 10, color: colors.textDim, marginTop: 1 },
  modBadge:   { marginLeft: 'auto', width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(251,191,36,0.1)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)', alignItems: 'center', justifyContent: 'center' },

  statsRow:  { flexDirection: 'row', gap: 10, margin: 16 },
  statCard:  { flex: 1, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, alignItems: 'center' },
  statVal:   { color: colors.textHi, fontSize: 22, fontWeight: '800' },
  statLbl:   { color: colors.textDim, fontSize: 8, letterSpacing: 2, marginTop: 3 },

  searchRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 12, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput:{ flex: 1, color: colors.textHi, fontSize: 14 },

  userRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  userRowBanned: { backgroundColor: 'rgba(239,68,68,0.04)' },
  userAv:        { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.deep, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  userAvTxt:     { color: colors.c1, fontWeight: '700' },
  userName:      { color: colors.textHi, fontWeight: '600', fontSize: 13 },
  userEmail:     { color: colors.textDim, fontSize: 11, marginTop: 2 },
  banReason:     { color: 'rgba(239,68,68,0.6)', fontSize: 10, marginTop: 2 },

  roleBadge:    { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1 },
  roleBadgeTxt: { fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  bannedBadge:  { backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  bannedBadgeTxt:{ color: 'rgba(239,68,68,0.8)', fontSize: 8, fontWeight: '800', letterSpacing: 1 },

  actions:   { flexDirection: 'row', gap: 4 },
  actionBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
  modalBox:     { backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', padding: 24, width: '88%' },
  modalTitle:   { fontSize: 12, letterSpacing: 4, color: 'rgba(239,68,68,0.9)', fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  modalUser:    { color: colors.textDim, fontSize: 13, textAlign: 'center', marginBottom: 16 },
  modalInput:   { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, color: colors.textHi, fontSize: 14, marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 10 },
  cancelBtn:    { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingVertical: 12, alignItems: 'center' },
  cancelBtnTxt: { color: colors.textDim, fontSize: 14 },
  banBtn:       { flex: 1, backgroundColor: 'rgba(239,68,68,0.8)', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  banBtnTxt:    { color: '#fff', fontWeight: '800', fontSize: 14 },
});
