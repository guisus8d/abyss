import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Image, ScrollView, StatusBar,
  ActivityIndicator, Alert, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import AvatarWithFrame from '../components/AvatarWithFrame';

export default function CreateGroupScreen({ navigation }) {
  const { user } = useAuthStore();
  const [name, setName]           = useState('');
  const [description, setDesc]    = useState('');
  const [image, setImage]         = useState(null);
  const [contacts, setContacts]   = useState([]);
  const [selected, setSelected]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [creating, setCreating]   = useState(false);

  useEffect(() => { loadContacts(); }, []);

  async function loadContacts() {
    try {
      const { data } = await api.get('/users/me');
      const me = data.user;
      const followers = (me.followers || []).map(f => ({ id: String(f._id || f), username: f.username })).filter(f => f.username);
      const following = (me.following || []).map(f => ({ id: String(f._id || f), username: f.username })).filter(f => f.username);
      const followerIds = followers.map(f => f.id);
      const followingIds = following.map(f => f.id);

      const allMap = {};
      [...followers, ...following].forEach(f => {
        if (f.username) allMap[f.id] = { ...f, isMutual: followerIds.includes(f.id) && followingIds.includes(f.id) };
      });

      const all = Object.values(allMap).slice(0, 30);
      if (all.length === 0) { setLoading(false); return; }

      const results = await Promise.all(
        all.map(f =>
          api.get(`/users/${f.username}`).then(r => ({ ...r.data.user, isMutual: f.isMutual })).catch(() => null)
        )
      );
      setContacts(results.filter(Boolean));
    } catch(e) { console.log(e); }
    finally { setLoading(false); }
  }

  async function pickImage() {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1,1], quality: 0.8,
    });
    if (!r.canceled) setImage(r.assets[0]);
  }

  function toggleSelect(userId) {
    setSelected(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  }

  async function handleCreate() {
    if (!name.trim()) return Alert.alert('Falta nombre', 'Ponle un nombre al grupo');
    setCreating(true);
    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('description', description.trim());
      formData.append('memberIds', JSON.stringify(selected));
      if (image) {
        if (image.uri.startsWith('blob:') || image.uri.startsWith('data:') || image.uri.startsWith('http')) {
          const res  = await fetch(image.uri);
          const blob = await res.blob();
          formData.append('image', blob, 'group.jpg');
        } else {
          formData.append('image', { uri: image.uri, type: 'image/jpeg', name: 'group.jpg' });
        }
      }
      const { data } = await api.post('/groups', formData);
      navigation.replace('GroupRoom', { group: data.group });
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo crear el grupo');
    } finally { setCreating(false); }
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.textHi} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>NUEVO GRUPO</Text>
          <TouchableOpacity onPress={handleCreate} disabled={creating || !name.trim()}>
            {creating
              ? <ActivityIndicator size="small" color={colors.c1} />
              : <Text style={[s.createTxt, !name.trim() && { opacity: 0.3 }]}>Crear</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Imagen del grupo */}
        <View style={s.imageSection}>
          <TouchableOpacity style={s.imagePicker} onPress={pickImage}>
            {image
              ? <Image source={{ uri: image.uri }} style={s.imagePreview} />
              : <View style={s.imagePlaceholder}>
                  <Ionicons name="camera" size={28} color={colors.textDim} />
                  <Text style={s.imagePlaceholderTxt}>Foto del grupo</Text>
                </View>}
          </TouchableOpacity>
        </View>

        {/* Nombre y descripción */}
        <View style={s.section}>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="Nombre del grupo"
            placeholderTextColor={colors.textDim}
            maxLength={60}
          />
          <TextInput
            style={[s.input, { marginTop: 10, height: 70, textAlignVertical: 'top', paddingTop: 10 }]}
            value={description}
            onChangeText={setDesc}
            placeholder="Descripción (opcional)"
            placeholderTextColor={colors.textDim}
            multiline
            maxLength={200}
          />
        </View>

        {/* Seleccionar miembros */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>AGREGAR MIEMBROS</Text>
          <Text style={s.sectionHint}>
            ✓ Amigos mutuos se agregan directo · Solo seguidores reciben invitación
          </Text>
          {loading
            ? <ActivityIndicator color={colors.c1} style={{ marginTop: 20 }} />
            : contacts.length === 0
              ? <Text style={s.emptyTxt}>Aún no tienes contactos</Text>
              : contacts.map(contact => {
                  const isSelected = selected.includes(contact._id);
                  return (
                    <TouchableOpacity
                      key={contact._id}
                      style={[s.contactItem, isSelected && s.contactItemSelected]}
                      onPress={() => toggleSelect(contact._id)}
                    >
                      <AvatarWithFrame
                        size={40}
                        avatarUrl={contact.avatarUrl}
                        username={contact.username}
                        profileFrame={contact.profileFrame}
                        frameUrl={contact.profileFrameUrl}
                      />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={s.contactName}>{contact.username}</Text>
                        <Text style={s.contactType}>
                          {contact.isMutual ? '✓ Amigo — acceso directo' : 'Seguidor — recibirá invitación'}
                        </Text>
                      </View>
                      <View style={[s.checkbox, isSelected && s.checkboxSelected]}>
                        {isSelected && <Ionicons name="checkmark" size={14} color="#000" />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: colors.black },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  backBtn:    { padding: 4 },
  headerTitle:{ color: colors.textHi, fontSize: 13, fontWeight: '800', letterSpacing: 2.5 },
  createTxt:  { color: colors.c1, fontSize: 14, fontWeight: '700' },

  imageSection:       { alignItems: 'center', paddingVertical: 20 },
  imagePicker:        { width: 90, height: 90, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  imagePreview:       { width: '100%', height: '100%' },
  imagePlaceholder:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  imagePlaceholderTxt:{ color: colors.textDim, fontSize: 11 },

  section:      { paddingHorizontal: 16, marginBottom: 20 },
  sectionLabel: { color: colors.textDim, fontSize: 9, letterSpacing: 3, fontWeight: '800', marginBottom: 8 },
  sectionHint:  { color: colors.textDim, fontSize: 11, marginBottom: 12, lineHeight: 16 },
  input:        { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.textHi, fontSize: 14 },

  contactItem:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  contactItemSelected: { backgroundColor: 'rgba(0,229,204,0.05)', borderRadius: 12, paddingHorizontal: 8 },
  contactName:         { color: colors.textHi, fontSize: 14, fontWeight: '600' },
  contactType:         { color: colors.textDim, fontSize: 11, marginTop: 2 },
  checkbox:            { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.textDim, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected:    { backgroundColor: colors.c1, borderColor: colors.c1 },
  emptyTxt:            { color: colors.textDim, fontSize: 13, textAlign: 'center', marginTop: 20 },
});
