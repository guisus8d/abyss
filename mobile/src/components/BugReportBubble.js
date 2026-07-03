import React, { useRef } from 'react';
import {
  TouchableOpacity, StyleSheet,
  PanResponder, Animated, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

const SIZE = 48;
const { width: SW, height: SH } = Dimensions.get('window');

export default function BugReportBubble({ navigationRef }) {
  const insets = useSafeAreaInsets();

  const pan = useRef(new Animated.ValueXY({
    x: SW - SIZE - 8,
    y: SH / 2 - SIZE / 2,
  })).current;

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
    onPanResponderGrant() {
      pan.setOffset({ x: pan.x._value, y: pan.y._value });
      pan.setValue({ x: 0, y: 0 });
    },
    onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
    onPanResponderRelease() {
      pan.flattenOffset();
      const clampedX = Math.max(0, Math.min(SW - SIZE, pan.x._value));
      const clampedY = Math.max(insets.top, Math.min(SH - SIZE - insets.bottom, pan.y._value));
      pan.setValue({ x: clampedX, y: clampedY });
    },
  })).current;

  function handlePress() {
    const screenName = navigationRef?.current?.getCurrentRoute?.()?.name || 'desconocida';
    navigationRef?.current?.navigate('BugReport', { previousScreen: screenName });
  }

  return (
    <Animated.View
      style={[s.bubble, { transform: pan.getTranslateTransform() }]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        style={s.inner}
        onPress={handlePress}
        activeOpacity={0.8}
        delayPressIn={80}
      >
        <Ionicons name="bug-outline" size={22} color={colors.black} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  bubble: {
    position:      'absolute',
    width:         SIZE,
    height:        SIZE,
    borderRadius:  SIZE / 2,
    elevation:     12,
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius:  8,
  },
  inner: {
    width:           SIZE,
    height:          SIZE,
    borderRadius:    SIZE / 2,
    backgroundColor: colors.c1,
    opacity:         0.85,
    alignItems:      'center',
    justifyContent:  'center',
  },
});
