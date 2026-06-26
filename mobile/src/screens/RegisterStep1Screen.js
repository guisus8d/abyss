import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  Image, StyleSheet, StatusBar, Dimensions, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

const { width: W } = Dimensions.get('window');
const CAROUSEL_ITEM_SIZE = 88;

const PRESET_URLS = Array.from({ length: 8 }, (_, i) =>
  `https://res.cloudinary.com/dlpdzgkeg/image/upload/v1781913669/avatars/presets/preset_bot_0${i + 1}.png`
);

// Presets + un item de cámara como último elemento del carrusel
const CAROUSEL_DATA = [
  ...PRESET_URLS.map(url => ({ type: 'preset', url })),
  { type: 'camera' },
];

function StepDots({ current }) {
  return (
    <View style={dots.row}>
      {[0, 1, 2, 3].map(i => (
        <View key={i} style={[dots.dot, i === current ? dots.dotActive : dots.dotInactive]} />
      ))}
    </View>
  );
}
const dots = StyleSheet.create({
  row:         { flexDirection: 'row', gap: 6, marginBottom: 32 },
  dot:         { height: 6, borderRadius: 3 },
  dotActive:   { width: 20, backgroundColor: '#00e5cc' },
  dotInactive: { width: 6,  backgroundColor: 'rgba(0,229,204,0.2)' },
});

const vUsername = (v) => /^[a-zA-Z0-9_]{3,20}$/.test(v);
const errUsername = (v) => {
  if (!v) return '';
  if (v.length < 3)  return 'Minimo 3 caracteres';
  if (v.length > 20) return 'Maximo 20 caracteres';
  if (!/^[a-zA-Z0-9_]+$/.test(v)) return 'Solo letras, numeros y _';
  return '';
};

