import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AvatarWithFrame from './AvatarWithFrame';
import { colors } from '../theme/colors';

/**
 * SharedProfileBubble
 * Muestra un perfil compartido dentro de un chat o grupo.
 * Props:
 *   sharedProfile — objeto con userId, username, avatarUrl, xp, followersCount, profileFrame, profileFrameUrl
 *   navigation    — nav object para navegar a PublicProfile
 *   isMe          — bool para estilo de burbuja
 *   onLongPress   — callback para menú de opciones
 */
export default function SharedProfileBubble({ sharedProfile, navigation, isMe, onLongPress }) {
  if (!sharedProfile?.username) return null;

  const bgColor   = 'rgba(13,29,46,0.9)';
  const borderCol = 'rgba(255,255,255,0.08)';

  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('PublicProfile', { username: sharedProfile.username })}
      onLongPress={onLongPress}
      activeOpacity={0.82}
      style={[s.card, { backgroundColor: bgColor, borderColor: borderCol }]}
    >
      {/* Header */}
      <View style={s.header}>
        <View style={s.accentBar} />
        <Text style={s.headerTxt}>Perfil compartido</Text>
        <Ionicons name="open-outline" size={13} color="rgba(0,229,204,0.5)" />
      </View>

      {/* Contenido */}
      <View style={s.body}>
        <AvatarWithFrame
          size={44}
          avatarUrl={sharedProfile.avatarUrl}
          username={sharedProfile.username}
          profileFrame={sharedProfile.profileFrame}
          frameUrl={sharedProfile.profileFrameUrl}
        />
        <View style={{ flex:1, gap:3 }}>
          <Text style={s.username}>{sharedProfile.username}</Text>
          <View style={s.statsRow}>
            {sharedProfile.xp > 0 && (
              <View style={s.statPill}>
                <Ionicons name="star-outline" size={10} color="rgba(0,229,204,0.7)" />
                <Text style={s.statTxt}>XP {sharedProfile.xp}</Text>
              </View>
            )}
            {sharedProfile.followersCount > 0 && (
              <View style={s.statPill}>
                <Ionicons name="people-outline" size={10} color="rgba(0,229,204,0.7)" />
                <Text style={s.statTxt}>{sharedProfile.followersCount}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={s.footer}>
        <Ionicons name="arrow-forward-circle-outline" size={12} color="rgba(0,229,204,0.45)" />
        <Text style={s.footerTxt}>Ver perfil completo</Text>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius:14, borderWidth:1, overflow:'hidden',
    width:224, marginBottom:4,
  },
  header: {
    flexDirection:'row', alignItems:'center',
    paddingHorizontal:10, paddingVertical:9, gap:7,
    borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.06)',
  },
  accentBar: { width:2, height:16, backgroundColor:'#00e5cc', borderRadius:1 },
  headerTxt: { color:'rgba(0,229,204,0.7)', fontSize:10, fontWeight:'700', letterSpacing:0.5, flex:1 },
  body: {
    flexDirection:'row', alignItems:'center',
    paddingHorizontal:10, paddingVertical:12, gap:10,
  },
  username: { color:'#e8f4f8', fontSize:14, fontWeight:'700' },
  statsRow: { flexDirection:'row', gap:6, flexWrap:'wrap' },
  statPill: {
    flexDirection:'row', alignItems:'center', gap:3,
    backgroundColor:'rgba(0,229,204,0.08)',
    borderRadius:8, paddingHorizontal:6, paddingVertical:2,
  },
  statTxt: { color:'rgba(0,229,204,0.7)', fontSize:10, fontWeight:'600' },
  footer: {
    flexDirection:'row', alignItems:'center', gap:4,
    paddingHorizontal:10, paddingBottom:8,
  },
  footerTxt: { color:'rgba(0,229,204,0.45)', fontSize:10, fontWeight:'600' },
});
