import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView,
  Platform, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import api, { postFormData } from '../services/api';

export default function PostComposer({ onClose, onPostCreated }) {
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const insets = useSafeAreaInsets();

  async function handlePost() {
    if (!content.trim()) return;
    setPosting(true);
    try {
      const tags = content.match(/#\w+/g) || [];
      const formData = new FormData();
      formData.append('content', content.trim());
      tags.forEach(t => formData.append('tags', t));
      const data = await postFormData('/posts', formData);
      onPostCreated(data.post, data.newBadges);
      onClose();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo publicar');
    } finally {
      setPosting(false);
    }
  }

  const canPost = !!content.trim();

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
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
          <View style={s.toolbar}>
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
  toolbar:         { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btnCancel:       { paddingVertical: 12, paddingHorizontal: 12 },
  btnCancelTxt:    { color: colors.textDim, fontSize: 13 },
  btnPost:         { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20, backgroundColor: colors.c1 },
  btnPostDisabled: { backgroundColor: 'rgba(0,229,204,0.25)' },
  btnPostTxt:      { color: '#001a18', fontSize: 12, fontWeight: '700', letterSpacing: 2 },
});
