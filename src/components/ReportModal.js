import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import api from '../services/api';

const REASONS = [
  { key: 'spam',        label: '🚫 Spam o publicidad no deseada' },
  { key: 'hate',        label: '🔥 Discurso de odio o discriminación' },
  { key: 'harassment',  label: '😰 Acoso o bullying' },
  { key: 'violence',    label: '⚠️ Contenido violento o perturbador' },
  { key: 'nsfw',        label: '🔞 Contenido sexual inapropiado' },
  { key: 'misinformation', label: '📰 Desinformación' },
  { key: 'other',       label: '💬 Otro motivo' },
];

const TYPE_LABELS = {
  post:  'publicación',
  user:  'usuario',
  group: 'grupo',
};

export default function ReportModal({ visible, onClose, type, targetId, targetName }) {
  const [selectedReason, setSelectedReason] = useState(null);
  const [details,        setDetails]        = useState('');
  const [loading,        setLoading]        = useState(false);
  const [done,           setDone]           = useState(false);
  const [error,          setError]          = useState('');

  function reset() {
    setSelectedReason(null);
    setDetails('');
    setLoading(false);
    setDone(false);
    setError('');
  }

  async function submit() {
    if (!selectedReason) { setError('Selecciona un motivo'); return; }
    setLoading(true);
    setError('');
    try {
      await api.post('/reports', {
        type, targetId, targetName, reason: selectedReason, details,
      });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al enviar el reporte');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={s.overlay} onPress={handleClose}>
        <Pressable style={s.box} onPress={e => e.stopPropagation()}>

          {done ? (
            /* ── Confirmación ── */
            <View style={s.doneBox}>
              <View style={s.doneIcon}>
                <Ionicons name="checkmark-circle" size={48} color={colors.c1} />
              </View>
              <Text style={s.doneTitle}>Reporte enviado</Text>
              <Text style={s.doneSub}>
                Gracias por ayudarnos a mantener Abyss seguro. Nuestro equipo revisará esta {TYPE_LABELS[type] || 'contenido'} en breve.
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
                  <Ionicons name="close" size={20} color={colors.textDim} />
                </TouchableOpacity>
              </View>

              <Text style={s.sectionLabel}>¿Por qué reportas esto?</Text>

              {/* ── Razones ── */}
              {REASONS.map(r => (
                <TouchableOpacity
                  key={r.key}
                  style={[s.reasonRow, selectedReason === r.key && s.reasonRowActive]}
                  onPress={() => { setSelectedReason(r.key); setError(''); }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.reasonTxt, selectedReason === r.key && s.reasonTxtActive]}>
                    {r.label}
                  </Text>
                  {selectedReason === r.key && (
                    <Ionicons name="checkmark-circle" size={16} color={colors.c1} />
                  )}
                </TouchableOpacity>
              ))}

              {/* ── Detalles opcionales ── */}
              <TextInput
                style={s.detailsInput}
                placeholder="Detalles adicionales (opcional)..."
                placeholderTextColor={colors.textDim}
                value={details}
                onChangeText={setDetails}
                multiline
                maxLength={300}
              />

              {!!error && (
                <Text style={s.errorTxt}>{error}</Text>
              )}

              {/* ── Botón enviar ── */}
              <TouchableOpacity
                style={[s.submitBtn, !selectedReason && s.submitBtnDisabled]}
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
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex:1, backgroundColor:'rgba(0,0,0,0.7)', justifyContent:'flex-end' },
  box:     { backgroundColor: colors.surface, borderTopLeftRadius:24, borderTopRightRadius:24, padding:20, paddingBottom:34, borderWidth:1, borderColor:'rgba(239,68,68,0.15)' },

  header:     { flexDirection:'row', alignItems:'center', gap:12, marginBottom:20 },
  headerIcon: { width:36, height:36, borderRadius:18, backgroundColor:'rgba(239,68,68,0.1)', borderWidth:1, borderColor:'rgba(239,68,68,0.3)', alignItems:'center', justifyContent:'center' },
  title:      { color: colors.textHi, fontWeight:'700', fontSize:16 },
  subtitle:   { color: colors.textDim, fontSize:11, marginTop:2 },
  closeBtn:   { padding:4 },

  sectionLabel: { color: colors.textDim, fontSize:11, fontWeight:'700', letterSpacing:1, marginBottom:10 },

  reasonRow:       { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:12, paddingHorizontal:14, borderRadius:12, borderWidth:1, borderColor: colors.border, marginBottom:6, backgroundColor:'rgba(255,255,255,0.02)' },
  reasonRowActive: { backgroundColor:'rgba(0,229,204,0.07)', borderColor:'rgba(0,229,204,0.3)' },
  reasonTxt:       { color: colors.textMid, fontSize:13 },
  reasonTxtActive: { color: colors.textHi, fontWeight:'600' },

  detailsInput: { backgroundColor:'rgba(8,20,36,0.95)', borderWidth:1, borderColor: colors.border, borderRadius:12, paddingHorizontal:14, paddingVertical:10, color: colors.textHi, fontSize:13, marginTop:8, minHeight:60, textAlignVertical:'top' },

  errorTxt: { color:'rgba(239,68,68,0.8)', fontSize:12, marginTop:6, textAlign:'center' },

  submitBtn:         { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:'rgba(239,68,68,0.8)', borderRadius:14, paddingVertical:14, marginTop:14 },
  submitBtnDisabled: { backgroundColor:'rgba(239,68,68,0.3)' },
  submitTxt:         { color:'#fff', fontWeight:'700', fontSize:14 },

  disclaimer: { color: colors.textDim, fontSize:10, textAlign:'center', marginTop:10, lineHeight:14 },

  // Done state
  doneBox:   { alignItems:'center', paddingVertical:20, gap:12 },
  doneIcon:  { width:80, height:80, borderRadius:40, backgroundColor:'rgba(0,229,204,0.1)', alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(0,229,204,0.2)' },
  doneTitle: { color: colors.textHi, fontSize:20, fontWeight:'800' },
  doneSub:   { color: colors.textDim, fontSize:13, textAlign:'center', lineHeight:20, paddingHorizontal:12 },
  doneBtn:   { backgroundColor:'rgba(0,229,204,0.15)', borderWidth:1, borderColor:'rgba(0,229,204,0.3)', borderRadius:14, paddingVertical:12, paddingHorizontal:32, marginTop:8 },
  doneBtnTxt:{ color: colors.c1, fontWeight:'700', fontSize:14 },
});
