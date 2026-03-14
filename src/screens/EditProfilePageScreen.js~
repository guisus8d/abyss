import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, StatusBar, SafeAreaView, TextInput,
  Dimensions, Alert, Modal, ActivityIndicator,
  KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

const W = Dimensions.get('window').width;

const BG_COLORS = [
  { id: 'none',   value: '',                        label: 'Ninguno'  },
  { id: 'teal',   value: 'rgba(0,229,204,0.15)',    label: 'Teal'     },
  { id: 'purple', value: 'rgba(147,51,234,0.18)',   label: 'Púrpura'  },
  { id: 'red',    value: 'rgba(239,68,68,0.15)',    label: 'Rojo'     },
  { id: 'blue',   value: 'rgba(41,121,255,0.18)',   label: 'Azul'     },
  { id: 'orange', value: 'rgba(249,115,22,0.18)',   label: 'Naranja'  },
  { id: 'pink',   value: 'rgba(236,72,153,0.18)',   label: 'Rosa'     },
  { id: 'green',  value: 'rgba(34,197,94,0.15)',    label: 'Verde'    },
  { id: 'yellow', value: 'rgba(234,179,8,0.18)',    label: 'Amarillo' },
  { id: 'white',  value: 'rgba(255,255,255,0.07)',  label: 'Blanco'   },
];

const TEXT_SIZES = [
  { label: 'S',  value: 13 },
  { label: 'M',  value: 16 },
  { label: 'L',  value: 20 },
  { label: 'XL', value: 26 },
];

const TEXT_ALIGNS = ['left','center','right'];

function uid() { return Math.random().toString(36).slice(2, 9); }

