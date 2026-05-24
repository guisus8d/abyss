import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import AvatarWithFrame from '../components/AvatarWithFrame';

const { width: W } = Dimensions.get('window');
const AVATAR_SIZE = Math.min(W * 0.62, 250);

export default function FramePreviewScreen({ route, navigation }) {
  const { frame } = route.params;
  const { user } = useAuthStore();

  const frameUrl = frame.imageUrl || null;
  const hasBgGradient = frame.bgType === 'gradient'
    && Array.isArray(frame.bgGradient)
    && frame.bgGradient.length >= 2;
  const hasBgColor = frame.bgType === 'color' && frame.bgColor;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      {/* Background del marco o negro por defecto */}
      {hasBgGradient
        ? <LinearGradient
            colors={frame.bgGradient}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        : hasBgColor
          ? <View style={[StyleSheet.absoluteFill, { backgroundColor: frame.bgColor }]} />
          : null
      }
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />

      <SafeAreaView style={s.safe}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textHi} />
        </TouchableOpacity>

        <View style={s.center}>
          <AvatarWithFrame
            size={AVATAR_SIZE}
            avatarUrl={user?.avatarUrl}
            username={user?.username}
            profileFrame={frame._id}
            frameUrl={frameUrl}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  safe: { flex: 1 },

  backBtn: {
    padding: 16,
    alignSelf: 'flex-start',
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
  },

  username: {
    color: colors.textHi,
    fontSize: 16,
    fontWeight: '700',
  },
});
