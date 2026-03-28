import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, ScrollView, Alert, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

const SECTIONS = [
  {
    title: 'CUENTA',
    items: [
      { key: 'username',  label: 'Cambiar nombre de usuario', icon: 'person-outline',       soon: false },
      { key: 'email',     label: 'Verificar correo',          icon: 'mail-outline',          soon: true  },
      { key: 'password',  label: 'Cambiar contraseña',        icon: 'lock-closed-outline',   soon: true  },
      { key: 'google',    label: 'Vincular cuenta Google',    icon: 'logo-google',           soon: true  },
    ],
  },
  {
    title: 'PRIVACIDAD',
    items: [
      { key: 'blocked',   label: 'Usuarios bloqueados',       icon: 'ban-outline',           soon: true  },
      { key: 'data',      label: 'Mis datos',                 icon: 'document-text-outline', soon: true  },
    ],
  },
  {
    title: 'NOTIFICACIONES',
    items: [
      { key: 'notifs',    label: 'Preferencias de notifs',    icon: 'notifications-outline', soon: true  },
    ],
  },
  {
    title: 'SOPORTE',
    items: [
      { key: 'report',    label: 'Reportar un problema',      icon: 'bug-outline',           soon: true  },
      { key: 'terms',     label: 'Términos de uso',           icon: 'shield-outline',        soon: true  },
    ],
  },
  {
    title: 'ZONA DE PELIGRO',
    items: [
      { key: 'delete',    label: 'Eliminar cuenta',           icon: 'trash-outline',         soon: false, danger: true },
    ],
  },
];

