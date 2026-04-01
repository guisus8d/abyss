import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Image, ScrollView, StatusBar, ActivityIndicator,
  Alert, Modal, FlatList, Dimensions, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import AvatarWithFrame from '../components/AvatarWithFrame';

const W = Dimensions.get('window').width;
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://abyss-production-7171.up.railway.app/api';

export default function GroupSettingsScreen({ route, navigation }) {
  const { group: initialGroup } = route.params;
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [group,       setGroup]       = useState(initialGroup);
  const [editing,     setEditing]     = useState(false);
  const [editName,    setEditName]    = useState(initialGroup.name);
  const [editDesc,    setEditDesc]    = useState(initialGroup.description || '');
  const [editImage,   setEditImage]   = useState(null); // nuevo uri local
  const [saving,      setSaving]      = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showAdd,     setShowAdd]     = useState(false);
  const [contacts,    setContacts]    = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [addSelected, setAddSelected] = useState([]);
  const [adding,      setAdding]      = useState(false);

  const isAdmin = group?.members?.some(
    m => (m.user?._id || m.user)?.toString() === user?._id?.toString() && m.role === 'admin'
  );

  // Recargar grupo fresco
  useEffect(() => {
    api.get(`/groups/${group._id}`)
      .then(({ data }) => setGroup(data.group))
      .catch(() => {});
  }, []);

  // ── Editar ────────────────────────────────────────────────────────────────
  async function pickEditImage() {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85,
    });
    if (!r.canceled) setEditImage(r.assets[0].uri);
  }

  async function saveEdit() {
    if (!editName.trim()) return Alert.alert('Falta nombre', 'El grupo debe tener un nombre');
    setSaving(true);
    try {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      const token = await AsyncStorage.getItem('token');
      const formData = new FormData();
      formData.append('name', editName.trim());
      formData.append('description', editDesc.trim());
      if (editImage) {
        if (Platform.OS === 'web') {
          const blob = await fetch(editImage).then(r => r.blob());
          formData.append('image', blob, 'group.jpg');
        } else {
          formData.append('image', { uri: editImage, type: 'image/jpeg', name: 'group.jpg' });
        }
      }
      const res = await fetch(`${BASE_URL}/groups/${group._id}`, {
        method: 'PATCH',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');
      const updated = { ...group, ...data.group };
      setGroup(updated);

      setEditing(false);
      setEditImage(null);
    } catch (err) {
      Alert.alert('Error', err.message || 'No se pudo guardar');
    } finally { setSaving(false); }
  }

  // ── Agregar miembros ──────────────────────────────────────────────────────
  async function openAddMembers() {
    setShowAdd(true);
    setLoadingContacts(true);
    try {
      const { data } = await api.get('/users/me');
      const me = data.user;
      const currentIds = new Set(
        group.members.map(m => (m.user?._id || m.user)?.toString())
      );
      const allMap = {};
      [...(me.followers || []), ...(me.following || [])].forEach(f => {
        const id = (f._id || f)?.toString();
        if (id && f.username && !currentIds.has(id)) allMap[id] = f;
      });
      const candidates = Object.values(allMap).slice(0, 30);
      if (candidates.length === 0) { setContacts([]); return; }
      const results = await Promise.all(
        candidates.map(f =>
          api.get(`/users/${f.username}`).then(r => r.data.user).catch(() => null)
        )
      );
      setContacts(results.filter(Boolean));
    } catch { setContacts([]); }
    finally { setLoadingContacts(false); }
  }

  async function confirmAddMembers() {
    if (!addSelected.length) return setShowAdd(false);
    setAdding(true);
    try {
      const { data } = await api.post(`/groups/${group._id}/add-members`, { memberIds: addSelected });
      const updated = { ...group, ...data.group };
      setGroup(updated);

      setShowAdd(false);
      setAddSelected([]);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo agregar');
    } finally { setAdding(false); }
  }

  // ── Expulsar miembro ──────────────────────────────────────────────────────
  async function kickMember(memberId, username) {
    Alert.alert('Expulsar', `¿Expulsar a ${username} del grupo?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Expulsar', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/groups/${group._id}/members/${memberId}`);
          const updated = {
            ...group,
            members: group.members.filter(m => (m.user?._id || m.user)?.toString() !== memberId),
          };
          setGroup(updated);
    
        } catch (err) {
          Alert.alert('Error', err.response?.data?.error || 'No se pudo expulsar');
        }
      }},
    ]);
  }

  // ── Salir del grupo ───────────────────────────────────────────────────────
  async function leaveGroup() {
    Alert.alert('Salir del grupo', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: async () => {
        try {
          await api.post(`/groups/${group._id}/leave`);
          navigation.popToTop();
        } catch (err) {
          Alert.alert('Error', err.response?.data?.error || 'No se pudo salir');
        }
      }},
    ]);
  }

  const previewMembers = group.members?.slice(0, 5) || [];
  const extraCount = Math.max(0, (group.members?.length || 0) - 5);
  const currentImage = editImage || group.imageUrl;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      {/* ── Modal lista completa de miembros ── */}
      <Modal visible={showMembers} animationType="slide" onRequestClose={() => setShowMembers(false)}>
        <View style={[s.root, { paddingTop: insets.top }]}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>MIEMBROS ({group.members?.length || 0})</Text>
            <TouchableOpacity onPress={() => setShowMembers(false)} style={s.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textHi} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={group.members}
            keyExtractor={(m, i) => String(m.user?._id || m.user || i)}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            renderItem={({ item: m }) => {
              const memberId = (m.user?._id || m.user)?.toString();
              const isMe = memberId === user?._id?.toString();
              const memberUser = typeof m.user === 'object' ? m.user : null;
              return (
                <View style={s.memberRow}>
                  <AvatarWithFrame
                    size={40}
                    avatarUrl={memberUser?.avatarUrl}
                    username={memberUser?.username || '?'}
                    profileFrame={memberUser?.profileFrame}
                    frameUrl={memberUser?.profileFrameUrl}
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.memberName}>{memberUser?.username || 'Usuario'}</Text>
                    {m.role === 'admin' && (
                      <View style={s.adminBadge}>
                        <Text style={s.adminBadgeTxt}>Admin</Text>
                      </View>
                    )}
                  </View>
                  {isAdmin && !isMe && m.role !== 'admin' && (
                    <TouchableOpacity
                      style={s.kickBtn}
                      onPress={() => kickMember(memberId, memberUser?.username)}>
                      <Ionicons name="remove-circle-outline" size={20} color="rgba(239,68,68,0.8)" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            }}
          />
        </View>
      </Modal>

      {/* ── Modal agregar miembros ── */}
      <Modal visible={showAdd} animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View style={[s.root, { paddingTop: insets.top }]}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>AGREGAR MIEMBROS</Text>
            <TouchableOpacity onPress={() => { setShowAdd(false); setAddSelected([]); }} style={s.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textHi} />
            </TouchableOpacity>
          </View>
          {loadingContacts
            ? <ActivityIndicator color={colors.c1} style={{ marginTop: 40 }} />
            : contacts.length === 0
              ? <Text style={s.emptyTxt}>No hay contactos para agregar</Text>
              : <FlatList
                  data={contacts}
                  keyExtractor={c => c._id}
                  contentContainerStyle={{ padding: 16, gap: 12 }}
                  renderItem={({ item: c }) => {
                    const sel = addSelected.includes(c._id);
                    return (
                      <TouchableOpacity
                        style={[s.memberRow, sel && s.memberRowSelected]}
                        onPress={() => setAddSelected(prev =>
                          sel ? prev.filter(id => id !== c._id) : [...prev, c._id]
                        )}>
                        <AvatarWithFrame size={40} avatarUrl={c.avatarUrl} username={c.username}
                          profileFrame={c.profileFrame} frameUrl={c.profileFrameUrl} />
                        <Text style={[s.memberName, { marginLeft: 12, flex: 1 }]}>{c.username}</Text>
                        <View style={[s.checkbox, sel && s.checkboxSel]}>
                          {sel && <Ionicons name="checkmark" size={14} color="#000" />}
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
          }
          <View style={[s.addConfirmRow, { paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity
              style={[s.addConfirmBtn, !addSelected.length && { opacity: 0.4 }]}
              onPress={confirmAddMembers}
              disabled={!addSelected.length || adding}>
              {adding
                ? <ActivityIndicator size="small" color="#000" />
                : <Text style={s.addConfirmTxt}>Agregar {addSelected.length > 0 ? `(${addSelected.length})` : ''}</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Header ── */}
      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.textHi} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>AJUSTES DEL GRUPO</Text>
          {isAdmin && !editing && (
            <TouchableOpacity onPress={() => setEditing(true)} style={s.editHeaderBtn}>
              <Ionicons name="pencil-outline" size={18} color={colors.c1} />
            </TouchableOpacity>
          )}
          {editing && (
            <TouchableOpacity onPress={saveEdit} disabled={saving} style={s.editHeaderBtn}>
              {saving
                ? <ActivityIndicator size="small" color={colors.c1} />
                : <Text style={s.saveHeaderTxt}>Guardar</Text>}
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Imagen y nombre ── */}
        <View style={s.heroSection}>
          <TouchableOpacity
            onPress={isAdmin && editing ? pickEditImage : undefined}
            activeOpacity={isAdmin && editing ? 0.7 : 1}
            style={s.avatarWrap}>
            {currentImage
              ? <Image source={{ uri: currentImage }} style={s.groupAvatar} />
              : <View style={s.groupAvatarPlaceholder}>
                  <Ionicons name="people" size={32} color={colors.c1} />
                </View>}
            {isAdmin && editing && (
              <View style={s.avatarEditBadge}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            )}
          </TouchableOpacity>

          {editing ? (
            <>
              <TextInput
                style={s.editNameInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Nombre del grupo"
                placeholderTextColor={colors.textDim}
                maxLength={60}
              />
              <TextInput
                style={s.editDescInput}
                value={editDesc}
                onChangeText={setEditDesc}
                placeholder="Descripción (opcional)"
                placeholderTextColor={colors.textDim}
                multiline
                maxLength={200}
              />
              <TouchableOpacity onPress={() => { setEditing(false); setEditImage(null); setEditName(group.name); setEditDesc(group.description || ''); }}>
                <Text style={s.cancelEditTxt}>Cancelar</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={s.groupName}>{group.name}</Text>
              {!!group.description && <Text style={s.groupDesc}>{group.description}</Text>}
            </>
          )}
        </View>

        {/* ── Miembros preview ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardLabel}>MIEMBROS</Text>
            <TouchableOpacity onPress={() => setShowMembers(true)}>
              <Text style={s.cardAction}>Ver todos</Text>
            </TouchableOpacity>
          </View>

          <View style={s.membersPreview}>
            {previewMembers.map((m, i) => {
              const memberUser = typeof m.user === 'object' ? m.user : null;
              return (
                <View key={i} style={s.memberPreviewItem}>
                  <AvatarWithFrame
                    size={46}
                    avatarUrl={memberUser?.avatarUrl}
                    username={memberUser?.username || '?'}
                    profileFrame={memberUser?.profileFrame}
                    frameUrl={memberUser?.profileFrameUrl}
                  />
                  <Text style={s.memberPreviewName} numberOfLines={1}>
                    {memberUser?.username || '?'}
                  </Text>
                </View>
              );
            })}
            {extraCount > 0 && (
              <TouchableOpacity style={s.memberPreviewItem} onPress={() => setShowMembers(true)}>
                <View style={s.extraBubble}>
                  <Text style={s.extraBubbleTxt}>+{extraCount}</Text>
                </View>
                <Text style={s.memberPreviewName}>más</Text>
              </TouchableOpacity>
            )}
            {/* Botón + agregar */}
            {isAdmin && (
              <TouchableOpacity style={s.memberPreviewItem} onPress={openAddMembers}>
                <View style={s.addBubble}>
                  <Ionicons name="add" size={24} color={colors.c1} />
                </View>
                <Text style={s.memberPreviewName}>Agregar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Info del grupo ── */}
        <View style={s.card}>
          <View style={s.infoRow}>
            <Ionicons name="people-outline" size={18} color={colors.textDim} />
            <Text style={s.infoTxt}>{group.members?.length || 0} miembros</Text>
          </View>
          <View style={[s.infoRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
            <Ionicons name="calendar-outline" size={18} color={colors.textDim} />
            <Text style={s.infoTxt}>
              Creado el {new Date(group.createdAt || Date.now()).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
          </View>
        </View>

        {/* ── Salir del grupo ── */}
        <TouchableOpacity style={s.leaveBtn} onPress={leaveGroup}>
          <Ionicons name="exit-outline" size={18} color="rgba(239,68,68,0.8)" />
          <Text style={s.leaveBtnTxt}>Salir del grupo</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: colors.black },
  header:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn:       { padding: 4, marginRight: 12 },
  headerTitle:   { flex: 1, color: colors.textHi, fontSize: 12, fontWeight: '800', letterSpacing: 2.5 },
  editHeaderBtn: { padding: 6 },
  saveHeaderTxt: { color: colors.c1, fontSize: 14, fontWeight: '700' },

  scroll: { paddingHorizontal: 16, paddingTop: 24, gap: 16 },

  heroSection:  { alignItems: 'center', gap: 12, paddingBottom: 8 },
  avatarWrap:   { position: 'relative' },
  groupAvatar:  { width: 90, height: 90, borderRadius: 20 },
  groupAvatarPlaceholder: { width: 90, height: 90, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderC, alignItems: 'center', justifyContent: 'center' },
  avatarEditBadge: { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.c1, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.black },
  groupName:    { color: colors.textHi, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  groupDesc:    { color: colors.textDim, fontSize: 13, textAlign: 'center', lineHeight: 18, maxWidth: W - 64 },
  editNameInput:{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderC, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, color: colors.textHi, fontSize: 16, fontWeight: '700', textAlign: 'center', width: W - 64 },
  editDescInput:{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, color: colors.textDim, fontSize: 13, textAlign: 'center', width: W - 64, minHeight: 60, marginTop: 4 },
  cancelEditTxt:{ color: 'rgba(239,68,68,0.7)', fontSize: 13, marginTop: 4 },

  card:       { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  cardLabel:  { color: colors.textDim, fontSize: 9, letterSpacing: 3, fontWeight: '800' },
  cardAction: { color: colors.c1, fontSize: 12, fontWeight: '600' },

  membersPreview:    { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingBottom: 16, gap: 12 },
  memberPreviewItem: { alignItems: 'center', gap: 5, width: 56 },
  memberPreviewName: { color: colors.textDim, fontSize: 10, textAlign: 'center' },
  extraBubble:       { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  extraBubbleTxt:    { color: colors.textMid, fontSize: 13, fontWeight: '700' },
  addBubble:         { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(0,229,204,0.1)', borderWidth: 1.5, borderColor: 'rgba(0,229,204,0.4)', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },

  memberRow:         { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, padding: 10 },
  memberRowSelected: { backgroundColor: 'rgba(0,229,204,0.07)', borderWidth: 1, borderColor: 'rgba(0,229,204,0.3)' },
  memberName:        { color: colors.textHi, fontSize: 14, fontWeight: '600' },
  adminBadge:        { marginTop: 3, backgroundColor: 'rgba(0,200,120,0.12)', borderRadius: 4, borderWidth: 1, borderColor: 'rgba(0,200,120,0.4)', paddingHorizontal: 5, paddingVertical: 1, alignSelf: 'flex-start' },
  adminBadgeTxt:     { color: 'rgba(0,220,130,1)', fontSize: 8, fontWeight: '800', letterSpacing: 0.3 },
  kickBtn:           { padding: 6 },

  infoRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  infoTxt:  { color: colors.textMid, fontSize: 13 },

  leaveBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
  leaveBtnTxt: { color: 'rgba(239,68,68,0.8)', fontSize: 14, fontWeight: '600' },

  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle:  { color: colors.textHi, fontSize: 12, fontWeight: '800', letterSpacing: 2.5 },
  closeBtn:    { padding: 4 },
  emptyTxt:    { color: colors.textDim, fontSize: 13, textAlign: 'center', marginTop: 40 },

  checkbox:    { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.textDim, alignItems: 'center', justifyContent: 'center' },
  checkboxSel: { backgroundColor: colors.c1, borderColor: colors.c1 },

  addConfirmRow: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  addConfirmBtn: { backgroundColor: colors.c1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  addConfirmTxt: { color: colors.black, fontSize: 15, fontWeight: '800' },
});
