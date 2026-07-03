import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, StatusBar, ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  ImageBackground, Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../theme/colors';
import api, { postFormData, BASE_URL } from '../services/api';
import { useAuthStore } from '../store/authStore';

const APP_VERSION = '1.0.0';
let _blockId = 1;
function nextId() { return _blockId++; }

export default function PostNoticiaScreen({ navigation }) {
  const { token } = useAuthStore();
  const insets = useSafeAreaInsets();
  const scrollRef   = useRef(null);
  const blockLayouts = useRef({});

  const [title,       setTitle]       = useState('');
  const [image,       setImage]       = useState(null);   // portada
  const [imageLink,   setImageLink]   = useState('');     // link de portada
  const [bgImage,     setBgImage]     = useState(null);
  const [bgUploading, setBgUploading] = useState(false);
  const [posting,     setPosting]     = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [blocks, setBlocks] = useState([{ id: nextId(), type: 'text', text: '' }]);
  const [uploadingBlockId, setUploadingBlockId] = useState(null);

  // ── Portada ───────────────────────────────────────────────────────────────
  async function pickCover() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.9,
    });
    if (!result.canceled) setImage(result.assets[0]);
  }

  // ── Fondo ─────────────────────────────────────────────────────────────────
  async function pickBackground() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: false, quality: 0.9,
    });
    if (!result.canceled) setBgImage(result.assets[0]);
  }

  async function uploadBackground() {
    if (!bgImage) return null;
    setBgUploading(true);
    try {
      const formData = new FormData();
      if (Platform.OS === 'web') {
        const res  = await fetch(bgImage.uri);
        const blob = await res.blob();
        formData.append('background', blob, 'background.jpg');
      } else {
        formData.append('background', { uri: bgImage.uri, type: 'image/jpeg', name: 'background.jpg' });
      }
      const res  = await fetch(`${BASE_URL}/posts/upload-background`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'x-app-version': APP_VERSION },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al subir fondo');
      return data.backgroundUrl;
    } finally {
      setBgUploading(false);
    }
  }

  // ── Bloques ───────────────────────────────────────────────────────────────
  function addTextBlock() {
    setBlocks(prev => [...prev, { id: nextId(), type: 'text', text: '' }]);
  }

  async function addImageBlock() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: false, quality: 0.9,
    });
    if (result.canceled) return;
    const picked = result.assets[0];
    const blockId = nextId();
    setBlocks(prev => [...prev, { id: blockId, type: 'image', uri: picked.uri, url: '', link: '' }]);
    setUploadingBlockId(blockId);
    try {
      const formData = new FormData();
      if (Platform.OS === 'web') {
        const r    = await fetch(picked.uri);
        const blob = await r.blob();
        formData.append('image', blob, 'block.jpg');
      } else {
        formData.append('image', { uri: picked.uri, type: 'image/jpeg', name: 'block.jpg' });
      }
      const res  = await fetch(`${BASE_URL}/posts/upload-image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'x-app-version': APP_VERSION },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al subir imagen');
      setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, url: data.imageUrl } : b));
    } catch (err) {
      Alert.alert('Error', err.message);
      setBlocks(prev => prev.filter(b => b.id !== blockId));
    } finally {
      setUploadingBlockId(null);
    }
  }

  function updateBlock(id, patch) {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));
  }

  function removeBlock(id) {
    setBlocks(prev => prev.filter(b => b.id !== id));
  }

  function onBlockLayout(id, e) {
    blockLayouts.current[id] = e.nativeEvent.layout.y;
  }

  function onBlockFocus(id) {
    const y = blockLayouts.current[id];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 100), animated: true });
  }

  // ── Publicar ──────────────────────────────────────────────────────────────
  async function handlePost() {
    if (!title.trim()) return Alert.alert('Falta titulo', 'Agrega un titulo a tu noticia.');
    const hasContent = blocks.some(b => b.type === 'text' ? b.text.trim() : b.url);
    if (!hasContent) return Alert.alert('Falta contenido', 'Agrega texto o una imagen al cuerpo.');
    setPosting(true);
    try {
      const backgroundUrl = await uploadBackground();
      const textContent   = blocks.filter(b => b.type === 'text').map(b => b.text).join(' ');
      const tags          = textContent.match(/#\w+/g) || [];
      const serialized    = JSON.stringify(
        blocks.map(({ type, text, url, link }) => ({ type, text, url, link }))
      );

      const formData = new FormData();
      formData.append('content',  serialized);
      formData.append('title',    title.trim());
      formData.append('postType', 'news');
      tags.forEach(t => formData.append('tags', t));
      if (backgroundUrl)       formData.append('backgroundUrl', backgroundUrl);
      if (imageLink.trim())    formData.append('imageLink',     imageLink.trim());

      if (image) {
        if (image.uri.startsWith('blob:') || image.uri.startsWith('data:') || image.uri.startsWith('http')) {
          const r    = await fetch(image.uri);
          const blob = await r.blob();
          formData.append('image', blob, 'cover.jpg');
        } else {
          formData.append('image', { uri: image.uri, type: 'image/jpeg', name: 'cover.jpg' });
        }
        await postFormData('/posts', formData);
      } else {
        await api.post('/posts', {
          content:  serialized,
          title:    title.trim(),
          postType: 'news',
          tags,
          ...(backgroundUrl      ? { backgroundUrl }                  : {}),
          ...(imageLink.trim()   ? { imageLink: imageLink.trim() }    : {}),
        });
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || err.message || 'No se pudo publicar');
    } finally {
      setPosting(false);
    }
  }

  const canPost   = title.trim().length > 0 && blocks.some(b => b.type === 'text' ? b.text.trim() : b.url);
  const isLoading = posting || bgUploading;

  // ── Editor ────────────────────────────────────────────────────────────────
  const editorContent = (
    <>
      {/* Portada */}
      <TouchableOpacity style={s.coverPicker} onPress={pickCover}>
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
          <LinearGradient colors={['rgba(234,179,8,0.1)', 'rgba(234,179,8,0.03)']} style={s.coverEmpty}>
            <Ionicons name="image-outline" size={36} color="rgba(251,191,36,0.8)" />
            <Text style={s.coverEmptyTxt}>Agregar portada</Text>
            <Text style={s.coverEmptyHint}>Opcional — 16:9 recomendado</Text>
          </LinearGradient>
        )}
      </TouchableOpacity>

      {image && (
        <View style={s.imageLinkWrap}>
          <Ionicons name="link-outline" size={14} color={colors.textDim} />
          <TextInput
            style={s.imageLinkInput}
            value={imageLink}
            onChangeText={setImageLink}
            placeholder="Link de la portada (opcional)"
            placeholderTextColor={colors.textDim}
            keyboardType="url"
            autoCapitalize="none"
          />
        </View>
      )}

      {/* Fondo */}
      <View style={s.bgRow}>
        <TouchableOpacity style={s.bgBtn} onPress={pickBackground} activeOpacity={0.8}>
          <Ionicons name="color-palette-outline" size={16} color={bgImage ? colors.c1 : colors.textDim} />
          <Text style={[s.bgBtnTxt, bgImage && { color: colors.c1 }]}>
            {bgImage ? 'Cambiar fondo' : 'Agregar fondo'}
          </Text>
        </TouchableOpacity>
        {bgImage && (
          <TouchableOpacity style={s.bgRemove} onPress={() => setBgImage(null)}>
            <Ionicons name="close-circle" size={18} color={colors.textDim} />
          </TouchableOpacity>
        )}
      </View>

      <View style={s.divider} />

      {/* Titulo */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>TITULO</Text>
        <TextInput
          style={s.titleInput}
          value={title}
          onChangeText={t => t.length <= 150 && setTitle(t)}
          placeholder="Escribe el titulo de tu noticia..."
          placeholderTextColor={colors.textDim}
          multiline
        />
        <Text style={s.charCount}>{title.length}/150</Text>
      </View>

      <View style={s.divider} />

      {/* Bloques de contenido */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>CONTENIDO</Text>
        {blocks.map((block) => (
          <View
            key={block.id}
            style={s.blockWrap}
            onLayout={e => onBlockLayout(block.id, e)}
          >
            {block.type === 'text' ? (
              <TextInput
                style={s.blockTextInput}
                value={block.text}
                onChangeText={text => updateBlock(block.id, { text })}
                onFocus={() => onBlockFocus(block.id)}
                placeholder="Escribe aqui..."
                placeholderTextColor={colors.textDim}
                multiline
              />
            ) : (
              <View style={s.blockImageWrap}>
                {uploadingBlockId === block.id ? (
                  <View style={s.blockImageLoading}>
                    <ActivityIndicator color={colors.c1} />
                    <Text style={s.blockImageLoadingTxt}>Subiendo imagen...</Text>
                  </View>
                ) : (
                  <Image source={{ uri: block.uri || block.url }} style={s.blockImage} resizeMode="cover" />
                )}
                <TextInput
                  style={s.blockLinkInput}
                  value={block.link}
                  onChangeText={link => updateBlock(block.id, { link })}
                  onFocus={() => onBlockFocus(block.id)}
                  placeholder="Link de la imagen (opcional)"
                  placeholderTextColor={colors.textDim}
                  keyboardType="url"
                  autoCapitalize="none"
                />
              </View>
            )}
            <TouchableOpacity style={s.blockRemove} onPress={() => removeBlock(block.id)}>
              <Ionicons name="close-circle" size={18} color={colors.textDim} />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Toolbar de bloques */}
      <View style={s.blockToolbar}>
        <TouchableOpacity style={s.toolbarBtn} onPress={addTextBlock}>
          <Ionicons name="text" size={18} color={colors.textMid} />
          <Text style={s.toolbarBtnTxt}>Texto</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.toolbarBtn} onPress={addImageBlock}>
          <Ionicons name="image-outline" size={18} color={colors.textMid} />
          <Text style={s.toolbarBtnTxt}>Imagen</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <View style={s.root}>
      {Platform.OS !== 'web' && <StatusBar barStyle="light-content" />}

      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
            <Ionicons name="close" size={22} color={colors.textDim} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>NUEVA NOTICIA</Text>
          <View style={s.headerRight}>
            <TouchableOpacity onPress={() => setPreviewOpen(true)} style={s.previewBtn} disabled={!canPost}>
              <Text style={[s.previewBtnTxt, !canPost && { opacity: 0.4 }]}>Ver</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handlePost}
              disabled={isLoading || !canPost}
              style={[s.publishBtn, (!canPost || isLoading) && s.publishBtnDisabled]}
            >
              {isLoading
                ? <ActivityIndicator size="small" color={colors.black} />
                : <Text style={s.publishBtnTxt}>Publicar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {bgImage ? (
          <ImageBackground source={{ uri: bgImage.uri }} style={{ flex: 1 }}>
            <View style={s.bgOverlay}>
              <ScrollView
                ref={scrollRef}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 80 }}
              >
                {editorContent}
              </ScrollView>
            </View>
          </ImageBackground>
        ) : (
          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 80 }}
          >
            {editorContent}
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      {/* Modal Vista Previa */}
      <Modal
        visible={previewOpen}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setPreviewOpen(false)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>VISTA PREVIA</Text>
              <TouchableOpacity onPress={() => setPreviewOpen(false)}>
                <Ionicons name="close" size={22} color={colors.textDim} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {bgImage ? (
                <ImageBackground source={{ uri: bgImage.uri }} style={s.previewBgWrap}>
                  <View style={s.previewBgOverlay}>
                    <PreviewContent title={title} blocks={blocks} image={image} />
                  </View>
                </ImageBackground>
              ) : (
                <PreviewContent title={title} blocks={blocks} image={image} />
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function PreviewContent({ title, blocks, image }) {
  return (
    <View style={s.previewCard}>
      {image && <Image source={{ uri: image.uri }} style={s.previewCover} resizeMode="cover" />}
      <View style={s.previewBody}>
        <View style={s.previewBadge}>
          <Ionicons name="newspaper-outline" size={10} color="rgba(251,191,36,1)" />
          <Text style={s.previewBadgeTxt}>NOTICIA</Text>
        </View>
        {title ? <Text style={s.previewTitle}>{title}</Text> : null}
        {blocks.map((b, i) =>
          b.type === 'text' ? (
            b.text ? <Text key={i} style={s.previewBodyTxt}>{b.text}</Text> : null
          ) : (b.uri || b.url) ? (
            <Image key={i} source={{ uri: b.uri || b.url }} style={s.previewBlockImg} resizeMode="cover" />
          ) : null
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:            { flex: 1, backgroundColor: colors.black },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerBtn:       { width: 44 },
  headerTitle:     { fontSize: 12, fontWeight: '900', letterSpacing: 5, color: 'rgba(251,191,36,1)' },
  headerRight:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewBtn:      { paddingHorizontal: 12, paddingVertical: 8 },
  previewBtnTxt:   { color: colors.textMid, fontSize: 13, fontWeight: '600' },
  publishBtn:      { backgroundColor: 'rgba(251,191,36,1)', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8 },
  publishBtnDisabled: { backgroundColor: 'rgba(251,191,36,0.3)' },
  publishBtnTxt:   { color: '#1a1200', fontWeight: '900', fontSize: 13 },

  coverPicker:     { margin: 16, height: 200, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  coverPreview:    { width: '100%', height: '100%' },
  coverEditBtn:    { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 6 },
  coverEmpty:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  coverEmptyTxt:   { color: 'rgba(251,191,36,0.8)', fontSize: 14, fontWeight: '600' },
  coverEmptyHint:  { color: colors.textDim, fontSize: 11 },

  imageLinkWrap:   { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: -4, marginBottom: 8, gap: 8, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.border },
  imageLinkInput:  { flex: 1, color: colors.textMid, fontSize: 13 },

  bgRow:           { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12, gap: 10 },
  bgBtn:           { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  bgBtnTxt:        { color: colors.textDim, fontSize: 13 },
  bgRemove:        { padding: 4 },
  bgOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },

  section:         { paddingHorizontal: 16, paddingVertical: 12 },
  sectionLabel:    { color: colors.textDim, fontSize: 9, letterSpacing: 3, marginBottom: 10 },
  titleInput:      { color: colors.textHi, fontSize: 22, fontWeight: '700', lineHeight: 30, textAlignVertical: 'top' },
  charCount:       { color: colors.textDim, fontSize: 10, textAlign: 'right', marginTop: 6 },
  divider:         { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },

  // Bloques
  blockWrap:           { marginBottom: 12, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  blockTextInput:      { color: colors.textMid, fontSize: 15, lineHeight: 24, minHeight: 80, padding: 12, textAlignVertical: 'top' },
  blockImageWrap:      { gap: 0 },
  blockImage:          { width: '100%', aspectRatio: 16 / 9 },
  blockImageLoading:   { height: 120, alignItems: 'center', justifyContent: 'center', gap: 8 },
  blockImageLoadingTxt:{ color: colors.textDim, fontSize: 12 },
  blockLinkInput:      { color: colors.textDim, fontSize: 12, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  blockRemove:         { position: 'absolute', top: 6, right: 6, zIndex: 1 },

  // Toolbar
  blockToolbar:    { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  toolbarBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  toolbarBtnTxt:   { color: colors.textMid, fontSize: 13 },

  // Modal vista previa
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard:       { backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: 1, borderTopColor: colors.border, maxHeight: '90%' },
  modalHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle:      { color: colors.textDim, fontSize: 11, letterSpacing: 3 },

  previewBgWrap:    { minHeight: 200 },
  previewBgOverlay: { backgroundColor: 'rgba(0,0,0,0.55)' },
  previewCard:      { backgroundColor: 'transparent' },
  previewCover:     { width: '100%', height: 180 },
  previewBody:      { padding: 16, gap: 10 },
  previewBadge:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(234,179,8,0.1)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  previewBadgeTxt:  { color: 'rgba(251,191,36,1)', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  previewTitle:     { color: colors.textHi, fontSize: 18, fontWeight: '700', lineHeight: 26 },
  previewBodyTxt:   { color: colors.textMid, fontSize: 14, lineHeight: 22 },
  previewBlockImg:  { width: '100%', aspectRatio: 16 / 9, borderRadius: 10 },
});
