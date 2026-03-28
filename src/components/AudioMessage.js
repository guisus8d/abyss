import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

const BARS = 26;
const BAR_HEIGHTS = Array.from({ length: BARS }, (_, i) => {
  const v = Math.sin(i * 0.9) * 0.3 + Math.sin(i * 1.8) * 0.2 + Math.sin(i * 0.4) * 0.15 + 0.4;
  return Math.max(0.15, Math.min(1, v));
});

function fmtTime(secs) {
  if (!secs || isNaN(secs) || !isFinite(secs) || secs < 0) return '0:00';
  const s = Math.floor(secs);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function AudioMessage({ uri, isMe, duration = 0 }) {
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);

  const playing  = status.playing ?? false;
  const elapsed  = status.currentTime ?? 0;
  const totalDur = status.duration > 0 ? status.duration : (duration > 0 ? duration : 0);
  const progress = totalDur > 0 ? elapsed / totalDur : 0;

  const barAnims  = useRef(BAR_HEIGHTS.map(h => new Animated.Value(h))).current;
  const animLoops = useRef([]);
  const wasPlaying = useRef(false);

  // Habilitar audio en silencio iOS
  useEffect(() => {
    setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {});
  }, []);

  // Arrancar/parar animación según estado
  useEffect(() => {
    if (playing && !wasPlaying.current) {
      startBarAnim();
      wasPlaying.current = true;
    } else if (!playing && wasPlaying.current) {
      stopBarAnim();
      wasPlaying.current = false;
    }
  }, [playing]);

  function startBarAnim() {
    stopBarAnim();
    animLoops.current = barAnims.map((anim, i) => {
      anim.setValue(BAR_HEIGHTS[i]);
      const minH = 0.15 + Math.random() * 0.1;
      const maxH = 0.5  + Math.random() * 0.5;
      const dur  = 200  + (i % 5) * 60;
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: maxH, duration: dur,      useNativeDriver: false }),
          Animated.timing(anim, { toValue: minH, duration: dur + 40, useNativeDriver: false }),
        ])
      );
      loop.start();
      return loop;
    });
  }

  function stopBarAnim() {
    animLoops.current.forEach(l => l?.stop());
    animLoops.current = [];
    barAnims.forEach((anim, i) => {
      Animated.timing(anim, { toValue: BAR_HEIGHTS[i], duration: 150, useNativeDriver: false }).start();
    });
  }

  function togglePlay() {
    if (playing) {
      player.pause();
    } else {
      player.play();
    }
  }

  const accent    = isMe ? colors.c1 : 'rgba(160,190,255,0.9)';
  const dimmed    = isMe ? 'rgba(0,229,204,0.18)' : 'rgba(160,190,255,0.12)';
  const btnBg     = isMe ? 'rgba(0,229,204,0.12)' : 'rgba(160,190,255,0.1)';
  const remaining = totalDur > 0 ? Math.max(0, totalDur - elapsed) : 0;
  const display   = playing ? fmtTime(remaining) : fmtTime(totalDur || duration);

  return (
    <View style={s.wrap}>
      <TouchableOpacity onPress={togglePlay} activeOpacity={0.7}
        style={[s.playBtn, { backgroundColor: btnBg, borderColor: accent }]}>
        <Ionicons
          name={playing ? 'pause' : 'play'}
          size={15} color={accent}
          style={!playing ? { marginLeft: 2 } : {}}
        />
      </TouchableOpacity>

      <View style={s.waveWrap}>
        {BAR_HEIGHTS.map((h, i) => {
          const filled = progress > 0 && (i / BARS) <= progress;
          return (
            <Animated.View key={i} style={{
              width: 2.5,
              borderRadius: 2,
              backgroundColor: filled ? accent : dimmed,
              height: barAnims[i].interpolate({
                inputRange:  [0, 1],
                outputRange: [3, 26],
              }),
            }} />
          );
        })}
      </View>

      <Text style={[s.timer, { color: accent }]}>{display}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2, minWidth: 190, maxWidth: 220 },
  playBtn:  { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  waveWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 28, gap: 1 },
  timer:    { fontSize: 10, fontWeight: '700', minWidth: 32, textAlign: 'right', flexShrink: 0 },
});
