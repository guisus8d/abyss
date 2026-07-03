import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator, Image, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getLocales } from 'expo-localization';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../theme/colors';
import api, { postFormData } from '../services/api';

const MAX_CHARS = 500;

function detectLang() {
  return getLocales()[0]?.languageCode === 'pt' ? 'pt' : 'es';
}

const T = {
  es: {
    title:       'Reportar problema',
    infoText:    'Este boton esta disponible solo para beta testers.\nEnvianos tus reportes — los revisamos y actualizamos la app cada dos dias en base a su feedback. Gracias.',
    placeholder: 'Describe el problema...',
    attach:      'Adjuntar imagen',
    attached:    'Imagen adjunta — toca para cambiar',
    send:        'Enviar reporte',
    sending:     'Enviando...',
    successTitle:'Reporte enviado',
    successMsg:  'Gracias por ayudarnos a mejorar Abyss.',
    errorMsg:    'No se pudo enviar el reporte. Intenta de nuevo.',
    toggleLang:  'PT',
  },
  pt: {
    title:       'Reportar problema',
    infoText:    'Este botao esta disponivel apenas para beta testers.\nEnvie seus relatorios — revisamos e atualizamos o app a cada dois dias com base no feedback. Obrigado.',
    placeholder: 'Descreva o problema...',
    attach:      'Anexar imagem',
    attached:    'Imagem anexada — toque para mudar',
    send:        'Enviar relatorio',
    sending:     'Enviando...',
    successTitle:'Relatorio enviado',
    successMsg:  'Obrigado por nos ajudar a melhorar o Abyss.',
    errorMsg:    'Nao foi possivel enviar o relatorio. Tente novamente.',
    toggleLang:  'ES',
  },
};

export default function BugReportScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const previousScreen = route?.params?.previousScreen || 'desconocida';

  const [lang,        setLang]        = useState(detectLang);
  const [description, setDescription] = useState('');
  const [image,       setImage]       = useState(null);
  const [loading,     setLoading]     = useState(false);

  const t = T[lang];

  function toggleLang() {
    setLang(l => l === 'es' ? 'pt' : 'es');
  }

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galeria para adjuntar imagenes.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality:    0.7,
    });
    if (!result.canceled && result.assets?.[0]) {
      setImage(result.assets[0]);
    }
  }

  function removeImage() {
    setImage(null);
  }

  async function submit() {
    if (!description.trim()) return;
    setLoading(true);
    try {
      const deviceInfo = `${Platform.OS} ${Platform.Version}`;

      if (image) {
        const formData = new FormData();
        formData.append('description', description.trim());
        formData.append('screen',      previousScreen);
        formData.append('deviceInfo',  deviceInfo);
        formData.append('image', {
          uri:  image.uri,
          type: 'image/jpeg',
          name: 'bug-screenshot.jpg',
        });
        await postFormData('/bug-reports', formData);
      } else {
        await api.post('/bug-reports', {
          description: description.trim(),
          screen:      previousScreen,
          deviceInfo,
        });
      }

      Alert.alert(t.successTitle, t.successMsg, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Error', t.errorMsg);
    } finally {
      setLoading(false);
    }
  }

  const canSend = description.trim().length > 0 && !loading;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.textHi} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t.title}</Text>
        <TouchableOpacity style={s.langToggle} onPress={toggleLang} activeOpacity={0.7}>
          <Text style={s.langToggleTxt}>{t.toggleLang}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Info card */}
          <View style={s.infoCard}>
            <Ionicons name="bug-outline" size={32} color={colors.c1} style={{ marginBottom: 10 }} />
            <Text style={s.infoText}>{t.infoText}</Text>
          </View>

          {/* TextInput */}
          <View style={s.inputWrap}>
            <TextInput
              style={s.input}
              placeholder={t.placeholder}
              placeholderTextColor={colors.textDim}
              value={description}
              onChangeText={v => setDescription(v.slice(0, MAX_CHARS))}
              multiline
              textAlignVertical="top"
            />
            <Text style={s.charCount}>{description.length}/{MAX_CHARS}</Text>
          </View>

          {/* Imagen adjunta */}
          <TouchableOpacity style={s.attachBtn} onPress={pickImage} activeOpacity={0.7}>
            <Ionicons name="image-outline" size={18} color={colors.textMid} />
            <Text style={s.attachTxt}>{image ? t.attached : t.attach}</Text>
          </TouchableOpacity>

          {image && (
            <View style={s.previewWrap}>
              <Image source={{ uri: image.uri }} style={s.preview} resizeMode="cover" />
              <TouchableOpacity style={s.removeImg} onPress={removeImage} activeOpacity={0.8}>
                <Ionicons name="close" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {/* Botón enviar */}
          <TouchableOpacity
            style={[s.sendBtn, !canSend && s.sendBtnDisabled]}
            onPress={submit}
            disabled={!canSend}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator size="small" color={colors.black} />
              : <Text style={s.sendTxt}>{t.send}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.black },

  header: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: 16,
    paddingVertical:   12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  backBtn:       { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:   { flex: 1, color: colors.textHi, fontSize: 17, fontWeight: '700' },
  langToggle:    {
    borderWidth:      1,
    borderColor:      colors.border,
    borderRadius:     8,
    paddingHorizontal: 12,
    paddingVertical:   6,
  },
  langToggleTxt: { color: colors.textMid, fontSize: 13, fontWeight: '700' },

  body: { padding: 20, gap: 16 },

  infoCard: {
    backgroundColor: colors.card,
    borderRadius:    16,
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.06)',
    padding:         20,
    alignItems:      'center',
  },
  infoText: {
    color:      colors.textMid,
    fontSize:   13,
    lineHeight: 20,
    textAlign:  'center',
  },

  inputWrap: { gap: 6 },
  input: {
    backgroundColor: colors.surface,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     colors.border,
    color:           colors.textHi,
    fontSize:        14,
    padding:         14,
    minHeight:       130,
  },
  charCount: {
    color:     colors.textDim,
    fontSize:  11,
    textAlign: 'right',
  },

  attachBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    paddingVertical:   11,
    paddingHorizontal: 14,
    backgroundColor:   colors.surface,
    borderRadius:      10,
    borderWidth:       1,
    borderColor:       colors.border,
  },
  attachTxt: { color: colors.textMid, fontSize: 13 },

  previewWrap: { position: 'relative' },
  preview: {
    width:        '100%',
    height:       180,
    borderRadius: 12,
  },
  removeImg: {
    position:        'absolute',
    top:             8,
    right:           8,
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems:      'center',
    justifyContent:  'center',
  },

  sendBtn: {
    backgroundColor: colors.c1,
    borderRadius:    12,
    paddingVertical: 14,
    alignItems:      'center',
    marginTop:       4,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendTxt: { color: colors.black, fontSize: 15, fontWeight: '800' },
});