export default function SettingsScreen({ navigation }) {
  const { user, logout } = useAuthStore();
  const [usernameModal, setUsernameModal] = useState(false);
  const [deleteModal, setDeleteModal]     = useState(false);
  const [newUsername, setNewUsername]     = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [saving, setSaving]               = useState(false);
  const [deleting, setDeleting]           = useState(false);

  async function handleChangeUsername() {
    if (!newUsername.trim() || newUsername.trim().length < 3) {
      return Alert.alert('Error', 'El username debe tener al menos 3 caracteres');
    }
    setSaving(true);
    try {
      await api.patch('/users/me/profile', { username: newUsername.trim() });
      Alert.alert('✅', 'Username actualizado');
      setUsernameModal(false);
      setNewUsername('');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo actualizar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== 'ELIMINAR') {
      return Alert.alert('Error', 'Escribe ELIMINAR para confirmar');
    }
    setDeleting(true);
    try {
      await api.delete('/users/me');
      logout();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo eliminar la cuenta');
      setDeleting(false);
    }
  }

  function handleItem(key, soon) {
    if (soon) {
      Alert.alert('Próximamente', 'Esta función estará disponible pronto.');
      return;
    }
    if (key === 'username') setUsernameModal(true);
    if (key === 'delete')   setDeleteModal(true);
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.c1} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>AJUSTES</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Info usuario */}
        <View style={s.userCard}>
          <View style={s.userAv}>
            <Text style={s.userAvTxt}>{user?.username?.[0]?.toUpperCase()}</Text>
          </View>
          <View>
            <Text style={s.userCardName}>{user?.username}</Text>
            <Text style={s.userCardEmail}>{user?.email}</Text>
          </View>
        </View>

        {SECTIONS.map(section => (
          <View key={section.title} style={s.section}>
            <Text style={s.sectionTitle}>{section.title}</Text>
            <View style={s.sectionGroup}>
              {section.items.map((item, i) => (
                <TouchableOpacity
                  key={item.key}
                  style={[s.row, i > 0 && s.rowBorder]}
                  onPress={() => handleItem(item.key, item.soon)}
                >
                  <View style={[s.rowIcon, item.danger && s.rowIconDanger]}>
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color={item.danger ? 'rgba(239,68,68,0.8)' : colors.textMid}
                    />
                  </View>
                  <Text style={[s.rowTxt, item.danger && s.rowTxtDanger]}>
                    {item.label}
                  </Text>
                  {item.soon
                    ? <View style={s.soonBadge}><Text style={s.soonTxt}>PRONTO</Text></View>
                    : <Ionicons name="chevron-forward" size={16} color={item.danger ? 'rgba(239,68,68,0.4)' : colors.textDim} />
                  }
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <Text style={s.version}>Abyss v0.1.0-mvp</Text>
      </ScrollView>

      {/* ── Modal: Cambiar username ── */}
      <Modal visible={usernameModal} transparent animationType="fade" onRequestClose={() => setUsernameModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>CAMBIAR USERNAME</Text>
            <Text style={s.modalHint}>Actual: @{user?.username}</Text>
            <TextInput
              style={s.modalInput}
              value={newUsername}
              onChangeText={setNewUsername}
              placeholder="Nuevo username..."
              placeholderTextColor={colors.textDim}
              autoFocus
              autoCapitalize="none"
              maxLength={30}
            />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => { setUsernameModal(false); setNewUsername(''); }}>
                <Text style={s.cancelBtnTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmBtn} onPress={handleChangeUsername} disabled={saving}>
                <LinearGradient colors={['#006b63','#00e5cc']} style={s.confirmBtnGrad} start={{x:0,y:0}} end={{x:1,y:0}}>
                  {saving ? <ActivityIndicator size="small" color="#001a18" /> : <Text style={s.confirmBtnTxt}>Guardar</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal: Eliminar cuenta ── */}
      <Modal visible={deleteModal} transparent animationType="fade" onRequestClose={() => setDeleteModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.deleteIcon}>
              <Ionicons name="warning-outline" size={32} color="rgba(239,68,68,0.8)" />
            </View>
            <Text style={[s.modalTitle, { color: 'rgba(239,68,68,0.9)' }]}>ELIMINAR CUENTA</Text>
            <Text style={s.deleteWarning}>
              Esta acción es permanente. Se eliminarán todos tus posts, comentarios, seguidores y datos. No se puede deshacer.
            </Text>
            <Text style={s.deleteHint}>Escribe <Text style={{ color: 'rgba(239,68,68,0.9)', fontWeight: '700' }}>ELIMINAR</Text> para confirmar:</Text>
            <TextInput
              style={[s.modalInput, { borderColor: 'rgba(239,68,68,0.3)' }]}
              value={deleteConfirm}
              onChangeText={setDeleteConfirm}
              placeholder="ELIMINAR"
              placeholderTextColor={colors.textDim}
              autoCapitalize="characters"
            />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => { setDeleteModal(false); setDeleteConfirm(''); }}>
                <Text style={s.cancelBtnTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.deleteBtn, deleteConfirm !== 'ELIMINAR' && s.deleteBtnDisabled]}
                onPress={handleDeleteAccount}
                disabled={deleting || deleteConfirm !== 'ELIMINAR'}
              >
                {deleting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.deleteBtnTxt}>Eliminar</Text>}
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
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn:    { width: 40 },
  headerTitle:{ fontSize: 13, fontWeight: '900', letterSpacing: 5, color: colors.c1 },

  userCard:     { flexDirection: 'row', alignItems: 'center', gap: 14, margin: 16, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 },
  userAv:       { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.deep, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderC },
  userAvTxt:    { color: colors.c1, fontWeight: '900', fontSize: 20 },
  userCardName: { color: colors.textHi, fontWeight: '700', fontSize: 15 },
  userCardEmail:{ color: colors.textDim, fontSize: 12, marginTop: 2 },

  section:      { marginHorizontal: 16, marginBottom: 20 },
  sectionTitle: { color: colors.textDim, fontSize: 9, letterSpacing: 3, marginBottom: 8 },
  sectionGroup: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  rowBorder:    { borderTopWidth: 1, borderTopColor: colors.border },
  rowIcon:      { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' },
  rowIconDanger:{ backgroundColor: 'rgba(239,68,68,0.08)' },
  rowTxt:       { flex: 1, color: colors.textMid, fontSize: 14 },
  rowTxtDanger: { color: 'rgba(239,68,68,0.8)' },
  soonBadge:    { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  soonTxt:      { color: colors.textDim, fontSize: 9, letterSpacing: 1 },

  version:      { color: colors.textDim, fontSize: 10, textAlign: 'center', marginTop: 8, opacity: 0.4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
  modalBox:     { backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 24, width: '88%' },
  modalTitle:   { fontSize: 12, letterSpacing: 4, color: colors.c1, fontWeight: '900', textAlign: 'center', marginBottom: 12 },
  modalHint:    { color: colors.textDim, fontSize: 12, textAlign: 'center', marginBottom: 16 },
  modalInput:   { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, color: colors.textHi, fontSize: 14, marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 10 },
  cancelBtn:    { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingVertical: 12, alignItems: 'center' },
  cancelBtnTxt: { color: colors.textDim, fontSize: 14 },
  confirmBtn:   { flex: 1, borderRadius: 12, overflow: 'hidden' },
  confirmBtnGrad:{ paddingVertical: 13, alignItems: 'center' },
  confirmBtnTxt:{ color: '#001a18', fontWeight: '800', fontSize: 14 },

  deleteIcon:       { alignItems: 'center', marginBottom: 12 },
  deleteWarning:    { color: colors.textDim, fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 16 },
  deleteHint:       { color: colors.textMid, fontSize: 13, marginBottom: 10 },
  deleteBtn:        { flex: 1, backgroundColor: 'rgba(239,68,68,0.8)', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  deleteBtnDisabled:{ backgroundColor: 'rgba(239,68,68,0.2)' },
  deleteBtnTxt:     { color: '#fff', fontWeight: '800', fontSize: 14 },
});
