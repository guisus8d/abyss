import React, { useRef, useState, useEffect } from 'react';
import { View, Image, TouchableOpacity, PanResponder, Animated, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCinemaStore } from '../store/cinemaStore';
import { getSocket } from '../services/socket';

const SIZE = 80;
const { width: SW, height: SH } = Dimensions.get('window');

export default function ProyectorWidget({ navigationRef }) {
  const insets = useSafeAreaInsets();
  const { isProyector, proyectorGroupId, proyectorGroupImage, clearProyector } = useCinemaStore();

  // Track whether the current route is GroupRoom to hide the widget while on it
  const [isOnGroupRoom, setIsOnGroupRoom] = useState(false);
  useEffect(() => {
    if (!navigationRef?.current) return;
    const check = () => {
      const route = navigationRef.current?.getCurrentRoute?.();
      setIsOnGroupRoom(route?.name === 'GroupRoom');
    };
    check();
    const unsub = navigationRef.current?.addListener?.('state', check);
    return () => unsub?.();
  }, [navigationRef]);

  const initBottom = 24 + insets.bottom;
  const initRight  = 16;

  const pan = useRef(new Animated.ValueXY({
    x: SW - SIZE - initRight,
    y: SH - SIZE - initBottom,
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

  if (!isProyector || isOnGroupRoom) return null;

  function handleVolver() {
    if (navigationRef?.current?.isReady()) {
      navigationRef.current.navigate('GroupRoom');
    }
  }

  function handleStop() {
    getSocket()?.emit('circle:cinema:proyector:leave', { groupId: proyectorGroupId });
    clearProyector();
  }

  return (
    <Animated.View
      style={[s.widget, { transform: pan.getTranslateTransform() }]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        style={s.inner}
        onPress={handleVolver}
        delayPressIn={100}
      >
        {proyectorGroupImage ? (
          <Image source={{ uri: proyectorGroupImage }} style={s.bg} resizeMode="cover" />
        ) : (
          <View style={[s.bg, s.bgFallback]} />
        )}
        <View style={s.overlay} />
        <Ionicons name="film-outline" size={22} color="rgba(255,255,255,0.85)" />
      </TouchableOpacity>

      <TouchableOpacity style={s.closeBtn} onPress={handleStop} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
        <Ionicons name="close" size={10} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  widget: {
    position:      'absolute',
    width:         SIZE,
    height:        SIZE,
    borderRadius:  16,
    overflow:      'visible',
    elevation:     12,
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius:  10,
  },
  inner: {
    width:           SIZE,
    height:          SIZE,
    borderRadius:    16,
    overflow:        'hidden',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     2,
    borderColor:     '#ffffff',
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  bgFallback: {
    backgroundColor: '#050c14',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,5,9,0.45)',
  },
  closeBtn: {
    position:        'absolute',
    top:             -6,
    right:           -6,
    width:           18,
    height:          18,
    borderRadius:    9,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.2)',
  },
});
