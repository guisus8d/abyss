import React, { useState, useEffect, useRef } from 'react';
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

export default function RegisterEmailVerifyScreen({ navigation, route }) {
  const insets  = useSafeAreaInsets();
  const regData = route.params?.regData || {};
  const email   = regData.email || '';

  const [code,     setCode]     = useState('');
  const [loading,  setLoading]  = useState(false);
  const [cooldown, setCooldown] = useState(60); // starts with 60s since code was just sent
  const timerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    startCooldown(60);
    return () => clearInterval(timerRef.current);
  }, []);

  function startCooldown(seconds) {
    setCooldown(seconds);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown(v => {
        if (v <= 1) { clearInterval(timerRef.current); return 0; }
        return v - 1;
      });
    }, 1000);
  }

  async function handleVerify() {
    if (code.length !== 6) return;
    setLoading(true);
    try {
      await api.post('/auth/verify-register-code', { email, code });
      navigation.navigate('RegisterStep4', { regData });
    } catch (err) {
      setCode('');
      Alert.alert('Codigo incorrecto', err.response?.data?.error || 'Codigo invalido');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    try {
      await api.post('/auth/send-register-code', { email });
      setCode('');
      startCooldown(60);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo reenviar el codigo');
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

      <View style={s.content}>
        <StepDots current={2} />

        <Text style={s.title}>Verifica tu correo</Text>
        <Text style={s.subtitle}>
          Ingresa el codigo de 6 digitos que enviamos a{'\n'}
          <Text style={s.emailHighlight}>{email}</Text>
        </Text>

        {/* Code input */}
        <TouchableOpacity activeOpacity={1} onPress={() => inputRef.current?.focus()}>
          <View style={s.codeBox}>
            {Array.from({ length: 6 }, (_, i) => (
              <View
                key={i}
                style={[
                  s.codeCell,
                  code.length === i && s.codeCellActive,
                  code.length > i && s.codeCellFilled,
                ]}
              >
                <Text style={s.codeCellTxt}>
                  {code[i] || ''}
                </Text>
              </View>
            ))}
          </View>
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={v => setCode(v.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            style={s.hiddenInput}
            autoFocus
          />
        </TouchableOpacity>

        {/* Resend */}
        <View style={s.resendRow}>
          {cooldown > 0 ? (
            <Text style={s.resendCooldown}>
              Reenviar codigo en {cooldown}s
            </Text>
          ) : (
            <TouchableOpacity onPress={handleResend} activeOpacity={0.7}>
              <Text style={s.resendLink}>Reenviar codigo</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Footer */}
      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <TouchableOpacity
          onPress={handleVerify}
          disabled={code.length !== 6 || loading}
          activeOpacity={0.85}
          style={{ opacity: code.length === 6 && !loading ? 1 : 0.3 }}
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
                <Text style={s.btnNextTxt}>VERIFICAR</Text>
                <Ionicons name="checkmark" size={15} color="#001a18" />
              </>
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
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
  footer:  { paddingHorizontal: 24, paddingTop: 12 },

  title:         { fontSize: 22, fontWeight: '700', color: '#e8f4f8', marginBottom: 6 },
  subtitle:      { fontSize: 13, color: 'rgba(232,244,248,0.4)', marginBottom: 36, lineHeight: 20 },
  emailHighlight:{ color: '#00e5cc', fontWeight: '600' },

  // Code cells
  codeBox: { flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: 24 },
  codeCell: {
    width: 44, height: 54, borderRadius: 12,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center', justifyContent: 'center',
  },
  codeCellActive: { borderColor: '#00e5cc', backgroundColor: 'rgba(0,229,204,0.05)' },
  codeCellFilled: { borderColor: 'rgba(0,229,204,0.4)', backgroundColor: 'rgba(0,229,204,0.05)' },
  codeCellTxt: { fontSize: 22, fontWeight: '700', color: '#e8f4f8', letterSpacing: 1 },
  hiddenInput: {
    position: 'absolute', opacity: 0, width: 1, height: 1,
  },

  // Resend
  resendRow:     { alignItems: 'center', marginTop: 8 },
  resendCooldown:{ color: 'rgba(232,244,248,0.3)', fontSize: 12 },
  resendLink:    { color: '#2979ff', fontSize: 12, fontWeight: '600' },

  btnNext:    { borderRadius: 14, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnNextTxt: { color: '#001a18', fontSize: 12, fontWeight: '800', letterSpacing: 3 },
});
