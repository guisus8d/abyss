import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
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

const vEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export default function RegisterStep3Screen({ navigation, route }) {
  const insets  = useSafeAreaInsets();
  const regData = route.params?.regData || {};

  const [email,     setEmail]     = useState(regData.email || '');
  const [loading,   setLoading]   = useState(false);
  const [codeSent,  setCodeSent]  = useState(false);

  async function handleSendCode() {
    if (!vEmail(email)) return;
    setLoading(true);
    try {
      await api.post('/auth/send-register-code', { email: email.trim() });
      setCodeSent(true);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo enviar el codigo');
    } finally {
      setLoading(false);
    }
  }

  function handleContinue() {
    navigation.navigate('RegisterEmailVerify', {
      regData: { ...regData, email: email.trim() },
    });
  }

  const emailValid = vEmail(email);

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
        <StepDots current={2} />

        <Text style={s.title}>Tu correo electronico</Text>
        <Text style={s.subtitle}>Enviaremos un codigo de 6 digitos para verificarlo</Text>

        {/* Email field */}
        <View style={s.field}>
          <Text style={s.label}>CORREO ELECTRONICO</Text>
          <View style={[
            s.inputWrap,
            { borderColor: email
              ? (emailValid ? 'rgba(0,229,204,0.5)' : 'rgba(239,68,68,0.45)')
              : 'rgba(255,255,255,0.08)'
            },
          ]}>
            <Ionicons name="mail-outline" size={16} color="rgba(0,229,204,0.4)" style={s.inputIcon} />
            <TextInput
              style={s.input}
              placeholder="usuario@ejemplo.com"
              placeholderTextColor="rgba(255,255,255,0.18)"
              value={email}
              onChangeText={v => { setEmail(v); setCodeSent(false); }}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!codeSent}
            />
            {email.length > 0 && (
              <Ionicons
                name={emailValid ? 'checkmark-circle' : 'close-circle'}
                size={16}
                color={emailValid ? 'rgba(0,229,204,0.7)' : 'rgba(239,68,68,0.7)'}
                style={{ marginRight: 12 }}
              />
            )}
          </View>
          {email && !emailValid && (
            <Text style={s.fieldErr}>Formato de email invalido</Text>
          )}
        </View>

        {/* Confirmation message */}
        {codeSent && (
          <View style={s.sentBox}>
            <Ionicons name="checkmark-circle" size={18} color="#00e5cc" />
            <Text style={s.sentTxt}>
              Hemos enviado un codigo a{' '}
              <Text style={s.sentEmail}>{email.trim()}</Text>
            </Text>
          </View>
        )}
      </View>

      {/* Footer */}
      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        {!codeSent ? (
          <TouchableOpacity
            onPress={handleSendCode}
            disabled={!emailValid || loading}
            activeOpacity={0.85}
            style={{ opacity: emailValid && !loading ? 1 : 0.3 }}
          >
            <LinearGradient
              colors={['#005c55', '#00b4a0', '#00e5cc']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.btnNext}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#001a18" />
              ) : (
                <>
                  <Text style={s.btnNextTxt}>ENVIAR CODIGO</Text>
                  <Ionicons name="send" size={14} color="#001a18" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleContinue} activeOpacity={0.85}>
            <LinearGradient
              colors={['#005c55', '#00b4a0', '#00e5cc']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.btnNext}
            >
              <Text style={s.btnNextTxt}>INGRESAR CODIGO</Text>
              <Ionicons name="chevron-forward" size={15} color="#001a18" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {codeSent && (
          <TouchableOpacity
            onPress={() => { setCodeSent(false); }}
            style={s.changeEmailBtn}
            activeOpacity={0.7}
          >
            <Text style={s.changeEmailTxt}>Cambiar correo</Text>
          </TouchableOpacity>
        )}
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

  field:     { marginBottom: 20 },
  label:     { fontSize: 9, letterSpacing: 3, color: 'rgba(0,229,204,0.5)', marginBottom: 10, fontWeight: '700' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14, overflow: 'hidden',
  },
  inputIcon: { paddingHorizontal: 14 },
  input:     { flex: 1, paddingVertical: 14, paddingRight: 14, color: '#e8f4f8', fontSize: 14 },
  fieldErr:  { color: 'rgba(239,68,68,0.8)', fontSize: 10, marginTop: 5, marginLeft: 4 },

  sentBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(0,229,204,0.06)',
    borderWidth: 1, borderColor: 'rgba(0,229,204,0.2)',
    borderRadius: 12, padding: 14,
  },
  sentTxt:   { flex: 1, color: 'rgba(232,244,248,0.6)', fontSize: 13, lineHeight: 18 },
  sentEmail: { color: '#00e5cc', fontWeight: '600' },

  btnNext:    { borderRadius: 14, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnNextTxt: { color: '#001a18', fontSize: 12, fontWeight: '800', letterSpacing: 3 },

  changeEmailBtn: { alignItems: 'center', paddingVertical: 14 },
  changeEmailTxt: { color: 'rgba(0,229,204,0.5)', fontSize: 12 },
});
