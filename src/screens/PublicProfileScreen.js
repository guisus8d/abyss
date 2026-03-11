import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, StatusBar, SafeAreaView, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

export default function PublicProfileScreen({ route, navigation }) {
  const { username } = route.params;
  const { user: me } = useAuthStore();
  const [profile, setProfile]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [following, setFollowing]   = useState(false);
  const [blocked, setBlocked]       = useState(false);
  const [loadingBtn, setLoadingBtn] = useState(false);
  const [chatStatus, setChatStatus] = useState('none'); // none | requested | active

  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    try {
      const { data } = await api.get(`/users/${username}`);
      setProfile(data.user);
      setFollowing(data.user.followers?.some(f => f._id === me._id || f === me._id));
      // Verificar estado del chat
      try {
        const chatRes = await api.get(`/chats/check/${data.user._id}`);
        setChatStatus(chatRes.data.status); // 'active' | 'requested' | 'none'
      } catch {
        setChatStatus('none');
      }
    } catch {
      Alert.alert('Error', 'No se pudo cargar el perfil');
    } finally {
      setLoading(false);
    }
  }

  async function handleFollow() {
    setLoadingBtn(true);
    try {
      const { data } = await api.post(`/social/follow/${username}`);
      setFollowing(data.following);
      setProfile(prev => ({
        ...prev,
        followers: data.following
          ? [...(prev.followers || []), { _id: me._id }]
          : (prev.followers || []).filter(f => f._id !== me._id),
      }));
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Error al seguir');
    } finally {
      setLoadingBtn(false);
    }
  }

  async function handleBlock() {
    Alert.alert(
      blocked ? 'Desbloquear' : 'Bloquear',
      `¿${blocked ? 'Desbloquear' : 'Bloquear'} a ${username}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: blocked ? 'Desbloquear' : 'Bloquear',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data } = await api.post(`/social/block/${username}`);
              setBlocked(data.blocked);
              if (data.blocked) setFollowing(false);
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error);
            }
          }
        }
      ]
    );
  }

  async function handleChat() {
    if (chatStatus === 'active') {
      try {
        const { data } = await api.get(`/chats/with/${profile._id}`);
        console.log('chat data:', data);
        if (data.chat) {
          // Sacar el 'other' de los participantes del chat
          const otherParticipant = data.chat.participants?.find(
            p => (p._id || p) !== profile._id
          ) || profile;
          navigation.navigate('ChatRoom', {
            chat: data.chat,
            other: { _id: profile._id, username: profile.username, avatarUrl: profile.avatarUrl }
          });
        } else {
          Alert.alert('Error', 'No se encontró el chat');
        }
      } catch (err) {
        console.error('error chat:', err.response?.data);
        Alert.alert('Error', err.response?.data?.error || 'No se pudo abrir el chat');
      }
      return;
    }

    if (chatStatus === 'requested') {
      navigation.navigate('ChatRoom', {
        chat: { _id: null, participants: [] },
        other: { _id: profile._id, username: profile.username, avatarUrl: profile.avatarUrl },
        requestMode: true,
        alreadyRequested: true,
      });
      return;
    }

    // Sin chat activo — abrir ChatRoom en modo "solicitud"
    navigation.navigate('ChatRoom', {
      chat: { _id: null, participants: [] },
      other: { _id: profile._id, username: profile.username, avatarUrl: profile.avatarUrl },
      requestMode: true,
    });
  }

  if (loading) return (
    <View style={s.root}>
      <ActivityIndicator color={colors.c1} style={{ marginTop: 80 }} />
    </View>
  );

  const isMe       = profile?._id === me._id;
  const daysSince  = Math.floor((Date.now() - new Date(profile?.createdAt)) / 86400000);

  function ChatButton() {
    if (chatStatus === 'active')     return <Text style={s.btnChatTxt}>💬 Chat</Text>;
    if (chatStatus === 'requested')  return <Text style={s.btnChatTxt}>⏳ Pendiente</Text>;
    return <Text style={s.btnChatTxt}>💬 Chatear</Text>;
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.black} />
      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={s.back}>←</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>{profile?.username}</Text>
          {!isMe ? (
            <TouchableOpacity onPress={handleBlock}>
              <Text style={s.blockTxt}>{blocked ? '🔓' : '🚫'}</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 32 }} />}
        </View>
      </SafeAreaView>

      <ScrollView>
        <LinearGradient colors={['rgba(0,110,100,0.25)','rgba(2,5,9,1)']} style={s.hero}>
          <LinearGradient colors={['#00e5cc','#2979ff']} style={s.avatarRing}>
            <View style={s.avatar}>
              {profile?.avatarUrl ? (
                <Image source={{ uri: profile.avatarUrl }} style={s.avatarImg} />
              ) : (
                <Text style={s.avatarTxt}>{profile?.username?.[0]?.toUpperCase()}</Text>
              )}
            </View>
          </LinearGradient>

          <Text style={s.username}>{profile?.username}</Text>

          <View style={s.followStats}>
            <TouchableOpacity style={s.followStat} onPress={() => navigation.navigate('FollowList', { username: profile?.username, type: 'following' })}>
              <Text style={s.followNum}>{profile?.following?.length || 0}</Text>
              <Text style={s.followLbl}>siguiendo</Text>
            </TouchableOpacity>
            <View style={s.followDiv} />
            <View style={s.followStat}>
              <Text style={[s.followNum, { color: colors.c1 }]}>{profile?.xp || 0}</Text>
              <Text style={s.followLbl}>XP</Text>
            </View>
            <View style={s.followDiv} />
            <TouchableOpacity style={s.followStat} onPress={() => navigation.navigate('FollowList', { username: profile?.username, type: 'followers' })}>
              <Text style={s.followNum}>{profile?.followers?.length || 0}</Text>
              <Text style={s.followLbl}>seguidores</Text>
            </TouchableOpacity>
          </View>

          {!isMe && !blocked && (
            <View style={s.actionRow}>
              <TouchableOpacity onPress={handleFollow} disabled={loadingBtn} style={{ flex: 1 }}>
                {following ? (
                  <View style={s.btnUnfollow}>
                    <Text style={s.btnUnfollowTxt}>{loadingBtn ? '...' : '✓ Siguiendo'}</Text>
                  </View>
                ) : (
                  <LinearGradient colors={['#006b63','#00e5cc']} style={s.btnFollow} start={{x:0,y:0}} end={{x:1,y:0}}>
                    <Text style={s.btnFollowTxt}>{loadingBtn ? '...' : '+ Seguir'}</Text>
                  </LinearGradient>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={s.btnChat} onPress={handleChat}>
                <ChatButton />
              </TouchableOpacity>
            </View>
          )}

          {blocked && (
            <View style={s.blockedBanner}>
              <Text style={s.blockedTxt}>Usuario bloqueado</Text>
            </View>
          )}
        </LinearGradient>

        <View style={s.statsRow}>
          <View style={s.stat}>
            <Text style={s.statVal}>{daysSince}</Text>
            <Text style={s.statLbl}>DÍAS</Text>
          </View>
          <View style={s.statDiv} />
          <View style={s.stat}>
            <Text style={s.statVal}>{profile?.badges?.length || 0}</Text>
            <Text style={s.statLbl}>BADGES</Text>
          </View>
          <View style={s.statDiv} />
          <View style={s.stat}>
            <Text style={s.statVal}>{profile?.xp || 0}</Text>
            <Text style={s.statLbl}>XP TOTAL</Text>
          </View>
        </View>

        {profile?.badges?.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>EMBLEMAS</Text>
            <View style={s.badgesGrid}>
              {profile.badges.map((b, i) => (
                <View key={i} style={s.badgeCard}>
                  <Text style={s.badgeIcon}>{b.icon}</Text>
                  <Text style={s.badgeName}>{b.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.black },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  back:        { color: colors.c1, fontSize: 22 },
  headerTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 4, color: colors.c1 },
  blockTxt:    { fontSize: 20 },
  hero:        { alignItems: 'center', padding: 32, paddingTop: 24 },
  avatarRing:  { padding: 3, borderRadius: 55, marginBottom: 14 },
  avatar: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.black, overflow: 'hidden',
  },
  avatarImg:  { width: 90, height: 90, borderRadius: 45 },
  avatarTxt:  { color: colors.c1, fontSize: 36, fontWeight: 'bold' },
  username:   { color: colors.textHi, fontSize: 22, fontWeight: '700', marginBottom: 16 },
  followStats:{ flexDirection: 'row', alignItems: 'center', gap: 24, marginBottom: 20 },
  followStat: { alignItems: 'center' },
  followNum:  { color: colors.textHi, fontSize: 20, fontWeight: '700' },
  followLbl:  { color: colors.textDim, fontSize: 10, marginTop: 2 },
  followDiv:  { width: 1, height: 30, backgroundColor: colors.border },
  actionRow:  { flexDirection: 'row', gap: 12, width: '100%' },
  btnFollow:  { borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  btnFollowTxt:   { color: '#001a18', fontWeight: '700', fontSize: 14, letterSpacing: 1 },
  btnUnfollow:    { borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.borderC },
  btnUnfollowTxt: { color: colors.c1, fontWeight: '700', fontSize: 14 },
  btnChat:    { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  btnChatTxt: { color: colors.textMid, fontSize: 14 },
  blockedBanner: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  blockedTxt: { color: 'rgba(239,68,68,0.7)', fontSize: 13 },
  statsRow:   { flexDirection: 'row', margin: 16, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16 },
  stat:       { flex: 1, alignItems: 'center' },
  statVal:    { color: colors.textHi, fontSize: 20, fontWeight: '700' },
  statLbl:    { color: colors.textDim, fontSize: 8, letterSpacing: 2, marginTop: 3 },
  statDiv:    { width: 1, backgroundColor: colors.border },
  section:    { marginHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 9, letterSpacing: 3, color: colors.textDim, marginBottom: 12 },
  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeCard:  { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.borderC, padding: 12, alignItems: 'center', minWidth: 80 },
  badgeIcon:  { fontSize: 24, marginBottom: 4 },
  badgeName:  { color: colors.c1, fontSize: 10, textAlign: 'center' },
});