export default function RegisterStep1Screen({ navigation, route }) {
  const insets  = useSafeAreaInsets();
  const regData = route.params?.regData || {};

  const [username,       setUsername]       = useState(regData.username || '');
  const [selectedPreset, setSelectedPreset] = useState(
    regData.avatarIsPreset !== false ? (regData.avatarUri || PRESET_URLS[0]) : PRESET_URLS[0]
  );
  const [customAvatar,   setCustomAvatar]   = useState(
    regData.avatarIsPreset === false ? regData.avatarUri : null
  );

  async function pickCustomAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso necesario', 'Necesitamos acceso a tu galeria para elegir una foto.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      setCustomAvatar(result.assets[0].uri);
      setSelectedPreset(null);
    }
  }

  function handleNext() {
    const avatarUri      = customAvatar || selectedPreset || PRESET_URLS[0];
    const avatarIsPreset = !customAvatar;
    navigation.navigate('RegisterStep2', {
      regData: { ...regData, username: username.trim(), avatarUri, avatarIsPreset },
    });
  }

  const canContinue = vUsername(username);

  function renderCarouselItem({ item }) {
    if (item.type === 'camera') {
      const isSelected = !!customAvatar;
      return (
        <TouchableOpacity
          onPress={pickCustomAvatar}
          activeOpacity={0.75}
          style={[s.presetWrap, isSelected && s.presetWrapSelected]}
        >
          {customAvatar ? (
            <>
              <Image source={{ uri: customAvatar }} style={s.presetImg} />
              <View style={s.presetCheck}>
                <Ionicons name="checkmark" size={10} color="#001a18" />
              </View>
            </>
          ) : (
            <View style={s.cameraCircle}>
              <Ionicons name="camera" size={22} color="rgba(232,244,248,0.5)" />
            </View>
          )}
        </TouchableOpacity>
      );
    }

    // Preset item
    const isSelected = !customAvatar && selectedPreset === item.url;
    return (
      <TouchableOpacity
        onPress={() => { setSelectedPreset(item.url); setCustomAvatar(null); }}
        activeOpacity={0.75}
        style={[s.presetWrap, isSelected && s.presetWrapSelected]}
      >
        <Image source={{ uri: item.url }} style={s.presetImg} />
        {isSelected && (
          <View style={s.presetCheck}>
            <Ionicons name="checkmark" size={10} color="#001a18" />
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top + 8 }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.black} />
      <LinearGradient
        colors={['#000d1a', '#001a2e', '#002a3a', '#001020']}
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color="rgba(232,244,248,0.7)" />
        </TouchableOpacity>
      </View>

      <View style={s.content}>
        <StepDots current={0} />

        <Text style={s.title}>Elige tu identidad</Text>
        <Text style={s.subtitle}>Como te van a conocer en las profundidades</Text>

        {/* ── Carrusel de avatares — primero ── */}
        <Text style={s.label}>FOTO DE PERFIL</Text>
        <View style={s.carouselWrap}>
          <FlatList
            horizontal
            data={CAROUSEL_DATA}
            keyExtractor={(item, i) => item.url || `camera-${i}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.carouselContent}
            renderItem={renderCarouselItem}
          />
          {/* Edge fades */}
          <LinearGradient
            colors={['#00080f', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.fadeLeft}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['transparent', '#00080f']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.fadeRight}
            pointerEvents="none"
          />
        </View>

        {/* ── Username — debajo del carrusel ── */}
        <View style={s.field}>
          <Text style={s.label}>NOMBRE DE USUARIO</Text>
          <View style={[
            s.inputWrap,
            { borderColor: username
              ? (vUsername(username) ? 'rgba(0,229,204,0.5)' : 'rgba(239,68,68,0.45)')
              : 'rgba(255,255,255,0.08)'
            },
          ]}>
            <Ionicons name="at-outline" size={16} color="rgba(0,229,204,0.4)" style={s.inputIcon} />
            <TextInput
              style={s.input}
              placeholder="tu_nombre_aqui"
              placeholderTextColor="rgba(255,255,255,0.18)"
              value={username}
              onChangeText={v => setUsername(v.replace(/\s/g, ''))}
              autoCapitalize="none"
              maxLength={20}
            />
            {username.length > 0 && (
              <Ionicons
                name={vUsername(username) ? 'checkmark-circle' : 'close-circle'}
                size={16}
                color={vUsername(username) ? 'rgba(0,229,204,0.7)' : 'rgba(239,68,68,0.7)'}
                style={{ marginRight: 12 }}
              />
            )}
          </View>
          {!!errUsername(username) && (
            <Text style={s.fieldErr}>{errUsername(username)}</Text>
          )}
        </View>
      </View>

      {/* Footer */}
      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <TouchableOpacity
          onPress={handleNext}
          disabled={!canContinue}
          activeOpacity={0.85}
          style={{ opacity: canContinue ? 1 : 0.3 }}
        >
          <LinearGradient
            colors={['#005c55', '#00b4a0', '#00e5cc']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.btnNext}
          >
            <Text style={s.btnNextTxt}>SIGUIENTE</Text>
            <Ionicons name="chevron-forward" size={15} color="#001a18" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#000d1a' },
  header:  { paddingHorizontal: 16, paddingBottom: 8 },
  backBtn: { padding: 8, alignSelf: 'flex-start' },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
  footer:  { paddingHorizontal: 24, paddingTop: 12 },

  title:    { fontSize: 22, fontWeight: '700', color: '#e8f4f8', marginBottom: 6 },
  subtitle: { fontSize: 13, color: 'rgba(232,244,248,0.4)', marginBottom: 28, lineHeight: 18 },

  label:   { fontSize: 9, letterSpacing: 3, color: 'rgba(0,229,204,0.5)', marginBottom: 12, fontWeight: '700' },

  // Carousel
  carouselWrap: {
    position: 'relative',
    marginHorizontal: -24, // sangría negativa para que el carrusel ocupe el ancho completo
    marginBottom: 28,
  },
  carouselContent: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    gap: 14,
  },
  presetWrap: {
    width: CAROUSEL_ITEM_SIZE,
    height: CAROUSEL_ITEM_SIZE,
    borderRadius: CAROUSEL_ITEM_SIZE / 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  presetWrapSelected: {
    borderColor: '#00e5cc',
    shadowColor: '#00e5cc',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    shadowOpacity: 0.5,
    elevation: 4,
  },
  presetImg: { width: '100%', height: '100%', borderRadius: CAROUSEL_ITEM_SIZE / 2 },
  presetCheck: {
    position: 'absolute', bottom: 2, right: 2,
    backgroundColor: '#00e5cc', borderRadius: 8,
    width: 16, height: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  cameraCircle: {
    width: CAROUSEL_ITEM_SIZE,
    height: CAROUSEL_ITEM_SIZE,
    borderRadius: CAROUSEL_ITEM_SIZE / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fadeLeft: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 30, zIndex: 1,
  },
  fadeRight: {
    position: 'absolute', right: 0, top: 0, bottom: 0, width: 30, zIndex: 1,
  },

  // Username field
  field:     { marginBottom: 0 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14, overflow: 'hidden',
  },
  inputIcon: { paddingHorizontal: 14 },
  input:     { flex: 1, paddingVertical: 14, paddingRight: 14, color: '#e8f4f8', fontSize: 14 },
  fieldErr:  { color: 'rgba(239,68,68,0.8)', fontSize: 10, marginTop: 5, marginLeft: 4 },

  // Next button
  btnNext:    { borderRadius: 14, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnNextTxt: { color: '#001a18', fontSize: 12, fontWeight: '800', letterSpacing: 3 },
});
