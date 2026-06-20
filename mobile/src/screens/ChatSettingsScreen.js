import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

const OPTIONS = [
  { icon: 'image-outline',  label: 'Cambiar fondo', screen: 'ChatBackground' },
  { icon: 'images-outline', label: 'Fotos',          screen: 'ChatPhotos'    },
  { icon: 'mic-outline',    label: 'Audios',         screen: 'ChatAudios'    },
];

export default function ChatSettingsScreen({ navigation, route }) {
  const { chatId, otherUsername, currentBg } = route.params;
  const insets = useSafeAreaInsets();

  function navigate(screen) {
    if (screen === 'ChatBackground') {
      navigation.navigate('ChatBackground', { chatId, currentBg });
    } else {
      navigation.navigate(screen, { chatId, otherUsername });
    }
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.textHi} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Ajustes del chat</Text>
            <Text style={s.headerSub}>{otherUsername}</Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={[s.list, { paddingBottom: insets.bottom + 24 }]}>
        {OPTIONS.map((opt, i) => (
          <TouchableOpacity
            key={opt.screen}
            style={[s.row, i === 0 && s.rowFirst]}
            onPress={() => navigate(opt.screen)}
            activeOpacity={0.7}
          >
            <View style={s.iconBox}>
              <Ionicons name={opt.icon} size={20} color={colors.textMid} />
            </View>
            <Text style={s.rowTxt}>{opt.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.black },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn:     { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.textHi, fontSize: 15, fontWeight: '700' },
  headerSub:   { color: colors.textDim, fontSize: 11, marginTop: 1 },

  list:     { marginTop: 16, paddingHorizontal: 16 },
  rowFirst: { borderTopWidth: 1, borderTopColor: colors.border },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  iconBox:  { width: 38, height: 38, borderRadius: 11, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  rowTxt:   { flex: 1, color: colors.textHi, fontSize: 15, fontWeight: '500' },
});
