import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Svg, Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { colors } from '../theme/colors';

export default function CustomTabBar({
  navigation,
  activeTab = 'home',
  onCreatePress,
  onCirclesPress,
  onGuestAction,
}) {
  const insets = useSafeAreaInsets();
  const { isGuest } = useAuthStore();
  const { unreadChatsCount } = useAppStore();
  const [navBotonesH, setNavBotonesH] = useState(0);

  function guard(callback) {
    if (isGuest) { onGuestAction?.(); } else { callback(); }
  }

  return (
    <View style={s.navOuter} pointerEvents="box-none">

      {/* CAPA 1: degradado de fondo */}
      <LinearGradient
        colors={['transparent', '#050c14', '#050c14']}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: navBotonesH + 120 }}
        pointerEvents="none"
      />

      {/* CAPA 2: colina SVG */}
      <Svg
        width="100%"
        height={30}
        viewBox="0 0 375 30"
        preserveAspectRatio="none"
        style={{ position: 'absolute', bottom: navBotonesH, left: 0, right: 0 }}
        pointerEvents="none"
      >
        <Path d="M0,30 Q187.5,22 375,30 Z" fill="#050c14" />
      </Svg>

      {/* CAPA 3: botones */}
      <View
        style={[s.botonesRow, { paddingBottom: insets.bottom + 10 }]}
        onLayout={e => setNavBotonesH(e.nativeEvent.layout.height)}
      >
        <TouchableOpacity style={s.ni}>
          <View style={s.niBox}>
            <Ionicons name="game-controller" size={20} color={colors.c1} />
          </View>
          <Text style={[s.niLbl, { color: colors.c1 }]}>Game</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.ni} onPress={() => { if (activeTab !== 'market') navigation.navigate('Market'); }}>
          <View style={s.niBox}>
            <Ionicons name="storefront" size={20} color={activeTab === 'market' ? colors.c1 : colors.textDim} />
          </View>
          <Text style={[s.niLbl, activeTab === 'market' && { color: colors.c1 }]}>Tienda</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.ni} onPress={() => guard(() => onCreatePress?.())}>
          <View style={s.niCreate}>
            <View style={s.rhombus} />
            <View style={s.rhombusIcon}>
              <Ionicons name="add" size={24} color={colors.c1} />
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.ni}
          onPress={() => guard(() => {
            if (activeTab !== 'chats') navigation.navigate('Chats');
          })}
        >
          <View style={s.niBox}>
            <Ionicons
              name="chatbubble"
              size={20}
              color={activeTab === 'chats' ? colors.c1 : colors.textDim}
            />
            {unreadChatsCount > 0 && (
              <View style={[s.chatBadge, unreadChatsCount > 9 && s.chatBadgeWide]}>
                <Text style={s.chatBadgeTxt}>
                  {unreadChatsCount > 9 ? '9+' : unreadChatsCount}
                </Text>
              </View>
            )}
          </View>
          <Text style={[s.niLbl, activeTab === 'chats' && { color: colors.c1 }]}>
            Chat
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.ni} onPress={() => guard(() => onCirclesPress?.())}>
          <View style={s.niBox}>
            <Ionicons name="people" size={20} color={colors.textDim} />
          </View>
          <Text style={s.niLbl}>Fiestas</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const s = StyleSheet.create({
  navOuter:   { position: 'absolute', bottom: 0, left: 0, right: 0 },
  botonesRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    backgroundColor: '#050c14', paddingVertical: 10,
  },
  ni:     { alignItems: 'center', flex: 1 },
  niBox:  {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  niLbl:  { fontSize: 9, color: colors.textDim, letterSpacing: 0.5 },
  niCreate: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  rhombus: {
    position: 'absolute', width: 34, height: 34, borderRadius: 8,
    backgroundColor: 'rgba(230,240,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(230,240,255,0.22)',
    transform: [{ rotate: '45deg' }],
  },
  rhombusIcon: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },

  chatBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: '#ef4444',
    minWidth: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  chatBadgeWide: { paddingHorizontal: 3 },
  chatBadgeTxt:  { color: '#fff', fontSize: 9, fontWeight: '700' },
});
