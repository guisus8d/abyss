import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { Audio } from 'expo-av';

const BAR_HEIGHTS = [14, 20, 16, 22, 12];

// ── Un solo audio activo en toda la app ───────────────────────────────────────
// Cuando un mensaje empieza a reproducirse, llama a _activeDeactivate() del
// mensaje que estaba sonando antes para pausarlo y detener su animación.
let _activeDeactivate = null;

function fmtNum(secs) {
  if (secs == null || isNaN(secs) || !isFinite(secs) || secs < 0) return '0';
  return `${Math.round(secs)}`;
}

export default function AudioMessage({ uri, isMe, duration = 0, onLongPress }) {
  const barAnims = useRef(
    Array.from({ length: 5 }, () => new Animated.Value(0.3))
  ).current;

  const soundRef = useRef(null);

  const [playing,   setPlaying]   = useState(false);
  const [totalSecs, setTotalSecs] = useState(duration || 0);
  const [remaining, setRemaining] = useState(duration || 0);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync();
      soundRef.current = null;
      if (_activeDeactivate === myDeactivate) _activeDeactivate = null;
    };
  }, []);

  // La función de desactivación de ESTE mensaje, captura sus propios refs/state
  function myDeactivate() {
    soundRef.current?.pauseAsync().catch(() => {});
    setPlaying(false);
    stopAnimation();
  }

  function startAnimation() {
    barAnims.forEach((anim, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue:  1,
            duration: 300 + i * 100,
            easing:   Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue:  0.2,
            duration: 300 + i * 80,
            easing:   Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    });
  }

  function stopAnimation() {
    barAnims.forEach(anim => {
      anim.stopAnimation();
      Animated.timing(anim, {
        toValue:  0.3,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  }

  async function handlePress() {
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false });

      if (!playing) {
        // Detener el audio que esté sonando en otro mensaje
        if (_activeDeactivate && _activeDeactivate !== myDeactivate) {
          _activeDeactivate();
        }

        if (!soundRef.current) {
          const { sound } = await Audio.Sound.createAsync(
            { uri },
            { shouldPlay: true },
          );
          soundRef.current = sound;

          sound.setOnPlaybackStatusUpdate((status) => {
            if (!status.isLoaded) return;

            if (status.durationMillis > 0) {
              const total = status.durationMillis / 1000;
              const pos   = status.positionMillis  / 1000;
              setTotalSecs(total);
              setRemaining(Math.max(0, total - pos));
            }

            if (status.didJustFinish) {
              const total = status.durationMillis > 0
                ? status.durationMillis / 1000
                : duration;
              setPlaying(false);
              setRemaining(total);
              stopAnimation();
              soundRef.current?.unloadAsync();
              soundRef.current = null;
              if (_activeDeactivate === myDeactivate) _activeDeactivate = null;
            }
          });
        } else {
          if (remaining <= 0.3) await soundRef.current.setPositionAsync(0);
          await soundRef.current.playAsync();
        }

        _activeDeactivate = myDeactivate;
        setPlaying(true);
        startAnimation();
      } else {
        await soundRef.current?.pauseAsync();
        setPlaying(false);
        stopAnimation();
        if (_activeDeactivate === myDeactivate) _activeDeactivate = null;
      }
    } catch (e) {
      console.log('AudioMessage error:', e.message);
    }
  }

  const displaySecs = playing ? remaining : duration;

  return (
    <TouchableOpacity
      onPress={handlePress}
      onLongPress={onLongPress}
      activeOpacity={0.8}
      style={s.wrap}
    >
      <Text style={s.durNum}>{fmtNum(displaySecs)}</Text>
      <Text style={s.durQuote}>"</Text>

      <View style={s.barsWrap}>
        {barAnims.map((anim, i) => (
          <Animated.View
            key={i}
            style={{
              width:            3,
              height:           BAR_HEIGHTS[i],
              backgroundColor:  '#ffffff',
              borderRadius:     2,
              marginHorizontal: 1,
              transform: [{ scaleY: anim }],
            }}
          />
        ))}
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  wrap:     { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 90, paddingVertical: 2 },
  durNum:   { fontSize: 13, color: '#ffffff', fontWeight: '600', minWidth: 28, textAlign: 'right' },
  durQuote: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginRight: 6 },
  barsWrap: { flexDirection: 'row', alignItems: 'center', height: 26, gap: 2 },
});
