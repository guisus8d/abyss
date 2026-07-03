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
import { CIRCLE_HASHTAGS, getHashtagColor } from '../constants/circleHashtags';

const MAX_TAGS    = 5;
const MIN_TAGS    = 3;
const MAX_CUSTOMS = 1;

export default function CircleCreateScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [name,            setName]            = useState('');
  const [description,     setDescription]     = useState('');
  const [selectedTags,    setSelectedTags]    = useState([]);
  const [customTag,       setCustomTag]       = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [imageUri,        setImageUri]        = useState(null);
  const [loading,         setLoading]         = useState(false);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: false, quality: 1,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  }

  function toggleTag(tag) {
    setSelectedTags(prev => {
      if (prev.includes(tag)) return prev.filter(t => t !== tag);
      if (prev.length >= MAX_TAGS) return prev;
      return [...prev, tag];
    });
  }

  function addCustomTag() {
    const clean = customTag.trim().replace(/^#+/, '').toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!clean) return;
    if (selectedTags.includes(clean)) { setCustomTag(''); return; }
    if (selectedTags.length >= MAX_TAGS) return;
    setSelectedTags(prev => [...prev, clean]);
    setCustomTag('');
    setShowCustomInput(false);
  }

  const customTags   = selectedTags.filter(t => !CIRCLE_HASHTAGS.includes(t));
  const canAddCustom = customTags.length < MAX_CUSTOMS && selectedTags.length < MAX_TAGS;

  async function handleCreate() {
    if (!name.trim()) {
      Alert.alert('Nombre requerido', 'Dale un nombre a tu fiesta.');
      return;
    }
    if (selectedTags.length < MIN_TAGS) {
      Alert.alert('Hashtags requeridos', `Selecciona al menos ${MIN_TAGS} hashtags para tu fiesta.`);
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name',        name.trim());
      formData.append('description', description.trim());
      formData.append('hashtags',    JSON.stringify(selectedTags));
      if (imageUri) {
        const ext      = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
        const mimeType = ext === 'gif' ? 'image/gif' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        formData.append('image', { uri: imageUri, type: mimeType, name: `circle.${ext}` });
      }
      await postFormData('/groups/circles', formData);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'No se pudo crear la fiesta');
    } finally {
      setLoading(false);
    }
  }

  const canCreate = name.trim() && selectedTags.length >= MIN_TAGS && !loading;

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
          style={[s.createBtn, !canCreate && { opacity: 0.4 }]}
          onPress={handleCreate}
          disabled={!canCreate}
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
          <View style={s.labelRow}>
            <Text style={s.label}>Hashtags * (mínimo {MIN_TAGS}, máximo {MAX_TAGS})</Text>
            <Text style={s.tagCount}>{selectedTags.length}/{MAX_TAGS}</Text>
          </View>

          <View style={s.pillGrid}>
            {CIRCLE_HASHTAGS.map(tag => {
              const selected = selectedTags.includes(tag);
              const color    = getHashtagColor(tag);
              const disabled = !selected && selectedTags.length >= MAX_TAGS;
              return (
                <TouchableOpacity
                  key={tag}
                  style={[
                    s.pill,
                    selected
                      ? { borderColor: color, backgroundColor: color + '30' }
                      : { borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)' },
                    disabled && { opacity: 0.4 },
                  ]}
                  onPress={() => toggleTag(tag)}
                  activeOpacity={0.75}
                  disabled={disabled}
                >
                  <Text style={[s.pillTxt, { color: selected ? color : colors.textMid }]}>#{tag}</Text>
                </TouchableOpacity>
              );
            })}

            {/* Tags personalizados ya agregados */}
            {customTags.map(tag => {
              const color = getHashtagColor(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  style={[s.pill, { borderColor: color, backgroundColor: color + '30' }]}
                  onPress={() => toggleTag(tag)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.pillTxt, { color }]}>#{tag}</Text>
                  <Ionicons name="close" size={11} color={color} style={{ marginLeft: 3 }} />
                </TouchableOpacity>
              );
            })}

            {/* Botón "+" */}
            {canAddCustom && (
              <TouchableOpacity
                style={[s.pill, s.pillAdd]}
                onPress={() => setShowCustomInput(v => !v)}
                activeOpacity={0.75}
              >
                <Ionicons name="add" size={15} color={colors.textMid} />
              </TouchableOpacity>
            )}
          </View>

          {/* Input personalizado */}
          {showCustomInput && (
            <View style={s.customInputRow}>
              <TextInput
                style={s.customInput}
                placeholder="tu hashtag"
                placeholderTextColor={colors.textDim}
                value={customTag}
                onChangeText={setCustomTag}
                autoCapitalize="none"
                autoFocus
                maxLength={24}
                onSubmitEditing={addCustomTag}
                returnKeyType="done"
              />
              <TouchableOpacity style={s.customAddBtn} onPress={addCustomTag}>
                <Text style={s.customAddBtnTxt}>Agregar</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={s.hint}>Mínimo {MIN_TAGS} requeridos · Puedes agregar 1 personalizado</Text>
        </View>

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

  imgPicker:     { width: '100%', height: 170, borderRadius: 12, backgroundColor: colors.surface, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: colors.borderC, gap: 6 },
  imgPickerTxt:  { color: colors.textDim, fontSize: 11, textAlign: 'center' },

  field:         { gap: 8 },
  labelRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label:         { color: colors.textMid, fontSize: 13, fontWeight: '600' },
  tagCount:      { color: colors.textDim, fontSize: 12 },
  input:         { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.borderC, paddingHorizontal: 14, paddingVertical: 12, color: colors.textHi, fontSize: 15 },
  inputMulti:    { minHeight: 80, textAlignVertical: 'top' },
  hint:          { color: colors.textDim, fontSize: 12 },

  pillGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill:          { flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 5 },
  pillTxt:       { fontSize: 12, fontWeight: '600' },
  pillAdd:       { borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)' },

  customInputRow:{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  customInput:   { flex: 1, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.borderC, paddingHorizontal: 12, paddingVertical: 9, color: colors.textHi, fontSize: 14 },
  customAddBtn:  { backgroundColor: colors.c1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  customAddBtnTxt:{ color: colors.black, fontWeight: '700', fontSize: 13 },
});
