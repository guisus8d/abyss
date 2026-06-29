import React, { useEffect, useRef, useState } from 'react';
import MaskedView from '@react-native-masked-view/masked-view';
import { Image } from 'react-native';
import {
  View, Text, Animated, TouchableOpacity, TouchableWithoutFeedback,
  StyleSheet, Dimensions, ScrollView,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import api from '../services/api';
import CoinIcon from './CoinIcon';
import { formatCoins } from '../utils/formatCoins';
import RewardedAdSection from './RewardedAdSection';

const collectibleIcon = require('../../assets/coleccionables/ic_collectible.png');

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(width * 0.72, 300);

const CARD_PAD = 12;
const CARD_W   = DRAWER_WIDTH - CARD_PAD *2;
const CARD_H   = Math.round(CARD_W * (485 / 637));
const PNG_W    = Math.round(CARD_W * 1);
const PNG_H    = Math.round(PNG_W * (485 / 637));
const CARD_AVT = 88;

function MenuItem({ icon, label, onPress, badge }) {
  return (
    <TouchableOpacity style={s.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={s.iconBox}>
        <Ionicons name={icon} size={19} color={colors.textMid} />
      </View>
      <Text style={s.menuLabel}>{label}</Text>
      {badge != null && badge > 0 ? (
        <View style={s.badge}>
          <Text style={s.badgeTxt}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={15} color={colors.textDim} />
      )}
    </TouchableOpacity>
  );
}

export default function ProfileDrawer({ visible, onClose, user, onLogout, onNavigate, onAvatarUpdate }) {
  const insets     = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const [rendered,    setRendered]    = useState(false);
  const [avatarUrl,   setAvatarUrl]   = useState(user?.avatarUrl || null);
  const [framesCount, setFramesCount] = useState(null);

  useEffect(() => {
    setAvatarUrl(user?.avatarUrl || null);
  }, [user?.avatarUrl]);

  useEffect(() => {
    if (visible) {
      api.get('/frames/my')
        .then(({ data }) => setFramesCount((data.frames || []).length))
        .catch(() => setFramesCount(0));
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.parallel([
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, { toValue: -DRAWER_WIDTH, duration: 260, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]).start(() => setRendered(false));
    }
  }, [visible]);

  if (!rendered) return null;

  const cardLevel = Math.floor((user?.xp ?? 0) / 100) + 1;

  return (
    <View style={s.root}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[s.overlay, { opacity }]} />
      </TouchableWithoutFeedback>

      <Animated.View style={[s.drawer, { transform: [{ translateX }] }]}>
        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

          {/* ── Abyss Card ── */}
          <View style={[s.cardSection, { paddingTop: insets.top + CARD_AVT / 2 + 10 }]}>
            <TouchableOpacity
              style={s.cardOuter}
              activeOpacity={0.85}
              onPress={() => { onClose(); onNavigate('Profile'); }}
            >
              <View style={s.cardInner}>
                <MaskedView
                  style={{ width: CARD_W, height: CARD_H }}
                  maskElement={
                    <Image
                      source={require('../../assets/abyss-card.png')}
                      style={{ width: PNG_W, height: PNG_H }}
                      resizeMode="stretch"
                    />
                  }
                >
                  {user?.profileBgType === 'image' && user?.profileBg
                    ? <Image source={{ uri: user.profileBg }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    : <View style={[StyleSheet.absoluteFill, { backgroundColor: user?.profileBg || '#0d1d2e' }]} />
                  }
                </MaskedView>
                <Image
                  source={require('../../assets/abyss-card.png')}
                  style={{ position: 'absolute', top: 0, left: 0, width: PNG_W, height: PNG_H }}
                  resizeMode="stretch"
                />

                {/* Info: top-right (next to avatar arch) */}
                <View style={s.cardInfo}>
                  <Text style={s.cardUsername} numberOfLines={1}>{user?.username}</Text>
                </View>

                {/* Bio: encima del strip de nivel/XP */}
                {user?.bioType === 'text' && user?.bio ? (
                  <View style={s.cardBioWrap}>
                    <Text style={s.cardBioTxt} numberOfLines={3}>{user.bio}</Text>
                  </View>
                ) : null}

                {/* Stats strip: bottom */}
                <View style={s.cardStats}>
                  <View style={s.cardStat}>
                    <Text style={s.cardStatVal}>Nv.{cardLevel}</Text>
                    <Text style={s.cardStatLbl}>Nivel</Text>
                  </View>
                  <View style={s.cardStatDivider} />
                  <View style={s.cardStat}>
                    <Text style={s.cardStatVal}>{user?.xp ?? 0}</Text>
                    <Text style={s.cardStatLbl}>XP</Text>
                  </View>
                </View>
              </View>

              <View style={s.cardAvatarWrap}>
                {avatarUrl
                  ? <Image source={{ uri: avatarUrl }} style={s.cardAvatarImg} resizeMode="cover" />
                  : <View style={s.cardAvatarFallback}>
                      <Text style={s.cardAvatarLetter}>{user?.username?.[0]?.toUpperCase()}</Text>
                    </View>
                }
              </View>
            </TouchableOpacity>
          </View>

          {/* ── Cartera ── */}
          <View style={s.walletWrap}>
            <View style={s.walletCard}>
              <View style={s.walletSection}>
                <CoinIcon size={17} />
                <Text style={s.walletValue}>{formatCoins(user?.coins)}</Text>
                <Text style={s.walletLabel}>COINS</Text>
              </View>
              <View style={s.walletDivider} />
              <View style={s.walletSection}>
                <Image source={collectibleIcon} style={{ width: 17, height: 17, opacity: 0.75 }} resizeMode="contain" />
                <Text style={s.walletValue}>{framesCount === null ? '–' : framesCount}</Text>
                <Text style={s.walletLabel}>COLECCIONABLES</Text>
              </View>
            </View>
          </View>

          <RewardedAdSection />

          {/* ── Menú ── */}
          <View style={s.section}>
            <MenuItem
              icon="albums-outline"
              label="Mi Colección"
              onPress={() => { onClose(); onNavigate('Collection'); }}
            />
            <MenuItem
              icon="storefront-outline"
              label="Mi Tienda"
              onPress={() => { onClose(); onNavigate('Store', { username: user?.username }); }}
            />
            <MenuItem
              icon="trophy-outline"
              label="Top Semanal"
              onPress={() => { onClose(); onNavigate('Top'); }}
            />
            <MenuItem
              icon="gift-outline"
              label="Mis Regalos"
              onPress={() => { onClose(); onNavigate('MyGifts'); }}
            />
            <MenuItem
              icon="settings-outline"
              label="Ajustes"
              onPress={() => { onClose(); onNavigate('Settings'); }}
            />
          </View>

          {/* ── Cerrar sesión ── */}
          <View style={s.logoutWrap}>
            <View style={s.dividerLine} />
            <TouchableOpacity style={s.logoutBtn} onPress={onLogout} activeOpacity={0.8}>
              <View style={s.logoutIconBox}>
                <Ionicons name="log-out-outline" size={19} color="#ef4444" />
              </View>
              <Text style={s.logoutTxt}>Cerrar sesión</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: insets.bottom + 24 }} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.65)' },
  drawer: {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    width: DRAWER_WIDTH, backgroundColor: colors.deep,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, elevation: 20,
  },

  // Abyss Card
  cardSection: {
    paddingHorizontal: CARD_PAD,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cardOuter: { width: CARD_W, position: 'relative' },
  cardInner: { width: CARD_W, height: CARD_H },

  // Info top-right (after avatar arch)
  cardInfo: {
    position: 'absolute',
    top: 48,
    left: CARD_AVT + 20,
    right: 8,
  },
  cardUsername: {
    color: '#fff', fontSize: 16, fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.85)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  // Stats strip bottom
  cardStats: {
    position: 'absolute', bottom: 8, left: 8, right: 8,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.42)', borderRadius: 8,
    paddingVertical: 5,
  },
  cardStat:        { flex: 1, alignItems: 'center' },
  cardStatVal: {
    color: '#fff', fontSize: 12, fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  cardStatLbl: {
    color: 'rgba(255,255,255,0.52)', fontSize: 7, marginTop: 1,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  cardStatDivider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.18)' },
  cardBioWrap: {
    position: 'absolute', top: CARD_AVT + 20, left: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cardBioTxt: {
    color: 'rgba(255,255,255,0.82)', fontSize: 10, fontWeight: '700', textAlign: 'left', lineHeight: 14,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cardAvatarWrap: {
    position: 'absolute', top: -(CARD_AVT * -0.15), left: 12,
    width: CARD_AVT, height: CARD_AVT, borderRadius: CARD_AVT / 2,
    overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)',
    zIndex: 10, backgroundColor: colors.deep,
  },
  cardAvatarImg:      { width: CARD_AVT, height: CARD_AVT },
  cardAvatarFallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  cardAvatarLetter:   { color: colors.textHi, fontSize: 16, fontWeight: '700' },


  // Wallet card
  walletWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  walletCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
  },
  walletSection: { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 5 },
  walletDivider: { width: 1, backgroundColor: colors.border, marginVertical: 14 },
  walletValue:   { color: colors.textHi, fontSize: 15, fontWeight: '800' },
  walletLabel:   { color: colors.textDim, fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },

  // Menú
  section:  { marginBottom: 4, paddingTop: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 13 },
  iconBox: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  menuLabel: { flex: 1, color: colors.textHi, fontSize: 14, fontWeight: '500' },
  badge:     { backgroundColor: colors.c3, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeTxt:  { color: '#fff', fontSize: 10, fontWeight: '800' },

  // Logout
  logoutWrap:    { marginTop: 4 },
  dividerLine:   { height: 1, backgroundColor: colors.border, marginHorizontal: 16, marginBottom: 4 },
  logoutBtn:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 13 },
  logoutIconBox: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoutTxt: { color: '#ef4444', fontSize: 14, fontWeight: '600' },
});
