import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, ScrollView, Image,
  Platform, Alert, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';
import api, { postFormData, BASE_URL } from '../services/api';

const BORDER_COLORS = [
  { label: 'Blanco',  value: '#ffffff' },
  { label: 'Teal',    value: colors.c1 },
  { label: 'Rosado',  value: colors.c3 },
  { label: 'Amarillo',value: '#facc15' },
  { label: 'Cyan',    value: colors.c5 },
  { label: 'Verde',   value: '#22c55e' },
  { label: 'Naranja', value: colors.c4 },
  { label: 'Morado',  value: '#a78bfa' },
];

export default function RoleManagerModal({ visible, onClose, groupId, roles, onChanged }) {
  const insets = useSafeAreaInsets();

  const [formOpen,     setFormOpen]     = useState(false);
  const [editingId,    setEditingId]    = useState(null);
  const [name,         setName]         = useState('');
  const [description,  setDescription]  = useState('');
  const [borderColor,  setBorderColor]  = useState(BORDER_COLORS[0].value);
  const [imageUri,     setImageUri]     = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [deletingId,   setDeletingId]   = useState(null);

  function resetForm() {
    setEditingId(null);
    setName('');
    setDescription('');
    setBorderColor(BORDER_COLORS[0].value);
    setImageUri(null);
  }

  function openCreate() {
    resetForm();
    setFormOpen(true);
  }

  function openEdit(role) {
    setEditingId(role._id);
    setName(role.name || '');
    setDescription(role.description || '');
    setBorderColor(role.borderColor || BORDER_COLORS[0].value);
    setImageUri(null);
    setFormOpen(true);
  }

  async function pickImage() {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85,
    });
    if (!r.canceled) setImageUri(r.assets[0].uri);
  }

  async function handleSubmit() {
    if (!name.trim()) return Alert.alert('Falta nombre', 'El personaje debe tener un nombre');
    if (!editingId && !imageUri) return Alert.alert('Falta imagen', 'Elige una foto para el personaje');
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('description', description.trim());
      formData.append('borderColor', borderColor);
      if (imageUri) {
        formData.append('image', { uri: imageUri, type: 'image/jpeg', name: 'role.jpg' });
      }

      if (editingId) {
        const token = await AsyncStorage.getItem('token');
        const res = await fetch(`${BASE_URL}/roles/${editingId}`, {
          method: 'PATCH',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al guardar');
      } else {
        await postFormData(`/roles/${groupId}`, formData);
      }

      setFormOpen(false);
      resetForm();
      onChanged?.();
    } catch (err) {
      Alert.alert('Error', err.message || err?.response?.data?.error || 'No se pudo guardar el rol');
    } finally { setSaving(false); }
  }

  function confirmDelete(role) {
    Alert.alert('Eliminar rol', `¿Eliminar "${role.name}"? Esta acción no se puede deshacer.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => handleDelete(role) },
    ]);
  }

  async function handleDelete(role) {
    setDeletingId(role._id);
    try {
      await api.delete(`/roles/${role._id}`);
      onChanged?.();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'No se pudo eliminar el rol');
    } finally { setDeletingId(null); }
  }

  function handleClose() {
    setFormOpen(false);
    resetForm();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={handleClose}>
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        <View style={[s.header, { paddingTop: insets.top ? 0 : 12 }]}>
          <TouchableOpacity onPress={formOpen ? () => setFormOpen(false) : handleClose} style={s.headerBtn}>
            <Ionicons name={formOpen ? 'arrow-back' : 'close'} size={22} color={colors.textHi} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{formOpen ? (editingId ? 'Editar rol' : 'Nuevo rol') : 'Gestionar roles'}</Text>
          <View style={{ width: 34 }} />
        </View>

        {formOpen ? (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
              <TouchableOpacity onPress={pickImage} style={s.imagePicker} activeOpacity={0.8}>
                {imageUri ? (
                  <Image
                    source={{ uri: imageUri }}
                    style={{ width: 60, height: 60, borderRadius: 30, borderWidth: 3, borderColor }}
                  />
                ) : editingId && roles.find(r => r._id === editingId)?.imageUrl ? (
                  <Image
                    source={{ uri: roles.find(r => r._id === editingId)?.imageUrl }}
                    style={{ width: 60, height: 60, borderRadius: 30, borderWidth: 3, borderColor }}
                  />
                ) : (
                  <View style={[s.imagePlaceholder, { borderColor }]}>
                    <Ionicons name="image-outline" size={28} color={colors.textDim} />
                  </View>
                )}
                <Text style={s.imagePickerTxt}>{imageUri ? 'Cambiar foto' : 'Elegir foto del personaje'}</Text>
              </TouchableOpacity>

              <Text style={s.label}>Nombre</Text>
              <TextInput
                style={s.input}
                value={name}
                onChangeText={t => setName(t.slice(0, 30))}
                placeholder="Nombre del personaje"
                placeholderTextColor={colors.textDim}
                maxLength={30}
              />

              <Text style={s.label}>Descripción</Text>
              <TextInput
                style={[s.input, s.inputMultiline]}
                value={description}
                onChangeText={t => setDescription(t.slice(0, 150))}
                placeholder="Descripción del personaje"
                placeholderTextColor={colors.textDim}
                maxLength={150}
                multiline
              />

              <Text style={s.label}>Color de borde</Text>
              <View style={s.colorRow}>
                {BORDER_COLORS.map(c => (
                  <TouchableOpacity
                    key={c.value}
                    onPress={() => setBorderColor(c.value)}
                    style={[s.colorDot, { backgroundColor: c.value }, borderColor === c.value && s.colorDotActive]}
                  >
                    {borderColor === c.value && <Ionicons name="checkmark" size={16} color={colors.black} />}
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={s.saveBtn} onPress={handleSubmit} disabled={saving} activeOpacity={0.85}>
                {saving ? <ActivityIndicator color={colors.black} /> : <Text style={s.saveBtnTxt}>{editingId ? 'Guardar cambios' : 'Crear rol'}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        ) : (
          <>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 12 }}>
              {roles.length === 0 && (
                <Text style={s.emptyTxt}>Todavía no hay roles creados.</Text>
              )}
              {roles.map(role => (
                <View key={role._id} style={s.roleRow}>
                  {role.imageUrl ? (
                    <Image
                      source={{ uri: role.imageUrl }}
                      style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: role.borderColor || '#fff' }}
                    />
                  ) : (
                    <View style={{ width: 48, height: 48, borderRadius: 8,
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="person-outline" size={24} color={colors.textDim} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={s.roleName} numberOfLines={1}>{role.name}</Text>
                    <Text style={s.roleStatus} numberOfLines={1}>
                      {role.takenBy ? `Tomado por @${role.takenBy.username}` : 'Disponible'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => openEdit(role)} style={s.roleActionBtn}>
                    <Ionicons name="pencil-outline" size={18} color={colors.textHi} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmDelete(role)} style={s.roleActionBtn} disabled={deletingId === role._id}>
                    {deletingId === role._id
                      ? <ActivityIndicator size={14} color="#ef4444" />
                      : <Ionicons name="trash-outline" size={18} color="#ef4444" />}
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
            <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
              <TouchableOpacity
                style={[s.createBtn, roles.length >= 10 && { opacity: 0.4 }]}
                onPress={openCreate}
                disabled={roles.length >= 10}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={18} color={colors.black} />
                <Text style={s.createBtnTxt}>{roles.length >= 10 ? 'Máximo 10 roles' : 'Crear rol'}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  headerBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', color: colors.textHi, fontSize: 15, fontWeight: '700' },

  emptyTxt: { color: colors.textDim, fontSize: 13, textAlign: 'center', marginTop: 24 },

  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 14, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: colors.borderC },
  roleName: { color: colors.textHi, fontSize: 14, fontWeight: '700' },
  roleStatus: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  roleActionBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },

  footer: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.c1, borderRadius: 14, paddingVertical: 13 },
  createBtnTxt: { color: colors.black, fontWeight: '800', fontSize: 14 },

  imagePicker: { alignItems: 'center', marginBottom: 20 },
  imagePlaceholder: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  imagePickerTxt: { color: colors.c1, fontSize: 12, fontWeight: '600', marginTop: 8 },

  label: { color: colors.textDim, fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: colors.deep, borderRadius: 12, borderWidth: 1, borderColor: colors.border, color: colors.textHi, fontSize: 13, paddingHorizontal: 14, paddingVertical: 11 },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },

  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colorDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  colorDotActive: { borderColor: colors.c1 },

  saveBtn: { backgroundColor: colors.c1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  saveBtnTxt: { color: colors.black, fontWeight: '800', fontSize: 14 },
});
