import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Image, ScrollView, StatusBar, SafeAreaView,
  ActivityIndicator, Alert, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import AvatarWithFrame from '../components/AvatarWithFrame';

const { width: W } = Dimensions.get('window');

const BG_COLORS = [
  '#000000', '#0a0a1a', '#0d1f2d', '#1a0a2e',
  '#0a1a0a', '#1a1a0a', '#2a0a0a', '#0a1a2a',
  '#1a2a1a', '#2a1a0a',
];

const BG_GRADIENTS = [
  ['#000000', '#0d1f2d'],
  ['#0a0a1a', '#1a0a2e'],
  ['#0d1f2d', '#00e5cc22'],
  ['#1a0a2e', '#d946ef22'],
  ['#0a1a0a', '#22d3ee22'],
  ['#2a0a0a', '#f9731622'],
];

export default function CreateFrameScreen({ navigation }) {
  const { user, updateUser } = useAuthStore();
  const [name, setName]           = useState('');
  const [description, setDesc]    = useState('');
  const [price, setPrice]         = useState('50');
  const [frameImage, setFrameImg] = useState(null);
  const [bgType, setBgType]       = useState('color');
  const [bgColor, setBgColor]     = useState('#0d1f2d');
  const [bgGradient, setBgGrad]   = useState(['#000000', '#0d1f2d']);
  const [bgImage, setBgImage]     = useState(null);
  const [publishing, setPublishing] = useState(false);

  const canCreate = user?.xp >= 200 && user?.coins >= 50;

  async function pickFrame() {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true,
      aspect: [1, 1], quality: 1,
    });
    if (!r.canceled) setFrameImg(r.assets[0].uri);
  }

  async function pickBgImage() {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true,
      aspect: [1, 1], quality: 0.8,
    });
    if (!r.canceled) { setBgImage(r.assets[0].uri); setBgType('image'); }
  }

  async function handleCreate() {
    if (!name.trim()) return Alert.alert('Falta nombre', 'Ponle un nombre a tu marco');
    if (!frameImage) return Alert.alert('Falta imagen', 'Sube la imagen del marco');
    if (!canCreate) return Alert.alert('Sin permisos', 'Necesitas 200 XP y 50 monedas');

    setPublishing(true);
    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('description', description.trim());
      formData.append('price', price || '50');
      formData.append('bgType', bgType);
      formData.append('bgColor', bgColor);
      formData.append('bgGradient', JSON.stringify(bgGradient));

      // Frame image
      const frameBlob = await fetch(frameImage).then(r => r.blob());
      formData.append('image', frameBlob, 'frame.png');

      const { data } = await api.post('/frames', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      updateUser({ ...user, coins: data.newCoins });
      Alert.alert('✦ Marco creado', `Tienes 5 unidades de "${name}". Publícalo en tu tienda desde Mi Colección.`, [
        { text: 'Ver colección', onPress: () => navigation.replace('Collection') },
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'No se pudo crear el marco');
    } finally {
      setPublishing(false);
    }
  }

  // Preview background
  function BgPreview({ style }) {
    if (bgType === 'image' && bgImage)
      return <Image source={{ uri: bgImage }} style={[style, { position: 'absolute' }]} resizeMode="cover" />;
    if (bgType === 'gradient')
      return <LinearGradient colors={bgGradient} style={[style, { position: 'absolute' }]} />;
    return <View style={[style, { position: 'absolute', backgroundColor: bgColor }]} />;
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.textHi} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>CREAR MARCO</Text>
          <View style={{ width: 36 }} />
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Requisitos */}
        {!canCreate && (
          <View style={s.reqBanner}>
            <Ionicons name="warning-outline" size={16} color="rgba(251,191,36,1)" />
            <Text style={s.reqTxt}>
              Necesitas {user?.xp < 200 ? `${200 - (user?.xp||0)} XP más` : ''}{user?.xp < 200 && (user?.coins||0) < 50 ? ' y ' : ''}{(user?.coins||0) < 50 ? `${50 - (user?.coins||0)} monedas más` : ''} para crear marcos
            </Text>
          </View>
        )}

        {/* Preview */}
        <View style={s.previewSection}>
          <Text style={s.sectionLabel}>PREVIEW</Text>
          <View style={s.previewCard}>
            <BgPreview style={StyleSheet.absoluteFillObject} />
            <View style={s.previewContent}>
              <AvatarWithFrame
                size={70}
                avatarUrl={user?.avatarUrl}
                username={user?.username}
                profileFrame={frameImage ? 'frame_001' : null}
              />
              {frameImage && (
                <Image
                  source={{ uri: frameImage }}
                  style={{ position: 'absolute', width: 100, height: 100 }}
                  resizeMode="contain"
                />
              )}
            </View>
            <Text style={s.previewName}>{name || 'Nombre del marco'}</Text>
          </View>
        </View>

        {/* Imagen del marco */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>IMAGEN DEL MARCO *</Text>
          <Text style={s.sectionHint}>PNG o WebP con fondo transparente, máx 600×600px</Text>
          <TouchableOpacity style={s.uploadBtn} onPress={pickFrame}>
            {frameImage ? (
              <Image source={{ uri: frameImage }} style={s.uploadPreview} resizeMode="contain" />
            ) : (
              <View style={s.uploadEmpty}>
                <Ionicons name="image-outline" size={32} color={colors.c1} />
                <Text style={s.uploadTxt}>Toca para subir</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Nombre */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>NOMBRE *</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="Ej: Marco Nebulosa"
            placeholderTextColor={colors.textDim}
            maxLength={50}
          />
          <Text style={s.charCount}>{name.length}/50</Text>
        </View>

        {/* Descripción */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>DESCRIPCIÓN</Text>
          <TextInput
            style={[s.input, { height: 80, textAlignVertical: 'top' }]}
            value={description}
            onChangeText={setDesc}
            placeholder="Describe tu marco..."
            placeholderTextColor={colors.textDim}
            multiline maxLength={200}
          />
        </View>

        {/* Fondo */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>FONDO DEL PREVIEW</Text>

          {/* Tipo de fondo */}
          <View style={s.bgTypePicker}>
            {[['color','Color'],['gradient','Gradiente'],['image','Imagen']].map(([k,l]) => (
              <TouchableOpacity key={k} style={[s.bgTypeBtn, bgType===k && s.bgTypeBtnActive]}
                onPress={() => setBgType(k)}>
                <Text style={[s.bgTypeTxt, bgType===k && s.bgTypeTxtActive]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {bgType === 'color' && (
            <View style={s.colorGrid}>
              {BG_COLORS.map(col => (
                <TouchableOpacity key={col} style={[s.colorSwatch, { backgroundColor: col },
                  bgColor === col && s.colorSwatchActive]}
                  onPress={() => setBgColor(col)} />
              ))}
            </View>
          )}

          {bgType === 'gradient' && (
            <View style={s.colorGrid}>
              {BG_GRADIENTS.map((grad, i) => (
                <TouchableOpacity key={i}
                  style={[s.gradSwatch, bgGradient === grad && s.colorSwatchActive]}
                  onPress={() => setBgGrad(grad)}>
                  <LinearGradient colors={grad} style={StyleSheet.absoluteFillObject} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {bgType === 'image' && (
            <TouchableOpacity style={s.uploadBtn} onPress={pickBgImage}>
              {bgImage ? (
                <Image source={{ uri: bgImage }} style={s.uploadPreview} resizeMode="cover" />
              ) : (
                <View style={s.uploadEmpty}>
                  <Ionicons name="image-outline" size={28} color={colors.textDim} />
                  <Text style={s.uploadTxt}>Subir imagen de fondo</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Precio */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>PRECIO (monedas)</Text>
          <Text style={s.sectionHint}>Cada compra = 5 unidades. Tú recibes el 85%.</Text>
          <View style={s.priceRow}>
            {['25','50','75','100'].map(p => (
              <TouchableOpacity key={p} style={[s.priceBtn, price===p && s.priceBtnActive]}
                onPress={() => setPrice(p)}>
                <Text style={[s.priceTxt, price===p && s.priceTxtActive]}>✦{p}</Text>
              </TouchableOpacity>
            ))}
            <TextInput
              style={s.priceInput}
              value={price}
              onChangeText={v => setPrice(v.replace(/[^0-9]/g,''))}
              keyboardType="numeric"
              placeholder="custom"
              placeholderTextColor={colors.textDim}
            />
          </View>
        </View>

        {/* Costo de publicación */}
        <View style={s.costBanner}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textDim} />
          <Text style={s.costTxt}>Crear marco cuesta <Text style={{ color: 'rgba(251,191,36,1)' }}>50 monedas</Text> y requiere <Text style={{ color: colors.c1 }}>200 XP</Text>. Recibirás 5 unidades.</Text>
        </View>

        {/* Botón crear */}
        <TouchableOpacity
          style={[s.createBtn, (!canCreate || publishing) && s.createBtnDisabled]}
          onPress={handleCreate}
          disabled={!canCreate || publishing}
        >
          {publishing ? (
            <ActivityIndicator color="#000" size={18} />
          ) : (
            <>
              <Ionicons name="sparkles" size={18} color="#000" />
              <Text style={s.createBtnTxt}>Crear marco (50 ✦)</Text>
            </>
          )}
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.black },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, justifyContent: 'space-between' },
  backBtn:{ padding: 4 },
  headerTitle: { color: colors.textHi, fontSize: 13, fontWeight: '800', letterSpacing: 2.5 },
  scroll: { paddingBottom: 40 },

  reqBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, padding: 12, backgroundColor: 'rgba(251,191,36,0.08)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)' },
  reqTxt:    { color: 'rgba(251,191,36,0.9)', fontSize: 12, flex: 1 },

  previewSection: { alignItems: 'center', paddingVertical: 20 },
  previewCard: { width: 160, height: 160, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  previewContent: { alignItems: 'center', justifyContent: 'center', width: 100, height: 100 },
  previewName: { color: colors.textDim, fontSize: 11, marginTop: 8 },

  section:      { paddingHorizontal: 16, marginBottom: 20 },
  sectionLabel: { color: colors.textDim, fontSize: 9, fontWeight: '800', letterSpacing: 2.5, marginBottom: 8 },
  sectionHint:  { color: colors.textDim, fontSize: 11, marginBottom: 10 },

  uploadBtn:     { height: 120, borderRadius: 16, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.02)' },
  uploadPreview: { width: '100%', height: '100%' },
  uploadEmpty:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  uploadTxt:     { color: colors.textDim, fontSize: 12 },

  input:      { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: colors.textHi, fontSize: 14 },
  charCount:  { color: colors.textDim, fontSize: 10, textAlign: 'right', marginTop: 4 },

  bgTypePicker: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  bgTypeBtn:    { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.03)' },
  bgTypeBtnActive: { borderColor: colors.c1, backgroundColor: 'rgba(0,229,204,0.1)' },
  bgTypeTxt:    { color: colors.textDim, fontSize: 12, fontWeight: '600' },
  bgTypeTxtActive: { color: colors.c1 },

  colorGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  colorSwatch:  { width: 36, height: 36, borderRadius: 10, borderWidth: 2, borderColor: 'transparent' },
  colorSwatchActive: { borderColor: colors.c1 },
  gradSwatch:   { width: 36, height: 36, borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },

  priceRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  priceBtn:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.03)' },
  priceBtnActive: { borderColor: 'rgba(251,191,36,0.6)', backgroundColor: 'rgba(251,191,36,0.08)' },
  priceTxt:    { color: colors.textDim, fontSize: 12, fontWeight: '700' },
  priceTxtActive: { color: 'rgba(251,191,36,1)' },
  priceInput:  { flex: 1, minWidth: 70, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: colors.textHi, fontSize: 13 },

  costBanner:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginHorizontal: 16, marginBottom: 20, padding: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  costTxt:     { color: colors.textDim, fontSize: 12, flex: 1, lineHeight: 18 },

  createBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, paddingVertical: 16, borderRadius: 18, backgroundColor: 'rgba(244,114,182,0.85)' },
  createBtnDisabled: { opacity: 0.4 },
  createBtnTxt: { color: '#000', fontSize: 15, fontWeight: '800' },
});
