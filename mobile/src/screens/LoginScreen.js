import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator,
  StyleSheet, Alert, StatusBar, ScrollView, Platform,
  Animated, Dimensions, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

const { width: W, height: H } = Dimensions.get('window');
const GOOGLE_CLIENT_ID = '841197288611-3uhrf7lv42jdae4703unshffp0rfralj.apps.googleusercontent.com';

function Particle({ delay, x, size, duration }) {
  const anim    = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(anim, { toValue: 1, duration, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(opacity, { toValue: 0.6, duration: duration * 0.3, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0,   duration: duration * 0.7, useNativeDriver: true }),
          ]),
        ]),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [H * 0.9, -50] });

  return (
    <Animated.View
      style={{
        position: 'absolute', left: x, bottom: 0,
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: '#00e5cc', opacity,
        transform: [{ translateY }],
      }}
    />
  );
}

const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id:       i,
  delay:    i * 700,
  x:        Math.random() * (W - 10),
  size:     Math.random() * 3 + 1,
  duration: 4000 + Math.random() * 6000,
}));

function GoogleIcon({ size = 20 }) {
  return (
    <Image
      source={{ uri: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PHBhdGggZmlsbD0iI0ZGQzEwNyIgZD0iTTQzLjYxMSwyMC4wODNINDJWMjBIMjR2OGgxMS4zMDNjLTEuNjQ5LDQuNjU3LTYuMDgsMTEtMTEuMzAzLDExYy02LjYyNywwLTEyLTUuMzczLTEyLTEyczUuMzczLTEyLDEyLTEyYzMuMDU5LDAsNS44NDIsMS4xNTQsNy45NjEsMy4wMzlsNS42NTctNS42NTdDMzQuMDQ2LDYuMDUzLDI5LjI2OCw0LDI0LDRDMTIuOTU1LDQsNCwxMi45NTUsNCwyNHM4Ljk1NSwyMCwyMCwyMHMyMC04Ljk1NSwyMC0yMEMzNiwyMi4zNCw0NiwyMC4wODMsNDMuNjExLDIwLjA4M3oiLz48cGF0aCBmaWxsPSIjRkY0MDgwIiBkPSJNNi4zMDYsMTQuNjkxbDYuNTcxLDQuODE5QzE0LjY1NSwxNS4xMDgsMTguOTYxLDEyLDI0LDEyYzMuMDU5LDAsNS44NDIsMS4xNTQsNy45NjEsMy4wMzlsNS42NTctNS42NTdDMzQuMDQ2LDYuMDUzLDI5LjI2OCw0LDI0LDRDMTYuMzE4LDQsOS42NTYsOC4zMzcsNi4zMDYsMTQuNjkxeiIvPjxwYXRoIGZpbGw9IiM0Q0FGNTAiIGQ9Ik0yNCw0NGM1LjE2NiwwLDkuODYtMS45NzcsMTMuNDA5LTUuMTkybC02LjE5LTUuMjM4QzI5LjIxMSwzNS4wOTEsMjYuNzE1LDM2LDI0LDM2Yy01LjIwMiwwLTkuNjE5LTMuMzE3LTExLjI4My03Ljk0NmwtNi41MjIsNS4wMjVDOS41MDUsNDAuMjI4LDE2LjIyNyw0NCwyNCw0NHoiLz48cGF0aCBmaWxsPSIjMTk3NkQyIiBkPSJNNDMuNjExLDIwLjA4M0g0MlYyMEgyNHY4aDExLjMwM2MtMC43OTIsMi4yMzctMi4yMzEsNC4xNjYtNC4wODcsNS41NzFjMC4wMDEtMC4wMDEsNi4xOSw1LjIzOCw2LjE5LDUuMjM4QzM5LjkwNywzNS40NDQsNDQsMzAuMTM4LDQ0LDI0QzQ0LDIyLjM0LDQzLjk4NiwyMC43MjUsNDMuNjExLDIwLjA4M3oiLz48L3N2Zz4=' }}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}

export default function LoginScreen({ navigation }) {
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPass,     setShowPass]     = useState(false);
  const [passDisplay,  setPassDisplay]  = useState('');
  const maskTimerPass  = useRef(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login, setAuth, isLoading } = useAuthStore();

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]).start();
  }, []);

  // Google Identity Services en web
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (document.getElementById('google-gsi')) return;
    const script = document.createElement('script');
    script.id    = 'google-gsi';
    script.src   = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, []);

  // Password masking con delay (mismo comportamiento que antes)
  function handlePassChange(raw) {
    const prevLen = password.length;
    const newLen  = raw.length;
    const newReal = newLen >= prevLen
      ? password + raw.slice(prevLen)
      : password.slice(0, newLen);
    setPassword(newReal);
    clearTimeout(maskTimerPass.current);
    if (newLen > prevLen && newReal.length > 0) {
      setPassDisplay('•'.repeat(newReal.length - 1) + newReal.slice(-1));
      maskTimerPass.current = setTimeout(() => setPassDisplay('•'.repeat(newReal.length)), 350);
    } else {
      setPassDisplay('•'.repeat(newReal.length));
    }
  }

  async function handleGoogleLogin() {
    if (Platform.OS !== 'web') {
      Alert.alert('Proximamente', 'Login con Google disponible en la app movil pronto.');
      return;
    }
    setGoogleLoading(true);
    try {
      await new Promise((resolve, reject) => {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (response) => {
            try {
              const { data } = await api.post('/auth/google', { idToken: response.credential });
              if (setAuth) setAuth(data.token, data.user);
              resolve();
            } catch (err) { reject(err); }
          },
        });
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            reject(new Error('Google login cancelado'));
          }
        });
      });
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || err.message || 'No se pudo iniciar sesion con Google');
    } finally { setGoogleLoading(false); }
  }

  async function handleSubmit() {
    const result = await login(email.trim(), password);
    if (!result.success) Alert.alert('Error', result.error);
  }

  function goToRegister() {
    // Vuelve a WelcomeScreen (raiz del stack no autenticado) donde el usuario puede elegir Registrarse
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.black} />

      <LinearGradient
        colors={['#000d1a', '#001a2e', '#002a3a', '#001020']}
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.glowCenter} />
      <View style={s.glowBottom} />

      {PARTICLES.map(p => <Particle key={p.id} {...p} />)}

      <ScrollView
        style={{ backgroundColor: 'transparent' }}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[s.inner, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          {/* Logo */}
          <View style={s.logoArea}>
            <View style={s.ring3} />
            <View style={s.ring2} />
            <View style={s.ring1} />
            <View style={s.logoBox}>
              <Image source={require('../../assets/logo.png')} style={s.logoImg} resizeMode="contain" />
            </View>
            <Text style={s.wordmark}>ABYSS</Text>
          </View>

          {/* Card */}
          <View style={s.card}>
            <LinearGradient
              colors={['transparent', '#00e5cc', '#2979ff', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.cardTopLine}
            />

            <Text style={s.cardTitle}>BIENVENIDO</Text>

            {/* Email */}
            <View style={s.field}>
              <Text style={s.label}>EMAIL</Text>
              <View style={s.inputWrap}>
                <Ionicons name="mail-outline" size={16} color="rgba(0,229,204,0.4)" style={s.inputIcon} />
                <TextInput
                  style={s.input}
                  placeholder="usuario@ejemplo.com"
                  placeholderTextColor="rgba(255,255,255,0.18)"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            {/* Password */}
            <View style={s.field}>
              <Text style={s.label}>CONTRASENA</Text>
              <View style={s.inputWrap}>
                <Ionicons name="lock-closed-outline" size={16} color="rgba(0,229,204,0.4)" style={s.inputIcon} />
                <TextInput
                  style={[s.input, { paddingRight: 44 }]}
                  placeholder="••••••••••••"
                  placeholderTextColor="rgba(255,255,255,0.18)"
                  value={showPass ? password : passDisplay}
                  onChangeText={showPass ? setPassword : handlePassChange}
                  secureTextEntry={false}
                />
                <TouchableOpacity style={s.eyeBtn} onPress={() => {
                  setShowPass(v => {
                    if (!v) setPassDisplay('•'.repeat(password.length));
                    return !v;
                  });
                }} activeOpacity={0.7}>
                  <Ionicons name={showPass ? 'eye-outline' : 'eye-off-outline'} size={18} color="rgba(255,255,255,0.35)" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Forgot password */}
            <TouchableOpacity style={s.forgotWrap} activeOpacity={0.7}>
              <Text style={s.forgot}>Olvidaste tu contrasena?</Text>
            </TouchableOpacity>

            {/* Submit */}
            <TouchableOpacity onPress={handleSubmit} disabled={isLoading} activeOpacity={0.85} style={{ marginTop: 4 }}>
              <LinearGradient
                colors={['#005c55', '#00b4a0', '#00e5cc']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.btnEnter}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#001a18" />
                ) : (
                  <Text style={s.btnTxt}>SUMERGIRSE</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Divisor */}
            <View style={s.divider}>
              <View style={s.divLine} />
              <Text style={s.divTxt}>o continua con</Text>
              <View style={s.divLine} />
            </View>

            {/* Google */}
            <TouchableOpacity
              style={s.googleBtn}
              onPress={handleGoogleLogin}
              disabled={googleLoading}
              activeOpacity={0.85}
            >
              <View style={s.googleBtnInner}>
                <GoogleIcon size={20} />
                <Text style={s.googleTxt}>
                  {googleLoading ? 'Conectando...' : 'Continuar con Google'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Toggle a registro */}
          <TouchableOpacity onPress={goToRegister} style={s.toggle} activeOpacity={0.7}>
            <Text style={s.toggleTxt}>
              No tienes cuenta?{' '}
              <Text style={s.toggleLink}>Registrate</Text>
            </Text>
          </TouchableOpacity>

          <Text style={s.depth}>— 3,800m —</Text>

        </Animated.View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#000d1a' },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  inner:  { width: '100%', maxWidth: 400, alignItems: 'center' },

  glowCenter: {
    position: 'absolute', width: 400, height: 400, borderRadius: 200,
    backgroundColor: 'rgba(0,80,100,0.18)', top: '20%', alignSelf: 'center',
  },
  glowBottom: {
    position: 'absolute', width: 300, height: 300, borderRadius: 150,
    backgroundColor: 'rgba(0,40,120,0.12)', bottom: 0, alignSelf: 'center',
  },

  logoArea: { alignItems: 'center', marginBottom: 36, position: 'relative', width: 160, height: 160, justifyContent: 'center' },
  ring1: { position: 'absolute', width: 100, height: 100, borderRadius: 50, borderWidth: 1, borderColor: 'rgba(0,229,204,0.2)' },
  ring2: { position: 'absolute', width: 130, height: 130, borderRadius: 65, borderWidth: 1, borderColor: 'rgba(41,121,255,0.12)' },
  ring3: { position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 1, borderColor: 'rgba(0,229,204,0.06)' },
  logoBox:  { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  logoImg:  { width: 84, height: 84 },
  wordmark: {
    position: 'absolute', bottom: -28, fontSize: 28, fontWeight: '900',
    letterSpacing: 12, color: '#00e5cc',
    textShadowColor: 'rgba(0,229,204,0.4)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12,
  },

  card: {
    width: '100%', marginTop: 40,
    backgroundColor: 'rgba(0,15,30,0.85)',
    borderRadius: 24, borderWidth: 1,
    borderColor: 'rgba(0,229,204,0.12)',
    padding: 24, overflow: 'hidden',
  },
  cardTopLine: { height: 1, width: '100%', marginBottom: 20 },
  cardTitle: {
    fontSize: 11, letterSpacing: 4, color: 'rgba(0,229,204,0.6)',
    textAlign: 'center', marginBottom: 24, fontWeight: '700',
  },

  field:     { marginBottom: 16 },
  label:     { fontSize: 9, letterSpacing: 3, color: 'rgba(0,229,204,0.5)', marginBottom: 8, fontWeight: '700' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' },
  inputIcon: { paddingHorizontal: 14 },
  input:     { flex: 1, paddingVertical: 14, paddingRight: 14, color: '#e8f4f8', fontSize: 14, letterSpacing: 0.3 },
  eyeBtn:    { position: 'absolute', right: 12, padding: 4 },

  forgotWrap: { alignItems: 'flex-end', marginBottom: 20, marginTop: -4 },
  forgot:     { fontSize: 11, color: 'rgba(0,229,204,0.5)', letterSpacing: 0.3 },

  btnEnter: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 20 },
  btnTxt:   { color: '#001a18', fontSize: 12, fontWeight: '800', letterSpacing: 4 },

  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  divLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  divTxt:  { marginHorizontal: 12, fontSize: 11, color: 'rgba(255,255,255,0.25)', letterSpacing: 0.5 },

  googleBtn:      { borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)', overflow: 'hidden' },
  googleBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 12 },
  googleTxt:      { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '600', letterSpacing: 0.3 },

  toggle:     { marginTop: 24 },
  toggleTxt:  { color: 'rgba(255,255,255,0.35)', fontSize: 13, textAlign: 'center' },
  toggleLink: { color: '#00e5cc', fontWeight: '700' },

  depth: { marginTop: 20, color: 'rgba(0,229,204,0.2)', fontSize: 10, letterSpacing: 4 },
});
