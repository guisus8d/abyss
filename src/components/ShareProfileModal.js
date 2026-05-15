import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput,
  FlatList, ActivityIndicator, StyleSheet, Platform,
  Share, ScrollView, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AvatarWithFrame from './AvatarWithFrame';
import api from '../services/api';

const C = {
  bg:'#060e18', card:'#0b1521', surface:'#0d1d2e',
  border:'rgba(255,255,255,0.07)',
  accent:'#00e5cc', accentDim:'rgba(0,229,204,0.10)', accentBorder:'rgba(0,229,204,0.25)',
  textHi:'#e8f4f8', textMid:'rgba(232,244,248,0.65)', textDim:'rgba(232,244,248,0.32)',
  success:'#22c55e', successDim:'rgba(34,197,94,0.12)',
};

function getInitials(u) { return (u||'?').slice(0,2).toUpperCase(); }

function PlainAvatar({ size=40, avatarUrl, username }) {
  const [err, setErr] = useState(false);
  if (avatarUrl && !err) return <Image source={{ uri:avatarUrl }} style={{ width:size, height:size, borderRadius:size/2 }} onError={()=>setErr(true)} />;
  return (
    <View style={{ width:size, height:size, borderRadius:size/2, backgroundColor:'#0d2a3e', alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(0,229,204,0.2)' }}>
      <Text style={{ color:C.accent, fontSize:size*0.32, fontWeight:'700' }}>{getInitials(username)}</Text>
    </View>
  );
}

// Preview del perfil que se va a compartir
function ProfilePreviewCard({ profile }) {
  return (
    <View style={pp.card}>
      <View style={pp.accent} />
      <View style={pp.body}>
        <AvatarWithFrame size={44} avatarUrl={profile.avatarUrl} username={profile.username} profileFrame={profile.profileFrame} frameUrl={profile.profileFrameUrl} />
        <View style={{ flex:1, gap:3 }}>
          <Text style={pp.username}>{profile.username}</Text>
          <View style={{ flexDirection:'row', gap:8 }}>
            <Text style={pp.meta}>XP {profile.xp||0}</Text>
            <Text style={pp.meta}>{profile.followers?.length||0} seguidores</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const pp = StyleSheet.create({
  card:     { flexDirection:'row', backgroundColor:C.surface, borderRadius:12, borderWidth:1, borderColor:C.border, overflow:'hidden', marginHorizontal:16, marginBottom:14 },
  accent:   { width:3, backgroundColor:C.accent },
  body:     { flex:1, flexDirection:'row', alignItems:'center', padding:12, gap:12 },
  username: { color:C.textHi, fontSize:14, fontWeight:'700' },
  meta:     { color:C.textDim, fontSize:11 },
});

function FriendBubble({ user, sent, sending, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={sent || sending}
      style={{ alignItems:'center', justifyContent:'center', width:70, marginHorizontal:6 }}
    >
      <PlainAvatar size={48} avatarUrl={user.avatarUrl} username={user.username} />
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{ fontSize:11, color:'#ffffff', textAlign:'center', marginTop:6, width:66 }}
      >
        {user.username}
      </Text>
    </TouchableOpacity>
  );
}

function GroupRow({ group, sent, sending, onPress }) {
  return (
    <TouchableOpacity style={gr.row} onPress={onPress} activeOpacity={0.75} disabled={sent||sending}>
      <View style={gr.av}>
        {group.imageUrl
          ? <Image source={{ uri:group.imageUrl }} style={{ width:'100%', height:'100%', borderRadius:20 }} />
          : <Text style={{ color:C.accent, fontSize:14, fontWeight:'700' }}>{getInitials(group.name)}</Text>}
      </View>
      <View style={{ flex:1 }}>
        <Text style={gr.name} numberOfLines={1}>{group.name}</Text>
        <Text style={gr.sub}>{group.members?.length||0} miembros</Text>
      </View>
    </TouchableOpacity>
  );
}

const gr = StyleSheet.create({
  row:     { flexDirection:'row', alignItems:'center', gap:10, paddingVertical:6, borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.04)' },
  av:      { width:40, height:40, borderRadius:20, backgroundColor:'#0d2a3e', alignItems:'center', justifyContent:'center', overflow:'hidden' },
  name:    { color:C.textHi, fontSize:13, fontWeight:'600' },
  sub:     { color:C.textDim, fontSize:11, marginTop:1 },
  btn:     { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:12, paddingVertical:7, borderRadius:10, backgroundColor:C.accentDim, borderWidth:1, borderColor:C.accentBorder },
  btnDone: { backgroundColor:'rgba(34,197,94,0.08)', borderColor:'rgba(34,197,94,0.25)' },
  btnTxt:  { color:C.accent, fontSize:11, fontWeight:'700' },
});

export default function ShareProfileModal({ visible, onClose, profile, currentUserId }) {
  const insets = useSafeAreaInsets();
  const [friends,     setFriends]     = useState([]);
  const [groups,      setGroups]      = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [groupQuery,  setGroupQuery]  = useState('');
  const [sentMap,     setSentMap]     = useState({});
  const [sendingMap,  setSendingMap]  = useState({});
  const [linkCopied,    setLinkCopied]    = useState(false);
  const [showSearch,    setShowSearch]    = useState(false);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const profileUrl = `https://abyss.social/user/${profile?.username}`;

  useEffect(() => {
    if (!visible) return;
    setSentMap({}); setSendingMap({}); setGroupQuery(''); setLinkCopied(false);
    setShowSearch(false); setSearchQuery(''); setSearchResults([]);
    setLoading(true);
    Promise.all([
      api.get('/chats').catch(() => ({ data: { chats: [] } })),
      api.get('/groups').catch(() => ({ data: { groups: [] } })),
    ]).then(([chatsRes, groupsRes]) => {
      const chats = chatsRes.data.chats || [];
      const extracted = chats.map(c => {
        const other = c.participants?.find(u => u._id?.toString() !== currentUserId?.toString());
        return other ? { ...other, chatId: c._id } : null;
      }).filter(Boolean);
      setFriends(extracted);
      setGroups(groupsRes.data?.groups || []);
    }).finally(() => setLoading(false));
  }, [visible]);

  // Payload del perfil a compartir
  const profilePayload = {
    userId:          profile?._id,
    username:        profile?.username        || '',
    avatarUrl:       profile?.avatarUrl       || null,
    xp:              profile?.xp              || 0,
    followersCount:  profile?.followers?.length || 0,
    profileFrame:    profile?.profileFrame    || null,
    profileFrameUrl: profile?.profileFrameUrl || null,
  };

  async function sendToFriend(friend) {
    const key = `friend_${friend._id}`;
    if (sendingMap[key] || sentMap[key] || !friend.chatId) return;
    setSendingMap(p => ({ ...p, [key]:true }));
    try {
      await api.post(`/chats/${friend.chatId}/share-profile`, profilePayload);
      setSentMap(p => ({ ...p, [key]:true }));
      setTimeout(() => onClose(), 700);
    } catch (e) { console.log('sendToFriend profile error:', e.message); }
    finally { setSendingMap(p => ({ ...p, [key]:false })); }
  }

  async function sendToGroup(group) {
    const key = `group_${group._id}`;
    if (sendingMap[key] || sentMap[key]) return;
    setSendingMap(p => ({ ...p, [key]:true }));
    try {
      await api.post(`/groups/${group._id}/share-profile`, profilePayload);
      setSentMap(p => ({ ...p, [key]:true }));
      setTimeout(() => onClose(), 700);
    } catch (e) { console.log('sendToGroup profile error:', e.message); }
    finally { setSendingMap(p => ({ ...p, [key]:false })); }
  }

  const handleSearchFriend = useCallback((q) => {
    setSearchQuery(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    const ql = q.trim().toLowerCase();
    setSearchResults(friends.filter(f => f.username?.toLowerCase().includes(ql)));
  }, [friends]);

  async function handleCopyLink() {
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(profileUrl);
      } else {
        const { Clipboard } = require('react-native');
        Clipboard.setString(profileUrl);
      }
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    } catch {}
  }

  async function handleNativeShare() {
    try {
      await Share.share({
        message: `Mira el perfil de @${profile?.username} en Abyss: ${profileUrl}`,
        url:     profileUrl,
      });
    } catch {}
  }

  const filteredGroups = groupQuery.trim().length > 0
    ? groups.filter(g => g.name?.toLowerCase().includes(groupQuery.toLowerCase()))
    : groups;

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={s.handle} />
          <View style={s.header}>
            <Text style={s.headerTitle}>Compartir perfil</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={18} color={C.textDim} />
            </TouchableOpacity>
          </View>

          {/* Preview del perfil */}
          {profile && <ProfilePreviewCard profile={profile} />}

          {/* Amigos */}
          <View style={s.sectionRow}><Text style={s.sectionLabel}>Amigos</Text></View>
          {loading ? (
            <ActivityIndicator color={C.accent} style={{ marginVertical:16 }} />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ paddingVertical:8 }}
              contentContainerStyle={{ paddingHorizontal:12, alignItems:'flex-start', gap:4 }}
            >
              {friends.slice(0, 5).map((f, i) => (
                <FriendBubble key={`f_${f._id}_${i}`} user={f} sent={!!sentMap[`friend_${f._id}`]} sending={!!sendingMap[`friend_${f._id}`]} onPress={() => sendToFriend(f)} />
              ))}
              <TouchableOpacity
                onPress={() => setShowSearch(true)}
                activeOpacity={0.75}
                style={{ alignItems:'center', justifyContent:'center', width:70, marginHorizontal:6 }}
              >
                <View style={s.plusCircle}>
                  <Ionicons name="add" size={24} color={C.accent} />
                </View>
                <Text style={{ fontSize:11, color:'#ffffff', textAlign:'center', marginTop:6, width:66 }}>
                  Buscar
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* Compartir externo */}
          <View style={s.divider} />
          <View style={s.sectionRow}><Text style={s.sectionLabel}>Compartir en</Text></View>
          <View style={s.platformsRow}>
            <TouchableOpacity style={[s.platformBtn, linkCopied && s.platformBtnDone]} onPress={handleCopyLink} activeOpacity={0.75}>
              <Ionicons name={linkCopied?'checkmark':'link-outline'} size={20} color={linkCopied?C.success:C.textMid} />
              <Text style={[s.platformTxt, linkCopied&&{color:C.success}]}>{linkCopied?'Copiado':'Copiar'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.platformBtn,{backgroundColor:'rgba(37,211,102,0.1)'}]} onPress={async()=>{const{Linking}=require('react-native');const msg=`Mira el perfil de @${profile?.username} en Abyss: ${profileUrl}`;Linking.openURL(`whatsapp://send?text=${encodeURIComponent(msg)}`).catch(()=>handleNativeShare())}} activeOpacity={0.75}>
              <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
              <Text style={[s.platformTxt,{color:'#25D366'}]}>WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.platformBtn,{backgroundColor:'rgba(255,255,255,0.06)'}]} onPress={handleNativeShare} activeOpacity={0.75}>
              <Ionicons name="share-outline" size={20} color={C.textMid} />
              <Text style={s.platformTxt}>Más</Text>
            </TouchableOpacity>
          </View>

          {/* Grupos */}
          <View style={s.divider} />
          <View style={s.sectionRow}><Text style={s.sectionLabel}>Grupos</Text></View>
          <View style={s.searchBar}>
            <Ionicons name="search-outline" size={14} color={C.textDim} style={{ marginLeft:10 }} />
            <TextInput style={s.searchInput} placeholder="Buscar grupo..." placeholderTextColor={C.textDim} value={groupQuery} onChangeText={setGroupQuery} />
          </View>
          <FlatList
            data={filteredGroups}
            keyExtractor={(item,i) => `g_${String(item._id||i)}_${i}`}
            style={{ maxHeight:200 }}
            contentContainerStyle={{ paddingHorizontal:16, paddingBottom:8 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={() => (
              <View style={s.empty}><Text style={s.emptyTxt}>{groups.length===0?'No perteneces a ningún grupo':'Sin resultados'}</Text></View>
            )}
            renderItem={({ item }) => (
              <GroupRow group={item} sent={!!sentMap[`group_${item._id}`]} sending={!!sendingMap[`group_${item._id}`]} onPress={() => sendToGroup(item)} />
            )}
          />
        </View>
      </View>

      {/* ── Modal buscar amigo (+) ── */}
      <Modal
        visible={showSearch}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSearch(false)}
      >
        <View style={s.overlay}>
          <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setShowSearch(false)} />
          <View style={[s.searchSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={s.handle} />
            <View style={s.header}>
              <Text style={s.headerTitle}>Buscar amigo</Text>
              <TouchableOpacity onPress={() => setShowSearch(false)} style={s.closeBtn}>
                <Ionicons name="close" size={18} color={C.textDim} />
              </TouchableOpacity>
            </View>
            <View style={[s.searchBar, { marginHorizontal:16, marginBottom:10 }]}>
              <Ionicons name="search-outline" size={14} color={C.textDim} style={{ marginLeft:10 }} />
              <TextInput
                style={s.searchInput}
                placeholder="Buscar usuario..."
                placeholderTextColor={C.textDim}
                value={searchQuery}
                onChangeText={handleSearchFriend}
                autoFocus
              />
            </View>
            <FlatList
              data={searchResults}
              keyExtractor={(item, i) => `search_${String(item._id || i)}_${i}`}
              style={{ maxHeight:300 }}
              contentContainerStyle={{ paddingHorizontal:16 }}
              ListEmptyComponent={() => (
                <View style={s.empty}>
                  <Text style={s.emptyTxt}>
                    {searchQuery.length >= 2 ? 'Sin resultados' : 'Escribe para buscar'}
                  </Text>
                </View>
              )}
              renderItem={({ item }) => {
                const key = `friend_${item._id}`;
                return (
                  <TouchableOpacity
                    style={[gr.row, { paddingHorizontal:0 }]}
                    onPress={async () => {
                      await sendToFriend(item);
                      if (!friends.find(f => f._id === item._id)) {
                        setFriends(prev => [item, ...prev]);
                      }
                    }}
                    activeOpacity={0.75}
                    disabled={!!sentMap[key] || !!sendingMap[key]}
                  >
                    <PlainAvatar size={40} avatarUrl={item.avatarUrl} username={item.username} />
                    <View style={{ flex:1, marginLeft:10 }}>
                      <Text style={gr.name}>{item.username}</Text>
                    </View>
                    {sendingMap[key] ? (
                      <ActivityIndicator size="small" color={C.accent} />
                    ) : (
                      <View style={[gr.btn, sentMap[key] && gr.btnDone]}>
                        <Ionicons name={sentMap[key] ? 'checkmark' : 'send-outline'} size={13} color={sentMap[key] ? C.success : C.accent} />
                        <Text style={[gr.btnTxt, sentMap[key] && { color: C.success }]}>
                          {sentMap[key] ? 'Enviado' : 'Enviar'}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:  { flex:1, justifyContent:'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(0,0,0,0.6)' },
  sheet:    { backgroundColor:C.bg, borderTopLeftRadius:24, borderTopRightRadius:24, borderTopWidth:1, borderLeftWidth:1, borderRightWidth:1, borderColor:'rgba(0,229,204,0.12)', maxHeight:'92%', paddingTop:12 },
  searchSheet: { backgroundColor:C.bg, borderTopLeftRadius:24, borderTopRightRadius:24, borderTopWidth:1, borderLeftWidth:1, borderRightWidth:1, borderColor:'rgba(0,229,204,0.12)', paddingTop:12 },
  plusCircle: { width:48, height:48, borderRadius:24, backgroundColor:'rgba(0,229,204,0.07)', borderWidth:1.5, borderStyle:'dashed', borderColor:'rgba(0,229,204,0.35)', alignItems:'center', justifyContent:'center' },
  handle:   { width:40, height:4, backgroundColor:'rgba(255,255,255,0.12)', borderRadius:2, alignSelf:'center', marginBottom:14 },
  header:   { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, marginBottom:14 },
  headerTitle: { color:C.textHi, fontSize:17, fontWeight:'700' },
  closeBtn: { width:32, height:32, borderRadius:16, backgroundColor:'rgba(255,255,255,0.07)', alignItems:'center', justifyContent:'center' },
  sectionRow:   { paddingHorizontal:16, marginBottom:10 },
  sectionLabel: { color:C.textDim, fontSize:11, fontWeight:'700', letterSpacing:0.8, textTransform:'uppercase' },
  friendsRow:   { paddingHorizontal:8, gap:6, paddingBottom:8, alignItems:'flex-start', paddingTop:4 },
  divider:      { height:1, backgroundColor:'rgba(255,255,255,0.05)', marginHorizontal:16, marginVertical:14 },
  platformsRow: { flexDirection:'row', paddingHorizontal:16, gap:8, marginBottom:4 },
  platformBtn:  { flex:1, alignItems:'center', gap:5, paddingVertical:10, borderRadius:12, backgroundColor:'rgba(255,255,255,0.05)', borderWidth:1, borderColor:C.border },
  platformBtnDone: { backgroundColor:'rgba(34,197,94,0.08)', borderColor:'rgba(34,197,94,0.25)' },
  platformTxt:  { color:C.textMid, fontSize:10, fontWeight:'600' },
  searchBar:    { flexDirection:'row', alignItems:'center', backgroundColor:C.surface, borderRadius:12, borderWidth:1, borderColor:C.border, marginHorizontal:16, marginBottom:8 },
  searchInput:  { flex:1, paddingVertical:10, paddingHorizontal:8, color:C.textHi, fontSize:13, ...(Platform.OS==='web'?{outlineStyle:'none'}:{}) },
  empty:        { paddingVertical:24, alignItems:'center' },
  emptyTxt:     { color:C.textDim, fontSize:12 },
});
