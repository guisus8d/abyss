import { View } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <View style={{ flex: 1, backgroundColor: '#020509' }}>
      <AppNavigator />
    </View>
  );
}
