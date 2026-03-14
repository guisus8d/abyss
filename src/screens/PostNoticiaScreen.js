import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, StatusBar, SafeAreaView, ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../theme/colors';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

export default function PostNoticiaScreen({ navigation, route }) {
  const { token } = useAuthStore();
  
  const [title, setTitle]     = useState('');
  const [body, setBody]       = useState('');
  const [image, setImage]     = useState(null);
  const [posting, setPosting] = useState(false);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [16,9], quality: 0.9,
    });
    if (!result.canceled) setImage(result.assets[0]);
  }

  async function handlePost() {
    if (!title.trim()) return Alert.alert('Falta título', 'Agrega un título a tu noticia.');
    if (!body.trim())  return Alert.alert('Falta contenido', 'Escribe el cuerpo de la noticia.');
    setPosting(true);
    try {
      const tags = body.match(/#\w+/g) || [];
      if (image) {
        const formData = new FormData();
        formData.append('content', body.trim());
        formData.append('title', title.trim());
        formData.append('postType', 'news');
        if (tags.length) formData.append('tags', JSON.stringify(tags));
        const res2  = await fetch(image.uri);
        const blob = await res2.blob();
        formData.append('image', blob, 'cover.jpg');
        await api.post('/posts', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post('/posts', {
          content: body.trim(),
          title: title.trim(),
          postType: 'news',
          tags,
        });
      }
      navigation.goBack();
    } catch (err) {
      console.error('POST ERROR:', err);
      Alert.alert('Error', err.message || err.response?.data?.error || 'No se pudo publicar');
    } finally {
      setPosting(false);
    }
  }

  const canPost = title.trim().length > 0 && body.trim().length > 0;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
            <Ionicons name="close" size={22} color={colors.textDim} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>POST NOTICIA</Text>
          <TouchableOpacity onPress={handlePost} disabled={posting || !canPost}
            style={[s.publishBtn, (!canPost || posting) && s.publishBtnDisabled]}>
            {posting
              ? <ActivityIndicator size="small" color={colors.black} />
              : <Text style={s.publishBtnTxt}>Publicar</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

          {/* Cover image */}
          <TouchableOpacity style={s.coverPicker} onPress={pickImage}>
            {image ? (
              <>
                <Image source={{ uri: image.uri }} style={s.coverPreview} resizeMode="cover" />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 16 }]} />
                <View style={s.coverEditBtn}>
                  <Ionicons name="camera" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 11 }}>Cambiar portada</Text>
                </View>
              </>
            ) : (
              <LinearGradient colors={['rgba(234,179,8,0.1)','rgba(234,179,8,0.03)']} style={s.coverEmpty}>
                <Ionicons name="image-outline" size={36} color="rgba(251,191,36,0.8)" />
                <Text style={s.coverEmptyTxt}>Agregar portada</Text>
                <Text style={s.coverEmptyHint}>Opcional — 16:9 recomendado</Text>
              </LinearGradient>
            )}
          </TouchableOpacity>

          {/* Título */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>TÍTULO</Text>
            <TextInput
              style={s.titleInput}
              value={title}
              onChangeText={t => t.length <= 100 && setTitle(t)}
              placeholder="Escribe el título de tu noticia..."
              placeholderTextColor={colors.textDim}
              multiline
            />
            <Text style={s.charCount}>{title.length}/100</Text>
          </View>

          {/* Divisor */}
          <View style={s.divider} />

          {/* Cuerpo */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>CONTENIDO</Text>
            <TextInput
              style={s.bodyInput}
              value={body}
              onChangeText={setBody}
              placeholder="Escribe el cuerpo de la noticia... #hashtag"
              placeholderTextColor={colors.textDim}
              multiline
              maxLength={2000}
            />
            <Text style={s.charCount}>{body.length}/2000</Text>
          </View>

          {/* Preview card */}
          {(title || body) ? (
            <View style={s.previewWrap}>
              <Text style={s.previewLabel}>PREVIEW</Text>
              <View style={s.previewCard}>
                {image && <Image source={{ uri: image.uri }} style={s.previewCover} resizeMode="cover" />}
                <View style={s.previewBody}>
                  <View style={s.previewBadge}>
                    <Ionicons name="newspaper-outline" size={10} color="rgba(251,191,36,1)" />
                    <Text style={s.previewBadgeTxt}>NOTICIA</Text>
                  </View>
                  {title ? <Text style={s.previewTitle} numberOfLines={2}>{title}</Text> : null}
                  {body  ? <Text style={s.previewBodyTxt} numberOfLines={3}>{body}</Text> : null}
                </View>
              </View>
            </View>
          ) : null}

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: colors.black },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerBtn:  { width: 44 },
  headerTitle:{ fontSize: 12, fontWeight: '900', letterSpacing: 5, color: 'rgba(251,191,36,1)' },
  publishBtn: { backgroundColor: 'rgba(251,191,36,1)', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8 },
  publishBtnDisabled: { backgroundColor: 'rgba(251,191,36,0.3)' },
  publishBtnTxt: { color: '#1a1200', fontWeight: '900', fontSize: 13 },

  coverPicker:  { margin: 16, height: 200, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  coverPreview: { width: '100%', height: '100%' },
  coverEditBtn: { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 6 },
  coverEmpty:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  coverEmptyTxt:{ color: 'rgba(251,191,36,0.8)', fontSize: 14, fontWeight: '600' },
  coverEmptyHint:{ color: colors.textDim, fontSize: 11 },

  section:      { paddingHorizontal: 16, paddingVertical: 12 },
  sectionLabel: { color: colors.textDim, fontSize: 9, letterSpacing: 3, marginBottom: 10 },
  titleInput:   { color: colors.textHi, fontSize: 22, fontWeight: '700', lineHeight: 30, textAlignVertical: 'top' },
  bodyInput:    { color: colors.textMid, fontSize: 15, lineHeight: 24, minHeight: 140, textAlignVertical: 'top' },
  charCount:    { color: colors.textDim, fontSize: 10, textAlign: 'right', marginTop: 6 },
  divider:      { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },

  previewWrap:  { margin: 16, marginTop: 8 },
  previewLabel: { color: colors.textDim, fontSize: 9, letterSpacing: 3, marginBottom: 10 },
  previewCard:  { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  previewCover: { width: '100%', height: 140 },
  previewBody:  { padding: 14, gap: 8 },
  previewBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(234,179,8,0.1)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  previewBadgeTxt: { color: 'rgba(251,191,36,1)', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  previewTitle: { color: colors.textHi, fontSize: 16, fontWeight: '700', lineHeight: 22 },
  previewBodyTxt: { color: colors.textDim, fontSize: 13, lineHeight: 20 },
});
