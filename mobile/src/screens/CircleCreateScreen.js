import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, ScrollView, ActivityIndicator, Alert, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../theme/colors';
import { postFormData } from '../services/api';

export default function CircleCreateScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput,   setTagsInput]   = useState('');
  const [imageUri,    setImageUri]    = useState(null);
  const [loading,     setLoading]     = useState(false);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  }

  function parseTags(raw) {
    return raw
      .split(/[\s,]+/)
      .map(t => t.replace(/^#+/, '').toLowerCase().replace(/[^a-z0-9_]/g, ''))
      .filter(Boolean);
  }

  async function handleCreate() {
    if (!name.trim()) {
      Alert.alert('Nombre requerido', 'Dale un nombre a tu fiesta.');
      return;
    }
    setLoading(true);
    try {
      const tags = parseTags(tagsInput);
      const formData = new FormData();
      formData.append('name',        name.trim());
      formData.append('description', description.trim());
      formData.append('hashtags',    JSON.stringify(tags));
      if (imageUri) {
        formData.append('image', { uri: imageUri, type: 'image/jpeg', name: 'circle.jpg' });
      }

      await postFormData('/groups/circles', formData);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'No se pudo crear la fiesta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textHi} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Nueva fiesta</Text>
        <TouchableOpacity
          style={[s.createBtn, (!name.trim() || loading) && { opacity: 0.4 }]}
          onPress={handleCreate}
          disabled={!name.trim() || loading}
        >
          {loading
            ? <ActivityIndicator size="small" color={colors.black} />
            : <Text style={s.createBtnTxt}>Crear</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">

        {/* Imagen */}
        <TouchableOpacity style={s.imgPicker} onPress={pickImage} activeOpacity={0.8}>
          {imageUri
            ? <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            : <>
                <Ionicons name="camera-outline" size={32} color={colors.textDim} />
                <Text style={s.imgPickerTxt}>Foto de la fiesta</Text>
              </>}
        </TouchableOpacity>

        {/* Nombre */}
        <View style={s.field}>
          <Text style={s.label}>Nombre *</Text>
          <TextInput
            style={s.input}
            placeholder="Nombre de la fiesta"
            placeholderTextColor={colors.textDim}
            value={name}
            onChangeText={setName}
            maxLength={60}
          />
        </View>

        {/* Descripción */}
        <View style={s.field}>
          <Text style={s.label}>Descripción</Text>
          <TextInput
            style={[s.input, s.inputMulti]}
            placeholder="De qué trata esta fiesta…"
            placeholderTextColor={colors.textDim}
            value={description}
            onChangeText={setDescription}
            maxLength={200}
            multiline
          />
        </View>

        {/* Hashtags */}
        <View style={s.field}>
          <Text style={s.label}>Hashtags</Text>
          <TextInput
            style={s.input}
            placeholder="música, arte, gaming…"
            placeholderTextColor={colors.textDim}
            value={tagsInput}
            onChangeText={setTagsInput}
            autoCapitalize="none"
          />
          <Text style={s.hint}>Separa por coma o espacio. Sin # necesario.</Text>
        </View>

        {/* Preview de tags */}
        {parseTags(tagsInput).length > 0 && (
          <View style={s.tagsPreview}>
            {parseTags(tagsInput).map(t => (
              <View key={t} style={s.tag}>
                <Text style={s.tagTxt}>#{t}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: colors.black },

  header:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
  backBtn:       { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:   { flex: 1, color: colors.textHi, fontSize: 17, fontWeight: '700' },
  createBtn:     { backgroundColor: colors.c1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  createBtnTxt:  { color: colors.black, fontWeight: '700', fontSize: 14 },

  body:          { padding: 20, gap: 20 },

  imgPicker:     { width: 100, height: 100, borderRadius: 24, backgroundColor: colors.surface, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: colors.borderC, gap: 6 },
  imgPickerTxt:  { color: colors.textDim, fontSize: 11, textAlign: 'center' },

  field:         { gap: 6 },
  label:         { color: colors.textMid, fontSize: 13, fontWeight: '600' },
  input:         { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.borderC, paddingHorizontal: 14, paddingVertical: 12, color: colors.textHi, fontSize: 15 },
  inputMulti:    { minHeight: 80, textAlignVertical: 'top' },
  hint:          { color: colors.textDim, fontSize: 12, marginTop: 2 },

  tagsPreview:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag:           { backgroundColor: 'rgba(0,229,204,0.1)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  tagTxt:        { color: colors.c1, fontSize: 13 },
});
