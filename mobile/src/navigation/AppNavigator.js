import React, { useEffect } from 'react';
import { View, Platform } from 'react-native';
import { NavigationContainer, DefaultTheme, createNavigationContainerRef } from '@react-navigation/native';

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
import { useAppStore } from '../store/appStore';
import { connectSocket, getSocket } from '../services/socket';
import LoginScreen           from '../screens/LoginScreen';
import HomeScreen            from '../screens/HomeScreen';
import ChatsScreen           from '../screens/ChatsScreen';
import ChatRoomScreen        from '../screens/ChatRoomScreen';
import ProfileScreen         from '../screens/ProfileScreen';
import PublicProfileScreen   from '../screens/PublicProfileScreen';
import EditProfilePageScreen from '../screens/EditProfilePageScreen';
import PostImageScreen       from '../screens/PostImageScreen';
import PostNoticiaScreen     from '../screens/PostNoticiaScreen';
import VideoPostScreen       from '../screens/VideoPostScreen';
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
import FramePreviewScreen         from '../screens/FramePreviewScreen';
import StoreScreen           from '../screens/StoreScreen';
import CreateStoreScreen     from '../screens/CreateStoreScreen';
import GiftScreen            from '../screens/GiftScreen';
import GiftsReceivedScreen   from '../screens/GiftsReceivedScreen';
import MyGiftsScreen         from '../screens/MyGiftsScreen';
import TransactionsScreen    from '../screens/TransactionsScreen';
import LandingScreen              from '../screens/LandingScreen';
import WelcomeScreen              from '../screens/WelcomeScreen';
import RegisterStep1Screen        from '../screens/RegisterStep1Screen';
import RegisterStep2Screen        from '../screens/RegisterStep2Screen';
import RegisterStep3Screen        from '../screens/RegisterStep3Screen';
import RegisterEmailVerifyScreen  from '../screens/RegisterEmailVerifyScreen';
import RegisterStep4Screen        from '../screens/RegisterStep4Screen';
import ChatPhotosScreen      from '../screens/ChatPhotosScreen';
import ChatAudiosScreen      from '../screens/ChatAudiosScreen';
import ChatBackgroundScreen  from '../screens/ChatBackgroundScreen';
import ChatSettingsScreen    from '../screens/ChatSettingsScreen';
import CirclesScreen         from '../screens/CirclesScreen';
import CircleCreateScreen    from '../screens/CircleCreateScreen';
import ProyectorWidget       from '../components/ProyectorWidget';
const MeetTextScreen = Platform.OS !== 'web'
  ? require('../screens/MeetTextScreen').default
  : () => null;

