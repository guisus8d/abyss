import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, StatusBar, FlatList, KeyboardAvoidingView,
  Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import api from '../services/api';
import CoinIcon from '../components/CoinIcon';

function formatSaleDate(date) {
  return new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function SaleRow({ sale }) {
  const frame = sale.item;
  const buyer = sale.emisor;
  return (
    <View style={s.saleRow}>
      {frame?.imageUrl
        ? <Image source={{ uri: frame.imageUrl }} style={s.saleFrameImg} resizeMode="cover" />
        : <View style={[s.saleFrameImg, s.saleFrameImgPh]}><Ionicons name="sparkles-outline" size={16} color={colors.textDim} /></View>}
      <View style={{ flex: 1 }}>
        <Text style={s.saleFrameName} numberOfLines={1}>{frame?.name || 'Marco eliminado'}</Text>
        <Text style={s.saleBuyer} numberOfLines={1}>@{buyer?.username || 'usuario'}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <CoinIcon size={10} />
          <Text style={s.salePrice}>{sale.monto}</Text>
        </View>
        <Text style={s.saleDate}>{formatSaleDate(sale.createdAt)}</Text>
      </View>
    </View>
  );
}

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://abyss-production-7171.up.railway.app/api';

async function uploadStoreImage(localUri, field) {
  const token = await AsyncStorage.getItem('token');
  const formData = new FormData();
  formData.append(field, { uri: localUri, type: 'image/jpeg', name: `${field}.jpg` });
  const res = await fetch(`${BASE_URL}/store/me/${field}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Error al subir ${field}`);
  return data.url;
}

async function pickImage(aspect, allowsEditing = true) {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') throw new Error('Permiso de galería requerido');
  const opts = { mediaTypes: ['images'], allowsEditing, quality: 0.85 };
  if (allowsEditing && aspect) opts.aspect = aspect;
  const result = await ImagePicker.launchImageLibraryAsync(opts);
  if (result.canceled) return null;
  return result.assets[0].uri;
}

function TextField({ label, value, onChangeText, placeholder, multiline, maxLength }) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.input, multiline && s.inputMulti]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textDim}
        multiline={multiline}
        maxLength={maxLength}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
      {maxLength && <Text style={s.charCount}>{value.length}/{maxLength}</Text>}
    </View>
  );
}

function ImageField({ label, uri, onPick, uploading, aspect, hint, changeText = 'Cambiar imagen' }) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TouchableOpacity style={s.imagePicker} onPress={onPick} disabled={uploading} activeOpacity={0.8}>
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <LinearGradient
            colors={['rgba(0,229,204,0.06)', 'rgba(41,121,255,0.06)']}
            style={StyleSheet.absoluteFill}
          />
        )}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', gap: 6 }]}>
          {uploading
            ? <ActivityIndicator color={colors.c1} />
            : <>
                <View style={s.imagePickerIcon}>
                  <Ionicons name={uri ? 'pencil-outline' : 'camera-outline'} size={22} color={colors.c1} />
                </View>
                <Text style={s.imagePickerTxt}>{uri ? changeText : 'Subir imagen'}</Text>
                {hint && !uri && <Text style={s.imagePickerHint}>{hint}</Text>}
              </>}
        </View>
      </TouchableOpacity>
    </View>
  );
}

