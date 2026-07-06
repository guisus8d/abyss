import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  StatusBar, Appearance, Platform, Linking, Image,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { useAppStore } from './src/store/appStore';

if (Platform.OS !== 'web') {
  Appearance.setColorScheme('light');
}

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.abyss.social';

function UpdateModal() {
  const insets = useSafeAreaInsets();

  function handleUpdate() {
    Linking.openURL(PLAY_STORE_URL).catch(() => {
      Linking.openURL('market://details?id=com.abyss.social');
    });
  }

  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={() => {}} // bloquea el botón Back de Android
    >
      <View style={[m.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={m.card}>
          {/* Logo */}
          <Image
            source={require('./assets/logo.png')}
            style={m.logo}
            resizeMode="contain"
          />

          <Text style={m.title}>Actualizacion requerida</Text>
          <Text style={m.body}>
            Esta version de Abyss ya no es compatible.{'\n'}
            Descarga la ultima version para continuar.
          </Text>

          <TouchableOpacity style={m.btn} onPress={handleUpdate} activeOpacity={0.85}>
            <Text style={m.btnTxt}>Actualizar ahora</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function App() {
  const updateRequired = useAppStore((s) => s.updateRequired);

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: '#020509' }}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="#020509"
          translucent={false}
        />
        <AppNavigator />
        {updateRequired && <UpdateModal />}
      </View>
    </SafeAreaProvider>
  );
}

const m = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0b1521',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,229,204,0.15)',
    padding: 32,
    alignItems: 'center',
  },
  logo: {
    width: 56,
    height: 56,
    marginBottom: 20,
    opacity: 0.9,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#e8f4f8',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  body: {
    fontSize: 13,
    color: 'rgba(232,244,248,0.5)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  btn: {
    backgroundColor: '#00e5cc',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 36,
  },
  btnTxt: {
    color: '#001a18',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
});
