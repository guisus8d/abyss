import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import LoginScreen         from '../screens/LoginScreen';
import HomeScreen          from '../screens/HomeScreen';
import ChatsScreen         from '../screens/ChatsScreen';
import ChatRoomScreen      from '../screens/ChatRoomScreen';
import ProfileScreen       from '../screens/ProfileScreen';
import PublicProfileScreen from '../screens/PublicProfileScreen';
import EditProfilePageScreen from '../screens/EditProfilePageScreen';
import PostImageScreen       from '../screens/PostImageScreen';
import PostNoticiaScreen     from '../screens/PostNoticiaScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import FollowListScreen    from '../screens/FollowListScreen';
import PostDetailScreen    from '../screens/PostDetailScreen';
import TopScreen           from '../screens/TopScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { user, isRestoring, restoreSession } = useAuthStore();
  useEffect(() => { restoreSession(); }, []);

  if (isRestoring) {
    return (
      <View style={{ flex: 1, backgroundColor: '#020509', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#00e5cc" size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Home"          component={HomeScreen} />
            <Stack.Screen name="Chats"         component={ChatsScreen} />
            <Stack.Screen name="ChatRoom"      component={ChatRoomScreen} />
            <Stack.Screen name="Profile"       component={ProfileScreen} />
            <Stack.Screen name="PublicProfile" component={PublicProfileScreen} />
            <Stack.Screen name="EditProfilePage"  component={EditProfilePageScreen} />
            <Stack.Screen name="PostImage"       component={PostImageScreen} />
            <Stack.Screen name="PostNoticia"     component={PostNoticiaScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="FollowList"    component={FollowListScreen} />
            <Stack.Screen name="PostDetail"    component={PostDetailScreen} />
            <Stack.Screen name="Top"           component={TopScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
