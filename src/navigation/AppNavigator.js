import React, { useEffect } from 'react';
import { View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';

const AbyssTheme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary:      '#00e5cc',
    background:   '#020509',
    card:         '#050c14',
    text:         '#e8f4f8',
    border:       '#0d1520',
    notification: '#00e5cc',
  },
};
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import LoginScreen           from '../screens/LoginScreen';
import HomeScreen            from '../screens/HomeScreen';
import ChatsScreen           from '../screens/ChatsScreen';
import ChatRoomScreen        from '../screens/ChatRoomScreen';
import ProfileScreen         from '../screens/ProfileScreen';
import PublicProfileScreen   from '../screens/PublicProfileScreen';
import EditProfilePageScreen from '../screens/EditProfilePageScreen';
import PostImageScreen       from '../screens/PostImageScreen';
import PostNoticiaScreen     from '../screens/PostNoticiaScreen';
import SettingsScreen        from '../screens/SettingsScreen';
import CollectionScreen      from '../screens/CollectionScreen';
import CreateFrameScreen     from '../screens/CreateFrameScreen';
import NotificationsScreen   from '../screens/NotificationsScreen';
import FollowListScreen      from '../screens/FollowListScreen';
import PostDetailScreen      from '../screens/PostDetailScreen';
import TopScreen             from '../screens/TopScreen';
import FrameDetailScreen     from '../screens/FrameDetailScreen';
import FrameSelectorScreen   from '../screens/FrameSelectorScreen';
import CreateGroupScreen     from '../screens/CreateGroupScreen';
import GroupRoomScreen       from '../screens/GroupRoomScreen';
import GroupSettingsScreen   from '../screens/GroupSettingsScreen';
import SearchScreen          from '../screens/SearchScreen';
import BlockedUsersScreen    from '../screens/BlockedUsersScreen';
import MarketScreen               from '../screens/MarketScreen';
import MarketFrameDetailScreen    from '../screens/MarketFrameDetailScreen';
import StoreScreen           from '../screens/StoreScreen';
import CreateStoreScreen     from '../screens/CreateStoreScreen';
import GiftScreen            from '../screens/GiftScreen';
import GiftsReceivedScreen   from '../screens/GiftsReceivedScreen';
import TransactionsScreen    from '../screens/TransactionsScreen';

// ModPanelScreen eliminado intencionalmente por seguridad.
// El panel de moderación solo es accesible desde abyss.social/mod
// usando autenticación web con JWT de corta duración.

const Stack = createNativeStackNavigator();

const linking = {
  prefixes: ['https://abyss.social', 'abyss://'],
  config: {
    screens: {
      Login:         'login',
      Home:          '',
      PostDetail:    'post/:postId',
      PublicProfile: 'user/:username',
    },
  },
};

export default function AppNavigator() {
  const { user, isRestoring, restoreSession } = useAuthStore();
  useEffect(() => { restoreSession(); }, []);

  if (isRestoring) {
    return (
      <SafeAreaProvider>
        <View style={{ flex:1, backgroundColor:'#020509' }} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer
        theme={AbyssTheme}
        linking={linking}
        documentTitle={{ formatter: (options, route) => options?.title ? `${options.title} — Abyss` : 'Abyss' }}
      >
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#020509' },
            animation: 'slide_from_right',
          }}
        >
          {user ? (
            <>
              <Stack.Screen name="Home"            component={HomeScreen} />
              <Stack.Screen name="Chats"           component={ChatsScreen} />
              <Stack.Screen name="ChatRoom"        component={ChatRoomScreen} />
              <Stack.Screen name="Profile"         component={ProfileScreen} />
              <Stack.Screen name="PublicProfile"   component={PublicProfileScreen} />
              <Stack.Screen name="EditProfilePage" component={EditProfilePageScreen} />
              <Stack.Screen name="PostImage"       component={PostImageScreen} />
              <Stack.Screen name="PostNoticia"     component={PostNoticiaScreen} />
              <Stack.Screen name="Settings"        component={SettingsScreen} />
              <Stack.Screen name="Collection"      component={CollectionScreen} />
              <Stack.Screen name="CreateFrame"     component={CreateFrameScreen} />
              <Stack.Screen name="Notifications"   component={NotificationsScreen} />
              <Stack.Screen name="FollowList"      component={FollowListScreen} />
              <Stack.Screen name="PostDetail"      component={PostDetailScreen} />
              <Stack.Screen name="Top"             component={TopScreen} />
              <Stack.Screen name="FrameDetail"     component={FrameDetailScreen} />
              <Stack.Screen name="FrameSelector"   component={FrameSelectorScreen} />
              <Stack.Screen name="CreateGroup"     component={CreateGroupScreen} />
              <Stack.Screen name="GroupRoom"       component={GroupRoomScreen} />
              <Stack.Screen name="GroupSettings"   component={GroupSettingsScreen} />
              <Stack.Screen name="Search"          component={SearchScreen} />
              <Stack.Screen name="BlockedUsers"    component={BlockedUsersScreen} />
              <Stack.Screen name="Market"            component={MarketScreen} />
              <Stack.Screen name="MarketFrameDetail" component={MarketFrameDetailScreen} options={{ headerShown: false }} />
              <Stack.Screen name="Store"           component={StoreScreen} />
              <Stack.Screen name="CreateStore"     component={CreateStoreScreen} />
              <Stack.Screen name="Gift"            component={GiftScreen} />
              <Stack.Screen name="GiftsReceived"   component={GiftsReceivedScreen} />
              <Stack.Screen name="Transactions"    component={TransactionsScreen} />
            </>
          ) : (
            <>
              <Stack.Screen name="Login"         component={LoginScreen} />
              <Stack.Screen name="PostDetail"    component={PostDetailScreen} />
              <Stack.Screen name="PublicProfile" component={PublicProfileScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
