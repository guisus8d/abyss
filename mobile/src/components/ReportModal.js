import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Image, ScrollView,
  Platform, Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://abyss-production-7171.up.railway.app/api';
const { width: W } = Dimensions.get('window');

const REASONS = [
  { key: 'spam',           label: 'Spam o publicidad no deseada',       icon: 'ban-outline' },
  { key: 'hate',           label: 'Discurso de odio o discriminación',  icon: 'flame-outline' },
  { key: 'harassment',     label: 'Acoso o bullying',                   icon: 'alert-circle-outline' },
  { key: 'violence',       label: 'Contenido violento o perturbador',   icon: 'warning-outline' },
  { key: 'nsfw',           label: 'Contenido sexual inapropiado',       icon: 'eye-off-outline' },
  { key: 'misinformation', label: 'Desinformación',                     icon: 'newspaper-outline' },
  { key: 'other',          label: 'Otro motivo',                        icon: 'chatbubble-outline' },
];

const TYPE_LABELS = { post: 'publicación', user: 'usuario', group: 'grupo' };

export default function ReportModal({ visible, onClose, type, targetId, targetName, targetAuthorId }) {
  const insets = useSafeAreaInsets();

  const [selectedReason, setSelectedReason] = useState(null);
  const [details,        setDetails]        = useState('');
  const [images,         setImages]         = useState([]); // max 4
  const [loading,        setLoading]        = useState(false);
  const [done,           setDone]           = useState(false);
  const [error,          setError]          = useState('');

  function reset() {
    setSelectedReason(null); setDetails('');
    setImages([]); setLoading(false); setDone(false); setError('');
  }

  function handleClose() { reset(); onClose(); }

  async function pickImage() {
    if (images.length >= 4) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsEditing: false, quality: 0.8,
      });
      if (!result.canceled) {
        setImages(prev => [...prev, { uri: result.assets[0].uri }]);
      }
    } catch {}
  }

  function removeImage(idx) {
    setImages(prev => prev.filter((_, i) => i !== idx));
  }

  async function submit() {
    if (!selectedReason) { setError('Selecciona un motivo'); return; }
    setLoading(true);
    setError('');
    try {
      const token = await AsyncStorage.getItem('token');
      const formData = new FormData();

      formData.append('type',       type);
      formData.append('targetId',   String(targetId));
      formData.append('targetName', targetName || '');
      formData.append('reason',     selectedReason);
      formData.append('details',    details);
      if (targetAuthorId) formData.append('targetAuthorId', String(targetAuthorId));

      // ── CORRECTO para React Native: pasar objeto {uri, type, name} directamente ──
      // NO usar blob — eso es solo para web. En RN el runtime maneja el stream nativo.
      images.forEach((img, i) => {
        const ext      = img.uri.split('.').pop()?.toLowerCase() || 'jpg';
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
        formData.append('images', {
          uri:  img.uri,
          type: mimeType,
          name: `evidence_${i}.${ext}`,
        });
      });

      const res = await fetch(`${BASE_URL}/reports`, {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${token}`,
          // NO poner Content-Type manualmente — fetch lo genera con el boundary correcto
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al enviar');
      setDone(true);
    } catch (err) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      statusBarTranslucent={true}   // ← importante en Android edge-to-edge
      onRequestClose={handleClose}
    >
      {/* SafeAreaView maneja el notch y la barra de estado superior */}
      <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>

        {done ? (
          /* ── Confirmación ── */
          <View style={[s.doneBox, { paddingBottom: insets.bottom + 24 }]}>
            <View style={s.doneIconWrap}>
              <Ionicons name="checkmark-circle" size={64} color={colors.c1} />
            </View>
            <Text style={s.doneTitle}>Reporte enviado</Text>
            <Text style={s.doneSub}>
              Gracias por ayudarnos a mantener Abyss seguro.{'\n'}
              Nuestro equipo revisará esta {TYPE_LABELS[type] || 'contenido'} en breve.
            </Text>
            <TouchableOpacity style={s.doneBtn} onPress={handleClose}>
              <Text style={s.doneBtnTxt}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ── Header ── */}
            <View style={s.header}>
              <View style={s.headerIcon}>
                <Ionicons name="flag" size={18} color="rgba(239,68,68,0.9)" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>Reportar {TYPE_LABELS[type] || 'contenido'}</Text>
                {!!targetName && (
                  <Text style={s.subtitle} numberOfLines={1}>{targetName}</Text>
                )}
              </View>
              <TouchableOpacity onPress={handleClose} style={s.closeBtn}>
                <Ionicons name="close" size={24} color={colors.textDim} />
              </TouchableOpacity>
            </View>

            {/* ── Contenido scrollable ── */}
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[
                s.scroll,
                // Padding inferior = barra de navegación del sistema
                { paddingBottom: (insets.bottom || 16) + 16 },
              ]}
            >
              {/* Motivo */}
              <Text style={s.sectionLabel}>¿Por qué reportas esto?</Text>
              {REASONS.map(r => (
                <TouchableOpacity
                  key={r.key}
                  style={[s.reasonRow, selectedReason === r.key && s.reasonRowActive]}
                  onPress={() => { setSelectedReason(r.key); setError(''); }}
                  activeOpacity={0.7}
                >
                  <View style={[s.reasonIcon, selectedReason === r.key && s.reasonIconActive]}>
                    <Ionicons name={r.icon} size={16} color={selectedReason === r.key ? colors.c1 : colors.textDim} />
                  </View>
                  <Text style={[s.reasonTxt, selectedReason === r.key && s.reasonTxtActive]}>
                    {r.label}
                  </Text>
                  {selectedReason === r.key && (
                    <Ionicons name="checkmark-circle" size={18} color={colors.c1} />
                  )}
                </TouchableOpacity>
              ))}

              {/* Detalles */}
              <Text style={[s.sectionLabel, { marginTop: 20 }]}>Detalles adicionales</Text>
              <TextInput
                style={s.detailsInput}
                placeholder="Describe lo que ocurrió (opcional)..."
                placeholderTextColor={colors.textDim}
                value={details}
                onChangeText={setDetails}
                multiline
                maxLength={400}
              />

              {/* Evidencia */}
              <View style={s.evidenceHeader}>
                <Text style={[s.sectionLabel, { marginTop: 20, marginBottom: 0 }]}>
                  Evidencia
                </Text>
                <Text style={s.evidenceCount}>{images.length}/4</Text>
              </View>
              <Text style={s.evidenceHint}>
                Adjunta capturas de pantalla que respalden tu reporte (máx. 4)
              </Text>

              <View style={s.imagesGrid}>
                {images.map((img, i) => (
                  <View key={i} style={s.imgThumbWrap}>
                    <Image source={{ uri: img.uri }} style={s.imgThumb} resizeMode="cover" />
                    <TouchableOpacity style={s.imgRemove} onPress={() => removeImage(i)}>
                      <Ionicons name="close-circle" size={22} color="rgba(239,68,68,0.95)" />
                    </TouchableOpacity>
                  </View>
                ))}
                {images.length < 4 && (
                  <TouchableOpacity style={s.imgAddBtn} onPress={pickImage} activeOpacity={0.7}>
                    <Ionicons name="camera-outline" size={26} color={colors.textDim} />
                    <Text style={s.imgAddTxt}>Añadir</Text>
                  </TouchableOpacity>
                )}
              </View>

              {!!error && <Text style={s.errorTxt}>{error}</Text>}

              {/* Botón enviar */}
              <TouchableOpacity
                style={[s.submitBtn, (!selectedReason || loading) && s.submitBtnDisabled]}
                onPress={submit}
                disabled={!selectedReason || loading}
                activeOpacity={0.8}
              >
                {loading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <>
                      <Ionicons name="flag-outline" size={16} color="#fff" />
                      <Text style={s.submitTxt}>Enviar reporte</Text>
                    </>
                }
              </TouchableOpacity>

              <Text style={s.disclaimer}>
                Los reportes falsos o de mala fe pueden resultar en sanciones a tu cuenta.
              </Text>
            </ScrollView>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const THUMB = Math.floor((W - 48 - 24) / 4);

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },

  header:     { flexDirection:'row', alignItems:'center', gap:12, padding:16, borderBottomWidth:1, borderBottomColor: colors.border },
  headerIcon: { width:40, height:40, borderRadius:20, backgroundColor:'rgba(239,68,68,0.1)', borderWidth:1, borderColor:'rgba(239,68,68,0.25)', alignItems:'center', justifyContent:'center' },
  title:      { color: colors.textHi, fontWeight:'700', fontSize:17 },
  subtitle:   { color: colors.textDim, fontSize:12, marginTop:2 },
  closeBtn:   { padding:6 },

  scroll: { padding:16 },

  sectionLabel: { color: colors.textDim, fontSize:11, fontWeight:'700', letterSpacing:1.2, marginBottom:10 },

  reasonRow:       { flexDirection:'row', alignItems:'center', gap:12, paddingVertical:13, paddingHorizontal:14, borderRadius:12, borderWidth:1, borderColor: colors.border, marginBottom:7, backgroundColor:'rgba(255,255,255,0.02)' },
  reasonRowActive: { backgroundColor:'rgba(0,229,204,0.06)', borderColor:'rgba(0,229,204,0.25)' },
  reasonIcon:      { width:32, height:32, borderRadius:16, backgroundColor:'rgba(255,255,255,0.05)', alignItems:'center', justifyContent:'center' },
  reasonIconActive:{ backgroundColor:'rgba(0,229,204,0.1)' },
  reasonTxt:       { color: colors.textMid, fontSize:14, flex:1 },
  reasonTxtActive: { color: colors.textHi, fontWeight:'600' },

  detailsInput: { backgroundColor:'rgba(8,20,36,0.95)', borderWidth:1, borderColor: colors.border, borderRadius:12, paddingHorizontal:14, paddingVertical:12, color: colors.textHi, fontSize:14, minHeight:90, textAlignVertical:'top' },

  evidenceHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop:20, marginBottom:6 },
  evidenceCount:  { color: colors.textDim, fontSize:12, fontWeight:'700' },
  evidenceHint:   { color: colors.textDim, fontSize:12, marginBottom:12, lineHeight:17 },

  imagesGrid:  { flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:4 },
  imgThumbWrap:{ width:THUMB, height:THUMB, borderRadius:10, overflow:'hidden', position:'relative' },
  imgThumb:    { width:'100%', height:'100%' },
  imgRemove:   { position:'absolute', top:3, right:3, backgroundColor:'rgba(0,0,0,0.55)', borderRadius:11 },
  imgAddBtn:   { width:THUMB, height:THUMB, borderRadius:10, borderWidth:1, borderColor: colors.border, borderStyle:'dashed', alignItems:'center', justifyContent:'center', gap:5, backgroundColor:'rgba(255,255,255,0.02)' },
  imgAddTxt:   { color: colors.textDim, fontSize:11 },

  errorTxt:          { color:'rgba(239,68,68,0.8)', fontSize:13, textAlign:'center', marginTop:10 },
  submitBtn:         { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:'rgba(239,68,68,0.8)', borderRadius:14, paddingVertical:16, marginTop:20 },
  submitBtnDisabled: { backgroundColor:'rgba(239,68,68,0.25)' },
  submitTxt:         { color:'#fff', fontWeight:'700', fontSize:15 },
  disclaimer:        { color: colors.textDim, fontSize:11, textAlign:'center', marginTop:12, lineHeight:16 },

  doneBox:     { flex:1, alignItems:'center', justifyContent:'center', padding:32, gap:16 },
  doneIconWrap:{ width:100, height:100, borderRadius:50, backgroundColor:'rgba(0,229,204,0.08)', alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(0,229,204,0.2)' },
  doneTitle:   { color: colors.textHi, fontSize:24, fontWeight:'800' },
  doneSub:     { color: colors.textDim, fontSize:14, textAlign:'center', lineHeight:22 },
  doneBtn:     { backgroundColor:'rgba(0,229,204,0.12)', borderWidth:1, borderColor:'rgba(0,229,204,0.3)', borderRadius:14, paddingVertical:14, paddingHorizontal:40, marginTop:8 },
  doneBtnTxt:  { color: colors.c1, fontWeight:'700', fontSize:15 },
});
