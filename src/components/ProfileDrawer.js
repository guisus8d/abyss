import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Animated, TouchableOpacity, TouchableWithoutFeedback,
  StyleSheet, Dimensions, ScrollView, Alert, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import api from '../services/api';
import AvatarWithFrame from './AvatarWithFrame';
import * as ImagePicker from 'expo-image-picker';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(width * 0.78, 320);

function timeAgo(date) {
  if (!date) return null;
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60)   return 'activo ahora';
  if (diff < 3600) return `activo hace ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `activo hace ${Math.floor(diff / 3600)}h`;
  return `activo hace ${Math.floor(diff / 86400)}d`;
}

export default function ProfileDrawer({ visible, onClose, user, onLogout, onNavigate, onAvatarUpdate }) {
  const insets     = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const [rendered,  setRendered]  = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || null);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.parallel([
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, { toValue: -DRAWER_WIDTH, duration: 260, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]).start(() => setRendered(false));
    }
  }, [visible]);

  async function handlePickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (result.canceled) return;
    setUploading(true);
    try {
      const asset = result.assets[0];
      const formData = new FormData();
      if (asset.uri.startsWith('data:') || asset.uri.startsWith('blob:') || asset.uri.startsWith('http')) {
        const blob = await fetch(asset.uri).then(r => r.blob());
        formData.append('avatar', blob, 'avatar.jpg');
      } else {
        formData.append('avatar', { uri: asset.uri, type: 'image/jpeg', name: 'avatar.jpg' });
      }
      const { data } = await api.post('/users/me/avatar', formData);
      setAvatarUrl(data.avatarUrl);
      if (onAvatarUpdate) onAvatarUpdate(data.user);
    } catch {
      Alert.alert('Error', 'No se pudo subir la imagen');
    } finally {
      setUploading(false);
    }
  }

  if (!rendered) return null;

  const xp       = user?.xp || 0;
  const level    = Math.floor(xp / 500) + 1;
  const xpInLevel = xp % 500;
  const xpPct    = xpInLevel / 500;
  const followers = user?.followers?.length ?? 0;
  const following = user?.following?.length ?? 0;
  const coins     = user?.coins ?? 0;
  const activity  = timeAgo(user?.lastActive);
  const isMod     = user?.role === 'mod' || user?.role === 'admin';

  return (
    <View style={s.root}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[s.overlay, { opacity }]} />
      </TouchableWithoutFeedback>

      <Animated.View style={[s.drawer, { transform: [{ translateX }] }]}>
        <ScrollView showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>

          {/* ── HEADER ── */}
          <View style={[s.header, { paddingTop: insets.top + 20 }]}>
            <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={colors.textDim} />
            </TouchableOpacity>

            <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.85} style={s.avatarWrap}>
              <AvatarWithFrame
                size={72}
                avatarUrl={avatarUrl}
                username={user?.username}
                profileFrame={user?.profileFrame}
                frameUrl={user?.profileFrameUrl}
              />
              <View style={s.cameraBtn}>
                <Ionicons name={uploading ? 'time-outline' : 'camera'} size={11} color={colors.textMid} />
              </View>
            </TouchableOpacity>

            <Text style={s.username}>{user?.username}</Text>
            {activity && (
              <View style={s.activityRow}>
                <View style={s.activeDot} />
                <Text style={s.activityTxt}>{activity}</Text>
              </View>
            )}
          </View>

          {/* ── STATS ── */}
          <View style={s.statsCard}>
            <View style={s.statItem}>
              <Text style={s.statVal}>{followers}</Text>
              <Text style={s.statLbl}>Seguidores</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statVal}>{following}</Text>
              <Text style={s.statLbl}>Siguiendo</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statVal}>{xp}</Text>
              <Text style={s.statLbl}>XP</Text>
            </View>
          </View>

          {/* ── XP / NIVEL ── */}
          <View style={s.card}>
            <View style={s.cardRow}>
              <View style={s.levelBadge}>
                <Text style={s.levelBadgeTxt}>{level}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.levelHeaderRow}>
                  <Text style={s.levelTxt}>Nivel {level}</Text>
                  <Text style={s.xpTxt}>{xpInLevel} / 500 XP</Text>
                </View>
                <View style={s.progressBg}>
                  <Animated.View style={[s.progressFill, { width: `${Math.round(xpPct * 100)}%` }]} />
                </View>
              </View>
            </View>
          </View>

          {/* ── MONEDAS ── */}
          <View style={s.card}>
            <View style={s.cardRow}>
              <View style={s.coinCircle}>
                <Text style={s.coinStar}>✦</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardLabel}>Monedas</Text>
                <Text style={s.coinAmt}>{coins}</Text>
              </View>
            </View>
          </View>

          {/* ── MENÚ ── */}
          <View style={s.menuSection}>
            <Text style={s.menuSectionTitle}>MENÚ</Text>

            <TouchableOpacity style={s.menuItem} onPress={() => { onClose(); onNavigate('Profile'); }} activeOpacity={0.7}>
              <View style={[s.menuIcon, { backgroundColor: 'rgba(0,229,204,0.08)' }]}>
                <Ionicons name="person-outline" size={16} color={colors.c1} />
              </View>
              <Text style={s.menuTxt}>Mi Perfil</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textDim} />
            </TouchableOpacity>

            <TouchableOpacity style={s.menuItem} onPress={() => { onClose(); onNavigate('Notifications'); }} activeOpacity={0.7}>
              <View style={[s.menuIcon, { backgroundColor: 'rgba(41,121,255,0.08)' }]}>
                <Ionicons name="notifications-outline" size={16} color={colors.c2} />
              </View>
              <Text style={s.menuTxt}>Notificaciones</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textDim} />
            </TouchableOpacity>

            <TouchableOpacity style={s.menuItem} onPress={() => { onClose(); onNavigate('Settings'); }} activeOpacity={0.7}>
              <View style={[s.menuIcon, { backgroundColor: 'rgba(122,154,184,0.08)' }]}>
                <Ionicons name="settings-outline" size={16} color={colors.textMid} />
              </View>
              <Text style={s.menuTxt}>Ajustes</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textDim} />
            </TouchableOpacity>

            {isMod && (
              <TouchableOpacity style={s.menuItem} onPress={() => { onClose(); onNavigate('ModPanel'); }} activeOpacity={0.7}>
                <View style={[s.menuIcon, { backgroundColor: 'rgba(251,191,36,0.08)' }]}>
                  <Ionicons name="shield-checkmark-outline" size={16} color="rgba(251,191,36,1)" />
                </View>
                <Text style={[s.menuTxt, { color: 'rgba(251,191,36,0.9)' }]}>Moderación</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textDim} />
              </TouchableOpacity>
            )}
          </View>

          {/* ── CERRAR SESIÓN ── */}
          <TouchableOpacity style={s.logoutBtn} onPress={onLogout} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={16} color="rgba(239,68,68,0.8)" />
            <Text style={s.logoutTxt}>Cerrar sesión</Text>
          </TouchableOpacity>

        </ScrollView>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { position:'absolute', top:0, left:0, right:0, bottom:0, zIndex:999 },
  overlay: { position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.65)' },
  drawer:  { position:'absolute', top:0, left:0, bottom:0, width:DRAWER_WIDTH, backgroundColor:colors.deep, borderRightWidth:1, borderRightColor:colors.border },

  // Header
  header:     { paddingHorizontal:20, paddingBottom:20, alignItems:'center' },
  closeBtn:   { position:'absolute', top:16, right:14, width:32, height:32, alignItems:'center', justifyContent:'center', backgroundColor:'rgba(255,255,255,0.05)', borderRadius:16 },
  avatarWrap: { position:'relative', marginBottom:12 },
  cameraBtn:  { position:'absolute', bottom:2, right:0, width:22, height:22, borderRadius:11, backgroundColor:colors.card, borderWidth:1, borderColor:colors.borderC, alignItems:'center', justifyContent:'center' },
  username:   { color:colors.textHi, fontSize:17, fontWeight:'800', letterSpacing:0.2, marginBottom:5 },
  activityRow:{ flexDirection:'row', alignItems:'center', gap:5 },
  activeDot:  { width:6, height:6, borderRadius:3, backgroundColor:'#22c55e' },
  activityTxt:{ color:colors.textMid, fontSize:11 },

  // Stats
  statsCard:    { flexDirection:'row', marginHorizontal:14, marginBottom:10, backgroundColor:colors.card, borderRadius:14, borderWidth:1, borderColor:colors.border, paddingVertical:14 },
  statItem:     { flex:1, alignItems:'center' },
  statVal:      { color:colors.textHi, fontSize:17, fontWeight:'800' },
  statLbl:      { color:colors.textDim, fontSize:9, letterSpacing:0.5, marginTop:2 },
  statDivider:  { width:1, backgroundColor:colors.border, marginVertical:4 },

  // Cards
  card:      { marginHorizontal:14, marginBottom:10, backgroundColor:colors.card, borderRadius:14, borderWidth:1, borderColor:colors.border, padding:14 },
  cardRow:   { flexDirection:'row', alignItems:'center', gap:12 },
  cardLabel: { color:colors.textDim, fontSize:9, letterSpacing:0.8, textTransform:'uppercase', marginBottom:2 },

  // Nivel
  levelBadge:      { width:38, height:38, borderRadius:19, backgroundColor:'rgba(0,229,204,0.12)', borderWidth:1.5, borderColor:'rgba(0,229,204,0.35)', alignItems:'center', justifyContent:'center' },
  levelBadgeTxt:   { color:colors.c1, fontSize:15, fontWeight:'900' },
  levelHeaderRow:  { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:6 },
  levelTxt:        { color:colors.textHi, fontSize:12, fontWeight:'700' },
  xpTxt:           { color:colors.textDim, fontSize:10 },
  progressBg:      { height:5, backgroundColor:'rgba(255,255,255,0.06)', borderRadius:3, overflow:'hidden' },
  progressFill:    { height:'100%', backgroundColor:colors.c1, borderRadius:3 },

  // Monedas
  coinCircle: { width:38, height:38, borderRadius:19, backgroundColor:'rgba(251,191,36,0.1)', borderWidth:1.5, borderColor:'rgba(251,191,36,0.3)', alignItems:'center', justifyContent:'center' },
  coinStar:   { fontSize:14, color:'rgba(251,191,36,1)' },
  coinAmt:    { color:'rgba(251,191,36,1)', fontSize:17, fontWeight:'800' },

  // Menú
  menuSection:      { marginHorizontal:14, marginBottom:10 },
  menuSectionTitle: { fontSize:8, letterSpacing:3, color:colors.textDim, marginBottom:8, marginLeft:2 },
  menuItem:         { flexDirection:'row', alignItems:'center', gap:12, paddingVertical:11, borderBottomWidth:1, borderBottomColor:colors.border },
  menuIcon:         { width:32, height:32, borderRadius:10, alignItems:'center', justifyContent:'center' },
  menuTxt:          { flex:1, color:colors.textMid, fontSize:13, fontWeight:'500' },

  // Logout
  logoutBtn: { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, marginHorizontal:14, marginTop:4, paddingVertical:13, borderRadius:12, borderWidth:1, borderColor:'rgba(239,68,68,0.25)', backgroundColor:'rgba(239,68,68,0.05)' },
  logoutTxt: { color:'rgba(239,68,68,0.8)', fontSize:13, fontWeight:'600', letterSpacing:0.3 },
});