// ModPanelScreen eliminado intencionalmente por seguridad.
// El panel de moderación solo es accesible desde abyss.social/mod
// usando autenticación web con JWT de corta duración.

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

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
  const { user, isRestoring, restoreSession, isGuest } = useAuthStore();
  const { addUnreadChatId } = useAppStore();

  useEffect(() => { restoreSession(); }, []);

  // ── Listeners globales de notificaciones de chat ───────────────────────────
  // Se registran una sola vez cuando el usuario está autenticado y permanecen
  // activos independientemente de qué pantalla esté visible.
  useEffect(() => {
    if (!user) return;

    const chatHandler = ({ chatId }) => {
      const route = navigationRef.getCurrentRoute();
      const inThisChat =
        route?.name === 'ChatRoom' &&
        route?.params?.chat?._id?.toString() === chatId?.toString();
      if (!inThisChat) addUnreadChatId(chatId?.toString());
    };

    const groupHandler = ({ groupId }) => {
      const route = navigationRef.getCurrentRoute();
      const inThisGroup =
        route?.name === 'GroupRoom' &&
        route?.params?.group?._id?.toString() === groupId?.toString();
      if (!inThisGroup) addUnreadChatId(groupId?.toString());
    };

    let mounted = true;
    connectSocket().then(socket => {
      if (!mounted) return;
      socket.on('chat:notification',  chatHandler);
      socket.on('group:notification', groupHandler);
    });

    return () => {
      mounted = false;
      const socket = getSocket();
      socket?.off('chat:notification',  chatHandler);
      socket?.off('group:notification', groupHandler);
    };
  }, [user?._id]);

  if (isRestoring) {
    return (
      <SafeAreaProvider>
        <View style={{ flex:1, backgroundColor:'#020509' }} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }}>
      <NavigationContainer
        ref={navigationRef}
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
          {(user || isGuest) ? (
            <>
              <Stack.Screen name="Home"            component={HomeScreen} />
              <Stack.Screen name="Chats"           component={ChatsScreen} />
              <Stack.Screen name="ChatRoom"        component={ChatRoomScreen} />
              <Stack.Screen name="Profile"         component={ProfileScreen} />
              <Stack.Screen name="PublicProfile"   component={PublicProfileScreen} />
              <Stack.Screen name="EditProfilePage" component={EditProfilePageScreen} />
              <Stack.Screen name="PostImage"       component={PostImageScreen} />
              <Stack.Screen name="PostNoticia"     component={PostNoticiaScreen} />
              <Stack.Screen name="VideoPost"       component={VideoPostScreen} />
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
              <Stack.Screen name="GroupRoom"       component={GroupRoomScreen} options={{ detachPreviousScreen: false }} />
              <Stack.Screen name="GroupSettings"   component={GroupSettingsScreen} />
              <Stack.Screen name="Circles"         component={CirclesScreen} />
              <Stack.Screen name="CircleCreate"    component={CircleCreateScreen} />
              <Stack.Screen name="Search"          component={SearchScreen} />
              <Stack.Screen name="BlockedUsers"    component={BlockedUsersScreen} />
              <Stack.Screen name="Market"            component={MarketScreen} />
              <Stack.Screen name="MarketFrameDetail" component={MarketFrameDetailScreen} options={{ headerShown: false }} />
              <Stack.Screen name="FramePreview"      component={FramePreviewScreen}      options={{ headerShown: false }} />
              <Stack.Screen name="Store"           component={StoreScreen} />
              <Stack.Screen name="CreateStore"     component={CreateStoreScreen} />
              <Stack.Screen name="Gift"            component={GiftScreen} />
              <Stack.Screen name="GiftsReceived"   component={GiftsReceivedScreen} />
              <Stack.Screen name="MyGifts"         component={MyGiftsScreen} />
              <Stack.Screen name="Transactions"    component={TransactionsScreen} />
              <Stack.Screen name="ChatPhotos"      component={ChatPhotosScreen}     options={{ headerShown: false }} />
              <Stack.Screen name="ChatAudios"      component={ChatAudiosScreen}     options={{ headerShown: false }} />
              <Stack.Screen name="ChatBackground"  component={ChatBackgroundScreen} options={{ headerShown: false }} />
              <Stack.Screen name="ChatSettings"    component={ChatSettingsScreen}   options={{ headerShown: false }} />
              <Stack.Screen name="MeetText"        component={MeetTextScreen}        options={{ headerShown: false }} />
            </>
          ) : (
            <>
              {Platform.OS === 'web' ? (
                <Stack.Screen name="Landing" component={LandingScreen} />
              ) : (
                <>
                  <Stack.Screen name="Welcome"             component={WelcomeScreen} />
                  <Stack.Screen name="RegisterStep1"       component={RegisterStep1Screen} />
                  <Stack.Screen name="RegisterStep2"       component={RegisterStep2Screen} />
                  <Stack.Screen name="RegisterStep3"       component={RegisterStep3Screen} />
                  <Stack.Screen name="RegisterEmailVerify" component={RegisterEmailVerifyScreen} />
                  <Stack.Screen name="RegisterStep4"       component={RegisterStep4Screen} />
                </>
              )}
              <Stack.Screen name="Login"         component={LoginScreen} />
              <Stack.Screen name="PostDetail"    component={PostDetailScreen} />
              <Stack.Screen name="PublicProfile" component={PublicProfileScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
      <ProyectorWidget navigationRef={navigationRef} />
      </View>
    </SafeAreaProvider>
  );
}
