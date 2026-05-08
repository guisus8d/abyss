import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Pressable, Image, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../theme/colors';
import api from '../services/api';

const REASONS = [
  { key: 'spam',           label: 'Spam o publicidad no deseada',        icon: 'ban-outline' },
  { key: 'hate',           label: 'Discurso de odio o discriminación',   icon: 'flame-outline' },
  { key: 'harassment',     label: 'Acoso o bullying',                    icon: 'alert-circle-outline' },
  { key: 'violence',       label: 'Contenido violento o perturbador',    icon: 'warning-outline' },
  { key: 'nsfw',           label: 'Contenido sexual inapropiado',        icon: 'eye-off-outline' },
  { key: 'misinformation', label: 'Desinformación',                      icon: 'newspaper-outline' },
  { key: 'other',          label: 'Otro motivo',                         icon: 'chatbubble-outline' },
];

const TYPE_LABELS = { post: 'publicación', user: 'usuario', group: 'grupo' };

export default function ReportModal({ visible, onClose, type, targetId, targetName }) {
  const [step,           setStep]           = useState(1); // 1: razón, 2: detalles, 3: confirmación
  const [selectedReason, setSelectedReason] = useState(null);
  const [details,        setDetails]        = useState('');
  const [evidence,       setEvidence]       = useState(null); // { uri }
  const [loading,        setLoading]        = useState(false);
  const [done,           setDone]           = useState(false);
  const [error,          setError]          = useState('');

  function reset() {
    setStep(1); setSelectedReason(null); setDetails('');
    setEvidence(null); setLoading(false); setDone(false); setError('');
  }

  function handleClose() { reset(); onClose(); }

  async function pickEvidence() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsEditing: false, quality: 0.8,
      });
      if (!result.canceled) setEvidence({ uri: result.assets[0].uri });
    } catch {}
  }

  async function submit() {
    if (!selectedReason) { setError('Selecciona un motivo'); return; }
    setLoading(true);
    setError('');
    try {
      // Si hay imagen adjunta usamos FormData, si no JSON normal
      if (evidence) {
        const formData = new FormData();
        formData.append('type',       type);
        formData.append('targetId',   targetId);
        formData.append('targetName', targetName || '');
        formData.append('reason',     selectedReason);
        formData.append('details',    details);
        const blob = await fetch(evidence.uri).then(r => r.blob());
        formData.append('image', blob, 'evidence.jpg');

        const token = await (await import('@react-native-async-storage/async-storage')).default.getItem('token');
        const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://abyss-production-7171.up.railway.app/api';
        const res = await fetch(`${BASE_URL}/reports`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error');
      } else {
        await api.post('/reports', { type, targetId, targetName, reason: selectedReason, details });
      }
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error al enviar el reporte');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={s.overlay} onPress={handleClose}>
        <Pressable style={s.sheet} onPress={e => e.stopPropagation()}>

          {/* ── Confirmación final ── */}
          {done ? (
            <View style={s.doneBox}>
              <View style={s.doneIconWrap}>
                <Ionicons name="checkmark-circle" size={52} color={colors.c1} />
              </View>
              <Text style={s.doneTitle}>Reporte enviado</Text>
              <Text style={s.doneSub}>
                Gracias por ayudarnos a mantener Abyss seguro. Nuestro equipo revisará esta {TYPE_LABELS[type]} en breve.
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
                  {!!targetName && <Text style={s.subtitle} numberOfLines={1}>{targetName}</Text>}
                </View>
                <TouchableOpacity onPress={handleClose} style={s.closeBtn}>
                  <Ionicons name="close" size={22} color={colors.textDim} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* ── Paso 1: Motivo ── */}
                <Text style={s.sectionLabel}>¿Por qué reportas esto?</Text>
                {REASONS.map(r => (
                  <TouchableOpacity
                    key={r.key}
                    style={[s.reasonRow, selectedReason === r.key && s.reasonRowActive]}
                    onPress={() => { setSelectedReason(r.key); setError(''); }}
                    activeOpacity={0.7}
                  >
                    <View style={[s.reasonIconWrap, selectedReason === r.key && s.reasonIconWrapActive]}>
                      <Ionicons name={r.icon} size={15} color={selectedReason === r.key ? colors.c1 : colors.textDim} />
                    </View>
                    <Text style={[s.reasonTxt, selectedReason === r.key && s.reasonTxtActive]}>
                      {r.label}
                    </Text>
                    {selectedReason === r.key && (
                      <Ionicons name="checkmark-circle" size={16} color={colors.c1} />
                    )}
                  </TouchableOpacity>
                ))}

                {/* ── Detalles ── */}
                <Text style={[s.sectionLabel, { marginTop: 16 }]}>Detalles adicionales</Text>
                <TextInput
                  style={s.detailsInput}
                  placeholder="Describe lo que ocurrió (opcional)..."
                  placeholderTextColor={colors.textDim}
                  value={details}
                  onChangeText={setDetails}
                  multiline
                  maxLength={400}
                />

                {/* ── Evidencia ── */}
                <Text style={[s.sectionLabel, { marginTop: 16 }]}>Adjuntar evidencia</Text>
                <Text style={s.evidenceHint}>
                  Opcional — adjunta una captura de pantalla que respalde tu reporte
                </Text>

                {evidence ? (
                  <View style={s.evidencePreview}>
                    <Image source={{ uri: evidence.uri }} style={s.evidenceImg} resizeMode="cover" />
                    <TouchableOpacity style={s.evidenceRemove} onPress={() => setEvidence(null)}>
                      <Ionicons name="close-circle" size={22} color="rgba(239,68,68,0.9)" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={s.evidenceBtn} onPress={pickEvidence} activeOpacity={0.7}>
                    <Ionicons name="camera-outline" size={20} color={colors.textDim} />
                    <Text style={s.evidenceBtnTxt}>Seleccionar captura</Text>
                  </TouchableOpacity>
                )}

                {!!error && <Text style={s.errorTxt}>{error}</Text>}

                {/* ── Botón enviar ── */}
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

                <View style={{ height: 20 }} />
              </ScrollView>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex:1, backgroundColor:'rgba(0,0,0,0.7)', justifyContent:'flex-end' },
  sheet:   { backgroundColor: colors.surface, borderTopLeftRadius:24, borderTopRightRadius:24, paddingHorizontal:20, paddingTop:20, maxHeight:'90%', borderWidth:1, borderColor:'rgba(239,68,68,0.12)', borderBottomWidth:0 },

  header:         { flexDirection:'row', alignItems:'center', gap:12, marginBottom:20 },
  headerIcon:     { width:38, height:38, borderRadius:19, backgroundColor:'rgba(239,68,68,0.1)', borderWidth:1, borderColor:'rgba(239,68,68,0.25)', alignItems:'center', justifyContent:'center' },
  title:          { color: colors.textHi, fontWeight:'700', fontSize:16 },
  subtitle:       { color: colors.textDim, fontSize:11, marginTop:2 },
  closeBtn:       { padding:4 },

  sectionLabel:   { color: colors.textDim, fontSize:11, fontWeight:'700', letterSpacing:1, marginBottom:8 },

  reasonRow:       { flexDirection:'row', alignItems:'center', gap:12, paddingVertical:12, paddingHorizontal:14, borderRadius:12, borderWidth:1, borderColor: colors.border, marginBottom:6, backgroundColor:'rgba(255,255,255,0.02)' },
  reasonRowActive: { backgroundColor:'rgba(0,229,204,0.06)', borderColor:'rgba(0,229,204,0.25)' },
  reasonIconWrap:  { width:30, height:30, borderRadius:15, backgroundColor:'rgba(255,255,255,0.05)', alignItems:'center', justifyContent:'center' },
  reasonIconWrapActive: { backgroundColor:'rgba(0,229,204,0.1)' },
  reasonTxt:       { color: colors.textMid, fontSize:13, flex:1 },
  reasonTxtActive: { color: colors.textHi, fontWeight:'600' },

  detailsInput:   { backgroundColor:'rgba(8,20,36,0.95)', borderWidth:1, borderColor: colors.border, borderRadius:12, paddingHorizontal:14, paddingVertical:12, color: colors.textHi, fontSize:13, minHeight:80, textAlignVertical:'top' },

  evidenceHint:    { color: colors.textDim, fontSize:11, marginBottom:10, lineHeight:16 },
  evidenceBtn:     { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10, paddingVertical:14, borderRadius:12, borderWidth:1, borderColor: colors.border, borderStyle:'dashed', backgroundColor:'rgba(255,255,255,0.02)' },
  evidenceBtnTxt:  { color: colors.textDim, fontSize:13 },
  evidencePreview: { position:'relative', borderRadius:12, overflow:'hidden', marginBottom:4 },
  evidenceImg:     { width:'100%', height:180, borderRadius:12 },
  evidenceRemove:  { position:'absolute', top:8, right:8, backgroundColor:'rgba(0,0,0,0.6)', borderRadius:12 },

  errorTxt:       { color:'rgba(239,68,68,0.8)', fontSize:12, marginTop:8, textAlign:'center' },

  submitBtn:         { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:'rgba(239,68,68,0.8)', borderRadius:14, paddingVertical:15, marginTop:16 },
  submitBtnDisabled: { backgroundColor:'rgba(239,68,68,0.25)' },
  submitTxt:         { color:'#fff', fontWeight:'700', fontSize:14 },

  disclaimer:     { color: colors.textDim, fontSize:10, textAlign:'center', marginTop:10, lineHeight:15 },

  doneBox:        { alignItems:'center', paddingVertical:32, gap:14 },
  doneIconWrap:   { width:90, height:90, borderRadius:45, backgroundColor:'rgba(0,229,204,0.08)', alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(0,229,204,0.2)' },
  doneTitle:      { color: colors.textHi, fontSize:22, fontWeight:'800' },
  doneSub:        { color: colors.textDim, fontSize:13, textAlign:'center', lineHeight:20, paddingHorizontal:16 },
  doneBtn:        { backgroundColor:'rgba(0,229,204,0.12)', borderWidth:1, borderColor:'rgba(0,229,204,0.3)', borderRadius:14, paddingVertical:13, paddingHorizontal:36, marginTop:4 },
  doneBtnTxt:     { color: colors.c1, fontWeight:'700', fontSize:14 },
});
