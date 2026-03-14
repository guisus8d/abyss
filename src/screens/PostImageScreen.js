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

export default function PostImageScreen({ navigation, route }) {
  const { token } = useAuthStore();
  
  const [image, setImage]     = useState(null);
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, quality: 0.9,
    });
    if (!result.canceled) setImage(result.assets[0]);
  }

  async function handlePost() {
    if (!image) return Alert.alert('Falta imagen', 'Agrega una imagen primero.');
    setPosting(true);
    try {
      const formData = new FormData();
      if (image.uri.startsWith('blob:') || image.uri.startsWith('data:') || image.uri.startsWith('http')) {
        const res  = await fetch(image.uri);
        const blob = await res.blob();
        formData.append('image', blob, 'post.jpg');
      } else {
        formData.append('image', { uri: image.uri, type: 'image/jpeg', name: 'post.jpg' });
      }
      if (caption.trim()) formData.append('content', caption.trim());
      const tags = caption.match(/#\w+/g) || [];
      if (tags.length) formData.append('tags', JSON.stringify(tags));
      formData.append('postType', 'image');
      await api.post('/posts', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo publicar');
    } finally {
      setPosting(false);
    }
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
            <Ionicons name="close" size={22} color={colors.textDim} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>POST IMAGEN</Text>
          <TouchableOpacity
            onPress={handlePost}
            disabled={posting || !image}
            style={[s.publishBtn, (!image || posting) && s.publishBtnDisabled]}
          >
            {posting
              ? <ActivityIndicator size="small" color={colors.black} />
              : <Text style={s.publishBtnTxt}>Publicar</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

          {/* Imagen */}
          <TouchableOpacity style={s.imagePicker} onPress={pickImage}>
            {image ? (
              <>
                <Image source={{ uri: image.uri }} style={s.imagePreview} resizeMode="cover" />
                <View style={s.imageEditOverlay}>
                  <Ionicons name="camera" size={20} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 12, marginTop: 4 }}>Cambiar</Text>
                </View>
              </>
            ) : (
              <View style={s.imageEmpty}>
                <LinearGradient colors={['rgba(0,229,204,0.1)','rgba(0,229,204,0.03)']} style={s.imageEmptyGrad}>
                  <Ionicons name="image-outline" size={48} color={colors.c1} />
                  <Text style={s.imageEmptyTxt}>Toca para agregar imagen</Text>
                  <Text style={s.imageEmptyHint}>JPG, PNG o WebP</Text>
                </LinearGradient>
              </View>
            )}
          </TouchableOpacity>

          {/* Caption */}
          <View style={s.captionWrap}>
            <TextInput
              style={s.captionInput}
              value={caption}
              onChangeText={setCaption}
              placeholder="Escribe algo sobre esta imagen... #hashtag"
              placeholderTextColor={colors.textDim}
              multiline
              maxLength={500}
            />
            <Text style={s.charCount}>{caption.length}/500</Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: colors.black },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerBtn:  { width: 44 },
  headerTitle:{ fontSize: 12, fontWeight: '900', letterSpacing: 5, color: colors.c1 },
  publishBtn: { backgroundColor: colors.c1, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8 },
  publishBtnDisabled: { backgroundColor: 'rgba(0,229,204,0.3)' },
  publishBtnTxt: { color: '#001a18', fontWeight: '900', fontSize: 13 },

  imagePicker:    { margin: 16, borderRadius: 20, overflow: 'hidden', height: 320, borderWidth: 1, borderColor: colors.border },
  imagePreview:   { width: '100%', height: '100%' },
  imageEditOverlay: { position: 'absolute', bottom: 14, right: 14, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  imageEmpty:     { flex: 1 },
  imageEmptyGrad: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  imageEmptyTxt:  { color: colors.c1, fontSize: 15, fontWeight: '600' },
  imageEmptyHint: { color: colors.textDim, fontSize: 12 },

  captionWrap:  { marginHorizontal: 16, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 },
  captionInput: { color: colors.textHi, fontSize: 15, lineHeight: 22, minHeight: 80, textAlignVertical: 'top' },
  charCount:    { color: colors.textDim, fontSize: 10, textAlign: 'right', marginTop: 8 },
});
