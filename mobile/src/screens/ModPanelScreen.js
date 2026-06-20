import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView,
  FlatList, TextInput, Image, ActivityIndicator, Modal, Pressable, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import api from '../services/api';

const ROLE_COLORS = {
  admin: { bg:'rgba(239,68,68,0.15)',    border:'rgba(239,68,68,0.4)',    text:'#ef4444',              label:'ADMIN' },
  mod:   { bg:'rgba(251,191,36,0.15)',   border:'rgba(251,191,36,0.4)',   text:'rgba(251,191,36,1)',   label:'MOD'   },
  user:  { bg:'rgba(255,255,255,0.04)',  border: colors.border,           text: colors.textDim,        label:'USER'  },
};

const REPORT_REASONS = {
  spam:           '🚫 Spam',
  hate:           '🔥 Odio',
  harassment:     '😰 Acoso',
  violence:       '⚠️ Violencia',
  nsfw:           '🔞 NSFW',
  misinformation: '📰 Desinformación',
  other:          '💬 Otro',
};

const TYPE_COLORS = {
  post:  { bg:'rgba(0,229,204,0.1)',   border:'rgba(0,229,204,0.3)',  text:'#00e5cc',          label:'POST'   },
  user:  { bg:'rgba(251,191,36,0.1)',  border:'rgba(251,191,36,0.3)', text:'rgba(251,191,36,1)', label:'USUARIO' },
  group: { bg:'rgba(139,92,246,0.1)',  border:'rgba(139,92,246,0.3)', text:'rgba(167,139,250,1)', label:'GRUPO' },
};

