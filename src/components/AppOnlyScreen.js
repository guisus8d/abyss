import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export default function AppOnlyScreen({ navigation }) {
  return (
    <View style={s.root}>
      <SafeAreaView style={s.safe}>
        <TouchableOpacity style={s.back} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textHi} />
        </TouchableOpacity>
        <View style={s.center}>
          <View style={s.iconWrap}>
            <Ionicons name="phone-portrait-outline" size={48} color={colors.textDim} />
          </View>
          <Text style={s.title}>Disponible solo en la app</Text>
          <Text style={s.subtitle}>
            Esta función está disponible únicamente en la app de Abyss para iOS y Android.
          </Text>
          <TouchableOpacity
            style={s.downloadBtn}
            onPress={() => Linking.openURL('https://abyss.social/download')}
            activeOpacity={0.8}
          >
            <Ionicons name="download-outline" size={20} color={colors.c1} />
            <Text style={s.downloadTxt}>Descargar Abyss</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  safe: { flex: 1 },
  back: { padding: 16, alignSelf: 'flex-start' },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, paddingBottom: 60,
  },
  iconWrap: {
    width: 96, height: 96, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 28,
  },
  title: {
    color: colors.textHi, fontSize: 20, fontWeight: '800',
    textAlign: 'center', marginBottom: 12,
  },
  subtitle: {
    color: colors.textDim, fontSize: 14, textAlign: 'center',
    lineHeight: 21, marginBottom: 36,
  },
  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 28, paddingVertical: 15,
    borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(0,229,204,0.4)',
    backgroundColor: 'rgba(0,229,204,0.08)',
  },
  downloadTxt: { color: colors.c1, fontSize: 15, fontWeight: '700' },
});
