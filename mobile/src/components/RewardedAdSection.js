import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Alert, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import CoinIcon from './CoinIcon';

// Cambiar a true al hacer EAS build con código nativo de AdMob
const IS_DEV_BUILD = false;

const AD_UNIT_ID = __DEV__
  ? 'ca-app-pub-3940256099942544/5224354917'
  : 'ca-app-pub-8972895798926021/2572623758';

const DAILY_LIMIT  = 5;
const COINS_PER_AD = 3;

function todayKey() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `adProgress_${y}-${m}-${day}`;
}

export default function RewardedAdSection() {
  const { user, updateUser } = useAuthStore();

  const [progress,  setProgress]  = useState(0);
  const [loading,   setLoading]   = useState(false);

  const progressAnim    = useRef(new Animated.Value(0)).current;
  const celebrationAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadProgress();
  }, []);

  async function loadProgress() {
    try {
      const raw = await AsyncStorage.getItem(todayKey());
      const n   = raw ? parseInt(raw, 10) : 0;
      setProgress(n);
      progressAnim.setValue(n / DAILY_LIMIT);
      if (n >= DAILY_LIMIT) celebrationAnim.setValue(1);
    } catch (_) {}
  }

  async function saveProgress(n) {
    try {
      await AsyncStorage.setItem(todayKey(), String(n));
    } catch (_) {}
  }

  function animateProgress(n) {
    Animated.timing(progressAnim, {
      toValue:         n / DAILY_LIMIT,
      duration:        500,
      useNativeDriver: false,
    }).start();
  }

  function triggerCelebration() {
    Animated.sequence([
      Animated.timing(celebrationAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(celebrationAnim, { toValue: 0.85, duration: 150, useNativeDriver: true }),
      Animated.timing(celebrationAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  }

  function watchAd() {
    if (loading || progress >= DAILY_LIMIT) return;

    if (!IS_DEV_BUILD) {
      Alert.alert('Solo disponible en la app completa');
      return;
    }

    setLoading(true);

    const { RewardedAd, RewardedAdEventType } = require('react-native-google-mobile-ads');
    const ad = RewardedAd.createForAdRequest(AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    });

    const unsubEarned = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, async () => {
      try {
        const { data } = await api.post('/ads/reward');
        const newCount = data.adViewsToday.count;

        updateUser({ ...user, coins: data.coins });
        await saveProgress(newCount);
        setProgress(newCount);
        animateProgress(newCount);

        if (newCount >= DAILY_LIMIT) {
          triggerCelebration();
        }
      } catch (e) {
        Alert.alert('Error', e.response?.data?.error || 'No se pudieron sumar los coins');
      }
    });

    const unsubClosed = ad.addAdEventListener(RewardedAdEventType.CLOSED, () => {
      setLoading(false);
      unsubEarned();
      unsubClosed();
      unsubError();
    });

    const unsubError = ad.addAdEventListener('error', () => {
      setLoading(false);
      Alert.alert('Sin anuncios', 'No hay anuncios disponibles ahora. Intenta mas tarde.');
      unsubEarned();
      unsubClosed();
      unsubError();
    });

    ad.load();

    const unsubLoaded = ad.addAdEventListener('loaded', () => {
      unsubLoaded();
      ad.show().catch(() => {
        setLoading(false);
        Alert.alert('Error', 'No se pudo mostrar el anuncio');
      });
    });
  }

  const isCompleted = progress >= DAILY_LIMIT;

  const barWidth = progressAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  const celebScale = celebrationAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0.8, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={s.card}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>Gana coins gratis</Text>
          <Text style={s.subtitle}>Ve anuncios cortos y acumula coins</Text>
        </View>
        <View style={s.coinsBadge}>
          <CoinIcon size={12} />
          <Text style={s.coinsText}>{COINS_PER_AD}</Text>
        </View>
      </View>

      <View style={s.progressSection}>
        <View style={s.progressTrack}>
          <Animated.View style={[s.progressFill, { width: barWidth }]}>
            <LinearGradient
              colors={[colors.c1, colors.c5]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
        <Text style={s.progressLabel}>{progress}/{DAILY_LIMIT} anuncios</Text>
      </View>

      <Text style={s.rewardText}>{COINS_PER_AD * DAILY_LIMIT} coins al completar los {DAILY_LIMIT}</Text>

      {isCompleted ? (
        <Animated.View style={[s.completedBox, { transform: [{ scale: celebScale }], opacity: celebrationAnim }]}>
          <Ionicons name="checkmark-circle" size={18} color={colors.c1} />
          <Text style={s.completedText}>Bonus completado. Vuelve manana</Text>
        </Animated.View>
      ) : (
        <TouchableOpacity
          style={[s.button, loading && s.buttonDisabled]}
          onPress={watchAd}
          disabled={loading}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.black} />
          ) : (
            <Text style={s.buttonText}>Ver anuncio</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 16,
    gap: 12,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    color: colors.textHi,
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textDim,
    fontSize: 12,
    marginTop: 2,
  },
  coinsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(251,191,36,0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  coinsText: {
    color: 'rgba(251,191,36,1)',
    fontSize: 12,
    fontWeight: '800',
  },

  progressSection: {
    gap: 6,
  },
  progressTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '600',
  },

  rewardText: {
    color: colors.textMid,
    fontSize: 12,
  },

  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.c1,
    borderRadius: 12,
    paddingVertical: 12,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: colors.black,
    fontSize: 14,
    fontWeight: '700',
  },

  completedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,229,204,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,229,204,0.2)',
    paddingVertical: 12,
  },
  completedText: {
    color: colors.c1,
    fontSize: 13,
    fontWeight: '600',
  },
});
