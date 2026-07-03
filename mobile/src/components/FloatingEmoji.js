import React, { useRef, useEffect } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';

export default function FloatingEmoji({ emoji, onDone }) {
  const emojiScale   = useRef(new Animated.Value(0.5)).current;
  const emojiOpacity = useRef(new Animated.Value(1)).current;
  const waveScale    = useRef(new Animated.Value(0)).current;
  const waveOpacity  = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(emojiScale, {
        toValue:         1.0,
        tension:         120,
        friction:        6,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(300),
        Animated.timing(emojiOpacity, {
          toValue:         0,
          duration:        200,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(waveScale, {
        toValue:         2.5,
        duration:        500,
        useNativeDriver: true,
      }),
      Animated.timing(waveOpacity, {
        toValue:         0,
        duration:        500,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => { if (finished) onDone(); });
  }, []);

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[s.wave, { transform: [{ scale: waveScale }], opacity: waveOpacity }]}
      />
      <Animated.Text
        pointerEvents="none"
        style={[s.emoji, { transform: [{ scale: emojiScale }], opacity: emojiOpacity }]}
      >
        {emoji}
      </Animated.Text>
    </>
  );
}

const s = StyleSheet.create({
  wave: {
    position:        'absolute',
    width:           60,
    height:          60,
    borderRadius:    999,
    backgroundColor: 'rgba(0,229,204,0.4)',
    alignSelf:       'center',
    top:             '50%',
    marginTop:       -30,
  },
  emoji: {
    position:  'absolute',
    alignSelf: 'center',
    top:       '50%',
    marginTop: -20,
    fontSize:  34,
    zIndex:    1,
  },
});
