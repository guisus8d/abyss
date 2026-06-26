import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Image, ScrollView, StatusBar, ActivityIndicator,
  Alert, Modal, FlatList, Dimensions, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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
  const [editImage,   setEditImage]   = useState(null);
  const [editHashtags, setEditHashtags] = useState(
    (initialGroup.hashtags || []).map((tag, i) => ({
      tag,
      color: ['#2979ff', '#f472b6', '#facc15', '#22d3ee', '#4ade80', '#f97316'][i % 6],
    }))
  );
  const [newHashtag,  setNewHashtag]  = useState('');
  const [saving,      setSaving]      = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showAdd,     setShowAdd]     = useState(false);
  const [contacts,    setContacts]    = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [addSelected, setAddSelected] = useState([]);
  const [adding,      setAdding]      = useState(false);
  const [showTransfer,   setShowTransfer]   = useState(false);
  const [transferSent,   setTransferSent]   = useState(false);
  const [transferring,   setTransferring]   = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteText,     setDeleteText]     = useState('');
  const [deleting,       setDeleting]       = useState(false);
  const [showBanned,     setShowBanned]     = useState(false);
  const [bannedUsers,    setBannedUsers]    = useState([]);
  const [loadingBanned,  setLoadingBanned]  = useState(false);
  const [savingBg,       setSavingBg]       = useState(false);

  // Circle-specific state
  const [rules,        setRules]        = useState(initialGroup.rules || []);
  const [editRules,    setEditRules]    = useState(initialGroup.rules || []);
  const [editingRules, setEditingRules] = useState(false);
  const [savingRules,  setSavingRules]  = useState(false);
  const [toggling,     setToggling]     = useState(false);
  const [settingRole,  setSettingRole]  = useState(null);

  const isAdmin = group?.members?.some(
    m => (m.user?._id || m.user)?.toString() === user?._id?.toString() && m.role === 'admin'
  );
  const isCoAdmin = group?.members?.some(
    m => (m.user?._id || m.user)?.toString() === user?._id?.toString() && m.role === 'co-admin'
  );
  const canManage = isAdmin || isCoAdmin;

  useEffect(() => {
    api.get(`/groups/${group._id}`)
      .then(({ data }) => {
        setGroup(data.group);
        setRules(data.group.rules || []);
        setEditHashtags(
          (data.group.hashtags || []).map((tag, i) => ({
            tag,
            color: ['#2979ff', '#f472b6', '#facc15', '#22d3ee', '#4ade80', '#f97316'][i % 6],
          }))
        );
      })
      .catch(() => {});
  }, []);

  // ── Imagen ────────────────────────────────────────────────────────────────
  async function pickEditImage() {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85,
    });
    if (!r.canceled) setEditImage(r.assets[0].uri);
  }

  // ── Guardar edición general ───────────────────────────────────────────────
  async function saveEdit() {
    if (!editName.trim()) return Alert.alert('Falta nombre', 'El grupo debe tener un nombre');
    setSaving(true);
    try {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      const token = await AsyncStorage.getItem('token');
      const formData = new FormData();
      formData.append('name', editName.trim());
      formData.append('description', editDesc.trim());
      if (group.isCircle) {
        if (editHashtags.length < 2) {
          Alert.alert('Hashtags insuficientes', 'La fiesta debe tener al menos 2 hashtags.');
          setSaving(false);
          return;
        }
        formData.append('hashtags', JSON.stringify(editHashtags.map(h => h.tag)));
      }
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
      setGroup(prev => ({ ...prev, ...data.group }));
      setEditing(false);
      setEditImage(null);
    } catch (err) {
      Alert.alert('Error', err.message || 'No se pudo guardar');
    } finally { setSaving(false); }
  }

  // ── Toggle active ─────────────────────────────────────────────────────────
  async function toggleActive() {
    setToggling(true);
    try {
      const { data } = await api.patch(`/groups/circles/${group._id}/toggle-active`);
      setGroup(prev => ({ ...prev, isActive: data.group.isActive, activatedAt: data.group.activatedAt }));
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo cambiar el estado');
    } finally { setToggling(false); }
  }

  // ── Reglas ────────────────────────────────────────────────────────────────
  function addRule() {
    if (editRules.length >= 10) return;
    setEditRules(prev => [...prev, '']);
  }

  function removeRule(idx) {
    setEditRules(prev => prev.filter((_, i) => i !== idx));
  }

  function updateRule(idx, text) {
    setEditRules(prev => prev.map((r, i) => i === idx ? text : r));
  }

  async function saveRules() {
    setSavingRules(true);
    try {
      const { data } = await api.patch(`/groups/circles/${group._id}/rules`, {
        rules: editRules.map(r => r.trim()).filter(Boolean),
      });
      setRules(data.rules);
      setEditRules(data.rules);
      setEditingRules(false);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo guardar las reglas');
    } finally { setSavingRules(false); }
  }

  // ── Hashtags ──────────────────────────────────────────────────────────────
  const HASHTAG_COLORS = ['#2979ff', '#f472b6', '#facc15', '#22d3ee', '#4ade80', '#f97316'];
  const hashtagColorRef = useRef(0);

  function getNextHashtagColor() {
    const color = HASHTAG_COLORS[hashtagColorRef.current % HASHTAG_COLORS.length];
    hashtagColorRef.current += 1;
    return color;
  }

  function addHashtag() {
    const clean = newHashtag.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!clean || editHashtags.some(h => h.tag === clean) || editHashtags.length >= 5) return;
    setEditHashtags(prev => [...prev, { tag: clean, color: getNextHashtagColor() }]);
    setNewHashtag('');
  }

  function removeHashtag(tag) {
    setEditHashtags(prev => prev.filter(h => h.tag !== tag));
  }

  // ── Co-admin ──────────────────────────────────────────────────────────────
  async function toggleCoAdmin(memberId, currentRole) {
    const newRole = currentRole === 'co-admin' ? 'member' : 'co-admin';
    const label   = newRole === 'co-admin' ? 'Asignar co-admin' : 'Quitar co-admin';
    Alert.alert(label, `¿${label} a este miembro?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', onPress: async () => {
        setSettingRole(memberId);
        try {
          await api.patch(`/groups/circles/${group._id}/set-role`, { memberId, role: newRole });
          setGroup(prev => ({
            ...prev,
            members: prev.members.map(m =>
              (m.user?._id || m.user)?.toString() === memberId ? { ...m, role: newRole } : m
            ),
          }));
        } catch (err) {
          Alert.alert('Error', err.response?.data?.error || 'No se pudo cambiar el rol');
        } finally { setSettingRole(null); }
      }},
    ]);
  }

  // ── Agregar miembros ──────────────────────────────────────────────────────
  async function openAddMembers() {
    setShowAdd(true);
    setLoadingContacts(true);
    try {
      const { data } = await api.get('/users/me');
      const me = data.user;
      const currentIds = new Set(group.members.map(m => (m.user?._id || m.user)?.toString()));
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
      const contactMap = Object.fromEntries(contacts.map(c => [c._id, c]));
      const patchedMembers = (data.group.members || []).map(m => {
        const uid = (m.user?._id || m.user)?.toString();
        return m.user?.username ? m : { ...m, user: contactMap[uid] || m.user };
      });
      setGroup(prev => ({ ...prev, ...data.group, members: patchedMembers }));
      setShowAdd(false);
      setAddSelected([]);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo agregar');
    } finally { setAdding(false); }
  }

  // ── Expulsar ──────────────────────────────────────────────────────────────
  async function kickMember(memberId, username) {
    Alert.alert('Expulsar', `¿Expulsar a ${username}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Expulsar', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/groups/${group._id}/members/${memberId}`);
          setGroup(prev => ({
            ...prev,
            members: prev.members.filter(m => (m.user?._id || m.user)?.toString() !== memberId),
          }));
        } catch (err) {
          Alert.alert('Error', err.response?.data?.error || 'No se pudo expulsar');
        }
      }},
    ]);
  }

  // ── Salir ─────────────────────────────────────────────────────────────────
  async function leaveGroup() {
    const label = group.isCircle ? 'Salir de la fiesta' : 'Salir del grupo';
    Alert.alert(label, '¿Seguro que quieres salir?', [
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

  // ── Ceder admin ───────────────────────────────────────────────────────────
  async function transferAdmin(memberId) {
    setTransferring(true);
    try {
      await api.post(`/groups/${group._id}/transfer-admin`, { newAdminId: memberId });
      setTransferSent(true);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo enviar la solicitud');
    } finally { setTransferring(false); }
  }

  // ── Baneados ──────────────────────────────────────────────────────────────
  async function openBanned() {
    setShowBanned(true);
    setLoadingBanned(true);
    try {
      const { data } = await api.get(`/groups/${group._id}/banned`);
      setBannedUsers(data.bannedUsers || []);
    } catch { setBannedUsers([]); }
    finally { setLoadingBanned(false); }
  }

  async function unbanUser(userId, username) {
    Alert.alert('Desbanear', `¿Desbanear a ${username}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desbanear', onPress: async () => {
        try {
          await api.delete(`/groups/${group._id}/ban/${userId}`);
          setBannedUsers(prev => prev.filter(u => u._id !== userId));
        } catch (err) {
          Alert.alert('Error', err.response?.data?.error || 'No se pudo desbanear');
        }
      }},
    ]);
  }

  // ── Fondo del grupo ───────────────────────────────────────────────────────
  async function pickGroupBackground() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galeria'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [9, 16], quality: 0.85,
    });
    if (result.canceled) return;
    setSavingBg(true);
    try {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      const token = await AsyncStorage.getItem('token');
      const uri = result.assets[0].uri;
      const formData = new FormData();
      formData.append('file', { uri, type: 'image/jpeg', name: 'group-bg.jpg' });
      const res = await fetch(`${BASE_URL}/groups/${group._id}/background`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al subir');
      setGroup(prev => ({ ...prev, backgroundUrl: data.backgroundUrl }));
    } catch (err) {
      Alert.alert('Error', err.message || 'No se pudo cambiar el fondo');
    } finally { setSavingBg(false); }
  }

  async function applyGroupBgPreset(preset) {
    setSavingBg(true);
    try {
      const { data } = await api.patch(`/groups/${group._id}/background`, { preset });
      setGroup(prev => ({ ...prev, backgroundUrl: data.backgroundUrl }));
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo cambiar el fondo');
    } finally { setSavingBg(false); }
  }

  // ── Eliminar ──────────────────────────────────────────────────────────────
  async function deleteGroup() {
    if (deleteText.trim() !== 'ELIMINAR') {
      Alert.alert('Texto incorrecto', 'Escribe exactamente ELIMINAR para confirmar');
      return;
    }
    setDeleting(true);
    try {
      await api.delete(`/groups/${group._id}`);
      setShowDeleteConfirm(false);
      navigation.navigate('Chats');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo eliminar');
    } finally { setDeleting(false); }
  }

  // ── Modales compartidos ───────────────────────────────────────────────────
  const sharedModals = (
    <>
      {/* Ceder administracion */}
      <Modal visible={showTransfer} animationType="slide" onRequestClose={() => { setShowTransfer(false); setTransferSent(false); }}>
        <View style={[s.root, { paddingTop: insets.top }]}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>CEDER ADMINISTRACION</Text>
            <TouchableOpacity onPress={() => { setShowTransfer(false); setTransferSent(false); }} style={s.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textHi} />
            </TouchableOpacity>
          </View>
          {transferSent ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
              <Ionicons name="checkmark-circle-outline" size={56} color={colors.c1} />
              <Text style={[s.memberName, { textAlign: 'center', marginTop: 16, fontSize: 16 }]}>Solicitud enviada</Text>
              <Text style={[s.emptyTxt, { marginTop: 8, textAlign: 'center' }]}>
                El miembro debe aceptar la solicitud para convertirse en administrador.
              </Text>
            </View>
          ) : (
            <FlatList
              style={{ backgroundColor: colors.black }}
              data={group.members?.filter(m => (m.user?._id || m.user)?.toString() !== user?._id?.toString())}
              keyExtractor={(m, i) => String(m.user?._id || m.user || i)}
              contentContainerStyle={{ padding: 16, gap: 12 }}
              ListEmptyComponent={<Text style={s.emptyTxt}>No hay otros miembros</Text>}
              renderItem={({ item: m }) => {
                const memberId  = (m.user?._id || m.user)?.toString();
                const memberUser = typeof m.user === 'object' ? m.user : null;
                return (
                  <TouchableOpacity
                    style={s.memberRow}
                    disabled={transferring}
                    onPress={() => Alert.alert(
                      'Ceder administracion',
                      `¿Ceder la administracion a ${memberUser?.username}? Deberas esperar su confirmacion.`,
                      [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Enviar solicitud', onPress: () => transferAdmin(memberId) },
                      ]
                    )}>
                    <AvatarWithFrame size={40} avatarUrl={memberUser?.avatarUrl} username={memberUser?.username || '?'}
                      profileFrame={memberUser?.profileFrame} frameUrl={memberUser?.profileFrameUrl} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={s.memberName}>{memberUser?.username || 'Usuario'}</Text>
                      {m.role !== 'member' && (
                        <View style={m.role === 'admin' ? s.adminBadge : s.coAdminBadge}>
                          <Text style={m.role === 'admin' ? s.adminBadgeTxt : s.coAdminBadgeTxt}>
                            {m.role === 'admin' ? 'Admin' : 'Co-admin'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </Modal>

      {/* Confirmar eliminar */}
      <Modal visible={showDeleteConfirm} animationType="fade" transparent statusBarTranslucent onRequestClose={() => setShowDeleteConfirm(false)}>
        <View style={s.deleteOverlay}>
          <View style={s.deleteModal}>
            <Ionicons name="warning-outline" size={40} color="rgba(239,68,68,0.8)" style={{ marginBottom: 12 }} />
            <Text style={s.deleteModalTitle}>Eliminar {group.isCircle ? 'fiesta' : 'grupo'}</Text>
            <Text style={s.deleteModalDesc}>
              Esta accion no se puede deshacer. Todos los mensajes e historial se perderan permanentemente.
            </Text>
            <Text style={s.deleteModalLabel}>
              Escribe <Text style={{ color: 'rgba(239,68,68,0.9)', fontWeight: '800' }}>ELIMINAR</Text> para confirmar
            </Text>
            <TextInput
              style={s.deleteInput}
              value={deleteText}
              onChangeText={setDeleteText}
              placeholder="ELIMINAR"
              placeholderTextColor={colors.textDim}
              autoCapitalize="characters"
            />
            <View style={s.deleteActions}>
              <TouchableOpacity style={s.deleteCancelBtn} onPress={() => { setShowDeleteConfirm(false); setDeleteText(''); }}>
                <Text style={s.deleteCancelTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.deleteConfirmBtn, deleteText.trim() !== 'ELIMINAR' && { opacity: 0.4 }]}
                onPress={deleteGroup}
                disabled={deleting || deleteText.trim() !== 'ELIMINAR'}>
                {deleting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.deleteConfirmTxt}>Eliminar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Baneados */}
      <Modal visible={showBanned} animationType="slide" onRequestClose={() => setShowBanned(false)}>
        <View style={[s.root, { paddingTop: insets.top }]}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>MIEMBROS BANEADOS</Text>
            <TouchableOpacity onPress={() => setShowBanned(false)} style={s.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textHi} />
            </TouchableOpacity>
          </View>
          {loadingBanned
            ? <ActivityIndicator color={colors.c1} style={{ marginTop: 40 }} />
            : bannedUsers.length === 0
              ? <Text style={s.emptyTxt}>No hay usuarios baneados</Text>
              : <FlatList
                  style={{ backgroundColor: colors.black }}
                  data={bannedUsers}
                  keyExtractor={u => u._id}
                  contentContainerStyle={{ padding: 16, gap: 12 }}
                  renderItem={({ item: u }) => (
                    <View style={s.memberRow}>
                      <AvatarWithFrame size={40} avatarUrl={u.avatarUrl} username={u.username}
                        profileFrame={u.profileFrame} frameUrl={u.profileFrameUrl} />
                      <Text style={[s.memberName, { flex: 1, marginLeft: 12 }]}>{u.username}</Text>
                      <TouchableOpacity
                        onPress={() => unbanUser(u._id, u.username)}
                        style={s.unbanBtn}>
                        <Text style={s.unbanTxt}>Desbanear</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                />
          }
        </View>
      </Modal>
    </>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: FIESTA (isCircle)
  // ════════════════════════════════════════════════════════════════════════════
  if (group.isCircle) {
    const currentImage = editImage || group.imageUrl;
    const memberCount  = group.members?.length || 0;

    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" />
        {sharedModals}

        {/* Agregar miembros */}
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
                    style={{ backgroundColor: colors.black }}
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
                  : <Text style={s.addConfirmTxt}>Agregar {addSelected.length > 0 ? `(${addSelected.length})` : ''}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Header */}
        <SafeAreaView>
          <View style={s.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
              <Ionicons name="arrow-back" size={20} color={colors.textHi} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>AJUSTES DE LA FIESTA</Text>
            <View style={{ width: 36 }} />
          </View>
        </SafeAreaView>

        <ScrollView style={{ backgroundColor: colors.black }} showsVerticalScrollIndicator={false} contentContainerStyle={cs.scroll}>

          {/* Hero */}
          <View style={cs.hero}>
            {currentImage
              ? <Image source={{ uri: currentImage }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]} />}
            <LinearGradient
              colors={['rgba(0,0,0,0.7)', 'transparent']}
              style={[StyleSheet.absoluteFill, { height: '50%' }]}
            />
            <LinearGradient
              colors={['rgba(0,0,0,0.8)', 'transparent']}
              start={{ x: 0, y: 1 }} end={{ x: 0, y: 0 }}
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' }}
            />

            <View style={cs.heroContent}>
              <View style={[cs.activeBadge, !group.isActive && cs.inactiveBadge]}>
                <Text style={[cs.activeBadgeTxt, !group.isActive && cs.inactiveBadgeTxt]}>
                  {group.isActive ? 'ACTIVA' : 'APAGADA'}
                </Text>
              </View>
              <Text style={cs.heroTitle} numberOfLines={2}>{group.name}</Text>
            </View>

            {/* Editar imagen */}
            {canManage && (
              <TouchableOpacity style={cs.editImgBtn} onPress={pickEditImage}>
                <Ionicons name="camera-outline" size={17} color="#fff" />
              </TouchableOpacity>
            )}

            {/* Toggle activa */}
            {canManage && (
              <TouchableOpacity
                style={[cs.toggleBtn, group.isActive ? cs.toggleBtnOn : cs.toggleBtnOff]}
                onPress={toggleActive}
                disabled={toggling}>
                {toggling
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons
                      name="power"
                      size={20}
                      color={group.isActive ? 'rgba(239,68,68,0.9)' : 'rgba(0,229,204,0.9)'}
                    />}
              </TouchableOpacity>
            )}
          </View>

          {/* ── SECCION: GENERAL ─────────────────────────────────────────── */}
          <Text style={cs.sectionLabel}>GENERAL</Text>
          <View style={s.card}>
            {canManage && editing ? (
              <View style={{ padding: 16, gap: 12 }}>
                <TextInput
                  style={cs.fieldInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Nombre de la fiesta"
                  placeholderTextColor={colors.textDim}
                  maxLength={60}
                />
                <TextInput
                  style={[cs.fieldInput, { minHeight: 72, textAlignVertical: 'top' }]}
                  value={editDesc}
                  onChangeText={setEditDesc}
                  placeholder="Descripcion (opcional)"
                  placeholderTextColor={colors.textDim}
                  multiline
                  maxLength={200}
                />

                {/* Hashtags */}
                <View style={cs.hashtagsWrap}>
                  {editHashtags.map(({ tag, color }) => (
                    <TouchableOpacity
                      key={tag}
                      style={[cs.hashtagPillEdit, { borderColor: color + '55', backgroundColor: color + '18' }]}
                      onPress={() => removeHashtag(tag)}>
                      <Text style={[cs.hashtagPillEditTxt, { color }]}>#{tag}</Text>
                      <Ionicons name="close" size={11} color={color} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  ))}
                  {editHashtags.length < 5 && (
                    <View style={cs.hashtagAddRow}>
                      <TextInput
                        style={cs.hashtagInput}
                        value={newHashtag}
                        onChangeText={t => setNewHashtag(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        placeholder="hashtag"
                        placeholderTextColor={colors.textDim}
                        maxLength={20}
                        onSubmitEditing={addHashtag}
                        returnKeyType="done"
                      />
                      <TouchableOpacity
                        onPress={addHashtag}
                        disabled={editHashtags.length >= 5}
                        style={[cs.hashtagAddBtn, editHashtags.length >= 5 && { opacity: 0.35 }]}>
                        <Ionicons name="add" size={16} color={colors.c1} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={cs.cancelBtn}
                    onPress={() => {
                      setEditing(false);
                      setEditImage(null);
                      setEditName(group.name);
                      setEditDesc(group.description || '');
                      setEditHashtags(
                        (group.hashtags || []).map((tag, i) => ({
                          tag,
                          color: ['#2979ff', '#f472b6', '#facc15', '#22d3ee', '#4ade80', '#f97316'][i % 6],
                        }))
                      );
                    }}>
                    <Text style={cs.cancelBtnTxt}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[cs.saveBtn, { flex: 2 }]} onPress={saveEdit} disabled={saving}>
                    {saving
                      ? <ActivityIndicator size="small" color={colors.black} />
                      : <Text style={cs.saveBtnTxt}>Guardar</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View>
                <View style={cs.fieldReadRow}>
                  <Text style={cs.fieldLabel}>Nombre</Text>
                  <Text style={cs.fieldValue}>{group.name}</Text>
                </View>
                <View style={[cs.fieldReadRow, cs.fieldRowBorder]}>
                  <Text style={cs.fieldLabel}>Descripcion</Text>
                  <Text style={cs.fieldValue}>{group.description || '—'}</Text>
                </View>
                <View style={[cs.fieldReadRow, cs.fieldRowBorder]}>
                  <Text style={cs.fieldLabel}>Hashtags</Text>
                  {group.hashtags?.length > 0
                    ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1, justifyContent: 'flex-end' }}>
                        {group.hashtags.map((t, i) => {
                          const c = ['#2979ff', '#f472b6', '#facc15', '#22d3ee', '#4ade80', '#f97316'][i % 6];
                          return (
                            <View key={t} style={[cs.hashtagPill, { borderColor: c + '55', backgroundColor: c + '18' }]}>
                              <Text style={[cs.hashtagPillTxt, { color: c }]}>#{t}</Text>
                            </View>
                          );
                        })}
                      </View>
                    : <Text style={cs.fieldValue}>—</Text>}
                </View>
                {canManage && (
                  <TouchableOpacity
                    style={cs.editSectionBtn}
                    onPress={() => setEditing(true)}>
                    <Text style={cs.editSectionBtnTxt}>Editar</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* ── SECCION: REGLAS ──────────────────────────────────────────── */}
          <Text style={cs.sectionLabel}>REGLAS</Text>
          <View style={s.card}>
            {editingRules && canManage ? (
              <View style={{ padding: 16, gap: 10 }}>
                {editRules.map((rule, i) => (
                  <View key={i} style={cs.ruleEditRow}>
                    <Text style={cs.ruleNum}>{i + 1}.</Text>
                    <TextInput
                      style={cs.ruleInput}
                      value={rule}
                      onChangeText={t => updateRule(i, t)}
                      placeholder="Escribe la regla..."
                      placeholderTextColor={colors.textDim}
                      maxLength={200}
                    />
                    <TouchableOpacity onPress={() => removeRule(i)} style={{ padding: 4 }}>
                      <Ionicons name="close-circle" size={20} color="rgba(239,68,68,0.7)" />
                    </TouchableOpacity>
                  </View>
                ))}
                {editRules.length < 10 && (
                  <TouchableOpacity style={cs.addRuleBtn} onPress={addRule}>
                    <Ionicons name="add-circle-outline" size={16} color={colors.c1} />
                    <Text style={cs.addRuleTxt}>Agregar regla</Text>
                  </TouchableOpacity>
                )}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  <TouchableOpacity
                    style={cs.cancelBtn}
                    onPress={() => { setEditingRules(false); setEditRules([...rules]); }}>
                    <Text style={cs.cancelBtnTxt}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[cs.saveBtn, { flex: 2 }]} onPress={saveRules} disabled={savingRules}>
                    {savingRules
                      ? <ActivityIndicator size="small" color={colors.black} />
                      : <Text style={cs.saveBtnTxt}>Guardar</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View>
                {rules.length === 0 ? (
                  <Text style={[s.emptyTxt, { margin: 16 }]}>
                    {canManage ? 'Sin reglas. Agrega hasta 10.' : 'Sin reglas definidas.'}
                  </Text>
                ) : (
                  rules.map((rule, i) => (
                    <View key={i} style={[cs.ruleReadRow, i > 0 && cs.fieldRowBorder]}>
                      <Text style={cs.ruleNum}>{i + 1}.</Text>
                      <Text style={cs.ruleTxt}>{rule}</Text>
                    </View>
                  ))
                )}
                {canManage && (
                  <TouchableOpacity
                    style={cs.editSectionBtn}
                    onPress={() => { setEditRules([...rules]); setEditingRules(true); }}>
                    <Text style={cs.editSectionBtnTxt}>Editar reglas</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* ── SECCION: MIEMBROS ─────────────────────────────────────────── */}
          <Text style={cs.sectionLabel}>MIEMBROS ({memberCount})</Text>
          <View style={s.card}>
            {group.members?.map((m, i) => {
              const memberId  = (m.user?._id || m.user)?.toString();
              const isMe      = memberId === user?._id?.toString();
              const memberUser = typeof m.user === 'object' ? m.user : null;
              const canKickThis = canManage && !isMe && m.role !== 'admin' &&
                                  !(m.role === 'co-admin' && !isAdmin);
              return (
                <View key={memberId || i} style={[cs.memberInlineRow, i > 0 && cs.fieldRowBorder]}>
                  <AvatarWithFrame
                    size={38}
                    avatarUrl={memberUser?.avatarUrl}
                    username={memberUser?.username || '?'}
                    profileFrame={memberUser?.profileFrame}
                    frameUrl={memberUser?.profileFrameUrl}
                  />
                  <View style={{ flex: 1, marginLeft: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={s.memberName} numberOfLines={1}>{memberUser?.username || 'Usuario'}</Text>
                    {m.role !== 'member' && (
                      <View style={m.role === 'admin' ? s.adminBadge : s.coAdminBadge}>
                        <Text style={m.role === 'admin' ? s.adminBadgeTxt : s.coAdminBadgeTxt}>
                          {m.role === 'admin' ? 'Admin' : 'Co-admin'}
                        </Text>
                      </View>
                    )}
                  </View>
                  {isAdmin && !isMe && m.role !== 'admin' && (
                    <TouchableOpacity
                      style={cs.coAdminBtn}
                      onPress={() => toggleCoAdmin(memberId, m.role)}
                      disabled={settingRole === memberId}>
                      {settingRole === memberId
                        ? <ActivityIndicator size="small" color={colors.c1} />
                        : <Text style={cs.coAdminBtnTxt}>
                            {m.role === 'co-admin' ? 'Quitar' : 'Co-admin'}
                          </Text>}
                    </TouchableOpacity>
                  )}
                  {canKickThis && (
                    <TouchableOpacity
                      style={{ padding: 6, marginLeft: 4 }}
                      onPress={() => kickMember(memberId, memberUser?.username)}>
                      <Ionicons name="remove-circle-outline" size={20} color="rgba(239,68,68,0.75)" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
            {canManage && (
              <TouchableOpacity style={cs.editSectionBtn} onPress={openAddMembers}>
                <Ionicons name="person-add-outline" size={14} color={colors.c1} style={{ marginRight: 6 }} />
                <Text style={cs.editSectionBtnTxt}>Agregar miembro</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── FONDO DEL GRUPO ───────────────────────────────────────────── */}
          {canManage && (
            <>
              <Text style={cs.sectionLabel}>FONDO</Text>
              <View style={s.card}>
                <View style={s.cardHeader}>
                  <Text style={s.cardLabel}>FONDO DE LA FIESTA</Text>
                  {savingBg && <ActivityIndicator size="small" color={colors.c1} />}
                </View>
                {group.backgroundUrl?.startsWith('http') && (
                  <Image source={{ uri: group.backgroundUrl }} style={{ width: '100%', height: 80, marginBottom: 2 }} resizeMode="cover" />
                )}
                <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 12 }}>
                  {[
                    { id: 'night',  color: '#020D1A' },
                    { id: 'void',   color: '#050505' },
                    { id: 'purple', color: '#0D0714' },
                    { id: 'teal',   color: '#030F10' },
                  ].map(p => (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => applyGroupBgPreset(p.id)}
                      disabled={savingBg}
                      style={[
                        { width: 36, height: 36, borderRadius: 10, backgroundColor: p.color, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
                        group.backgroundUrl === p.id ? { borderColor: colors.c1 } : { borderColor: 'rgba(255,255,255,0.12)' },
                      ]}>
                      {group.backgroundUrl === p.id && <Ionicons name="checkmark" size={16} color={colors.c1} />}
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 16 }}>
                  <TouchableOpacity
                    onPress={pickGroupBackground}
                    disabled={savingBg}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(0,229,204,0.08)', borderWidth: 1, borderColor: 'rgba(0,229,204,0.25)', alignItems: 'center' }}>
                    <Text style={{ color: colors.c1, fontSize: 13, fontWeight: '600' }}>
                      {savingBg ? 'Subiendo...' : 'Fondo propio'}
                    </Text>
                  </TouchableOpacity>
                  {!!group.backgroundUrl && (
                    <TouchableOpacity
                      onPress={() => applyGroupBgPreset(null)}
                      disabled={savingBg}
                      style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.07)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', alignItems: 'center' }}>
                      <Text style={{ color: 'rgba(239,68,68,0.8)', fontSize: 13, fontWeight: '600' }}>Quitar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </>
          )}

          {/* ── ZONA DE PELIGRO (solo admin) ──────────────────────────────── */}
          {isAdmin && (
            <>
              <Text style={[cs.sectionLabel, { color: 'rgba(239,68,68,0.55)' }]}>ZONA DE PELIGRO</Text>
              <View style={s.card}>
                <TouchableOpacity style={[cs.dangerRow]} onPress={openBanned}>
                  <Text style={cs.dangerRowTxt}>Miembros baneados</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={s.cardAction}>{group.bannedUsers?.length || 0}</Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.c1} />
                  </View>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={s.transferBtn}
                onPress={() => { setTransferSent(false); setShowTransfer(true); }}>
                <Text style={s.transferBtnTxt}>Ceder administracion</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.deleteBtn}
                onPress={() => Alert.alert(
                  '¿Eliminar fiesta?',
                  '¿Estas seguro? Esta accion no se puede deshacer.',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Continuar', style: 'destructive', onPress: () => { setDeleteText(''); setShowDeleteConfirm(true); } },
                  ]
                )}>
                <Text style={s.deleteBtnTxt}>Eliminar fiesta</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Salir */}
          <TouchableOpacity style={[s.leaveBtn, { marginTop: 8 }]} onPress={leaveGroup}>
            <Text style={s.leaveBtnTxt}>Salir de la fiesta</Text>
          </TouchableOpacity>

          <View style={{ height: 48 }} />
        </ScrollView>
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: GRUPO NORMAL (existente)
  // ════════════════════════════════════════════════════════════════════════════
  const previewMembers = group.members?.slice(0, 5) || [];
  const extraCount = Math.max(0, (group.members?.length || 0) - 5);
  const currentImage = editImage || group.imageUrl;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      {sharedModals}

      {/* Modal lista completa de miembros */}
      <Modal visible={showMembers} animationType="slide" onRequestClose={() => setShowMembers(false)}>
        <View style={[s.root, { paddingTop: insets.top }]}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>MIEMBROS ({group.members?.length || 0})</Text>
            <TouchableOpacity onPress={() => setShowMembers(false)} style={s.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textHi} />
            </TouchableOpacity>
          </View>
          <FlatList
            style={{ backgroundColor: colors.black }}
            data={group.members}
            keyExtractor={(m, i) => String(m.user?._id || m.user || i)}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            renderItem={({ item: m }) => {
              const memberId = (m.user?._id || m.user)?.toString();
              const isMe = memberId === user?._id?.toString();
              const memberUser = typeof m.user === 'object' ? m.user : null;
              return (
                <View style={s.memberRow}>
                  <AvatarWithFrame size={40} avatarUrl={memberUser?.avatarUrl} username={memberUser?.username || '?'}
                    profileFrame={memberUser?.profileFrame} frameUrl={memberUser?.profileFrameUrl} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.memberName}>{memberUser?.username || 'Usuario'}</Text>
                    {m.role === 'admin' && (
                      <View style={s.adminBadge}><Text style={s.adminBadgeTxt}>Admin</Text></View>
                    )}
                  </View>
                  {isAdmin && !isMe && m.role !== 'admin' && (
                    <TouchableOpacity style={s.kickBtn} onPress={() => kickMember(memberId, memberUser?.username)}>
                      <Ionicons name="remove-circle-outline" size={20} color="rgba(239,68,68,0.8)" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            }}
          />
        </View>
      </Modal>

      {/* Modal agregar miembros */}
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
                  style={{ backgroundColor: colors.black }}
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
                : <Text style={s.addConfirmTxt}>Agregar {addSelected.length > 0 ? `(${addSelected.length})` : ''}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.textHi} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>AJUSTES DEL GRUPO</Text>
          {isAdmin && !editing && (
            <TouchableOpacity onPress={() => setEditing(true)} style={s.editHeaderBtn}>
              <Ionicons name="pencil" size={16} color={colors.c1} />
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

      <ScrollView style={{ backgroundColor: colors.black }} showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Imagen y nombre */}
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
              <View style={s.avatarEditBadge}><Ionicons name="camera" size={14} color="#fff" /></View>
            )}
          </TouchableOpacity>
          {editing ? (
            <>
              <TextInput style={s.editNameInput} value={editName} onChangeText={setEditName}
                placeholder="Nombre del grupo" placeholderTextColor={colors.textDim} maxLength={60} />
              <TextInput style={s.editDescInput} value={editDesc} onChangeText={setEditDesc}
                placeholder="Descripcion (opcional)" placeholderTextColor={colors.textDim} multiline maxLength={200} />
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

        {/* Miembros preview */}
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
                  <AvatarWithFrame size={46} avatarUrl={memberUser?.avatarUrl} username={memberUser?.username || '?'}
                    profileFrame={memberUser?.profileFrame} frameUrl={memberUser?.profileFrameUrl} />
                  <Text style={s.memberPreviewName} numberOfLines={1}>{memberUser?.username || '?'}</Text>
                </View>
              );
            })}
            {extraCount > 0 && (
              <TouchableOpacity style={s.memberPreviewItem} onPress={() => setShowMembers(true)}>
                <View style={s.extraBubble}><Text style={s.extraBubbleTxt}>+{extraCount}</Text></View>
                <Text style={s.memberPreviewName}>mas</Text>
              </TouchableOpacity>
            )}
            {isAdmin && (
              <TouchableOpacity style={s.memberPreviewItem} onPress={openAddMembers}>
                <View style={s.addBubble}><Ionicons name="add" size={24} color={colors.c1} /></View>
                <Text style={s.memberPreviewName}>Agregar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Info del grupo */}
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

        {/* Fotos */}
        <TouchableOpacity
          style={s.card}
          onPress={() => navigation.navigate('ChatPhotos', { groupId: group._id.toString(), otherUsername: group.name })}
          activeOpacity={0.7}>
          <View style={[s.cardHeader, { paddingVertical: 14 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="images-outline" size={16} color={colors.textDim} />
              <Text style={s.cardLabel}>FOTOS DEL GRUPO</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={colors.c1} />
          </View>
        </TouchableOpacity>

        {/* Fondo del grupo */}
        {isAdmin && (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="image-outline" size={16} color={colors.textDim} />
                <Text style={s.cardLabel}>FONDO DEL GRUPO</Text>
              </View>
              {savingBg && <ActivityIndicator size="small" color={colors.c1} />}
            </View>
            {group.backgroundUrl?.startsWith('http') && (
              <Image source={{ uri: group.backgroundUrl }} style={{ width: '100%', height: 80, marginBottom: 2 }} resizeMode="cover" />
            )}
            <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 12 }}>
              {[
                { id: 'night', color: '#020D1A' }, { id: 'void', color: '#050505' },
                { id: 'purple', color: '#0D0714' }, { id: 'teal', color: '#030F10' },
              ].map(p => (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => applyGroupBgPreset(p.id)}
                  disabled={savingBg}
                  style={[
                    { width: 36, height: 36, borderRadius: 10, backgroundColor: p.color, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
                    group.backgroundUrl === p.id ? { borderColor: colors.c1 } : { borderColor: 'rgba(255,255,255,0.12)' },
                  ]}>
                  {group.backgroundUrl === p.id && <Ionicons name="checkmark" size={16} color={colors.c1} />}
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 16 }}>
              <TouchableOpacity
                onPress={pickGroupBackground}
                disabled={savingBg}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(0,229,204,0.08)', borderWidth: 1, borderColor: 'rgba(0,229,204,0.25)', alignItems: 'center' }}>
                <Text style={{ color: colors.c1, fontSize: 13, fontWeight: '600' }}>
                  {savingBg ? 'Subiendo...' : 'Fondo propio'}
                </Text>
              </TouchableOpacity>
              {!!group.backgroundUrl && (
                <TouchableOpacity
                  onPress={() => applyGroupBgPreset(null)}
                  disabled={savingBg}
                  style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.07)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', alignItems: 'center' }}>
                  <Text style={{ color: 'rgba(239,68,68,0.8)', fontSize: 13, fontWeight: '600' }}>Quitar</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Acciones admin */}
        {isAdmin && (
          <>
            <TouchableOpacity style={s.card} onPress={openBanned}>
              <View style={[s.cardHeader, { paddingVertical: 14 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="ban-outline" size={16} color={colors.textDim} />
                  <Text style={s.cardLabel}>MIEMBROS BANEADOS</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.cardAction}>{group.bannedUsers?.length || 0}</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.c1} />
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={s.transferBtn} onPress={() => { setTransferSent(false); setShowTransfer(true); }}>
              <Text style={s.transferBtnTxt}>Ceder administracion</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.deleteBtn}
              onPress={() => Alert.alert(
                '¿Eliminar grupo?',
                '¿Estas seguro? Esta accion no se puede deshacer.',
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Continuar', style: 'destructive', onPress: () => { setDeleteText(''); setShowDeleteConfirm(true); } },
                ]
              )}>
              <Ionicons name="trash-outline" size={18} color="rgba(239,68,68,0.9)" />
              <Text style={s.deleteBtnTxt}>Eliminar grupo</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={s.leaveBtn} onPress={leaveGroup}>
          <Ionicons name="exit-outline" size={18} color="rgba(239,68,68,0.8)" />
          <Text style={s.leaveBtnTxt}>Salir del grupo</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ── Estilos compartidos ──────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: colors.black },
  header:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn:       { padding: 4, marginRight: 12 },
  headerTitle:   { flex: 1, color: colors.textHi, fontSize: 12, fontWeight: '800', letterSpacing: 2.5 },
  editHeaderBtn: { padding: 7, borderRadius: 10, backgroundColor: 'rgba(0,229,204,0.1)', borderWidth: 1, borderColor: 'rgba(0,229,204,0.2)' },
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
  coAdminBadge:      { marginTop: 3, backgroundColor: 'rgba(0,229,204,0.1)', borderRadius: 4, borderWidth: 1, borderColor: 'rgba(0,229,204,0.35)', paddingHorizontal: 5, paddingVertical: 1, alignSelf: 'flex-start' },
  coAdminBadgeTxt:   { color: colors.c1, fontSize: 8, fontWeight: '800', letterSpacing: 0.3 },
  kickBtn:           { padding: 6 },

  infoRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  infoTxt:  { color: colors.textMid, fontSize: 13 },

  leaveBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
  leaveBtnTxt: { color: 'rgba(239,68,68,0.8)', fontSize: 14, fontWeight: '600' },

  transferBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, backgroundColor: 'rgba(0,229,204,0.06)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(0,229,204,0.2)' },
  transferBtnTxt: { color: colors.c1, fontSize: 14, fontWeight: '600' },

  deleteBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, backgroundColor: 'rgba(239,68,68,0.06)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)' },
  deleteBtnTxt: { color: 'rgba(239,68,68,0.9)', fontSize: 14, fontWeight: '600' },

  deleteOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  deleteModal:   { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 24, width: '100%', alignItems: 'center' },
  deleteModalTitle: { color: colors.textHi, fontSize: 18, fontWeight: '800', marginBottom: 10 },
  deleteModalDesc:  { color: colors.textDim, fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: 18 },
  deleteModalLabel: { color: colors.textMid, fontSize: 13, marginBottom: 10, textAlign: 'center' },
  deleteInput:      { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, color: colors.textHi, fontSize: 15, width: '100%', textAlign: 'center', letterSpacing: 2, marginBottom: 18 },
  deleteActions:    { flexDirection: 'row', gap: 12, width: '100%' },
  deleteCancelBtn:  { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  deleteCancelTxt:  { color: colors.textDim, fontSize: 14, fontWeight: '600' },
  deleteConfirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)', alignItems: 'center' },
  deleteConfirmTxt: { color: 'rgba(239,68,68,0.9)', fontSize: 14, fontWeight: '700' },

  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle:  { color: colors.textHi, fontSize: 12, fontWeight: '800', letterSpacing: 2.5 },
  closeBtn:    { padding: 4 },
  emptyTxt:    { color: colors.textDim, fontSize: 13, textAlign: 'center', marginTop: 40 },

  checkbox:    { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.textDim, alignItems: 'center', justifyContent: 'center' },
  checkboxSel: { backgroundColor: colors.c1, borderColor: colors.c1 },

  addConfirmRow: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  addConfirmBtn: { backgroundColor: colors.c1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  addConfirmTxt: { color: colors.black, fontSize: 15, fontWeight: '800' },

  unbanBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: 'rgba(0,229,204,0.1)', borderWidth: 1, borderColor: 'rgba(0,229,204,0.3)' },
  unbanTxt:  { color: colors.c1, fontSize: 12, fontWeight: '700' },
});

// ── Estilos exclusivos del layout isCircle ───────────────────────────────────
const cs = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingTop: 0, gap: 12, paddingBottom: 16 },

  hero: { width: '100%', height: 200, marginBottom: 8, position: 'relative', justifyContent: 'flex-end' },
  heroContent: { padding: 14, gap: 6 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: 0.2 },

  activeBadge:    { alignSelf: 'flex-start', backgroundColor: 'rgba(0,229,204,0.2)', borderRadius: 6, borderWidth: 1, borderColor: 'rgba(0,229,204,0.5)', paddingHorizontal: 8, paddingVertical: 3 },
  inactiveBadge:  { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' },
  activeBadgeTxt: { color: colors.c1, fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  inactiveBadgeTxt: { color: colors.textMid },

  editImgBtn: { position: 'absolute', top: 12, right: 12, width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },

  toggleBtn:    { position: 'absolute', bottom: 14, right: 14, width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  toggleBtnOn:  { backgroundColor: 'rgba(239,68,68,0.18)', borderColor: 'rgba(239,68,68,0.45)' },
  toggleBtnOff: { backgroundColor: 'rgba(0,229,204,0.12)', borderColor: 'rgba(0,229,204,0.4)' },

  sectionLabel: { color: colors.textDim, fontSize: 9, fontWeight: '800', letterSpacing: 3, marginBottom: -4, marginLeft: 4 },

  fieldReadRow:  { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 13, justifyContent: 'space-between', gap: 12 },
  fieldRowBorder:{ borderTopWidth: 1, borderTopColor: colors.border },
  fieldLabel:    { color: colors.textDim, fontSize: 12, fontWeight: '600', minWidth: 90 },
  fieldValue:    { color: colors.textHi, fontSize: 13, flex: 1, textAlign: 'right' },

  fieldInput:  { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderC, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: colors.textHi, fontSize: 14 },

  hashtagsWrap:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  hashtagPill:    { backgroundColor: 'rgba(0,229,204,0.08)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,229,204,0.25)', paddingHorizontal: 8, paddingVertical: 4 },
  hashtagPillTxt: { color: colors.c1, fontSize: 11, fontWeight: '600' },
  hashtagPillEdit:{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,229,204,0.1)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,229,204,0.35)', paddingHorizontal: 8, paddingVertical: 4 },
  hashtagPillEditTxt: { color: colors.c1, fontSize: 11, fontWeight: '600' },
  hashtagAddRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hashtagInput:   { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, color: colors.textHi, fontSize: 12, minWidth: 80 },
  hashtagAddBtn:  { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(0,229,204,0.1)', borderWidth: 1, borderColor: 'rgba(0,229,204,0.3)', alignItems: 'center', justifyContent: 'center' },

  saveBtn:    { flex: 1, backgroundColor: colors.c1, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  saveBtnTxt: { color: colors.black, fontSize: 14, fontWeight: '800' },
  cancelBtn:  { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  cancelBtnTxt: { color: colors.textDim, fontSize: 14, fontWeight: '600' },

  editSectionBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderTopWidth: 1, borderTopColor: colors.border },
  editSectionBtnTxt: { color: colors.c1, fontSize: 12, fontWeight: '700' },

  ruleEditRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ruleReadRow:  { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  ruleNum:      { color: colors.textDim, fontSize: 12, fontWeight: '700', minWidth: 20 },
  ruleInput:    { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: colors.textHi, fontSize: 13 },
  ruleTxt:      { color: colors.textMid, fontSize: 13, flex: 1, lineHeight: 19 },
  addRuleBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  addRuleTxt:   { color: colors.c1, fontSize: 13, fontWeight: '600' },

  memberInlineRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  coAdminBtn:      { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(0,229,204,0.08)', borderWidth: 1, borderColor: 'rgba(0,229,204,0.25)', marginLeft: 6 },
  coAdminBtnTxt:   { color: colors.c1, fontSize: 10, fontWeight: '700' },

  dangerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  dangerRowTxt: { color: colors.textMid, fontSize: 13, fontWeight: '600' },
});
