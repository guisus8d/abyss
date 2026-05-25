import React, { useEffect, useRef } from 'react';
import {
  View, Text, Image, TouchableOpacity,
  StyleSheet, Animated, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';

const { width: W, height: H } = Dimensions.get('window');

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
            Animated.timing(opacity, { toValue: 0.5, duration: duration * 0.3, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: duration * 0.7, useNativeDriver: true }),
          ]),
        ]),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [H * 0.95, -60] });

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
  id: i,
  delay: i * 800,
  x: Math.random() * (W - 10),
  size: Math.random() * 3 + 1,
  duration: 5000 + Math.random() * 6000,
}));

export default function LandingScreen({ navigation }) {
  const { enterGuestMode } = useAuthStore();

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 1000, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={s.root}>
      <LinearGradient
        colors={['#000d1a', '#001a2e', '#002a3a', '#001020']}
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={s.glowCenter} />
      <View style={s.glowTop} />

      {PARTICLES.map(p => <Particle key={p.id} {...p} />)}

      <Animated.View style={[s.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

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

        {/* Tagline */}
        <View style={s.taglineArea}>
          <Text style={s.tagline}>El océano social que te esperaba.</Text>
          <Text style={s.sub}>Conecta. Comparte. Sumérgete.</Text>
        </View>

        {/* Botones */}
        <View style={s.buttons}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Login', { mode: 'login' })}
            activeOpacity={0.85}
            style={{ width: '100%' }}
          >
            <LinearGradient
              colors={['#005c55', '#00b4a0', '#00e5cc']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.btnPrimary}
            >
              <Ionicons name="log-in-outline" size={18} color="#001a18" />
              <Text style={s.btnPrimaryTxt}>INICIAR SESIÓN</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('Login', { mode: 'register' })}
            activeOpacity={0.85}
            style={s.btnSecondary}
          >
            <LinearGradient
              colors={['rgba(41,121,255,0.15)', 'rgba(41,121,255,0.08)']}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name="person-add-outline" size={18} color={colors.c2} />
            <Text style={s.btnSecondaryTxt}>CREAR CUENTA</Text>
          </TouchableOpacity>
        </View>

        {/* Guest */}
        <TouchableOpacity
          onPress={enterGuestMode}
          activeOpacity={0.7}
          style={s.guestBtn}
        >
          <Text style={s.guestTxt}>Explorar sin cuenta</Text>
          <Ionicons name="arrow-forward" size={13} color="rgba(0,229,204,0.4)" />
        </TouchableOpacity>

        <Text style={s.depth}>— 3,800m —</Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000d1a', alignItems: 'center', justifyContent: 'center' },

  glowCenter: {
    position: 'absolute', width: 500, height: 500, borderRadius: 250,
    backgroundColor: 'rgba(0,80,100,0.15)', top: '15%', alignSelf: 'center',
  },
  glowTop: {
    position: 'absolute', width: 300, height: 300, borderRadius: 150,
    backgroundColor: 'rgba(0,40,120,0.1)', top: -50, alignSelf: 'center',
  },

  content: {
    width: '100%', maxWidth: 420,
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },

  // Logo
  logoArea: {
    alignItems: 'center',
    marginBottom: 48,
    position: 'relative',
    width: 180, height: 180,
    justifyContent: 'center',
  },
  ring1: {
    position: 'absolute', width: 110, height: 110, borderRadius: 55,
    borderWidth: 1, borderColor: 'rgba(0,229,204,0.22)',
  },
  ring2: {
    position: 'absolute', width: 145, height: 145, borderRadius: 73,
    borderWidth: 1, borderColor: 'rgba(41,121,255,0.14)',
  },
  ring3: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    borderWidth: 1, borderColor: 'rgba(0,229,204,0.07)',
  },
  logoBox:  { width: 88, height: 88, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  logoImg:  { width: 96, height: 96 },
  wordmark: {
    position: 'absolute', bottom: -28,
    fontSize: 32, fontWeight: '900', letterSpacing: 14, color: '#00e5cc',
    textShadowColor: 'rgba(0,229,204,0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },

  // Tagline
  taglineArea: { alignItems: 'center', marginBottom: 52, gap: 8 },
  tagline: {
    fontSize: 20, fontWeight: '700', color: 'rgba(232,244,248,0.9)',
    textAlign: 'center', letterSpacing: 0.3,
  },
  sub: {
    fontSize: 13, color: 'rgba(0,229,204,0.45)',
    letterSpacing: 2, textAlign: 'center',
  },

  // Buttons
  buttons: { width: '100%', gap: 14, alignItems: 'center', marginBottom: 36 },

  btnPrimary: {
    borderRadius: 16, paddingVertical: 17,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    width: '100%',
  },
  btnPrimaryTxt: { color: '#001a18', fontSize: 13, fontWeight: '800', letterSpacing: 4 },

  btnSecondary: {
    width: '100%', borderRadius: 16, paddingVertical: 17,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 1, borderColor: 'rgba(41,121,255,0.35)',
    overflow: 'hidden',
  },
  btnSecondaryTxt: { color: colors.c2, fontSize: 13, fontWeight: '800', letterSpacing: 4 },

  // Guest
  guestBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 16,
  },
  guestTxt: {
    fontSize: 13, color: 'rgba(0,229,204,0.4)',
    letterSpacing: 0.3,
  },

  depth: { marginTop: 32, color: 'rgba(0,229,204,0.18)', fontSize: 10, letterSpacing: 4 },
});
