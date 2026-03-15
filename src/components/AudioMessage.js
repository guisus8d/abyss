import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export default function AudioMessage({ uri, isMe, duration }) {
  const [sound, setSound]       = useState(null);
  const [playing, setPlaying]   = useState(false);
  const [pos, setPos]           = useState(0);       // 0-1
  const [dur, setDur]           = useState(duration || 0);
  const pulseAnim               = useRef(new Animated.Value(1)).current;
  const pulseLoop               = useRef(null);

  useEffect(() => {
    return () => { sound?.unloadAsync(); };
  }, [sound]);

  function startPulse() {
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 500, useNativeDriver: true }),
      ])
    );
    pulseLoop.current.start();
  }

  function stopPulse() {
    pulseLoop.current?.stop();
    Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  }

  async function togglePlay() {
    try {
      if (playing) {
        await sound?.pauseAsync();
        setPlaying(false);
        stopPulse();
        return;
      }
      if (sound) {
        await sound.playAsync();
        setPlaying(true);
        startPulse();
        return;
      }
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound: s } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded) {
            const total = status.durationMillis || 1;
            setDur(Math.round(total / 1000));
            setPos(status.positionMillis / total);
            if (status.didJustFinish) {
              setPlaying(false);
              setPos(0);
              stopPulse();
            }
          }
        }
      );
      setSound(s);
      setPlaying(true);
      startPulse();
    } catch (e) {
      console.log('AudioMessage error:', e.message);
    }
  }

  function fmtTime(secs) {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  const accent = isMe ? 'rgba(0,229,204,1)' : 'rgba(150,180,255,0.9)';
  const barBg  = isMe ? 'rgba(0,229,204,0.15)' : 'rgba(150,180,255,0.12)';

  // Generar barras de onda decorativas (fijas, no waveform real)
  const BARS = 28;
  const heights = Array.from({ length: BARS }, (_, i) => {
    const wave = Math.sin(i * 0.7) * 0.4 + Math.sin(i * 1.3) * 0.3 + 0.3;
    return Math.max(0.15, Math.min(1, wave));
  });

  return (
    <View style={[s.container, isMe ? s.containerMe : s.containerThem]}>
      {/* Botón play/pause */}
      <TouchableOpacity onPress={togglePlay} activeOpacity={0.8}>
        <Animated.View style={[s.playBtn, { borderColor: accent, transform: [{ scale: pulseAnim }] }]}>
          <Ionicons
            name={playing ? 'pause' : 'play'}
            size={16}
            color={accent}
            style={playing ? {} : { marginLeft: 2 }}
          />
        </Animated.View>
      </TouchableOpacity>

      {/* Waveform */}
      <View style={s.waveform}>
        {heights.map((h, i) => {
          const filled = pos > 0 && (i / BARS) < pos;
          return (
            <View
              key={i}
              style={[
                s.bar,
                {
                  height: 4 + h * 20,
                  backgroundColor: filled ? accent : barBg,
                  borderRadius: 2,
                }
              ]}
            />
          );
        })}
      </View>

      {/* Duración */}
      <Text style={[s.duration, { color: accent }]}>
        {fmtTime(dur)}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    minWidth: 200,
  },
  containerMe:   {},
  containerThem: {},

  playBtn: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },

  waveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 28,
  },
  bar: {
    width: 3,
    borderRadius: 2,
  },

  duration: {
    fontSize: 10,
    fontWeight: '700',
    minWidth: 30,
    textAlign: 'right',
  },
});
