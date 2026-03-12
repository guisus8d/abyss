import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, Animated, Text, StyleSheet } from 'react-native';
import AvatarWithFrame from './AvatarWithFrame';
import api from '../services/api';
import { colors } from '../theme/colors';

const CENTER_SIZE = 230;
const CENTER      = CENTER_SIZE / 2;
const AVG_SIZE    = 36;
const CENTER_AVATAR_SIZE = 48;
const MAX_SLOTS   = 5;

// Radios bien separados entre sí y del centro para evitar solapamiento
// AVG_SIZE=36, entonces mínimo radio = CENTER_AVATAR_SIZE/2 + AVG_SIZE/2 + 10 = 24+18+10 = 52
// Y entre slots la distancia mínima en arco debe ser > AVG_SIZE
// Con 5 slots en radio ~80, la distancia mínima entre slots = 2*PI*80/5 ≈ 100px → ok
const SLOT_CONFIG = [
  { radius: 80, speed:  0.0018 },
  { radius: 80, speed: -0.0015 },
  { radius: 80, speed:  0.0021 },
  { radius: 80, speed: -0.0017 },
  { radius: 80, speed:  0.0019 },
];

// Galaxia densa
const STARS = Array.from({ length: 80 }, () => ({
  angle:   Math.random() * 360,
  dist:    6 + Math.random() * (CENTER - 12),
  size:    0.6 + Math.random() * 2.4,
  opacity: 0.08 + Math.random() * 0.75,
  twinkle: Math.random() > 0.55,
}));

