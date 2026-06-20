import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  ImageBackground, ScrollView, ActivityIndicator, Alert, Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../theme/colors';

const PRESETS = [
  { id: 'default', label: 'Original',    type: 'image' },
  { id: 'night',   label: 'Noche',       type: 'color', color: '#020D1A' },
  { id: 'void',    label: 'Void',        type: 'color', color: '#050505' },
  { id: 'purple',  label: 'Deep Purple', type: 'color', color: '#0D0714' },
  { id: 'teal',    label: 'Deep Teal',   type: 'color', color: '#030F10' },
];

export default function ChatBackgroundScreen({ navigation, route }) {
  const { chatId, currentBg = 'default' } = route.params;
  const insets = useSafeAreaInsets();
  const [selected,    setSelected]    = useState(currentBg);
  const [uploading,   setUploading]   = useState(false);
  const [applyToAll,  setApplyToAll]  = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('chatBg_applyToAll').then(v => {
      if (v === 'true') setApplyToAll(true);
    }).catch(() => {});
  }, []);

  async function handleToggleApplyToAll(value) {
    setApplyToAll(value);
    await AsyncStorage.setItem('chatBg_applyToAll', value ? 'true' : 'false').catch(() => {});
  }

  async function handleSelect(presetId) {
    setSelected(presetId);
    const key = applyToAll ? 'chatBg_default' : `chatBg_${chatId}`;
    await AsyncStorage.setItem(key, presetId).catch(() => {});
    navigation.goBack();
  }

  async function handlePickCustom() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.85,
    });
    if (result.canceled) return;

    setUploading(true);
    try {
      const uri = result.assets[0].uri;
      const token = await AsyncStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', { uri, type: 'image/jpeg', name: 'bg.jpg' });
      const BASE_URL = process.env.EXPO_PUBLIC_API_URL;
      const res = await fetch(`${BASE_URL}/chats/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al subir');
      const key = applyToAll ? 'chatBg_default' : `chatBg_${chatId}`;
      await AsyncStorage.setItem(key, data.url).catch(() => {});
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'No se pudo subir la imagen');
    } finally {
      setUploading(false);
    }
  }

  const isCustomUrl = selected?.startsWith('http');

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.textHi} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Fondo del chat</Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={[s.grid, { paddingBottom: insets.bottom + 24 }]}>

        {/* ── 5 presets ── */}
        {PRESETS.map(p => {
          const active = selected === p.id;
          return (
            <TouchableOpacity
              key={p.id}
              style={[s.card, active && s.cardActive]}
              onPress={() => handleSelect(p.id)}
              activeOpacity={0.8}
            >
              {p.type === 'image' ? (
                <ImageBackground
                  source={require('../../assets/chat-bg.jpeg')}
                  style={s.preview}
                  resizeMode="cover"
                >
                  <View style={s.previewOverlay} />
                  {active && <View style={s.checkWrap}><Ionicons name="checkmark-circle" size={28} color={colors.c1} /></View>}
                </ImageBackground>
              ) : (
                <View style={[s.preview, { backgroundColor: p.color }]}>
                  {active && <View style={s.checkWrap}><Ionicons name="checkmark-circle" size={28} color={colors.c1} /></View>}
                </View>
              )}
              <Text style={[s.label, active && s.labelActive]}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}

        {/* ── Opción custom: imagen propia ── */}
        <TouchableOpacity
          style={[s.card, isCustomUrl && s.cardActive]}
          onPress={handlePickCustom}
          activeOpacity={0.8}
          disabled={uploading}
        >
          {isCustomUrl ? (
            <ImageBackground source={{ uri: selected }} style={s.preview} resizeMode="cover">
              {uploading && <View style={s.checkWrap}><ActivityIndicator color={colors.c1} /></View>}
            </ImageBackground>
          ) : (
            <View style={[s.preview, s.uploadPreview]}>
              {uploading
                ? <ActivityIndicator color={colors.c1} size="large" />
                : <Ionicons name="cloud-upload-outline" size={32} color={colors.textDim} />}
            </View>
          )}
          <Text style={[s.label, isCustomUrl && s.labelActive]}>
            {uploading ? 'Subiendo…' : 'Fondo propio'}
          </Text>
        </TouchableOpacity>

        {/* ── Toggle aplicar a todos ── */}
        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.toggleLabel}>Aplicar a todos mis chats privados</Text>
            <Text style={s.toggleSub}>La imagen se sube una sola vez</Text>
          </View>
          <Switch
            value={applyToAll}
            onValueChange={handleToggleApplyToAll}
            trackColor={{ false: colors.border, true: 'rgba(0,229,204,0.4)' }}
            thumbColor={applyToAll ? colors.c1 : colors.textDim}
          />
        </View>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.black },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn:     { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.textHi, fontSize: 15, fontWeight: '700' },

  grid:       { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 14 },
  card:       { width: '46%', borderRadius: 18, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.border },
  cardActive: { borderColor: colors.c1 },

  preview:        { width: '100%', aspectRatio: 0.72, alignItems: 'center', justifyContent: 'center' },
  previewOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(2,5,9,0.55)' },
  uploadPreview:  { backgroundColor: colors.card },
  checkWrap:      { alignItems: 'center', justifyContent: 'center' },

  label:       { color: colors.textDim, fontSize: 12, fontWeight: '600', textAlign: 'center', paddingVertical: 10, backgroundColor: colors.card },
  labelActive: { color: colors.c1 },

  toggleRow:   { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16 },
  toggleLabel: { color: colors.textHi, fontSize: 13, fontWeight: '600' },
  toggleSub:   { color: colors.textDim, fontSize: 11, marginTop: 2 },
});
