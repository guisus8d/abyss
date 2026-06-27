import React, { memo, useRef, useCallback } from 'react';
import { TouchableOpacity, Animated, Text, StyleSheet } from 'react-native';

function EmojiPill({ emoji, count, isActive, onPress, onLongPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = useCallback(() => {
    scale.setValue(1);
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.35, useNativeDriver: true, speed: 120, bounciness: 18 }),
      Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 80,  bounciness: 4  }),
    ]).start();
    onPress();
  }, [scale, onPress]);

  return (
    <TouchableOpacity onPress={handlePress} onLongPress={onLongPress} activeOpacity={0.7}>
      <Animated.View style={[ep.pill, isActive && ep.pillActive, { transform: [{ scale }] }]}>
        <Text style={ep.emoji}>{emoji}</Text>
        <Text style={[ep.count, isActive && ep.countActive]}>{count}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default memo(EmojiPill);

const ep = StyleSheet.create({
  pill:        { flexDirection:'row', alignItems:'center', gap:3, backgroundColor:'rgba(255,255,255,0.08)', borderRadius:12, paddingHorizontal:8, paddingVertical:4, borderWidth:1, borderColor:'rgba(255,255,255,0.12)' },
  pillActive:  { backgroundColor:'rgba(0,229,204,0.12)', borderColor:'rgba(0,229,204,0.35)' },
  emoji:       { fontSize:14 },
  count:       { color:'rgba(230,240,255,0.35)', fontSize:11, fontWeight:'600' },
  countActive: { color:'#0fe3b8' },
});