export default function CreateStoreScreen({ navigation, route }) {
  const existing  = route.params?.store;
  const onCreated = route.params?.onCreated;
  const isEdit    = !!existing;

  const [nombre,      setNombre]      = useState(existing?.nombre      || '');
  const [descripcion, setDescripcion] = useState(existing?.descripcion || '');
  const [bannerLocal, setBannerLocal] = useState(existing?.banner || null);
  const [logoLocal,   setLogoLocal]   = useState(existing?.logo   || null);
  const [loading,     setLoading]     = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingLogo,   setUploadingLogo]   = useState(false);
  const [errMsg,      setErrMsg]      = useState('');

  const [sales,        setSales]        = useState([]);
  const [salesLoading, setSalesLoading] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    setSalesLoading(true);
    api.get('/market/my-sales')
      .then(({ data }) => setSales(data.sales || []))
      .catch(() => {})
      .finally(() => setSalesLoading(false));
  }, [isEdit]);

  async function handlePickBanner() {
    try {
      const uri = await pickImage(null, false);
      if (!uri) return;
      setBannerLocal(uri);
    } catch (e) { setErrMsg(e.message); }
  }

  async function handlePickLogo() {
    try {
      const uri = await pickImage([1, 1]);
      if (!uri) return;
      setLogoLocal(uri);
    } catch (e) { setErrMsg(e.message); }
  }

  async function submit() {
    if (!nombre.trim()) { setErrMsg('El nombre de la tienda es requerido'); return; }
    setLoading(true);
    setErrMsg('');
    try {
      // 1. Crear o actualizar datos de texto
      if (isEdit) {
        await api.patch('/store/me', { nombre: nombre.trim(), descripcion: descripcion.trim() });
      } else {
        await api.post('/store', { nombre: nombre.trim(), descripcion: descripcion.trim() });
      }

      // 2. Subir banner si es una URI local (no URL remota)
      if (bannerLocal && bannerLocal.startsWith('file')) {
        setUploadingBanner(true);
        await uploadStoreImage(bannerLocal, 'banner');
        setUploadingBanner(false);
      }

      // 3. Subir logo si es una URI local
      if (logoLocal && logoLocal.startsWith('file')) {
        setUploadingLogo(true);
        await uploadStoreImage(logoLocal, 'logo');
        setUploadingLogo(false);
      }

      onCreated?.();
      navigation.goBack();
    } catch (e) {
      setErrMsg(e.response?.data?.error || e.message || 'Error al guardar');
      setUploadingBanner(false);
      setUploadingLogo(false);
    } finally {
      setLoading(false);
    }
  }

  const isUploading = loading || uploadingBanner || uploadingLogo;
  const uploadLabel = uploadingBanner ? 'Subiendo banner...' : uploadingLogo ? 'Subiendo logo...' : 'Guardando...';

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" backgroundColor={colors.black} />
      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.textHi} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{isEdit ? 'EDITAR TIENDA' : 'CREAR TIENDA'}</Text>
          <View style={{ width: 28 }} />
        </View>
      </SafeAreaView>

      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={s.body}
        showsVerticalScrollIndicator={false}
        data={isEdit ? sales : []}
        keyExtractor={item => item._id}
        renderItem={({ item }) => <SaleRow sale={item} />}
        ListHeaderComponent={() => (
          <>
            <View style={s.iconWrap}>
              <Ionicons name="storefront-outline" size={36} color={colors.c1} />
            </View>
            <Text style={s.subhead}>
              {isEdit ? 'Actualiza la información de tu tienda' : 'Crea tu tienda para vender marcos a la comunidad de Abyss'}
            </Text>

            <TextField
              label="Nombre de la tienda *"
              value={nombre}
              onChangeText={setNombre}
              placeholder="Ej: Pixel Arts Studio"
              maxLength={50}
            />
            <TextField
              label="Descripción"
              value={descripcion}
              onChangeText={setDescripcion}
              placeholder="Describe tu tienda en pocas palabras..."
              multiline
              maxLength={300}
            />

            <View style={s.separator}>
              <View style={s.sepLine} />
              <Text style={s.sepTxt}>IMÁGENES</Text>
              <View style={s.sepLine} />
            </View>

            <ImageField
              label="Fondo"
              uri={bannerLocal}
              onPick={handlePickBanner}
              uploading={uploadingBanner}
              hint="Recomendado 1600×500 px"
              changeText="Cambiar fondo"
            />

            <ImageField
              label="Logo"
              uri={logoLocal}
              onPick={handlePickLogo}
              uploading={uploadingLogo}
              aspect={[1, 1]}
              hint="Recomendado cuadrado"
              changeText="Cambiar logo"
            />

            <Text style={s.fallbackNote}>
              Si no subes banner o logo, se mostrará un fondo degradado automático.
            </Text>

            {errMsg ? (
              <View style={s.errBox}>
                <Ionicons name="alert-circle-outline" size={15} color={colors.c4} />
                <Text style={s.errTxt}>{errMsg}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[s.submitBtn, isUploading && { opacity: 0.6 }]}
              onPress={submit}
              disabled={isUploading}
            >
              {isUploading
                ? <><ActivityIndicator size={16} color={colors.black} /><Text style={s.submitTxt}>{uploadLabel}</Text></>
                : <Text style={s.submitTxt}>{isEdit ? 'Guardar cambios' : 'Crear tienda'}</Text>}
            </TouchableOpacity>

            {isEdit && (
              <View style={s.separator}>
                <View style={s.sepLine} />
                <Text style={s.sepTxt}>HISTORIAL DE VENTAS</Text>
                <View style={s.sepLine} />
              </View>
            )}
            {isEdit && salesLoading && <ActivityIndicator color={colors.c1} style={{ marginTop: 12 }} />}
          </>
        )}
        ListEmptyComponent={() => (
          isEdit && !salesLoading ? (
            <View style={s.emptySales}>
              <Ionicons name="receipt-outline" size={28} color={colors.textDim} />
              <Text style={s.emptySalesTxt}>Aún no has vendido ningún marco</Text>
            </View>
          ) : null
        )}
      />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn:     { padding: 4 },
  headerTitle: { color: colors.textHi, fontSize: 13, fontWeight: '800', letterSpacing: 2.5 },

  body:    { paddingHorizontal: 20, paddingBottom: 50 },
  iconWrap:{ alignSelf: 'center', width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(0,229,204,0.08)', borderWidth: 1, borderColor: 'rgba(0,229,204,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  subhead: { color: colors.textDim, fontSize: 13, textAlign: 'center', marginBottom: 28, lineHeight: 18 },

  fieldWrap:  { marginBottom: 18 },
  fieldLabel: { color: colors.textMid, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  input:      { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, color: colors.textHi, fontSize: 14, paddingHorizontal: 14, paddingVertical: 12 },
  inputMulti: { minHeight: 90, paddingTop: 12 },
  charCount:  { color: colors.textDim, fontSize: 10, textAlign: 'right', marginTop: 4 },

  separator: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 8, marginBottom: 18 },
  sepLine:   { flex: 1, height: 1, backgroundColor: colors.border },
  sepTxt:    { color: colors.textDim, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },

  imagePicker: {
    height: 110, borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
    position: 'relative',
  },
  imagePickerIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(0,229,204,0.15)', borderWidth: 1, borderColor: 'rgba(0,229,204,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  imagePickerTxt:  { color: colors.textHi, fontSize: 13, fontWeight: '600' },
  imagePickerHint: { color: colors.textDim, fontSize: 10 },

  fallbackNote: { color: colors.textDim, fontSize: 11, textAlign: 'center', marginBottom: 20, lineHeight: 16 },

  errBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(249,115,22,0.1)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(249,115,22,0.25)', padding: 12, marginBottom: 16 },
  errTxt:  { color: colors.c4, fontSize: 13, flex: 1 },

  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.c1, borderRadius: 18, paddingVertical: 16, marginTop: 8 },
  submitTxt: { color: colors.black, fontSize: 15, fontWeight: '800' },

  saleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14,
    borderWidth: 1, borderColor: colors.border,
    padding: 10, marginBottom: 10,
  },
  saleFrameImg:   { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.surface },
  saleFrameImgPh: { alignItems: 'center', justifyContent: 'center' },
  saleFrameName:  { color: colors.textHi, fontSize: 13, fontWeight: '700' },
  saleBuyer:      { color: colors.textDim, fontSize: 11, marginTop: 2 },
  salePrice:      { color: 'rgba(251,191,36,1)', fontSize: 13, fontWeight: '800' },
  saleDate:       { color: colors.textDim, fontSize: 10, marginTop: 3 },

  emptySales:    { alignItems: 'center', gap: 8, paddingVertical: 24 },
  emptySalesTxt: { color: colors.textDim, fontSize: 12, textAlign: 'center' },
});
