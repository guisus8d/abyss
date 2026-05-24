import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, StatusBar, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import api from '../services/api';

function Field({ label, value, onChangeText, placeholder, multiline, maxLength }) {
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
      {maxLength && (
        <Text style={s.charCount}>{value.length}/{maxLength}</Text>
      )}
    </View>
  );
}

export default function CreateStoreScreen({ navigation, route }) {
  const existing = route.params?.store;
  const onCreated = route.params?.onCreated;
  const isEdit = !!existing;

  const [nombre,      setNombre]      = useState(existing?.nombre      || '');
  const [descripcion, setDescripcion] = useState(existing?.descripcion || '');
  const [banner,      setBanner]      = useState(existing?.banner      || '');
  const [logo,        setLogo]        = useState(existing?.logo        || '');
  const [loading,     setLoading]     = useState(false);
  const [errMsg,      setErrMsg]      = useState('');

  async function submit() {
    if (!nombre.trim()) { setErrMsg('El nombre de la tienda es requerido'); return; }
    setLoading(true);
    setErrMsg('');
    try {
      const payload = { nombre: nombre.trim(), descripcion: descripcion.trim(), banner: banner.trim(), logo: logo.trim() };
      if (isEdit) {
        await api.patch('/store/me', payload);
      } else {
        await api.post('/store', { nombre: nombre.trim(), descripcion: descripcion.trim() });
        // Update banner/logo if provided
        if (banner.trim() || logo.trim()) {
          await api.patch('/store/me', { banner: banner.trim(), logo: logo.trim() });
        }
      }
      onCreated?.();
      navigation.goBack();
    } catch (e) {
      setErrMsg(e.response?.data?.error || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  }

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

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <View style={s.iconWrap}>
          <Ionicons name="storefront-outline" size={36} color={colors.c1} />
        </View>
        <Text style={s.subhead}>
          {isEdit ? 'Actualiza la información de tu tienda' : 'Crea tu tienda para vender marcos a la comunidad de Abyss'}
        </Text>

        <Field
          label="Nombre de la tienda *"
          value={nombre}
          onChangeText={setNombre}
          placeholder="Ej: Pixel Arts Studio"
          maxLength={50}
        />
        <Field
          label="Descripción"
          value={descripcion}
          onChangeText={setDescripcion}
          placeholder="Describe tu tienda en pocas palabras..."
          multiline
          maxLength={300}
        />

        <View style={s.separator}>
          <View style={s.separatorLine} />
          <Text style={s.separatorTxt}>IMÁGENES (URL)</Text>
          <View style={s.separatorLine} />
        </View>

        <Field
          label="Banner (URL de imagen)"
          value={banner}
          onChangeText={setBanner}
          placeholder="https://..."
        />
        <Field
          label="Logo (URL de imagen)"
          value={logo}
          onChangeText={setLogo}
          placeholder="https://..."
        />

        {errMsg ? (
          <View style={s.errBox}>
            <Ionicons name="alert-circle-outline" size={15} color={colors.c4} />
            <Text style={s.errTxt}>{errMsg}</Text>
          </View>
        ) : null}

        <TouchableOpacity style={[s.submitBtn, loading && { opacity: 0.6 }]} onPress={submit} disabled={loading}>
          {loading
            ? <ActivityIndicator size={18} color={colors.black} />
            : <Text style={s.submitTxt}>{isEdit ? 'Guardar cambios' : 'Crear tienda'}</Text>}
        </TouchableOpacity>
      </ScrollView>
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

  separator:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 8, marginBottom: 18 },
  separatorLine: { flex: 1, height: 1, backgroundColor: colors.border },
  separatorTxt:  { color: colors.textDim, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },

  errBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(249,115,22,0.1)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(249,115,22,0.25)', padding: 12, marginBottom: 16 },
  errTxt:  { color: colors.c4, fontSize: 13, flex: 1 },

  submitBtn: { backgroundColor: colors.c1, borderRadius: 18, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitTxt: { color: colors.black, fontSize: 15, fontWeight: '800' },
});