export default function EditProfilePageScreen({ route, navigation }) {
  const { profile } = route.params || {};
  const { updateUser } = useAuthStore();

  const [blocks, setBlocks]       = useState(profile?.profileBlocks || []);
  const [bg, setBg]               = useState(profile?.profileBg || '');
  const [bgType, setBgType]       = useState(profile?.profileBgType || 'color');
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(null); // block id or 'bg'
  const [bgModal, setBgModal]     = useState(false);
  const [addModal, setAddModal]   = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [mentionQ, setMentionQ]   = useState('');
  const [mentionResults, setMentionResults] = useState([]);
  const [searchingMention, setSearchingMention] = useState(false);

  // ── Block helpers ───────────────────────────────────────────
  function addBlock(type) {
    const b = {
      id: uid(), type,
      content: '',
      imageUrl: '',
      mentionUsername: '',
      mentionAvatar: '',
      fontSize: 14,
      align: 'left',
      bold: false,
    };
    setBlocks(prev => [...prev, b]);
    setAddModal(false);
    if (type === 'text') setEditingId(b.id);
  }

  function update(id, changes) {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...changes } : b));
  }

  function remove(id) {
    Alert.alert('Eliminar bloque', '¿Seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => setBlocks(prev => prev.filter(b => b.id !== id)) },
    ]);
  }

  function move(id, dir) {
    setBlocks(prev => {
      const i = prev.findIndex(b => b.id === id);
      const arr = [...prev];
      const t = i + dir;
      if (t < 0 || t >= arr.length) return prev;
      [arr[i], arr[t]] = [arr[t], arr[i]];
      return arr;
    });
  }

  // ── Upload image ────────────────────────────────────────────
  async function pickImage(blockId) {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, quality: 0.85,
    });
    if (result.canceled) return;
    setUploading(blockId);
    try {
      const asset = result.assets[0];
      const formData = new FormData();
      if (asset.uri.startsWith('blob:') || asset.uri.startsWith('data:') || asset.uri.startsWith('http')) {
        const res  = await fetch(asset.uri);
        const blob = await res.blob();
        formData.append('file', blob, 'img.jpg');
      } else {
        formData.append('file', { uri: asset.uri, type: 'image/jpeg', name: 'img.jpg' });
      }
      const { data } = await api.post('/users/me/upload', formData);
      update(blockId, { imageUrl: data.url });
    } catch {
      Alert.alert('Error', 'No se pudo subir la imagen');
    } finally {
      setUploading(null);
    }
  }

  async function pickBgImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [16,9], quality: 0.8,
    });
    if (result.canceled) return;
    setUploading('bg');
    try {
      const asset = result.assets[0];
      const formData = new FormData();
      if (asset.uri.startsWith('blob:') || asset.uri.startsWith('data:') || asset.uri.startsWith('http')) {
        const res  = await fetch(asset.uri);
        const blob = await res.blob();
        formData.append('file', blob, 'bg.jpg');
      } else {
        formData.append('file', { uri: asset.uri, type: 'image/jpeg', name: 'bg.jpg' });
      }
      const { data } = await api.post('/users/me/upload', formData);
      setBg(data.url);
      setBgType('image');
      setBgModal(false);
    } catch {
      Alert.alert('Error', 'No se pudo subir la imagen');
    } finally {
      setUploading(null);
    }
  }

  // ── Menciones ───────────────────────────────────────────────
  async function searchMention(q) {
    setMentionQ(q);
    if (q.length < 2) { setMentionResults([]); return; }
    setSearchingMention(true);
    try {
      const { data } = await api.get(`/users/search?q=${q}`);
      setMentionResults(data.users || []);
    } catch { setMentionResults([]); }
    finally { setSearchingMention(false); }
  }

  function addMentionBlock(user) {
    const b = { id: uid(), type: 'mention', mentionUsername: user.username, mentionAvatar: user.avatarUrl || '', content: '' };
    setBlocks(prev => [...prev, b]);
    setMentionQ('');
    setMentionResults([]);
    setAddModal(false);
  }

  // ── Save ────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    try {
      const { data } = await api.patch('/users/me/profile', {
        profileBlocks: blocks,
        profileBg: bg,
        profileBgType: bgType,
      });
      if (updateUser) updateUser(data.user);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  // ── Render block ────────────────────────────────────────────
  function renderBlock(block, idx) {
    const isEditing = editingId === block.id;

    // ── TEXT ──
    if (block.type === 'text') return (
      <View key={block.id} style={s.blockWrap}>
        {/* Controles bloque */}
        <View style={s.blockBar}>
          <TouchableOpacity onPress={() => move(block.id, -1)} style={s.blockBarBtn}>
            <Ionicons name="chevron-up" size={13} color={colors.textDim} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => move(block.id, 1)} style={s.blockBarBtn}>
            <Ionicons name="chevron-down" size={13} color={colors.textDim} />
          </TouchableOpacity>
          <View style={s.blockBarSep} />
          {TEXT_SIZES.map(sz => (
            <TouchableOpacity key={sz.label} onPress={() => update(block.id, { fontSize: sz.value })}
              style={[s.blockBarBtn, block.fontSize === sz.value && s.blockBarBtnActive]}>
              <Text style={[s.blockBarBtnTxt, block.fontSize === sz.value && { color: colors.c1 }]}>{sz.label}</Text>
            </TouchableOpacity>
          ))}
          <View style={s.blockBarSep} />
          <TouchableOpacity onPress={() => update(block.id, { bold: !block.bold })}
            style={[s.blockBarBtn, block.bold && s.blockBarBtnActive]}>
            <Text style={[s.blockBarBtnTxt, { fontWeight: '900' }, block.bold && { color: colors.c1 }]}>B</Text>
          </TouchableOpacity>
          {TEXT_ALIGNS.map(a => (
            <TouchableOpacity key={a} onPress={() => update(block.id, { align: a })}
              style={[s.blockBarBtn, block.align === a && s.blockBarBtnActive]}>
              <Ionicons name={`reorder-${a === 'left' ? 'four' : a === 'center' ? 'two' : 'three'}-outline`}
                size={13} color={block.align === a ? colors.c1 : colors.textDim} />
            </TouchableOpacity>
          ))}
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => remove(block.id)} style={s.blockBarBtn}>
            <Ionicons name="trash-outline" size={13} color="rgba(239,68,68,0.7)" />
          </TouchableOpacity>
        </View>

        <View style={s.textCard}>
          {isEditing ? (
            <>
              <TextInput
                style={[s.textInput, { fontSize: block.fontSize, fontWeight: block.bold ? '700' : '400', textAlign: block.align }]}
                value={block.content}
                onChangeText={t => t.length <= 400 && update(block.id, { content: t })}
                placeholder="Escribe algo..."
                placeholderTextColor={colors.textDim}
                multiline
                autoFocus
              />
              <View style={s.textCardFooter}>
                <Text style={s.charCount}>{(block.content||'').length}/400</Text>
                <TouchableOpacity onPress={() => setEditingId(null)} style={s.doneBtn}>
                  <LinearGradient colors={['#006b63','#00e5cc']} style={s.doneBtnGrad} start={{x:0,y:0}} end={{x:1,y:0}}>
                    <Text style={s.doneBtnTxt}>Listo</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <TouchableOpacity onPress={() => setEditingId(block.id)} style={{ minHeight: 44 }}>
              {block.content
                ? <Text style={{ fontSize: block.fontSize, fontWeight: block.bold ? '700' : '400', textAlign: block.align, color: colors.textHi, lineHeight: block.fontSize * 1.5 }}>{block.content}</Text>
                : <Text style={s.textPlaceholder}>Toca para escribir...</Text>}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );

    // ── IMAGE ──
    if (block.type === 'image') return (
      <View key={block.id} style={s.blockWrap}>
        <View style={s.blockBar}>
          <TouchableOpacity onPress={() => move(block.id, -1)} style={s.blockBarBtn}><Ionicons name="chevron-up" size={13} color={colors.textDim} /></TouchableOpacity>
          <TouchableOpacity onPress={() => move(block.id, 1)} style={s.blockBarBtn}><Ionicons name="chevron-down" size={13} color={colors.textDim} /></TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => remove(block.id)} style={s.blockBarBtn}><Ionicons name="trash-outline" size={13} color="rgba(239,68,68,0.7)" /></TouchableOpacity>
        </View>
        <TouchableOpacity style={s.imageCard} onPress={() => pickImage(block.id)}>
          {block.imageUrl ? (
            <>
              <Image source={{ uri: block.imageUrl }} style={s.imageCardImg} resizeMode="cover" />
              <View style={s.imageCardOverlay}>
                <Ionicons name="camera" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 11, marginTop: 4 }}>Cambiar</Text>
              </View>
            </>
          ) : (
            <>
              <View style={s.imageCardEmpty}>
                <Ionicons name="image-outline" size={36} color={colors.textDim} />
                <Text style={s.imageCardHint}>Toca para agregar imagen</Text>
              </View>
            </>
          )}
          {uploading === block.id && (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 16, alignItems: 'center', justifyContent: 'center' }]}>
              <ActivityIndicator color={colors.c1} size="large" />
            </View>
          )}
        </TouchableOpacity>
      </View>
    );

    // ── MENTION ──
    if (block.type === 'mention') return (
      <View key={block.id} style={s.blockWrap}>
        <View style={s.blockBar}>
          <TouchableOpacity onPress={() => move(block.id, -1)} style={s.blockBarBtn}><Ionicons name="chevron-up" size={13} color={colors.textDim} /></TouchableOpacity>
          <TouchableOpacity onPress={() => move(block.id, 1)} style={s.blockBarBtn}><Ionicons name="chevron-down" size={13} color={colors.textDim} /></TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => remove(block.id)} style={s.blockBarBtn}><Ionicons name="trash-outline" size={13} color="rgba(239,68,68,0.7)" /></TouchableOpacity>
        </View>
        <View style={s.mentionCard}>
          <LinearGradient colors={['rgba(0,229,204,0.08)','rgba(0,229,204,0.02)']} style={s.mentionCardGrad} start={{x:0,y:0}} end={{x:1,y:0}}>
            <View style={s.mentionAvatar}>
              {block.mentionAvatar
                ? <Image source={{ uri: block.mentionAvatar }} style={{ width: '100%', height: '100%', borderRadius: 22 }} />
                : <Text style={{ color: colors.c1, fontWeight: '900', fontSize: 16 }}>{block.mentionUsername?.[0]?.toUpperCase()}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.mentionAt}>@{block.mentionUsername}</Text>
              <Text style={s.mentionSub}>Perfil vinculado</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={colors.c1} />
          </LinearGradient>
        </View>
      </View>
    );

    return null;
  }

  const isImageBg = bgType === 'image';

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
            <Ionicons name="close" size={22} color={colors.textDim} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>EDITAR PERFIL</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving} style={s.saveBtn}>
            {saving
              ? <ActivityIndicator size="small" color={colors.black} />
              : <Text style={s.saveBtnTxt}>Guardar</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>

          {/* Canvas */}
          <View style={s.canvas}>
            {isImageBg && bg
              ? <Image source={{ uri: bg }} style={s.canvasBg} resizeMode="cover" blurRadius={2} />
              : null}
            {isImageBg && bg
              ? <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 20 }]} />
              : null}
            {!isImageBg && bg
              ? <View style={[StyleSheet.absoluteFill, { backgroundColor: bg, borderRadius: 20 }]} />
              : null}

            {/* Canvas top bar */}
            <View style={s.canvasTopBar}>
              <TouchableOpacity style={s.bgChip} onPress={() => setBgModal(true)}>
                {uploading === 'bg'
                  ? <ActivityIndicator size="small" color={colors.c1} />
                  : <Ionicons name="color-palette-outline" size={14} color={colors.c1} />}
                <Text style={s.bgChipTxt}>Fondo</Text>
              </TouchableOpacity>
            </View>

            {/* Blocks */}
            <View style={s.blocksWrap}>
              {blocks.length === 0
                ? (
                  <View style={s.emptyCanvas}>
                    <Text style={s.emptyCanvasEmoji}>✦</Text>
                    <Text style={s.emptyCanvasTxt}>Página vacía</Text>
                    <Text style={s.emptyCanvasHint}>Toca + para agregar bloques</Text>
                  </View>
                )
                : blocks.map((b, i) => renderBlock(b, i))}
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* FAB + */}
      <TouchableOpacity style={s.fab} onPress={() => setAddModal(true)}>
        <LinearGradient colors={['#00e5cc','#006b63']} style={s.fabGrad} start={{x:0,y:0}} end={{x:1,y:1}}>
          <Ionicons name="add" size={30} color="#001a18" />
        </LinearGradient>
      </TouchableOpacity>

      {/* ── Modal: Tipo de bloque ── */}
      <Modal visible={addModal === true} transparent animationType="slide" onRequestClose={() => setAddModal(false)}>
        <TouchableOpacity style={s.sheetOverlay} activeOpacity={1} onPress={() => setAddModal(false)}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>AGREGAR BLOQUE</Text>
            <View style={s.blockTypesRow}>

              <TouchableOpacity style={s.blockTypeCard} onPress={() => addBlock('text')}>
                <LinearGradient colors={['rgba(0,229,204,0.15)','rgba(0,229,204,0.03)']} style={s.blockTypeCardInner}>
                  <View style={[s.blockTypeIcon, { borderColor: 'rgba(0,229,204,0.3)' }]}>
                    <Ionicons name="text" size={24} color={colors.c1} />
                  </View>
                  <Text style={s.blockTypeLabel}>Texto</Text>
                  <Text style={s.blockTypeHint}>Párrafo libre</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={s.blockTypeCard} onPress={() => addBlock('image')}>
                <LinearGradient colors={['rgba(147,51,234,0.15)','rgba(147,51,234,0.03)']} style={s.blockTypeCardInner}>
                  <View style={[s.blockTypeIcon, { borderColor: 'rgba(167,139,250,0.3)' }]}>
                    <Ionicons name="image-outline" size={24} color="rgba(167,139,250,1)" />
                  </View>
                  <Text style={[s.blockTypeLabel, { color: 'rgba(167,139,250,1)' }]}>Imagen</Text>
                  <Text style={s.blockTypeHint}>Foto del carrete</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={s.blockTypeCard} onPress={() => { setAddModal('mention'); setMentionQ(''); setMentionResults([]); }}>
                <LinearGradient colors={['rgba(236,72,153,0.15)','rgba(236,72,153,0.03)']} style={s.blockTypeCardInner}>
                  <View style={[s.blockTypeIcon, { borderColor: 'rgba(244,114,182,0.3)' }]}>
                    <Ionicons name="at" size={24} color="rgba(244,114,182,1)" />
                  </View>
                  <Text style={[s.blockTypeLabel, { color: 'rgba(244,114,182,1)' }]}>Mención</Text>
                  <Text style={s.blockTypeHint}>Enlaza un usuario</Text>
                </LinearGradient>
              </TouchableOpacity>

            </View>
            <TouchableOpacity style={s.sheetCancelBtn} onPress={() => setAddModal(false)}>
              <Text style={s.sheetCancelTxt}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Modal: Menciones ── */}
      <Modal visible={addModal === 'mention'} transparent animationType="slide" onRequestClose={() => setAddModal(false)}>
        <TouchableOpacity style={s.sheetOverlay} activeOpacity={1} onPress={() => setAddModal(false)}>
          <View style={[s.sheet, { maxHeight: '72%' }]}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>MENCIONAR USUARIO</Text>
            <View style={s.mentionSearch}>
              <Ionicons name="search" size={16} color={colors.textDim} />
              <TextInput
                style={s.mentionSearchInput}
                value={mentionQ}
                onChangeText={searchMention}
                placeholder="Buscar @usuario..."
                placeholderTextColor={colors.textDim}
                autoFocus
              />
              {searchingMention && <ActivityIndicator size="small" color={colors.c1} />}
            </View>
            <ScrollView style={{ maxHeight: 240 }} keyboardShouldPersistTaps="handled">
              {mentionResults.map(u => (
                <TouchableOpacity key={u._id} style={s.mentionResultRow} onPress={() => addMentionBlock(u)}>
                  <View style={s.mentionResultAv}>
                    {u.avatarUrl
                      ? <Image source={{ uri: u.avatarUrl }} style={{ width: '100%', height: '100%', borderRadius: 20 }} />
                      : <Text style={{ color: colors.c1, fontWeight: '700' }}>{u.username?.[0]?.toUpperCase()}</Text>}
                  </View>
                  <Text style={s.mentionResultName}>@{u.username}</Text>
                  <Ionicons name="add-circle" size={22} color={colors.c1} />
                </TouchableOpacity>
              ))}
              {mentionQ.length >= 2 && !mentionResults.length && !searchingMention && (
                <Text style={{ color: colors.textDim, textAlign: 'center', marginTop: 20, fontSize: 13 }}>Sin resultados</Text>
              )}
            </ScrollView>
            <TouchableOpacity style={s.sheetCancelBtn} onPress={() => setAddModal(false)}>
              <Text style={s.sheetCancelTxt}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Modal: Fondo ── */}
      <Modal visible={bgModal} transparent animationType="slide" onRequestClose={() => setBgModal(false)}>
        <TouchableOpacity style={s.sheetOverlay} activeOpacity={1} onPress={() => setBgModal(false)}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>FONDO DE PÁGINA</Text>
            <View style={s.colorGrid}>
              {BG_COLORS.map(c => (
                <TouchableOpacity key={c.id}
                  style={[s.colorSwatch, c.value ? { backgroundColor: c.value } : {}, bg === c.value && { borderColor: colors.c1, borderWidth: 2.5 }]}
                  onPress={() => { setBg(c.value); setBgType('color'); setBgModal(false); }}>
                  {!c.value && <Ionicons name="close" size={18} color={colors.textDim} />}
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={s.colorSwatchImg} onPress={pickBgImage}>
                {uploading === 'bg'
                  ? <ActivityIndicator size="small" color={colors.c1} />
                  : <>
                    <Ionicons name="image-outline" size={22} color={colors.c1} />
                    <Text style={{ color: colors.c1, fontSize: 9, marginTop: 3 }}>Imagen</Text>
                  </>}
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.sheetCancelBtn} onPress={() => setBgModal(false)}>
              <Text style={s.sheetCancelTxt}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerBtn:   { width: 44 },
  headerTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 5, color: colors.c1 },
  saveBtn:     { backgroundColor: colors.c1, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8, minWidth: 44, alignItems: 'center' },
  saveBtnTxt:  { color: '#001a18', fontWeight: '900', fontSize: 13 },

  canvas:      { margin: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', minHeight: 320, position: 'relative', backgroundColor: 'rgba(255,255,255,0.02)' },
  canvasBg:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  canvasTopBar:{ flexDirection: 'row', justifyContent: 'flex-end', padding: 14 },
  bgChip:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: colors.borderC },
  bgChipTxt:   { color: colors.c1, fontSize: 12 },
  blocksWrap:  { paddingHorizontal: 14, paddingBottom: 20, gap: 12 },

  emptyCanvas:     { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyCanvasEmoji:{ fontSize: 32, color: colors.c1 },
  emptyCanvasTxt:  { color: colors.textDim, fontSize: 15, fontWeight: '700' },
  emptyCanvasHint: { color: colors.textDim, fontSize: 12, opacity: 0.5 },

  blockWrap: { gap: 5 },

  blockBar:        { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderColor: colors.border },
  blockBarBtn:     { paddingHorizontal: 6, paddingVertical: 4, borderRadius: 8 },
  blockBarBtnActive:{ backgroundColor: 'rgba(0,229,204,0.12)' },
  blockBarBtnTxt:  { color: colors.textDim, fontSize: 12, fontWeight: '700' },
  blockBarSep:     { width: 1, height: 16, backgroundColor: colors.border, marginHorizontal: 4 },

  textCard:       { backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14 },
  textInput:      { color: colors.textHi, lineHeight: 22, minHeight: 70, textAlignVertical: 'top' },
  textCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  textPlaceholder:{ color: colors.textDim, fontStyle: 'italic', fontSize: 13, paddingVertical: 10 },
  charCount:      { color: colors.textDim, fontSize: 10 },
  doneBtn:        { borderRadius: 10, overflow: 'hidden' },
  doneBtnGrad:    { paddingHorizontal: 18, paddingVertical: 8 },
  doneBtnTxt:     { color: '#001a18', fontWeight: '800', fontSize: 12 },

  imageCard:      { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, minHeight: 180, backgroundColor: colors.card },
  imageCardImg:   { width: '100%', height: 200 },
  imageCardOverlay:{ position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  imageCardEmpty: { flex: 1, minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 10 },
  imageCardHint:  { color: colors.textDim, fontSize: 12 },

  mentionCard:    { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,229,204,0.2)' },
  mentionCardGrad:{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  mentionAvatar:  { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.deep, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,229,204,0.3)' },
  mentionAt:      { color: colors.c1, fontWeight: '800', fontSize: 15 },
  mentionSub:     { color: colors.textDim, fontSize: 11, marginTop: 2 },

  fab:     { position: 'absolute', bottom: 32, right: 24, borderRadius: 34, overflow: 'hidden', shadowColor: colors.c1, shadowOpacity: 0.5, shadowRadius: 16, elevation: 10 },
  fabGrad: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },

  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 44, borderTopWidth: 1, borderTopColor: colors.border },
  sheetHandle:  { width: 44, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 22 },
  sheetTitle:   { fontSize: 11, letterSpacing: 5, color: colors.c1, fontWeight: '900', textAlign: 'center', marginBottom: 24 },
  sheetCancelBtn:{ marginTop: 20, alignItems: 'center' },
  sheetCancelTxt:{ color: colors.textDim, fontSize: 14, paddingVertical: 6 },

  blockTypesRow:      { flexDirection: 'row', gap: 12 },
  blockTypeCard:      { flex: 1, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  blockTypeCardInner: { padding: 16, alignItems: 'center', gap: 8 },
  blockTypeIcon:      { width: 52, height: 52, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  blockTypeLabel:     { color: colors.textHi, fontWeight: '700', fontSize: 13 },
  blockTypeHint:      { color: colors.textDim, fontSize: 10, textAlign: 'center' },

  colorGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginVertical: 10 },
  colorSwatch:    { width: 52, height: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  colorSwatchImg: { width: 52, height: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.borderC, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,229,204,0.05)' },

  mentionSearch:      { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16 },
  mentionSearchInput: { flex: 1, color: colors.textHi, fontSize: 14 },
  mentionResultRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  mentionResultAv:    { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.deep, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  mentionResultName:  { flex: 1, color: colors.textHi, fontSize: 14 },
});
