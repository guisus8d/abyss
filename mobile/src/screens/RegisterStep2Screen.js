import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

const GENDERS = [
  { key: 'hombre',            label: 'Hombre' },
  { key: 'mujer',             label: 'Mujer' },
  { key: 'prefiero-no-decir', label: 'Prefiero no decirlo' },
];

function StepDots({ current }) {
  return (
    <View style={dots.row}>
      {[0, 1, 2, 3].map(i => (
        <View
          key={i}
          style={[dots.dot, i === current ? dots.dotActive : dots.dotInactive]}
        />
      ))}
    </View>
  );
}
const dots = StyleSheet.create({
  row:         { flexDirection: 'row', gap: 6, marginBottom: 32 },
  dot:         { height: 6, borderRadius: 3 },
  dotActive:   { width: 20, backgroundColor: '#00e5cc' },
  dotInactive: { width: 6,  backgroundColor: 'rgba(0,229,204,0.2)' },
});

export default function RegisterStep2Screen({ navigation, route }) {
  const insets  = useSafeAreaInsets();
  const regData = route.params?.regData || {};
  const [gender, setGender] = useState(regData.gender || 'prefiero-no-decir');

  function handleNext() {
    navigation.navigate('RegisterStep3', { regData: { ...regData, gender } });
  }

  return (
    <View style={[s.root, { paddingTop: insets.top + 8 }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.black} />
      <LinearGradient
        colors={['#000d1a', '#001a2e', '#002a3a', '#001020']}
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color="rgba(232,244,248,0.7)" />
        </TouchableOpacity>
      </View>

      <View style={s.content}>
        <StepDots current={1} />

        <Text style={s.title}>Como te identificas</Text>
        <Text style={s.subtitle}>Esta informacion es privada y no se muestra en tu perfil publico</Text>

        {/* Gender options */}
        <View style={s.optionsWrap}>
          {GENDERS.map(g => {
            const active = gender === g.key;
            return (
              <TouchableOpacity
                key={g.key}
                style={[s.option, active && s.optionActive]}
                onPress={() => setGender(g.key)}
                activeOpacity={0.75}
              >
                {active && (
                  <LinearGradient
                    colors={['rgba(0,229,204,0.1)', 'rgba(41,121,255,0.1)']}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <View style={[s.optionRadio, active && s.optionRadioActive]}>
                  {active && <View style={s.optionRadioDot} />}
                </View>
                <Text style={[s.optionLbl, active && s.optionLblActive]}>
                  {g.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Footer */}
      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <TouchableOpacity onPress={handleNext} activeOpacity={0.85}>
          <LinearGradient
            colors={['#005c55', '#00b4a0', '#00e5cc']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.btnNext}
          >
            <Text style={s.btnNextTxt}>SIGUIENTE</Text>
            <Ionicons name="chevron-forward" size={15} color="#001a18" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#000d1a' },
  header:  { paddingHorizontal: 16, paddingBottom: 8 },
  backBtn: { padding: 8, alignSelf: 'flex-start' },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
  footer:  { paddingHorizontal: 24, paddingTop: 12 },

  title:    { fontSize: 22, fontWeight: '700', color: '#e8f4f8', marginBottom: 6 },
  subtitle: { fontSize: 13, color: 'rgba(232,244,248,0.4)', marginBottom: 36, lineHeight: 18 },

  optionsWrap: { gap: 12 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 18, paddingHorizontal: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  optionActive: { borderColor: 'rgba(0,229,204,0.35)' },
  optionRadio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  optionRadioActive: { borderColor: '#00e5cc' },
  optionRadioDot:    { width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#00e5cc' },
  optionLbl:         { fontSize: 15, color: 'rgba(232,244,248,0.5)', fontWeight: '500' },
  optionLblActive:   { color: '#e8f4f8', fontWeight: '600' },

  btnNext:    { borderRadius: 14, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnNextTxt: { color: '#001a18', fontSize: 12, fontWeight: '800', letterSpacing: 3 },
});
