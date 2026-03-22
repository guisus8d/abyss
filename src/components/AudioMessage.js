import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

const BARS = 28;

// Alturas base estáticas para el waveform decorativo
const BAR_HEIGHTS = Array.from({ length: BARS }, (_, i) => {
  const v = Math.sin(i * 0.9) * 0.3 + Math.sin(i * 1.8) * 0.2 + Math.sin(i * 0.4) * 0.15 + 0.4;
  return Math.max(0.15, Math.min(1, v));
});

function fmtTime(secs) {
  if (!secs || isNaN(secs) || !isFinite(secs) || secs < 0) return '0:00';
  const s = Math.floor(secs);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

// Singleton para pausar el audio activo cuando se abre otro
let _activeSound = null;

export default function AudioMessage({ uri, isMe, duration = 0 }) {
  const [sound, setSound]       = useState(null);
  const [playing, setPlaying]   = useState(false);
  const [progress, setProgress] = useState(0);   // 0–1
  const [elapsed, setElapsed]   = useState(0);   // segundos transcurridos
  const [totalDur, setTotalDur] = useState(duration > 0 ? duration : 0);

  // Cada barra tiene su propio Animated.Value para escala Y
  const barAnims = useRef(BAR_HEIGHTS.map(h => new Animated.Value(h))).current;
  const animTimers = useRef([]);

  useEffect(() => {
    return () => {
      sound?.unloadAsync();
      stopBarAnim();
    };
  }, [sound]);

  // ── Animación de barras — recursiva, valores random distintos cada ciclo ──
  function animateBar(anim, baseHeight, index) {
    const duration = 180 + Math.random() * 220;
    const target   = playing
      ? 0.2 + Math.random() * 0.8
      : baseHeight;

    Animated.timing(anim, {
      toValue: target,
      duration,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        animTimers.current[index] = setTimeout(() => animateBar(anim, baseHeight, index), 0);
      }
    });
  }

  function startBarAnim() {
    stopBarAnim();
    barAnims.forEach((anim, i) => {
      // Desfase inicial para que no todas empiecen igual
      const delay = i * 12;
      const timer = setTimeout(() => animateBar(anim, BAR_HEIGHTS[i], i), delay);
      animTimers.current[i] = timer;
    });
  }

  function stopBarAnim() {
    animTimers.current.forEach(t => clearTimeout(t));
    animTimers.current = [];
    // Regresa barras a su altura base suavemente
    barAnims.forEach((anim, i) => {
      Animated.timing(anim, {
        toValue: BAR_HEIGHTS[i],
        duration: 200,
        useNativeDriver: false,
      }).start();
    });
  }

  // ── Reproducción ─────────────────────────────────────────────────────────
  async function togglePlay() {
    try {
      if (playing) {
        await sound?.pauseAsync();
        setPlaying(false);
        stopBarAnim();
        return;
      }

      if (sound) {
        await sound.playAsync();
        setPlaying(true);
        startBarAnim();
        return;
      }

      // Pausar cualquier otro audio activo
      if (_activeSound) {
        try { await _activeSound.pauseAsync(); } catch (_) {}
      }

      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });

      const { sound: s } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) return;

          // Actualizar duración real tan pronto esté disponible
          if (status.durationMillis && status.durationMillis > 0) {
            const dur = status.durationMillis / 1000;
            setTotalDur(dur);
            setProgress(status.positionMillis / status.durationMillis);
            setElapsed(status.positionMillis / 1000);
          }

          if (status.didJustFinish) {
            setPlaying(false);
            setProgress(0);
            setElapsed(0);
            stopBarAnim();
          }
        },
        // Actualizaciones de progress cada 100ms para fluidez
        false
      );

      // Configurar intervalo de actualización frecuente
      await s.setProgressUpdateIntervalAsync(100);

      _activeSound = s;
      setSound(s);
      setPlaying(true);
      startBarAnim();
    } catch (e) {
      console.log('AudioMessage error:', e.message);
    }
  }

  const accent  = isMe ? colors.c1 : 'rgba(160,190,255,0.9)';
  const dimmed  = isMe ? 'rgba(0,229,204,0.18)' : 'rgba(160,190,255,0.12)';
  const btnBg   = isMe ? 'rgba(0,229,204,0.12)' : 'rgba(160,190,255,0.1)';

  // Tiempo mostrado: si está reproduciendo → tiempo restante, si no → duración total
  const remaining = totalDur > 0 ? Math.max(0, totalDur - elapsed) : 0;
  const display   = playing
    ? fmtTime(remaining)
    : fmtTime(totalDur || duration);

  return (
    <View style={s.wrap}>
      <TouchableOpacity onPress={togglePlay} activeOpacity={0.7}
        style={[s.playBtn, { backgroundColor: btnBg, borderColor: accent }]}>
        <Ionicons
          name={playing ? 'pause' : 'play'}
          size={15}
          color={accent}
          style={!playing ? { marginLeft: 2 } : {}}
        />
      </TouchableOpacity>

      <View style={s.waveWrap}>
        {BAR_HEIGHTS.map((h, i) => {
          const filled = progress > 0 && (i / BARS) <= progress;
          return (
            <Animated.View
              key={i}
              style={{
                width: 2.5,
                borderRadius: 2,
                backgroundColor: filled ? accent : dimmed,
                height: barAnims[i].interpolate({
                  inputRange: [0, 1],
                  outputRange: [3, 26],
                }),
              }}
            />
          );
        })}
      </View>

      <Text style={[s.timer, { color: accent }]}>{display}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
    minWidth: 190,
    maxWidth: 220,
  },
  playBtn: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  waveWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 28,
    gap: 1,
  },
  timer: {
    fontSize: 10,
    fontWeight: '700',
    minWidth: 32,
    textAlign: 'right',
    flexShrink: 0,
  },
});
