import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCinemaStore } from '../store/cinemaStore';
import { getSocket } from '../services/socket';

export default function ProyectorWidget({ navigationRef }) {
  const insets = useSafeAreaInsets();
  const { isProyector, screenFocused, proyectorGroup, clearProyector } = useCinemaStore();

  if (!isProyector || screenFocused) return null;

  function handleVolver() {
    if (navigationRef?.current?.isReady()) {
      navigationRef.current.navigate('GroupRoom', { group: proyectorGroup });
    }
  }

  function handleStop() {
    getSocket()?.emit('circle:cinema:proyector:leave', { groupId: proyectorGroup?._id });
    clearProyector();
  }

  return (
    <View style={[s.widget, { bottom: Math.max(insets.bottom, 16) + 16 }]}>
      <Ionicons name="film-outline" size={14} color="rgba(255,255,255,0.7)" style={s.icon} />
      <Text style={s.label} numberOfLines={1}>Sigues transmitiendo</Text>
      <TouchableOpacity onPress={handleVolver} activeOpacity={0.8} style={s.volverBtn}>
        <Text style={s.volverTxt}>Volver</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleStop} activeOpacity={0.8} style={s.closeBtn}>
        <Ionicons name="close" size={14} color="rgba(255,255,255,0.6)" />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  widget: {
    position:        'absolute',
    right:           16,
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: 'rgba(9,21,37,0.95)',
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     'rgba(0,229,204,0.2)',
    paddingVertical:   8,
    paddingHorizontal: 10,
    gap:             8,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.4,
    shadowRadius:    8,
    elevation:       10,
    maxWidth:        280,
  },
  icon: {
    flexShrink: 0,
  },
  label: {
    color:      'rgba(255,255,255,0.85)',
    fontSize:   12,
    fontWeight: '500',
    flexShrink: 1,
  },
  volverBtn: {
    backgroundColor: 'rgba(0,229,204,0.15)',
    borderRadius:    8,
    paddingVertical:   4,
    paddingHorizontal: 10,
    flexShrink: 0,
  },
  volverTxt: {
    color:      '#00e5cc',
    fontSize:   12,
    fontWeight: '700',
  },
  closeBtn: {
    padding:    4,
    flexShrink: 0,
  },
});
