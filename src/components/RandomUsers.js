import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Image, StyleSheet, Animated, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import api from '../services/api';
import AvatarWithFrame from './AvatarWithFrame';

export default function RandomUsers({ navigation }) {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const fadeAnim              = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      const { data } = await api.get('/users/random');
      setUsers(data.users || []);
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 600, useNativeDriver: true,
      }).start();
    } catch (e) {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  if (loading) return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.dot} />
        <Text style={s.title}>DESCUBRIR</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {[...Array(5)].map((_, i) => (
          <View key={i} style={[s.card, s.cardSkeleton]} />
        ))}
      </ScrollView>
    </View>
  );

  if (!users.length) return null;

  return (
    <Animated.View style={[s.container, { opacity: fadeAnim }]}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.dot} />
        <Text style={s.title}>DESCUBRIR</Text>
        <TouchableOpacity style={s.refreshBtn} onPress={load}>
          <Ionicons name="refresh-outline" size={14} color={colors.c1} />
        </TouchableOpacity>
      </View>

      {/* Scroll horizontal */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        decelerationRate="fast"
      >
        {users.map((u, i) => (
          <UserCard key={u._id} user={u} index={i} navigation={navigation} />
        ))}

        {/* Botón + para cargar más */}
        <TouchableOpacity style={s.moreCard} onPress={load}>
          <LinearGradient
            colors={['rgba(0,229,204,0.08)', 'rgba(41,121,255,0.08)']}
            style={s.moreGradient}
          >
            <View style={s.morePlus}>
              <Ionicons name="add" size={22} color={colors.c1} />
            </View>
            <Text style={s.moreTxt}>Ver{'\n'}más</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </Animated.View>
  );
}

function UserCard({ user, index, navigation }) {
  const scale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      delay: index * 60,
      useNativeDriver: true,
      tension: 80,
      friction: 8,
    }).start();
  }, []);

  function onPress() {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.93, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1,    duration: 100, useNativeDriver: true }),
    ]).start(() => navigation.navigate('PublicProfile', { username: user.username }));
  }

  const initials = user.username?.[0]?.toUpperCase() || '?';

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable style={s.card} onPress={onPress}>
        {/* Glow de fondo */}
        <View style={s.cardGlow} />

        {/* Avatar */}
        <View style={s.avatarWrap}>
          <AvatarWithFrame
            avatarUrl={user.avatarUrl}
            profileFrame={user.profileFrame}
            frameUrl={user.profileFrameUrl}
            username={user.username}
            size={52}
          />
          {/* Indicador online — decorativo */}
          <View style={s.onlineDot} />
        </View>

        {/* Nombre */}
        <Text style={s.userName} numberOfLines={1}>
          {user.username}
        </Text>

        {/* XP */}
        <View style={s.xpRow}>
          <Ionicons name="flash" size={9} color={colors.c1} />
          <Text style={s.xpTxt}>{user.xp || 0}</Text>
        </View>

        {/* Borde brillante inferior */}
        <LinearGradient
          colors={['transparent', 'rgba(0,229,204,0.25)']}
          style={s.cardBottomLine}
        />
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 7,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: colors.c1,
    shadowColor: colors.c1,
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  title: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.5,
    flex: 1,
  },
  refreshBtn: {
    padding: 4,
  },
  scroll: {
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 4,
  },

  // Card
  card: {
    width: 82,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 18,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    position: 'relative',
  },
  cardSkeleton: {
    height: 120,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  cardGlow: {
    position: 'absolute',
    top: -20, left: -20, right: -20,
    height: 60,
    backgroundColor: 'rgba(0,229,204,0.04)',
    borderRadius: 40,
  },
  cardBottomLine: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 2,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },

  // Avatar
  avatarWrap: {
    position: 'relative',
    marginBottom: 8,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1, right: 1,
    width: 9, height: 9,
    borderRadius: 5,
    backgroundColor: colors.c1,
    borderWidth: 1.5,
    borderColor: '#020509',
  },

  // Texto
  userName: {
    color: colors.textHi,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
    letterSpacing: 0.2,
  },
  xpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
    backgroundColor: 'rgba(0,229,204,0.08)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  xpTxt: {
    color: colors.c1,
    fontSize: 9,
    fontWeight: '700',
  },

  // Botón más
  moreCard: {
    width: 72,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,229,204,0.2)',
    borderStyle: 'dashed',
  },
  moreGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  morePlus: {
    width: 32, height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,229,204,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,229,204,0.3)',
  },
  moreTxt: {
    color: colors.c1,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});
