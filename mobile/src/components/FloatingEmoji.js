import React, { useRef, useEffect } from 'react';
import { Animated, Text, View, StyleSheet } from 'react-native';

export default function FloatingEmoji({ emoji, onDone }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity    = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    console.log('[FLOAT] mounting', emoji);
    Animated.parallel([
      Animated.timing(translateY, { toValue: -80, duration: 800, useNativeDriver: true }),
      Animated.timing(opacity,    { toValue: 0,   duration: 800, useNativeDriver: true }),
    ]).start(({ finished }) => { if (finished) onDone(); });
  }, []);

  return (
    <View style={s.wrap} pointerEvents="none">
      <Animated.Text style={[s.emoji, { transform: [{ translateY }], opacity }]}>
        {emoji}
      </Animated.Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:  { position:'absolute', left:0, right:0, bottom:30, alignItems:'center', zIndex:99, elevation:8 },
  emoji: { fontSize:34 },
});
