import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, Alert, StatusBar, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

const GENDERS = [
  { key: 'hombre',           label: '♂ Hombre' },
  { key: 'mujer',            label: '♀ Mujer' },
  { key: 'no-binario',       label: '⚧ No binario' },
  { key: 'prefiero-no-decir',label: '◌ Prefiero no decir' },
];

export default function LoginScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [gender, setGender]     = useState('prefiero-no-decir');
  const [avatar, setAvatar]     = useState(null);
  const { login, register, isLoading } = useAuthStore();

  async function pickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1,1], quality: 0.8,
    });
    if (!result.canceled) setAvatar(result.assets[0]);
  }

  async function handleSubmit() {
    if (isRegister) {
      if (!username.trim()) return Alert.alert('Error', 'Ingresa un username');
      try {
        const formData = new FormData();
        formData.append('username', username.trim());
        formData.append('email', email.trim());
        formData.append('password', password);
        formData.append('gender', gender);
        if (avatar?.uri) {
          if (avatar.uri.startsWith('blob:') || avatar.uri.startsWith('data:') || avatar.uri.startsWith('http')) {
            const res  = await fetch(avatar.uri);
            const blob = await res.blob();
            formData.append('avatar', blob, 'avatar.jpg');
          } else {
            formData.append('avatar', { uri: avatar.uri, type: 'image/jpeg', name: 'avatar.jpg' });
          }
        }
        const result = await register(formData);
        if (!result.success) Alert.alert('Error', result.error);
      } catch (err) {
        Alert.alert('Error', err.response?.data?.error || 'No se pudo registrar');
      }
    } else {
      const result = await login(email.trim(), password);
      if (!result.success) Alert.alert('Error', result.error);
    }
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.black} />
      <View style={s.glowTop} />
      <View style={s.glowBot} />

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        <View style={s.logoArea}>
          <View style={s.ring1} /><View style={s.ring2} /><View style={s.ring3} />
          <View style={s.logoBox}>
            <Image
              source={require('../../assets/logo.png')}
              style={s.logoImg}
              resizeMode="contain"
            />
          </View>
          <Text style={s.wordmark}>ABBYS</Text>
          <Text style={s.sub}>PROJECT</Text>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>{isRegister ? 'CREAR CUENTA' : 'ACCEDER'}</Text>

          {isRegister && (
            <>
              {/* Avatar picker */}
              <TouchableOpacity style={s.avatarPicker} onPress={pickAvatar}>
                {avatar ? (
                  <Image source={{ uri: avatar.uri }} style={s.avatarPreview} />
                ) : (
                  <View style={s.avatarEmpty}>
                    <Text style={s.avatarEmptyIcon}>📷</Text>
                    <Text style={s.avatarEmptyTxt}>Foto de perfil{'\n'}(opcional)</Text>
                  </View>
                )}
                {avatar && (
                  <View style={s.avatarEditBadge}>
                    <Text style={{ fontSize: 10 }}>✏️</Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={s.field}>
                <Text style={s.label}>USERNAME</Text>
                <TextInput
                  style={s.input}
                  placeholder="tu_nombre"
                  placeholderTextColor={colors.textDim}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                />
              </View>

              {/* Género */}
              <View style={s.field}>
                <Text style={s.label}>GÉNERO</Text>
                <View style={s.genderGrid}>
                  {GENDERS.map(g => (
                    <TouchableOpacity
                      key={g.key}
                      style={[s.genderBtn, gender === g.key && s.genderBtnActive]}
                      onPress={() => setGender(g.key)}
                    >
                      <Text style={[s.genderTxt, gender === g.key && s.genderTxtActive]}>
                        {g.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}

          <View style={s.field}>
            <Text style={s.label}>EMAIL</Text>
            <TextInput
              style={s.input}
              placeholder="usuario@ejemplo.com"
              placeholderTextColor={colors.textDim}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>CONTRASEÑA</Text>
            <TextInput
              style={s.input}
              placeholder="••••••••"
              placeholderTextColor={colors.textDim}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {!isRegister && (
            <Text style={s.forgot}>¿Olvidaste tu contraseña?</Text>
          )}

          <TouchableOpacity onPress={handleSubmit} disabled={isLoading} activeOpacity={0.85}>
            <LinearGradient
              colors={['#006b63','#00c4b4','#00e5cc']}
              start={{x:0,y:0}} end={{x:1,y:0}}
              style={s.btnEnter}
            >
              <Text style={s.btnTxt}>
                {isLoading ? '...' : isRegister ? 'CREAR CUENTA' : 'ENTRAR'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {!isRegister && (
            <>
              <View style={s.divider}>
                <View style={s.divLine} />
                <Text style={s.divTxt}>o continúa con</Text>
                <View style={s.divLine} />
              </View>
              <View style={s.socials}>
                <TouchableOpacity style={s.socialBtn}><Text style={s.socialTxt}>G</Text></TouchableOpacity>
                <TouchableOpacity style={s.socialBtn}><Text style={s.socialTxt}>D</Text></TouchableOpacity>
              </View>
            </>
          )}
        </View>

        <TouchableOpacity onPress={() => setIsRegister(!isRegister)} style={s.toggle}>
          <Text style={s.toggleTxt}>
            {isRegister ? '¿Ya tienes cuenta? ' : '¿No tienes cuenta? '}
            <Text style={s.toggleLink}>{isRegister ? 'Inicia sesión' : 'Regístrate'}</Text>
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.black },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, paddingTop: 60 },
  glowTop: {
    position: 'absolute', width: 300, height: 300, borderRadius: 150,
    backgroundColor: 'rgba(0,110,130,0.08)', top: -100, left: -80,
  },
  glowBot: {
    position: 'absolute', width: 280, height: 280, borderRadius: 140,
    backgroundColor: 'rgba(40,0,120,0.07)', bottom: -80, right: -60,
  },
  logoArea: { alignItems: 'center', marginBottom: 32, position: 'relative' },
  ring1: {
    position: 'absolute', width: 90, height: 90, borderRadius: 45,
    borderWidth: 1, borderColor: 'rgba(0,229,204,0.12)', top: -5, alignSelf: 'center',
  },
  ring2: {
    position: 'absolute', width: 110, height: 110, borderRadius: 55,
    borderWidth: 1, borderColor: 'rgba(41,121,255,0.08)', top: -15, alignSelf: 'center',
  },
  ring3: {
    position: 'absolute', width: 132, height: 132, borderRadius: 66,
    borderWidth: 1, borderColor: 'rgba(217,70,239,0.05)', top: -26, alignSelf: 'center',
  },
  logoBox:            { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  logoImg: {
    width: 80, height: 80,
    shadowColor: '#00e5cc',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 18,
    // En Android la sombra va en el contenedor
  },
  wordmark: { fontSize: 30, fontWeight: '900', letterSpacing: 10, color: colors.c1, marginTop: 10, zIndex: 2 },
  sub:      { fontSize: 8, letterSpacing: 5, color: 'rgba(0,229,204,0.5)', marginTop: 2, marginBottom: 4 },

  card: {
    width: '100%', backgroundColor: colors.card,
    borderRadius: 24, borderWidth: 1, borderColor: colors.borderC, padding: 24,
  },
  cardTitle: { fontSize: 11, letterSpacing: 3, color: colors.textMid, textAlign: 'center', marginBottom: 24 },

  // Avatar picker
  avatarPicker: { alignSelf: 'center', marginBottom: 20, position: 'relative' },
  avatarPreview: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: colors.c1 },
  avatarEmpty: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 2, borderColor: colors.borderC, borderStyle: 'dashed',
    backgroundColor: 'rgba(0,229,204,0.05)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarEmptyIcon: { fontSize: 20, marginBottom: 2 },
  avatarEmptyTxt:  { color: colors.textDim, fontSize: 9, textAlign: 'center', letterSpacing: 0.5 },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: colors.deep, borderRadius: 10,
    borderWidth: 1, borderColor: colors.borderC,
    width: 22, height: 22, alignItems: 'center', justifyContent: 'center',
  },

  field:  { marginBottom: 14 },
  label:  { fontSize: 10, letterSpacing: 2, color: colors.textDim, marginBottom: 6 },
  input:  {
    backgroundColor: 'rgba(8,20,36,0.95)',
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    padding: 14, color: colors.textHi, fontSize: 14,
  },

  // Gender selector
  genderGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  genderBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: 'rgba(8,20,36,0.95)',
  },
  genderBtnActive: { borderColor: colors.c1, backgroundColor: 'rgba(0,229,204,0.1)' },
  genderTxt:       { color: colors.textDim, fontSize: 12 },
  genderTxtActive: { color: colors.c1 },

  forgot:  { textAlign: 'right', fontSize: 11, color: 'rgba(0,229,204,0.6)', marginBottom: 20 },
  btnEnter:{ borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 20 },
  btnTxt:  { color: '#001a18', fontSize: 13, fontWeight: '700', letterSpacing: 3 },

  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  divLine: { flex: 1, height: 1, backgroundColor: colors.border },
  divTxt:  { marginHorizontal: 12, fontSize: 11, color: colors.textDim },

  socials:   { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  socialBtn: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  socialTxt: { color: colors.textMid, fontSize: 16, fontWeight: 'bold' },

  toggle:     { marginTop: 24 },
  toggleTxt:  { color: colors.textMid, fontSize: 13, textAlign: 'center' },
  toggleLink: { color: colors.c1 },
});
