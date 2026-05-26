import React, { useEffect, useRef, useState } from 'react';
import {
  View, TouchableOpacity, Animated,
  StyleSheet, Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AvatarWithFrame from './AvatarWithFrame';
import api from '../services/api';
import { colors } from '../theme/colors';

// ─── Layout ──────────────────────────────────────────────────────────────────
const CENTER_SIZE        = 320;
const CENTER             = CENTER_SIZE / 2;
const AVATAR_SIZE        = 42;
const CENTER_AVATAR_SIZE = 70;
const { width: SW, height: SH } = Dimensions.get('window');

// ─── Dos anillos orbitales ────────────────────────────────────────────────────
// Todos los slots de un anillo comparten la misma velocidad angular
// → jamás se agrupan porque mantienen su separación angular inicial fija
const RINGS = [
  { radius: 84,  angularSpeed:  0.0009, count: 3 }, // interior — sentido horario
  { radius: 140, angularSpeed: -0.0006, count: 4 }, // exterior — antihorario
];

// Mapeo plano: slot 0-2 → anillo 0, slot 3-6 → anillo 1
const SLOT_MAP = [];
RINGS.forEach((ring, ringIdx) => {
  for (let i = 0; i < ring.count; i++) {
    SLOT_MAP.push({ ringIdx, slotInRing: i, ring });
  }
});
const TOTAL_SLOTS = SLOT_MAP.length; // 7

// ─── Estrellas de fondo ───────────────────────────────────────────────────────
const STARS = Array.from({ length: 45 }, () => ({
  x:       Math.random() * SW,
  y:       Math.random() * SH * 0.6,
  size:    0.4 + Math.random() * 1.8,
  opacity: 0.06 + Math.random() * 0.38,
  twinkle: Math.random() > 0.72,
}));

// ─── Componente Star ──────────────────────────────────────────────────────────
function Star({ star }) {
  const anim = useRef(new Animated.Value(star.opacity)).current;
  useEffect(() => {
    if (!star.twinkle) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: star.opacity * 0.08,
          duration: 1400 + Math.random() * 1800,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: star.opacity,
          duration: 1400 + Math.random() * 1800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={{
      position:        'absolute',
      left:            star.x - star.size / 2,
      top:             star.y - star.size / 2,
      width:           star.size,
      height:          star.size,
      borderRadius:    star.size,
      backgroundColor: colors.c1,
      opacity:         anim,
    }} />
  );
}

// ─── Avatar orbital ───────────────────────────────────────────────────────────
function OrbitSlot({ leftAnim, topAnim, scaleAnim, opacityAnim, user, navigation }) {
  if (!user) return null;
  return (
    <Animated.View style={{
      position:  'absolute',
      transform: [
        { translateX: leftAnim },
        { translateY: topAnim },
        { scale: scaleAnim },
      ],
      opacity: opacityAnim,
      left: -AVATAR_SIZE / 2,
      top:  -AVATAR_SIZE / 2,
    }}>
      <TouchableOpacity
        onPress={() => navigation.navigate('PublicProfile', { username: user.username })}
        activeOpacity={0.8}
      >
        <View style={styles.orbitAvatarWrap}>
          <AvatarWithFrame
            size={AVATAR_SIZE}
            avatarUrl={user.avatarUrl}
            username={user.username}
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Centro (agujero negro) ───────────────────────────────────────────────────
function BlackHoleCenter({ user, navigation }) {
  const avatarOpacity = useRef(new Animated.Value(0)).current;
  const avatarScale   = useRef(new Animated.Value(0.8)).current;
  const pulse1        = useRef(new Animated.Value(1)).current;
  const pulse2        = useRef(new Animated.Value(1)).current;
  const diskRotate    = useRef(new Animated.Value(0)).current;

  // Disco de acreción girando
  useEffect(() => {
    Animated.loop(
      Animated.timing(diskRotate, {
        toValue:        1,
        duration:       12000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  // Pulso doble desfasado
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse1, { toValue: 1.12, duration: 1600, useNativeDriver: true }),
        Animated.timing(pulse1, { toValue: 1.0,  duration: 1600, useNativeDriver: true }),
      ])
    ).start();
    setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse2, { toValue: 1.20, duration: 2000, useNativeDriver: true }),
          Animated.timing(pulse2, { toValue: 1.0,  duration: 2000, useNativeDriver: true }),
        ])
      ).start();
    }, 800);
  }, []);

  // Entrada del avatar central
  useEffect(() => {
    if (!user) return;
    avatarOpacity.setValue(0);
    avatarScale.setValue(0.8);
    Animated.parallel([
      Animated.timing(avatarOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(avatarScale,   { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
    ]).start();
  }, [user?.key]);

  const diskSpin = diskRotate.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!user) return null;

  return (
    <View style={styles.centerRoot}>

      {/* Halo exterior — glow suave */}
      <Animated.View style={[
        styles.haloOuter,
        { transform: [{ scale: pulse2 }] },
      ]} />

      {/* Disco de acreción girando */}
      <Animated.View style={[
        styles.accretionDisk,
        { transform: [{ rotate: diskSpin }] },
      ]} />

      {/* Halo interior — event horizon */}
      <Animated.View style={[
        styles.haloInner,
        { transform: [{ scale: pulse1 }] },
      ]} />

      {/* Núcleo oscuro */}
      <View style={styles.coreBackground} />

      {/* Avatar */}
      <Animated.View style={{
        opacity:   avatarOpacity,
        transform: [{ scale: avatarScale }],
        zIndex:    30,
      }}>
        <TouchableOpacity
          onPress={() => navigation.navigate('PublicProfile', { username: user.username })}
          activeOpacity={0.85}
        >
          <View style={styles.centerAvatarWrap}>
            <AvatarWithFrame
              size={CENTER_AVATAR_SIZE}
              avatarUrl={user.avatarUrl}
              username={user.username}
            />
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function OrbitUsers({ navigation }) {
  const [allUsers, setAllUsers]     = useState([]);
  const [slots, setSlots]           = useState(Array(TOTAL_SLOTS).fill(null));
  const [centerUser, setCenterUser] = useState(null);

  const userIdxRef    = useRef(0);
  const centerIdxRef  = useRef(0);

  // Ángulo base por anillo (compartido entre todos los slots del mismo anillo)
  const ringAnglesRef = useRef(RINGS.map(() => 0));

  const slotAnims = useRef(
    Array.from({ length: TOTAL_SLOTS }, () => ({
      left:    new Animated.Value(0),
      top:     new Animated.Value(0),
      scale:   new Animated.Value(0),
      opacity: new Animated.Value(0),
    }))
  ).current;

  // ── RAF orbital ─────────────────────────────────────────────────────────────
  useFocusEffect(
    React.useCallback(() => {
      let running = true;

      function loop() {
        if (!running) return;

        // Avanzar el ángulo de cada anillo
        ringAnglesRef.current = ringAnglesRef.current.map(
          (angle, ri) => angle + RINGS[ri].angularSpeed
        );

        // Posicionar cada slot según su anillo + offset angular fijo
        SLOT_MAP.forEach(({ ringIdx, slotInRing, ring }, slotIdx) => {
          const baseAngle = (slotInRing / ring.count) * Math.PI * 2;
          const angle     = ringAnglesRef.current[ringIdx] + baseAngle;
          slotAnims[slotIdx].left.setValue(Math.cos(angle) * ring.radius);
          slotAnims[slotIdx].top.setValue( Math.sin(angle) * ring.radius);
        });

        requestAnimationFrame(loop);
      }

      requestAnimationFrame(loop);
      return () => { running = false; };
    }, [])
  );

  // ── Carga inicial de usuarios ─────────────────────────────────────────────
  useEffect(() => {
    api.get('/users/top')
      .then(({ data }) => {
        const users = (data.users || []).sort(() => Math.random() - 0.5);
        setAllUsers(users);

        if (users.length > 0) {
          setCenterUser({ ...users[0], key: 'center-0' });
          centerIdxRef.current = 1;
        }

        const initial = users.slice(1, TOTAL_SLOTS + 1);
        setSlots(initial.map((u, i) => ({ ...u, key: `${u._id}-${i}` })));
        userIdxRef.current = initial.length + 1;

        // Entrada escalonada
        initial.forEach((_, i) => {
          setTimeout(() => {
            Animated.parallel([
              Animated.spring(slotAnims[i].scale,   { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
              Animated.timing(slotAnims[i].opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
            ]).start();
          }, i * 130);
        });
      })
      .catch(() => {});
  }, []);

  // ── Ciclo orbital — reemplaza un slot aleatorio cada 3s ──────────────────
  useEffect(() => {
    if (!allUsers.length) return;
    const interval = setInterval(() => {
      const replaceIdx = Math.floor(Math.random() * TOTAL_SLOTS);
      const nextUser   = allUsers[userIdxRef.current % allUsers.length];
      userIdxRef.current++;

      Animated.parallel([
        Animated.timing(slotAnims[replaceIdx].scale,   { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(slotAnims[replaceIdx].opacity, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]).start(() => {
        setSlots(prev => {
          const next = [...prev];
          next[replaceIdx] = { ...nextUser, key: `${nextUser._id}-${Date.now()}` };
          return next;
        });
        Animated.parallel([
          Animated.spring(slotAnims[replaceIdx].scale,   { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
          Animated.timing(slotAnims[replaceIdx].opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]).start();
      });
    }, 3200);
    return () => clearInterval(interval);
  }, [allUsers]);

  // ── Ciclo centro — cambia cada 5s ────────────────────────────────────────
  useEffect(() => {
    if (!allUsers.length) return;
    const interval = setInterval(() => {
      const nextUser = allUsers[centerIdxRef.current % allUsers.length];
      centerIdxRef.current++;
      setCenterUser({ ...nextUser, key: `center-${Date.now()}` });
    }, 5000);
    return () => clearInterval(interval);
  }, [allUsers]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>

      {/* Estrellas de fondo */}
      <View style={styles.starsContainer} pointerEvents="none">
        {STARS.map((star, i) => <Star key={i} star={star} />)}
      </View>

      <View style={[styles.wrap, { width: CENTER_SIZE, height: CENTER_SIZE }]}>

        {/* Anillos decorativos — muy sutiles, sin guiones */}
        {[84, 140].map(r => (
          <View key={r} style={[styles.ring, {
            width: r * 2, height: r * 2, borderRadius: r,
            left: CENTER - r, top: CENTER - r,
          }]} />
        ))}

        {/* Agujero negro central */}
        <View style={{
          position: 'absolute',
          left: CENTER - CENTER_AVATAR_SIZE / 2 - 20,
          top:  CENTER - CENTER_AVATAR_SIZE / 2 - 20,
          zIndex: 20,
        }}>
          <BlackHoleCenter user={centerUser} navigation={navigation} />
        </View>

        {/* Slots orbitales */}
        <View style={{ position: 'absolute', left: CENTER, top: CENTER }}>
          {slots.map((user, i) => (
            <OrbitSlot
              key={user?.key || i}
              leftAnim={slotAnims[i].left}
              topAnim={slotAnims[i].top}
              scaleAnim={slotAnims[i].scale}
              opacityAnim={slotAnims[i].opacity}
              user={user}
              navigation={navigation}
            />
          ))}
        </View>

      </View>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const GLOW_COLOR    = 'rgba(0,229,204,';
const DISK_COLOR    = 'rgba(0,180,160,';

const styles = StyleSheet.create({
  root: {
    alignItems:     'center',
    paddingVertical: 16,
  },

  starsContainer: {
    position: 'absolute',
    top: 0, left: 0,
    width:  SW,
    height: CENTER_SIZE,
    zIndex: 0,
  },

  wrap: { position: 'relative' },

  // Anillos guía — solid y muy transparentes (sin dashes = sin trazos)
  ring: {
    position:    'absolute',
    borderWidth: 1,
    borderColor: `${GLOW_COLOR}0.10)`,
    borderStyle: 'solid',
  },

  // ── Agujero negro ────────────────────────────────────────────────────────
  centerRoot: {
    width:          CENTER_AVATAR_SIZE + 40,
    height:         CENTER_AVATAR_SIZE + 40,
    alignItems:     'center',
    justifyContent: 'center',
  },

  // Halo exterior difuso
  haloOuter: {
    position:        'absolute',
    width:           CENTER_AVATAR_SIZE + 56,
    height:          CENTER_AVATAR_SIZE + 56,
    borderRadius:    (CENTER_AVATAR_SIZE + 56) / 2,
    backgroundColor: `${GLOW_COLOR}0.06)`,
    shadowColor:     `${GLOW_COLOR}1)`,
    shadowOpacity:   0.4,
    shadowRadius:    24,
    elevation:       0,
  },

  // Disco de acreción — elipse giratoria
  accretionDisk: {
    position:    'absolute',
    width:       CENTER_AVATAR_SIZE + 34,
    height:      CENTER_AVATAR_SIZE + 34,
    borderRadius: (CENTER_AVATAR_SIZE + 34) / 2,
    borderWidth:  2,
    borderColor:  `${DISK_COLOR}0.45)`,
    shadowColor:  `${GLOW_COLOR}1)`,
    shadowOpacity: 0.6,
    shadowRadius:  8,
  },

  // Halo interior — event horizon
  haloInner: {
    position:        'absolute',
    width:           CENTER_AVATAR_SIZE + 16,
    height:          CENTER_AVATAR_SIZE + 16,
    borderRadius:    (CENTER_AVATAR_SIZE + 16) / 2,
    backgroundColor: `${GLOW_COLOR}0.10)`,
    shadowColor:     `${GLOW_COLOR}1)`,
    shadowOpacity:   0.8,
    shadowRadius:    14,
  },

  // Núcleo oscuro detrás del avatar
  coreBackground: {
    position:        'absolute',
    width:           CENTER_AVATAR_SIZE + 4,
    height:          CENTER_AVATAR_SIZE + 4,
    borderRadius:    (CENTER_AVATAR_SIZE + 4) / 2,
    backgroundColor: 'rgba(2,5,9,0.85)',
  },

  // ── Avatares ─────────────────────────────────────────────────────────────
  orbitAvatarWrap: {
    borderRadius:   100,
    shadowColor:    colors.c1,
    shadowOpacity:  0.55,
    shadowRadius:   8,
    elevation:      6,
  },

  centerAvatarWrap: {
    borderRadius:   100,
    shadowColor:    colors.c1,
    shadowOpacity:  0.9,
    shadowRadius:   18,
    elevation:      12,
  },
});