function Star({ star }) {
  const anim = useRef(new Animated.Value(star.opacity)).current;
  useEffect(() => {
    if (!star.twinkle) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: star.opacity * 0.15, duration: 600 + Math.random() * 1400, useNativeDriver: true }),
        Animated.timing(anim, { toValue: star.opacity,        duration: 600 + Math.random() * 1400, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const rad = (star.angle * Math.PI) / 180;
  return (
    <Animated.View style={{
      position: 'absolute',
      left: CENTER + Math.cos(rad) * star.dist - star.size / 2,
      top:  CENTER + Math.sin(rad) * star.dist - star.size / 2,
      width: star.size, height: star.size, borderRadius: star.size,
      backgroundColor: colors.c1,
      opacity: anim,
    }} />
  );
}

function OrbitSlot({ leftAnim, topAnim, scaleAnim, opacityAnim, user, navigation }) {
  if (!user) return null;
  return (
    <Animated.View style={{
      position: 'absolute',
      transform: [
        { translateX: leftAnim },
        { translateY: topAnim },
        { scale: scaleAnim },
      ],
      opacity: opacityAnim,
      left: -AVG_SIZE / 2,
      top:  -AVG_SIZE / 2,
    }}>
      <TouchableOpacity
        onPress={() => navigation.navigate('PublicProfile', { username: user.username })}
        activeOpacity={0.8}
      >
        <AvatarWithFrame
          size={AVG_SIZE}
          avatarUrl={user.avatarUrl}
          username={user.username}
          
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

// Avatar central con fade in/out
function CenterUser({ user, navigation }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale   = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (!user) return;
    opacity.setValue(0);
    scale.setValue(0.8);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(scale,   { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
    ]).start();
  }, [user?.key]);

  if (!user) return null;

  return (
    <Animated.View style={{
      position: 'absolute',
      left: CENTER - CENTER_AVATAR_SIZE / 2,
      top:  CENTER - CENTER_AVATAR_SIZE / 2,
      opacity,
      transform: [{ scale }],
      zIndex: 20,
    }}>
      <TouchableOpacity
        onPress={() => navigation.navigate('PublicProfile', { username: user.username })}
        activeOpacity={0.8}
      >
        <AvatarWithFrame
          size={CENTER_AVATAR_SIZE}
          avatarUrl={user.avatarUrl}
          username={user.username}
          
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function OrbitUsers({ navigation }) {
  const [allUsers, setAllUsers]   = useState([]);
  const [slots, setSlots]         = useState(Array(MAX_SLOTS).fill(null));
  const [centerUser, setCenterUser] = useState(null);
  const pulse    = useRef(new Animated.Value(1)).current;
  const indexRef = useRef(0);
  const centerIdxRef = useRef(0);

  // Ángulos iniciales bien distribuidos (equidistantes)
  const anglesRef = useRef(
    SLOT_CONFIG.map((_, i) => (i / MAX_SLOTS) * Math.PI * 2)
  );

  const slotAnims = useRef(
    Array.from({ length: MAX_SLOTS }, () => ({
      left:    new Animated.Value(0),
      top:     new Animated.Value(0),
      scale:   new Animated.Value(0),
      opacity: new Animated.Value(0),
    }))
  ).current;

  // RAF loop — solo setValue, sin re-renders
  useEffect(() => {
    let running = true;
    function loop() {
      if (!running) return;
      anglesRef.current = anglesRef.current.map((angle, i) => {
        const next = angle + SLOT_CONFIG[i].speed;
        slotAnims[i].left.setValue(Math.cos(next) * SLOT_CONFIG[i].radius);
        slotAnims[i].top.setValue(Math.sin(next)  * SLOT_CONFIG[i].radius);
        return next;
      });
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    return () => { running = false; };
  }, []);

  // Pulso del glow (solo el glow, el avatar ya está encima)
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.5, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.7, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Cargar usuarios
  useEffect(() => {
    api.get('/users/top')
      .then(({ data }) => {
        const users = (data.users || []).sort(() => Math.random() - 0.5);
        setAllUsers(users);

        // Centro: primer usuario
        if (users.length > 0) {
          setCenterUser({ ...users[0], key: `center-0` });
          centerIdxRef.current = 1;
        }

        // Slots: siguientes MAX_SLOTS usuarios
        const initial = users.slice(1, MAX_SLOTS + 1);
        setSlots(initial.map((u, i) => ({ ...u, key: `${u._id}-${i}` })));
        indexRef.current = initial.length + 1;

        initial.forEach((_, i) => {
          setTimeout(() => {
            Animated.parallel([
              Animated.spring(slotAnims[i].scale,   { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
              Animated.timing(slotAnims[i].opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
            ]).start();
          }, i * 180);
        });
      })
      .catch(() => {});
  }, []);

  // Ciclo infinito — sustituir slot orbital
  useEffect(() => {
    if (!allUsers.length) return;
    const interval = setInterval(() => {
      const replaceIdx = Math.floor(Math.random() * MAX_SLOTS);
      const nextUser   = allUsers[indexRef.current % allUsers.length];
      indexRef.current++;

      Animated.parallel([
        Animated.timing(slotAnims[replaceIdx].scale,   { toValue: 0, duration: 350, useNativeDriver: true }),
        Animated.timing(slotAnims[replaceIdx].opacity, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start(() => {
        setSlots(prev => {
          const next = [...prev];
          next[replaceIdx] = { ...nextUser, key: `${nextUser._id}-${Date.now()}` };
          return next;
        });
        Animated.parallel([
          Animated.spring(slotAnims[replaceIdx].scale,   { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
          Animated.timing(slotAnims[replaceIdx].opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        ]).start();
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [allUsers]);

  // Ciclo centro — cambia cada 5s
  useEffect(() => {
    if (!allUsers.length) return;
    const interval = setInterval(() => {
      const nextUser = allUsers[centerIdxRef.current % allUsers.length];
      centerIdxRef.current++;
      setCenterUser({ ...nextUser, key: `center-${Date.now()}` });
    }, 5000);
    return () => clearInterval(interval);
  }, [allUsers]);

  return (
    <View style={s.root}>
      <Text style={s.label}>USUARIOS ACTIVOS</Text>
      <View style={[s.wrap, { width: CENTER_SIZE, height: CENTER_SIZE }]}>

        {STARS.map((star, i) => <Star key={i} star={star} />)}

        {/* Anillos */}
        {[42, 80, 90].map(r => (
          <View key={r} style={[s.ring, {
            width: r*2, height: r*2, borderRadius: r,
            left: CENTER-r, top: CENTER-r,
            opacity: r === 80 ? 0.2 : 0.07,
          }]} />
        ))}

        {/* Glow central */}
        <Animated.View style={[s.glow, { left: CENTER-22, top: CENTER-22, transform: [{ scale: pulse }] }]} />

        {/* Avatar central */}
        <CenterUser user={centerUser} navigation={navigation} />

        {/* Avatares orbitando */}
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

const s = StyleSheet.create({
  root:  { alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { color: colors.textDim, fontSize: 9, letterSpacing: 3, marginBottom: 6 },
  wrap:  { position: 'relative' },
  ring:  { position: 'absolute', borderWidth: 1, borderColor: colors.c1, borderStyle: 'dashed' },
  glow:  {
    position: 'absolute', width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,229,204,0.15)',
    shadowColor: colors.c1, shadowOpacity: 1, shadowRadius: 20, elevation: 10,
  },
});