export default function ModPanelScreen({ navigation, route }) {
  const { currentUser } = route.params || {};
  const [activeTab, setActiveTab] = useState('reports'); // 'reports' | 'users'

  // ── Users state ───────────────────────────────────────────────────────────
  const [users,           setUsers]           = useState([]);
  const [usersLoading,    setUsersLoading]    = useState(false);
  const [usersLoadingMore,setUsersLoadingMore]= useState(false);
  const [usersPage,       setUsersPage]       = useState(1);
  const [usersHasMore,    setUsersHasMore]    = useState(false);
  const [usersTotal,      setUsersTotal]      = useState(0);
  const [usersBanned,     setUsersBanned]     = useState(0);
  const [usersMods,       setUsersMods]       = useState(0);
  const [hideBots,   setHideBots]   = useState(true);
  const [search,     setSearch]     = useState('');
  const [banModal,   setBanModal]   = useState(null);
  const [banReason,  setBanReason]  = useState('');
  const [acting,     setActing]     = useState(false);

  // ── Reports state ─────────────────────────────────────────────────────────
  const [reports,        setReports]        = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportFilter,   setReportFilter]   = useState('pending'); // pending | reviewed | dismissed | all
  const [selectedReport, setSelectedReport] = useState(null);
  const [modNotes,       setModNotes]       = useState('');
  const [reportStats,    setReportStats]    = useState({ pending:0, reviewed:0, dismissed:0 });

  useEffect(() => {
    if (activeTab === 'users')   loadUsers('', 1, hideBots);
    if (activeTab === 'reports') loadReports();
  }, [activeTab, reportFilter, hideBots]);

  // ─── Users ────────────────────────────────────────────────────────────────
  async function loadUsers(q = '', page = 1, bots = hideBots) {
    if (page === 1) setUsersLoading(true);
    else            setUsersLoadingMore(true);
    try {
      const params = new URLSearchParams({ page, limit: 20, hideBots: bots ? 'true' : 'false' });
      if (q) params.set('q', q);
      const { data } = await api.get(`/users/mod/users?${params}`);
      setUsers(prev => page === 1 ? (data.users || []) : [...prev, ...(data.users || [])]);
      setUsersPage(data.page);
      setUsersHasMore(data.page < data.pages);
      setUsersTotal(data.total);
      setUsersBanned(data.totalBanned);
      setUsersMods(data.totalMods);
    } catch (err) { console.log('loadUsers error:', err.message); }
    finally {
      setUsersLoading(false);
      setUsersLoadingMore(false);
    }
  }

  function loadMoreUsers() {
    if (usersLoadingMore || !usersHasMore) return;
    loadUsers(search, usersPage + 1, hideBots);
  }

  async function handleBan(user) {
    if (!banReason.trim()) return;
    setActing(true);
    try {
      await api.post(`/users/mod/ban/${user._id}`, { reason: banReason });
      setBanModal(null); setBanReason('');
      loadUsers(search, 1, hideBots);
    } catch (err) { console.log('ban error:', err.message); }
    finally { setActing(false); }
  }

  async function handleUnban(userId) {
    try {
      await api.post(`/users/mod/unban/${userId}`);
      loadUsers(search, 1, hideBots);
    } catch (err) { console.log('unban error:', err.message); }
  }

  async function handleSetRole(userId, role) {
    try {
      await api.post(`/users/mod/setrole/${userId}`, { role });
      loadUsers(search, 1, hideBots);
    } catch (err) { console.log('setrole error:', err.message); }
  }

  // ─── Reports ──────────────────────────────────────────────────────────────
  async function loadReports() {
    setReportsLoading(true);
    try {
      const { data } = await api.get(`/reports?status=${reportFilter}`);
      setReports(data.reports || []);
      setReportStats({ pending: data.pending, reviewed: data.reviewed, dismissed: data.dismissed });
    } catch (err) { console.log('loadReports error:', err.message); }
    finally { setReportsLoading(false); }
  }

  async function handleResolve(reportId, status) {
    try {
      await api.patch(`/reports/${reportId}`, { status, modNotes });
      setSelectedReport(null);
      setModNotes('');
      loadReports();
    } catch (err) { console.log('resolve error:', err.message); }
  }

  const userStats = { total: usersTotal, banned: usersBanned, mods: usersMods };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      {/* ── Modal detalle reporte ── */}
      <Modal visible={!!selectedReport} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setSelectedReport(null)}>
        <Pressable style={s.modalOverlay} onPress={() => setSelectedReport(null)}>
          <Pressable style={s.reportDetailBox} onPress={e => e.stopPropagation()}>
            {selectedReport && (() => {
              const tc = TYPE_COLORS[selectedReport.type] || TYPE_COLORS.post;
              return (
                <>
                  <View style={s.reportDetailHeader}>
                    <View style={[s.typeBadge, { backgroundColor: tc.bg, borderColor: tc.border }]}>
                      <Text style={[s.typeBadgeTxt, { color: tc.text }]}>{tc.label}</Text>
                    </View>
                    <Text style={s.reportDetailTarget} numberOfLines={1}>{selectedReport.targetName}</Text>
                    <TouchableOpacity onPress={() => setSelectedReport(null)} style={{ padding:4 }}>
                      <Ionicons name="close" size={20} color={colors.textDim} />
                    </TouchableOpacity>
                  </View>

                  <View style={s.reportDetailRow}>
                    <Text style={s.reportDetailLbl}>Reportado por</Text>
                    <Text style={s.reportDetailVal}>{selectedReport.reporter?.username}</Text>
                  </View>
                  <View style={s.reportDetailRow}>
                    <Text style={s.reportDetailLbl}>Motivo</Text>
                    <Text style={s.reportDetailVal}>{REPORT_REASONS[selectedReport.reason] || selectedReport.reason}</Text>
                  </View>
                  {!!selectedReport.details && (
                    <View style={s.reportDetailRow}>
                      <Text style={s.reportDetailLbl}>Detalles</Text>
                      <Text style={s.reportDetailVal}>{selectedReport.details}</Text>
                    </View>
                  )}
                  <View style={s.reportDetailRow}>
                    <Text style={s.reportDetailLbl}>Fecha</Text>
                    <Text style={s.reportDetailVal}>{new Date(selectedReport.createdAt).toLocaleDateString('es')}</Text>
                  </View>

                  {(selectedReport.type === 'post' || selectedReport.type === 'user') && (
                    <TouchableOpacity
                      style={s.viewLinkBtn}
                      onPress={async () => {
                        const url = selectedReport.type === 'post'
                          ? `https://abyss.social/post/${selectedReport.targetId}`
                          : `https://abyss.social/user/${selectedReport.targetName}`;
                        try { await Linking.openURL(url); } catch (e) { console.error('openURL:', e); }
                      }}
                    >
                      <Ionicons name="open-outline" size={14} color={colors.c1} />
                      <Text style={s.viewLinkTxt}>
                        Ver {selectedReport.type === 'post' ? 'post' : 'perfil'} en web
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TextInput
                    style={s.modNotesInput}
                    placeholder="Notas de moderación (opcional)..."
                    placeholderTextColor={colors.textDim}
                    value={modNotes}
                    onChangeText={setModNotes}
                    multiline
                  />

                  <View style={{ flexDirection:'row', gap:10, marginTop:16 }}>
                    <TouchableOpacity style={s.dismissBtn} onPress={() => handleResolve(selectedReport._id, 'dismissed')}>
                      <Ionicons name="close-circle-outline" size={16} color={colors.textDim} />
                      <Text style={[s.resolveBtn_txt, { color: colors.textDim }]}>Desestimar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.resolveBtn} onPress={() => handleResolve(selectedReport._id, 'reviewed')}>
                      <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                      <Text style={s.resolveBtn_txt}>Acción tomada</Text>
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Modal banear ── */}
      <Modal visible={!!banModal} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setBanModal(null)}>
        <View style={s.modalOverlay}>
          <View style={s.banModalBox}>
            <Text style={s.modalTitle}>BANEAR USUARIO</Text>
            <Text style={s.modalUser}>{banModal?.username}</Text>
            <TextInput
              style={s.modalInput}
              value={banReason}
              onChangeText={setBanReason}
              placeholder="Motivo del ban..."
              placeholderTextColor={colors.textDim}
              autoFocus
            />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setBanModal(null)}>
                <Text style={s.cancelBtnTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.banBtn} onPress={() => handleBan(banModal)} disabled={acting || !banReason.trim()}>
                {acting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.banBtnTxt}>Banear</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color="rgba(239,68,68,0.8)" />
          </TouchableOpacity>
          <View style={{ flex:1 }}>
            <Text style={s.headerTitle}>PANEL MOD</Text>
            <Text style={s.headerSub}>{currentUser?.username}</Text>
          </View>
          {/* Badge de reportes pendientes */}
          {reportStats.pending > 0 && (
            <View style={s.pendingBadge}>
              <Text style={s.pendingBadgeTxt}>{reportStats.pending}</Text>
            </View>
          )}
          <View style={s.modBadge}>
            <Ionicons name="shield-checkmark" size={16} color="rgba(251,191,36,1)" />
          </View>
        </View>

        {/* ── Tabs ── */}
        <View style={s.tabBar}>
          <TouchableOpacity style={[s.tabBtn, activeTab==='reports' && s.tabBtnActive]} onPress={() => setActiveTab('reports')}>
            <Ionicons name="flag-outline" size={16} color={activeTab==='reports' ? '#fff' : colors.textDim} />
            <Text style={[s.tabBtnTxt, activeTab==='reports' && s.tabBtnTxtActive]}>Reportes</Text>
            {reportStats.pending > 0 && (
              <View style={s.tabBadge}><Text style={s.tabBadgeTxt}>{reportStats.pending}</Text></View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={[s.tabBtn, activeTab==='users' && s.tabBtnActive]} onPress={() => setActiveTab('users')}>
            <Ionicons name="people-outline" size={16} color={activeTab==='users' ? '#fff' : colors.textDim} />
            <Text style={[s.tabBtnTxt, activeTab==='users' && s.tabBtnTxtActive]}>Usuarios</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ══════════════ TAB: REPORTES ══════════════ */}
      {activeTab === 'reports' && (
        <ScrollView style={{ backgroundColor: colors.black }} showsVerticalScrollIndicator={false}>
          {/* Stats */}
          <View style={s.statsRow}>
            <TouchableOpacity style={[s.statCard, reportFilter==='pending'   && s.statCardActive]} onPress={() => setReportFilter('pending')}>
              <Text style={[s.statVal, { color:'rgba(239,68,68,0.9)' }]}>{reportStats.pending}</Text>
              <Text style={s.statLbl}>PENDIENTES</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.statCard, reportFilter==='reviewed'  && s.statCardActive]} onPress={() => setReportFilter('reviewed')}>
              <Text style={[s.statVal, { color: colors.c1 }]}>{reportStats.reviewed}</Text>
              <Text style={s.statLbl}>REVISADOS</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.statCard, reportFilter==='dismissed' && s.statCardActive]} onPress={() => setReportFilter('dismissed')}>
              <Text style={[s.statVal, { color: colors.textDim }]}>{reportStats.dismissed}</Text>
              <Text style={s.statLbl}>DESESTIMADOS</Text>
            </TouchableOpacity>
          </View>

          {reportsLoading ? (
            <ActivityIndicator color={colors.c1} style={{ marginTop:40 }} />
          ) : reports.length === 0 ? (
            <View style={s.emptyState}>
              <Ionicons name="flag-outline" size={40} color={colors.textDim} />
              <Text style={s.emptyStateTxt}>Sin reportes {reportFilter === 'pending' ? 'pendientes' : reportFilter === 'reviewed' ? 'revisados' : 'desestimados'}</Text>
            </View>
          ) : reports.map(r => {
            const tc = TYPE_COLORS[r.type] || TYPE_COLORS.post;
            return (
              <TouchableOpacity key={r._id} style={s.reportRow} onPress={() => { setSelectedReport(r); setModNotes(r.modNotes || ''); }} activeOpacity={0.7}>
                <View style={[s.typeBadge, { backgroundColor: tc.bg, borderColor: tc.border }]}>
                  <Text style={[s.typeBadgeTxt, { color: tc.text }]}>{tc.label}</Text>
                </View>
                <View style={{ flex:1 }}>
                  <Text style={s.reportTarget} numberOfLines={1}>{r.targetName || r.targetId}</Text>
                  <Text style={s.reportMeta}>
                    {REPORT_REASONS[r.reason] || r.reason} · {r.reporter?.username} · {new Date(r.createdAt).toLocaleDateString('es')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
              </TouchableOpacity>
            );
          })}
          <View style={{ height:40 }} />
        </ScrollView>
      )}

      {/* ══════════════ TAB: USUARIOS ══════════════ */}
      {activeTab === 'users' && (
        <FlatList
          style={{ backgroundColor: colors.black }}
          data={users}
          keyExtractor={u => u._id}
          onEndReached={loadMoreUsers}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 90 }}
          ListHeaderComponent={
            <>
              {/* Stats */}
              <View style={s.statsRow}>
                <View style={s.statCard}>
                  <Text style={s.statVal}>{userStats.total}</Text>
                  <Text style={s.statLbl}>USUARIOS</Text>
                </View>
                <View style={[s.statCard, { borderColor:'rgba(239,68,68,0.3)' }]}>
                  <Text style={[s.statVal, { color:'rgba(239,68,68,0.8)' }]}>{userStats.banned}</Text>
                  <Text style={s.statLbl}>BANEADOS</Text>
                </View>
                <View style={[s.statCard, { borderColor:'rgba(251,191,36,0.3)' }]}>
                  <Text style={[s.statVal, { color:'rgba(251,191,36,1)' }]}>{userStats.mods}</Text>
                  <Text style={s.statLbl}>MODS</Text>
                </View>
              </View>

              {/* Buscador + toggle bots */}
              <View style={s.searchRow}>
                <Ionicons name="search" size={16} color={colors.textDim} />
                <TextInput
                  style={s.searchInput}
                  value={search}
                  onChangeText={v => { setSearch(v); loadUsers(v, 1, hideBots); }}
                  placeholder="Buscar usuario..."
                  placeholderTextColor={colors.textDim}
                />
                {search ? <TouchableOpacity onPress={() => { setSearch(''); loadUsers('', 1, hideBots); }}>
                  <Ionicons name="close" size={16} color={colors.textDim} />
                </TouchableOpacity> : null}
              </View>
              <TouchableOpacity
                style={[s.botToggle, !hideBots && s.botToggleActive]}
                onPress={() => setHideBots(v => !v)}
              >
                <Ionicons name="hardware-chip-outline" size={13} color={hideBots ? colors.textDim : colors.c1} />
                <Text style={[s.botToggleTxt, !hideBots && { color: colors.c1 }]}>
                  {hideBots ? 'Bots ocultos' : 'Mostrando bots'}
                </Text>
              </TouchableOpacity>

              {usersLoading && <ActivityIndicator color={colors.c1} style={{ marginTop:40 }} />}
            </>
          }
          renderItem={({ item: u }) => {
            const role = ROLE_COLORS[u.role] || ROLE_COLORS.user;
            return (
              <View style={[s.userRow, u.banned && s.userRowBanned]}>
                <View style={s.userAv}>
                  {u.avatarUrl
                    ? <Image source={{ uri: u.avatarUrl }} style={{ width:'100%', height:'100%', borderRadius:20 }} />
                    : <Text style={s.userAvTxt}>{u.username?.[0]?.toUpperCase()}</Text>}
                </View>
                <View style={{ flex:1 }}>
                  <View style={{ flexDirection:'row', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    <Text style={[s.userName, u.banned && { color: colors.textDim, textDecorationLine:'line-through' }]}>
                      {u.username}
                    </Text>
                    <View style={[s.roleBadge, { backgroundColor: role.bg, borderColor: role.border }]}>
                      <Text style={[s.roleBadgeTxt, { color: role.text }]}>{role.label}</Text>
                    </View>
                    {u.banned && <View style={s.bannedBadge}><Text style={s.bannedBadgeTxt}>BANEADO</Text></View>}
                  </View>
                  <Text style={s.userEmail}>{u.email}</Text>
                  {u.banned && u.bannedReason && <Text style={s.banReason}>↳ {u.bannedReason}</Text>}
                </View>
                <View style={s.actions}>
                  {u.role !== 'admin' && (
                    u.banned ? (
                      <TouchableOpacity style={s.actionBtn} onPress={() => handleUnban(u._id)}>
                        <Ionicons name="checkmark-circle-outline" size={20} color={colors.c1} />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={s.actionBtn} onPress={() => { setBanModal(u); setBanReason(''); }}>
                        <Ionicons name="ban-outline" size={20} color="rgba(239,68,68,0.7)" />
                      </TouchableOpacity>
                    )
                  )}
                  {currentUser?.role === 'admin' && u.role !== 'admin' && (
                    <TouchableOpacity style={s.actionBtn} onPress={() => handleSetRole(u._id, u.role === 'mod' ? 'user' : 'mod')}>
                      <Ionicons name={u.role === 'mod' ? 'shield-outline' : 'shield-checkmark-outline'} size={20} color="rgba(251,191,36,0.8)" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={s.actionBtn} onPress={() => navigation.navigate('PublicProfile', { username: u.username })}>
                    <Ionicons name="person-outline" size={20} color={colors.textDim} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListFooterComponent={
            usersLoadingMore
              ? <ActivityIndicator color={colors.c1} style={{ marginVertical: 16 }} />
              : null
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex:1, backgroundColor: colors.black },
  header:      { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:20, paddingVertical:14, borderBottomWidth:1, borderBottomColor:'rgba(239,68,68,0.2)' },
  backBtn:     { width:40 },
  headerTitle: { fontSize:13, fontWeight:'900', letterSpacing:5, color:'rgba(239,68,68,0.9)' },
  headerSub:   { fontSize:10, color: colors.textDim, marginTop:1 },
  modBadge:    { width:36, height:36, borderRadius:18, backgroundColor:'rgba(251,191,36,0.1)', borderWidth:1, borderColor:'rgba(251,191,36,0.3)', alignItems:'center', justifyContent:'center' },
  pendingBadge:{ backgroundColor:'rgba(239,68,68,0.8)', borderRadius:10, paddingHorizontal:8, paddingVertical:2, marginRight:8 },
  pendingBadgeTxt:{ color:'#fff', fontSize:11, fontWeight:'800' },

  tabBar:       { flexDirection:'row', marginHorizontal:16, marginVertical:12, backgroundColor: colors.card, borderRadius:12, borderWidth:1, borderColor: colors.border, overflow:'hidden' },
  tabBtn:       { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, paddingVertical:12 },
  tabBtnActive: { backgroundColor:'rgba(255,255,255,0.06)' },
  tabBtnTxt:    { color: colors.textDim, fontSize:13, fontWeight:'600' },
  tabBtnTxtActive:{ color:'#fff' },
  tabBadge:     { backgroundColor:'rgba(239,68,68,0.8)', borderRadius:8, paddingHorizontal:6, paddingVertical:1 },
  tabBadgeTxt:  { color:'#fff', fontSize:9, fontWeight:'800' },

  statsRow:     { flexDirection:'row', gap:10, margin:16 },
  statCard:     { flex:1, backgroundColor: colors.card, borderRadius:14, borderWidth:1, borderColor: colors.border, padding:14, alignItems:'center' },
  statCardActive:{ borderColor: colors.c1 },
  statVal:      { color: colors.textHi, fontSize:22, fontWeight:'800' },
  statLbl:      { color: colors.textDim, fontSize:8, letterSpacing:2, marginTop:3 },

  // Reports
  reportRow:    { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor: colors.border },
  reportTarget: { color: colors.textHi, fontWeight:'600', fontSize:13 },
  reportMeta:   { color: colors.textDim, fontSize:11, marginTop:2 },
  typeBadge:    { borderRadius:6, paddingHorizontal:7, paddingVertical:3, borderWidth:1, alignSelf:'flex-start' },
  typeBadgeTxt: { fontSize:8, fontWeight:'800', letterSpacing:1 },
  emptyState:   { alignItems:'center', paddingVertical:60, gap:12 },
  emptyStateTxt:{ color: colors.textDim, fontSize:14 },

  // Report detail modal
  reportDetailBox:   { backgroundColor: colors.surface, borderRadius:20, margin:20, padding:20, borderWidth:1, borderColor: colors.borderC },
  reportDetailHeader:{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:16 },
  reportDetailTarget:{ flex:1, color: colors.textHi, fontWeight:'700', fontSize:14 },
  reportDetailRow:   { flexDirection:'row', gap:12, marginBottom:10 },
  reportDetailLbl:   { color: colors.textDim, fontSize:12, width:90 },
  reportDetailVal:   { color: colors.textHi, fontSize:12, flex:1 },
  modNotesInput:     { backgroundColor:'rgba(8,20,36,0.95)', borderWidth:1, borderColor: colors.border, borderRadius:12, paddingHorizontal:14, paddingVertical:10, color: colors.textHi, fontSize:13, minHeight:60, textAlignVertical:'top', marginTop:8 },
  dismissBtn:        { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, paddingVertical:12, borderRadius:12, borderWidth:1, borderColor: colors.border },
  resolveBtn:        { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, paddingVertical:12, borderRadius:12, backgroundColor:'rgba(0,229,204,0.8)' },
  resolveBtn_txt:    { color:'#fff', fontWeight:'700', fontSize:13 },
  viewLinkBtn:       { flexDirection:'row', alignItems:'center', gap:6, alignSelf:'flex-start', paddingVertical:8, paddingHorizontal:12, borderRadius:10, borderWidth:1, borderColor:'rgba(0,229,204,0.3)', backgroundColor:'rgba(0,229,204,0.06)', marginBottom:4 },
  viewLinkTxt:       { color: colors.c1, fontWeight:'600', fontSize:12 },

  // Users
  searchRow:    { flexDirection:'row', alignItems:'center', gap:10, marginHorizontal:16, marginBottom:12, backgroundColor: colors.card, borderRadius:12, borderWidth:1, borderColor: colors.border, paddingHorizontal:14, paddingVertical:10 },
  searchInput:  { flex:1, color: colors.textHi, fontSize:14 },
  userRow:      { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor: colors.border },
  userRowBanned:{ backgroundColor:'rgba(239,68,68,0.04)' },
  userAv:       { width:40, height:40, borderRadius:20, backgroundColor: colors.deep, alignItems:'center', justifyContent:'center', overflow:'hidden' },
  userAvTxt:    { color: colors.c1, fontWeight:'700' },
  userName:     { color: colors.textHi, fontWeight:'600', fontSize:13 },
  userEmail:    { color: colors.textDim, fontSize:11, marginTop:2 },
  banReason:    { color:'rgba(239,68,68,0.6)', fontSize:10, marginTop:2 },
  roleBadge:    { borderRadius:6, paddingHorizontal:6, paddingVertical:2, borderWidth:1 },
  roleBadgeTxt: { fontSize:8, fontWeight:'800', letterSpacing:1 },
  bannedBadge:  { backgroundColor:'rgba(239,68,68,0.15)', borderRadius:6, paddingHorizontal:6, paddingVertical:2, borderWidth:1, borderColor:'rgba(239,68,68,0.3)' },
  bannedBadgeTxt:{ color:'rgba(239,68,68,0.8)', fontSize:8, fontWeight:'800', letterSpacing:1 },
  actions:      { flexDirection:'row', gap:4 },
  actionBtn:    { width:34, height:34, borderRadius:10, backgroundColor:'rgba(255,255,255,0.04)', alignItems:'center', justifyContent:'center', borderWidth:1, borderColor: colors.border },

  modalOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.75)', justifyContent:'center', padding:20 },
  banModalBox:  { backgroundColor: colors.surface, borderRadius:24, borderWidth:1, borderColor:'rgba(239,68,68,0.3)', padding:24 },
  modalTitle:   { fontSize:12, letterSpacing:4, color:'rgba(239,68,68,0.9)', fontWeight:'900', textAlign:'center', marginBottom:8 },
  modalUser:    { color: colors.textDim, fontSize:13, textAlign:'center', marginBottom:16 },
  modalInput:   { backgroundColor: colors.card, borderRadius:12, borderWidth:1, borderColor: colors.border, paddingHorizontal:14, paddingVertical:12, color: colors.textHi, fontSize:14, marginBottom:16 },
  modalActions: { flexDirection:'row', gap:10 },
  cancelBtn:    { flex:1, borderRadius:12, borderWidth:1, borderColor: colors.border, paddingVertical:12, alignItems:'center' },
  cancelBtnTxt: { color: colors.textDim, fontSize:14 },
  banBtn:       { flex:1, backgroundColor:'rgba(239,68,68,0.8)', borderRadius:12, paddingVertical:12, alignItems:'center' },
  banBtnTxt:    { color:'#fff', fontWeight:'800', fontSize:14 },

  botToggle:     { flexDirection:'row', alignItems:'center', gap:6, alignSelf:'flex-start', marginHorizontal:16, marginBottom:10, paddingHorizontal:12, paddingVertical:6, borderRadius:20, borderWidth:1, borderColor: colors.border, backgroundColor:'rgba(255,255,255,0.03)' },
  botToggleActive:{ borderColor:'rgba(0,229,204,0.35)', backgroundColor:'rgba(0,229,204,0.07)' },
  botToggleTxt:  { color: colors.textDim, fontSize:11, fontWeight:'600' },
});
