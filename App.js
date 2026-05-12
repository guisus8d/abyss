import { View, StatusBar, Appearance, Platform } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';

if (Platform.OS !== 'web') {
  Appearance.setColorScheme('light');
}

export default function App() {
  return (
    <View style={{ flex: 1, backgroundColor: '#020509' }}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#020509"
        translucent={false}
      />
      <AppNavigator />
    </View>
  );
}
