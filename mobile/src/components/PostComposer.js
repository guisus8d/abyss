import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView,
  Platform, Image, Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import api, { postFormData } from '../services/api';

export default function PostComposer({ onClose, onPostCreated }) {
  const [content, setContent] = useState('');
  const [image, setImage]     = useState(null);
  const [posting, setPosting] = useState(false);
  const insets = useSafeAreaInsets();

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, quality: 0.8,
    });
    if (!result.canceled) setImage(result.assets[0]);
  }

  async function handlePost() {
    if (!content.trim() && !image) return;
    setPosting(true);
    try {
      const tags = content.match(/#\w+/g) || [];
      const formData = new FormData();
      formData.append('content', content.trim() || ' ');
      tags.forEach(t => formData.append('tags', t));

      if (image?.uri) {
        // ✅ En Expo Go native la URI es file:/// — usar objeto directo
        // blob/data/http = web
        if (image.uri.startsWith('blob:') || image.uri.startsWith('data:') || image.uri.startsWith('http')) {
          const response = await fetch(image.uri);
          const blob = await response.blob();
          formData.append('image', blob, 'post.jpg');
        } else {
          formData.append('image', { uri: image.uri, type: 'image/jpeg', name: 'post.jpg' });
        }
      }

      // ✅ FIX: usar postFormData (fetch nativo) en vez de axios
      // axios rompe FormData en React Native con Network Error
      const data = await postFormData('/posts', formData);
      onPostCreated(data.post, data.newBadges);
      onClose();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo publicar');
    } finally {
      setPosting(false);
    }
  }

  const canPost = !!(content.trim() || image);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <View style={[s.card, { marginBottom: insets.bottom + 16 }]}>
          <Text style={s.title}>NUEVO POST</Text>
          <TextInput
            style={s.input}
            placeholder="¿Qué estás pensando? Usa #tags"
            placeholderTextColor={colors.textDim}
            value={content}
            onChangeText={setContent}
            multiline maxLength={1000} autoFocus
          />
          {image ? (
            <View style={s.imagePreview}>
              <Image source={{ uri: image.uri }} style={s.previewImg} resizeMode="cover" />
              <TouchableOpacity style={s.removeImg} onPress={() => setImage(null)}>
                <Text style={s.removeImgTxt}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={s.toolbar}>
            <TouchableOpacity style={s.toolBtn} onPress={pickImage}>
              <Text style={s.toolIcon}>🖼️</Text>
              <Text style={s.toolTxt}>Imagen</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={onClose} style={s.btnCancel}>
              <Text style={s.btnCancelTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handlePost}
              disabled={posting || !canPost}
              style={[s.btnPost, !canPost && s.btnPostDisabled]}
            >
              <Text style={s.btnPostTxt}>{posting ? '...' : 'PUBLICAR'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:         { flex: 1, backgroundColor: 'rgba(2,5,9,0.92)', justifyContent: 'center', padding: 20 },
  card:            { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.borderC, padding: 20 },
  title:           { fontSize: 11, letterSpacing: 3, color: colors.textDim, marginBottom: 14 },
  input:           { backgroundColor: 'rgba(8,20,36,0.95)', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, color: colors.textHi, fontSize: 14, minHeight: 100, textAlignVertical: 'top', marginBottom: 12 },
  imagePreview:    { position: 'relative', marginBottom: 12, borderRadius: 12, overflow: 'hidden' },
  previewImg:      { width: '100%', aspectRatio: 16 / 9, borderRadius: 12 },
  removeImg:       { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  removeImgTxt:    { color: '#fff', fontSize: 12 },
  toolbar:         { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toolBtn:         { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toolIcon:        { fontSize: 18 },
  toolTxt:         { color: colors.textDim, fontSize: 12 },
  btnCancel:       { paddingVertical: 12, paddingHorizontal: 12 },
  btnCancelTxt:    { color: colors.textDim, fontSize: 13 },
  btnPost:         { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20, backgroundColor: colors.c1 },
  btnPostDisabled: { backgroundColor: 'rgba(0,229,204,0.25)' },
  btnPostTxt:      { color: '#001a18', fontSize: 12, fontWeight: '700', letterSpacing: 2 },
});
