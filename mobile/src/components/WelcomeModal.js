import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, Image, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';
import { useAppStore } from '../store/appStore';

const BANNER_URL = 'https://res.cloudinary.com/dlpdzgkeg/image/upload/v1782839084/ChatGPT_Image_30_jun_2026_10_53_31_a.m._irdi9m.png';

const POST_IDS = {
  es: '6a43f93b628f13981caa81ab',
  pt: '6a43fd03628f13981caa8323',
};

const STRINGS = {
  es: {
    title:    'Bienvenido a la beta',
    subtitle: 'Invita a mas personas a probar la beta. Ya esta disponible para todos.',
    toggle:   'Ver em portugues',
  },
  pt: {
    title:    'Bem-vindo a beta',
    subtitle: 'Convide mais pessoas para testar a beta. Ja esta disponivel para todos.',
    toggle:   'Ver en espanol',
  },
};

function detectLang() {
  return getLocales()[0]?.languageCode === 'pt' ? 'pt' : 'es';
}

export default function WelcomeModal({ navigationRef }) {
  const insets = useSafeAreaInsets();
  const { showWelcomeModal, setShowWelcomeModal } = useAppStore();
  const [lang, setLang] = useState(detectLang);

  useEffect(() => {
    if (showWelcomeModal) setLang(detectLang());
  }, [showWelcomeModal]);

  async function dismiss() {
    try { await AsyncStorage.setItem('welcomeModalShown_v1', '1'); } catch (_) {}
    setShowWelcomeModal(false);
  }

  async function handlePrimary() {
    await dismiss();
    navigationRef?.current?.navigate('PostDetail', { postId: POST_IDS[lang] });
  }

  const t = STRINGS[lang];

  return (
    <Modal
      visible={showWelcomeModal}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={dismiss}
    >
      <View style={[s.overlay, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>

        <TouchableOpacity style={s.card} onPress={handlePrimary} activeOpacity={0.92}>
          <View style={s.bannerWrap}>
            <Image
              source={{ uri: BANNER_URL }}
              style={s.banner}
              resizeMode="cover"
            />
            <TouchableOpacity style={s.closeBtn} onPress={dismiss} activeOpacity={0.8}>
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={s.body}>
            <Text style={s.title}>{t.title}</Text>
            <Text style={s.subtitle}>{t.subtitle}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={s.toggleWrap} onPress={() => setLang(l => l === 'es' ? 'pt' : 'es')} activeOpacity={0.6}>
          <Text style={s.toggleText}>{t.toggle}</Text>
        </TouchableOpacity>

      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex:              1,
    backgroundColor:   'rgba(2,5,9,0.82)',
    justifyContent:    'center',
    paddingHorizontal: 20,
    gap:               12,
  },
  card: {
    backgroundColor: colors.deep,
    borderRadius:    20,
    overflow:        'hidden',
    borderWidth:     1,
    borderColor:     colors.border,
  },
  bannerWrap: {
    width:    '100%',
    aspectRatio: 16 / 9,
  },
  banner: {
    ...StyleSheet.absoluteFillObject,
  },
  closeBtn: {
    position:        'absolute',
    top:             8,
    right:           8,
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  body: {
    padding: 20,
    gap:     8,
  },
  title: {
    color:      colors.textHi,
    fontSize:   18,
    fontWeight: '800',
  },
  subtitle: {
    color:      colors.textMid,
    fontSize:   14,
    lineHeight: 20,
  },
  toggleWrap: {
    alignItems: 'center',
  },
  toggleText: {
    color:               colors.c5,
    fontSize:            12,
    fontWeight:          '500',
    textDecorationLine:  'underline',
  },
});
