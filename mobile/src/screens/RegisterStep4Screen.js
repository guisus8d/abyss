import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

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

const vPassword = (v) => v.length >= 8 && /[A-Z]/.test(v) && /[0-9]/.test(v);
const errPassword = (v) => {
  if (!v) return '';
  if (v.length < 8)     return 'Minimo 8 caracteres';
  if (!/[A-Z]/.test(v)) return 'Debe incluir al menos una mayuscula';
  if (!/[0-9]/.test(v)) return 'Debe incluir al menos un numero';
  return '';
};

export default function RegisterStep4Screen({ navigation, route }) {
  const insets  = useSafeAreaInsets();
  const regData = route.params?.regData || {};
  const { setAuth } = useAuthStore();

  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass,        setShowPass]        = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [loading,         setLoading]         = useState(false);

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const canSubmit      = vPassword(password) && passwordsMatch;

  function borderColor(isValid, value) {
    if (!value) return 'rgba(255,255,255,0.08)';
    return isValid ? 'rgba(0,229,204,0.5)' : 'rgba(239,68,68,0.45)';
  }

  async function handleRegister() {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('username', regData.username);
      formData.append('email',    regData.email);
      formData.append('password', password);
      formData.append('gender',   regData.gender || 'prefiero-no-decir');

      if (regData.avatarIsPreset && regData.avatarUri) {
        formData.append('avatarUrl', regData.avatarUri);
      } else if (regData.avatarUri) {
        formData.append('avatar', {
          uri:  regData.avatarUri,
          type: 'image/jpeg',
          name: 'avatar.jpg',
        });
      }

      const { data } = await api.post('/auth/register', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setAuth(data.token, data.user);
      // AppNavigator detecta user != null y cambia al stack autenticado automaticamente
    } catch (err) {
      Alert.alert('Error al crear cuenta', err.response?.data?.error || 'Intentalo de nuevo');
      setLoading(false);
    }
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

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <StepDots current={3} />

        <Text style={s.title}>Elige una contrasena</Text>
        <Text style={s.subtitle}>Ultimo paso. Haz que sea segura</Text>

        {/* Password */}
        <View style={s.field}>
          <Text style={s.label}>CONTRASENA</Text>
          <View style={[s.inputWrap, { borderColor: borderColor(vPassword(password), password) }]}>
            <Ionicons name="lock-closed-outline" size={16} color="rgba(0,229,204,0.4)" style={s.inputIcon} />
            <TextInput
              style={[s.input, { paddingRight: 48 }]}
              placeholder="Minimo 8 caracteres"
              placeholderTextColor="rgba(255,255,255,0.18)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
              autoFocus
            />
            <TouchableOpacity
              style={s.eyeBtn}
              onPress={() => setShowPass(v => !v)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={showPass ? 'eye-outline' : 'eye-off-outline'}
                size={18}
                color="rgba(255,255,255,0.35)"
              />
            </TouchableOpacity>
          </View>
          {!!errPassword(password) && (
            <Text style={s.fieldErr}>{errPassword(password)}</Text>
          )}
        </View>

        {/* Confirm password */}
        <View style={s.field}>
          <Text style={s.label}>CONFIRMAR CONTRASENA</Text>
          <View style={[
            s.inputWrap,
            { borderColor: borderColor(passwordsMatch, confirmPassword) },
          ]}>
            <Ionicons name="lock-closed-outline" size={16} color="rgba(0,229,204,0.4)" style={s.inputIcon} />
            <TextInput
              style={[s.input, { paddingRight: 48 }]}
              placeholder="Repite tu contrasena"
              placeholderTextColor="rgba(255,255,255,0.18)"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirm}
            />
            <TouchableOpacity
              style={s.eyeBtn}
              onPress={() => setShowConfirm(v => !v)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={showConfirm ? 'eye-outline' : 'eye-off-outline'}
                size={18}
                color="rgba(255,255,255,0.35)"
              />
            </TouchableOpacity>
          </View>
          {confirmPassword.length > 0 && !passwordsMatch && (
            <Text style={s.fieldErr}>Las contrasenas no coinciden</Text>
          )}
        </View>

        {/* Password hints */}
        <View style={s.hintsWrap}>
          {[
            { ok: password.length >= 8,  label: 'Minimo 8 caracteres' },
            { ok: /[A-Z]/.test(password), label: 'Al menos una mayuscula' },
            { ok: /[0-9]/.test(password), label: 'Al menos un numero' },
          ].map((hint, i) => (
            <View key={i} style={s.hintRow}>
              <Ionicons
                name={hint.ok ? 'checkmark-circle' : 'ellipse-outline'}
                size={13}
                color={hint.ok ? '#00e5cc' : 'rgba(255,255,255,0.2)'}
              />
              <Text style={[s.hintTxt, hint.ok && s.hintTxtOk]}>{hint.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <TouchableOpacity
          onPress={handleRegister}
          disabled={!canSubmit || loading}
          activeOpacity={0.85}
          style={{ opacity: canSubmit && !loading ? 1 : 0.3 }}
        >
          <LinearGradient
            colors={['#005c55', '#00b4a0', '#00e5cc']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.btnNext}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#001a18" />
            ) : (
              <Text style={s.btnNextTxt}>CREAR CUENTA</Text>
            )}
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
  content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  footer:  { paddingHorizontal: 24, paddingTop: 12 },

  title:    { fontSize: 22, fontWeight: '700', color: '#e8f4f8', marginBottom: 6 },
  subtitle: { fontSize: 13, color: 'rgba(232,244,248,0.4)', marginBottom: 28, lineHeight: 18 },

  field:     { marginBottom: 20 },
  label:     { fontSize: 9, letterSpacing: 3, color: 'rgba(0,229,204,0.5)', marginBottom: 10, fontWeight: '700' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14, overflow: 'hidden',
  },
  inputIcon: { paddingHorizontal: 14 },
  input:     { flex: 1, paddingVertical: 14, color: '#e8f4f8', fontSize: 14 },
  eyeBtn:    { position: 'absolute', right: 12, padding: 6 },
  fieldErr:  { color: 'rgba(239,68,68,0.8)', fontSize: 10, marginTop: 5, marginLeft: 4 },

  hintsWrap: { gap: 8, marginTop: 4 },
  hintRow:   { flexDirection: 'row', alignItems: 'center', gap: 7 },
  hintTxt:   { fontSize: 12, color: 'rgba(255,255,255,0.25)' },
  hintTxtOk: { color: 'rgba(0,229,204,0.6)' },

  btnNext:    { borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  btnNextTxt: { color: '#001a18', fontSize: 12, fontWeight: '800', letterSpacing: 3 },
});
