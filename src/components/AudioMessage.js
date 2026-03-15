import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

const BARS = 30;
const BAR_HEIGHTS = Array.from({ length: BARS }, (_, i) => {
  const v = Math.sin(i * 0.8) * 0.35 + Math.sin(i * 1.7) * 0.25 + Math.sin(i * 0.3) * 0.2 + 0.35;
  return Math.max(0.12, Math.min(1, v));
});

function fmtTime(secs) {
  if (!secs || isNaN(secs) || !isFinite(secs)) return '0:00';
  const s = Math.max(0, Math.floor(secs));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

let _activeSound = null;

export default function AudioMessage({ uri, isMe, duration = 0 }) {
  const [sound, setSound]       = useState(null);
  const [playing, setPlaying]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed]   = useState(0);
  const [totalDur, setTotalDur] = useState(duration || 0);
  const barAnims = useRef(BAR_HEIGHTS.map(() => new Animated.Value(1))).current;
  const animLoops = useRef([]);

  useEffect(() => {
    return () => { sound?.unloadAsync(); stopBarAnim(); };
  }, [sound]);

  function startBarAnim() {
    animLoops.current = barAnims.map((anim, i) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 0.3 + Math.random() * 0.7, duration: 250 + Math.random() * 300, useNativeDriver: true }),
          Animated.timing(anim, { toValue: BAR_HEIGHTS[i], duration: 250 + Math.random() * 300, useNativeDriver: true }),
        ])
      );
      loop.start();
      return loop;
    });
  }

  function stopBarAnim() {
    animLoops.current.forEach(l => l?.stop());
    barAnims.forEach((anim, i) =>
      Animated.timing(anim, { toValue: BAR_HEIGHTS[i], duration: 200, useNativeDriver: true }).start()
    );
  }

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
      if (_activeSound && _activeSound !== sound) {
        try { await _activeSound.pauseAsync(); } catch (_) {}
      }
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound: s } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) return;
          const total = status.durationMillis;
          if (total && total > 0) {
            setTotalDur(Math.round(total / 1000));
            setProgress(status.positionMillis / total);
            setElapsed(Math.round(status.positionMillis / 1000));
          }
          if (status.didJustFinish) {
            setPlaying(false);
            setProgress(0);
            setElapsed(0);
            stopBarAnim();
          }
        }
      );
      _activeSound = s;
      setSound(s);
      setPlaying(true);
      startBarAnim();
    } catch (e) {
      console.log('AudioMessage error:', e.message);
    }
  }

  const accent = isMe ? colors.c1 : 'rgba(160,190,255,0.9)';
  const dimmed = isMe ? 'rgba(0,229,204,0.2)' : 'rgba(160,190,255,0.15)';
  const btnBg  = isMe ? 'rgba(0,229,204,0.12)' : 'rgba(160,190,255,0.1)';
  const remaining = totalDur > 0 ? Math.max(0, totalDur - elapsed) : totalDur;
  const display = fmtTime(remaining || totalDur);

  return (
    <View style={s.wrap}>
      <TouchableOpacity onPress={togglePlay} activeOpacity={0.7}
        style={[s.playBtn, { backgroundColor: btnBg, borderColor: accent }]}>
        <Ionicons name={playing ? 'pause' : 'play'} size={15} color={accent}
          style={!playing ? { marginLeft: 2 } : {}} />
      </TouchableOpacity>

      <View style={s.waveWrap}>
        {BAR_HEIGHTS.map((h, i) => {
          const filled = progress > 0 && (i / BARS) <= progress;
          return (
            <Animated.View key={i} style={{
              width: 2.5,
              height: 6 + h * 18,
              borderRadius: 2,
              backgroundColor: filled ? accent : dimmed,
              transform: playing ? [{ scaleY: barAnims[i] }] : [{ scaleY: 1 }],
            }} />
          );
        })}
      </View>

      <Text style={[s.timer, { color: accent }]}>{display}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, paddingVertical: 2,
    minWidth: 190, maxWidth: 220,
  },
  playBtn: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  waveWrap: {
    flex: 1, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
    height: 28, gap: 1,
  },
  timer: {
    fontSize: 10, fontWeight: '700',
    minWidth: 32, textAlign: 'right', flexShrink: 0,
  },
});
