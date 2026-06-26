import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Image, StyleSheet,
  StatusBar, Animated, Dimensions, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

const { width: W, height: H } = Dimensions.get('window');

function Particle({ delay, x, size, duration }) {
  const anim    = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(anim,    { toValue: 1, duration, useNativeDriver: true }),
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

const PARTICLES = Array.from({ length: 16 }, (_, i) => ({
  id:       i,
  delay:    i * 750,
  x:        Math.random() * (W - 10),
  size:     Math.random() * 3 + 1,
  duration: 4000 + Math.random() * 6000,
}));

export default function WelcomeScreen({ navigation }) {
  const insets   = useSafeAreaInsets();
  const [accepted, setAccepted] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]).start();
  }, []);

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

      <Animated.View style={[s.inner, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

        {/* Logo */}
        <View style={[s.logoArea, { marginTop: insets.top + 40 }]}>
          <View style={s.ring3} />
          <View style={s.ring2} />
          <View style={s.ring1} />
          <View style={s.logoBox}>
            <Image source={require('../../assets/logo.png')} style={s.logoImg} resizeMode="contain" />
          </View>
          <Text style={s.wordmark}>ABYSS</Text>
          <Text style={s.tagline}>Las profundidades te esperan</Text>
        </View>

        {/* Bottom action block */}
        <View style={[s.bottomBlock, { paddingBottom: Math.max(insets.bottom, 32) }]}>

          <LinearGradient
            colors={['transparent', '#00e5cc', '#2979ff', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.blockTopLine}
          />

          {/* Checkbox */}
          <TouchableOpacity
            style={s.checkRow}
            onPress={() => setAccepted(v => !v)}
            activeOpacity={0.7}
          >
            <View style={[s.checkbox, accepted && s.checkboxOn]}>
              {accepted && <Ionicons name="checkmark" size={12} color="#001a18" />}
            </View>
            <Text style={s.checkTxt}>Acepto las politicas de privacidad</Text>
          </TouchableOpacity>

          {/* Login button */}
          <TouchableOpacity
            style={[s.btnLogin, !accepted && s.btnDim]}
            onPress={() => navigation.navigate('Login')}
            disabled={!accepted}
            activeOpacity={0.8}
          >
            <Text style={s.btnLoginTxt}>Iniciar sesion</Text>
          </TouchableOpacity>

          {/* Register button */}
          <TouchableOpacity
            onPress={() => navigation.navigate('RegisterStep1', { regData: {} })}
            disabled={!accepted}
            activeOpacity={0.85}
            style={!accepted && s.btnDim}
          >
            <LinearGradient
              colors={['#005c55', '#00b4a0', '#00e5cc']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.btnRegister}
            >
              <Text style={s.btnRegisterTxt}>Registrarse</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Privacy policy link */}
          <TouchableOpacity
            onPress={() => Linking.openURL('https://abyss.social/terminos')}
            style={s.privacyWrap}
            activeOpacity={0.7}
          >
            <Text style={s.privacyLink}>Ver politicas de privacidad</Text>
          </TouchableOpacity>

        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000d1a' },
  inner: { flex: 1, justifyContent: 'space-between' },

  glowCenter: {
    position: 'absolute', width: 400, height: 400, borderRadius: 200,
    backgroundColor: 'rgba(0,80,100,0.18)', top: '15%', alignSelf: 'center',
  },
  glowBottom: {
    position: 'absolute', width: 300, height: 300, borderRadius: 150,
    backgroundColor: 'rgba(0,40,120,0.12)', bottom: 0, alignSelf: 'center',
  },

  // Logo
  logoArea: {
    alignItems: 'center',
    position: 'relative',
    width: 180,
    height: 200,
    alignSelf: 'center',
    justifyContent: 'center',
  },
  ring1: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50,
    borderWidth: 1, borderColor: 'rgba(0,229,204,0.2)',
  },
  ring2: {
    position: 'absolute', width: 130, height: 130, borderRadius: 65,
    borderWidth: 1, borderColor: 'rgba(41,121,255,0.12)',
  },
  ring3: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    borderWidth: 1, borderColor: 'rgba(0,229,204,0.06)',
  },
  logoBox:  { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  logoImg:  { width: 84, height: 84 },
  wordmark: {
    position: 'absolute', bottom: 28, fontSize: 28, fontWeight: '900',
    letterSpacing: 12, color: '#00e5cc',
    textShadowColor: 'rgba(0,229,204,0.4)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12,
  },
  tagline: {
    position: 'absolute', bottom: 4, fontSize: 10, letterSpacing: 1.5,
    color: 'rgba(232,244,248,0.3)', fontStyle: 'italic',
  },

  // Bottom block
  bottomBlock: {
    paddingHorizontal: 24,
    paddingTop: 24,
    backgroundColor: 'rgba(0,10,20,0.7)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,229,204,0.06)',
  },
  blockTopLine: { height: 1, width: '100%', marginBottom: 24 },

  // Checkbox
  checkRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  checkbox: {
    width: 22, height: 22, borderRadius: 7, borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#00e5cc', borderColor: '#00e5cc' },
  checkTxt:   { flex: 1, fontSize: 13, color: 'rgba(232,244,248,0.55)', lineHeight: 18 },

  // Buttons
  btnDim:    { opacity: 0.3 },
  btnLogin: {
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(0,229,204,0.3)',
    backgroundColor: 'rgba(0,229,204,0.06)',
    paddingVertical: 15, alignItems: 'center',
    marginBottom: 12,
  },
  btnLoginTxt: { color: '#00e5cc', fontSize: 13, fontWeight: '700', letterSpacing: 3 },
  btnRegister: { borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginBottom: 20 },
  btnRegisterTxt: { color: '#001a18', fontSize: 13, fontWeight: '800', letterSpacing: 3 },

  // Privacy link
  privacyWrap: { alignItems: 'center', paddingVertical: 4 },
  privacyLink: { color: '#2979ff', fontSize: 12, letterSpacing: 0.3 },
});
