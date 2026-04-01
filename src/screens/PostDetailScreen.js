import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, Modal, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator, TextInput, Platform, Alert, Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import AvatarWithFrame from '../components/AvatarWithFrame';
import SharePostModal  from '../components/SharePostModal';

const C = {
  card:         '#0b1521',
  cardBorder:   'rgba(255,255,255,0.07)',
  surface:      '#0d1d2e',
  accent:       '#0fe3b8',
  accentDim:    'rgba(15,227,184,0.10)',
  accentBorder: 'rgba(15,227,184,0.28)',
  textHi:       '#e6f0ff',
  textMid:      'rgba(230,240,255,0.65)',
  textDim:      'rgba(230,240,255,0.35)',
  red:          '#ef4444',
  gold:         'rgba(251,191,36,1)',
  goldDim:      'rgba(251,191,36,0.12)',
  goldBorder:   'rgba(251,191,36,0.35)',
  divider:      'rgba(255,255,255,0.06)',
};

const isWeb = Platform.OS === 'web';

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60)    return `${s}s`;
  if (s < 3600)  return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function ConfirmModal({ visible, onConfirm, onCancel }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={cm.overlay}>
        <View style={cm.box}>
          <Text style={cm.title}>¿Borrar comentario?</Text>
          <Text style={cm.body}>Esta acción no se puede deshacer</Text>
          <View style={cm.row}>
            <TouchableOpacity onPress={onCancel} style={cm.btnCancel} activeOpacity={0.7}>
              <Text style={cm.btnCancelTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onConfirm} style={cm.btnDanger} activeOpacity={0.7}>
              <Text style={cm.btnDangerTxt}>Borrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const cm = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  box:          { backgroundColor: C.card, borderRadius: 22, padding: 24, width: '100%', maxWidth: 380, borderWidth: 1, borderColor: C.cardBorder },
  title:        { color: C.textHi, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  body:         { color: C.textDim, fontSize: 13, textAlign: 'center', marginBottom: 24 },
  row:          { flexDirection: 'row', gap: 10 },
  btnCancel:    { flex: 1, paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: C.cardBorder, alignItems: 'center' },
  btnCancelTxt: { color: C.textDim, fontWeight: '600', fontSize: 14 },
  btnDanger:    { flex: 1, paddingVertical: 13, borderRadius: 14, backgroundColor: 'rgba(239,68,68,0.75)', alignItems: 'center' },
  btnDangerTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

export default function PostDetailScreen({ route, navigation }) {
  const { postId } = route.params;
  const { user }   = useAuthStore();
  const insets     = useSafeAreaInsets();

  const [post,               setPost]              = useState(null);
  const [loading,            setLoading]            = useState(true);
  const [comment,            setComment]            = useState('');
  const [sending,            setSending]            = useState(false);
  const [replyTo,            setReplyTo]            = useState(null);
  const [deleteCommentModal, setDeleteCommentModal] = useState(null);
  const [shareOpen,          setShareOpen]          = useState(false);

  const inputRef   = useRef(null);
  const sendingRef = useRef(false);

  const loadPost = useCallback(async () => {
    try {
      const { data } = await api.get(`/posts/${postId}`);
      if (data.post) setPost(data.post);
    } catch (e) {
      console.log('loadPost error:', e.message);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => { loadPost(); }, [loadPost]);

  const handleComment = useCallback(async () => {
    if (!comment.trim() || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try {
      const payload = { text: comment.trim() };
      if (replyTo) payload.replyTo = replyTo;
      await api.post(`/posts/${postId}/comment`, payload);
      setComment('');
      setReplyTo(null);
      await loadPost();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo comentar');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }, [comment, replyTo, postId, loadPost]);

  const handleDeleteComment = useCallback(async (commentId) => {
    try {
      const { data } = await api.delete(`/posts/${postId}/comment/${commentId}`);
      if (data.comments) setPost(prev => ({ ...prev, comments: data.comments }));
    } catch (e) {
      Alert.alert('Error', 'No se pudo eliminar');
    } finally {
      setDeleteCommentModal(null);
    }
  }, [postId]);

  const handleShare = useCallback(async () => {
    const url = `https://abyss.social/post/${postId}`;
    const title = post?.title || 'Post en Abyss';
    if (isWeb && navigator?.share) {
      navigator.share({ title, url }).catch(() => {});
    } else {
      try {
        await Share.share({ message: `${title} — ${url}` });
      } catch {}
    }
  }, [post, postId]);

  if (loading) return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <ActivityIndicator color={C.accent} style={{ marginTop: 60 }} />
    </View>
  );
  if (!post) return null;

  const isNews = post.postType === 'news';
  const inputBottomPad = isWeb ? 12 : Math.max(insets.bottom, 12);

  const renderComment = (c, isReply = false) => {
    const uid      = c.user?._id?.toString() || c.user?.toString();
    const isOwn    = uid === user?._id?.toString();
    const parentId = isReply ? c.replyTo?.commentId : c._id;
    const replyData = { commentId: parentId, username: c.user?.username, text: c.text };

    return (
      <View key={c._id || String(Math.random())} style={[s.commentWrap, isReply && s.commentWrapReply]}>
        {isReply && <View style={s.replyLine} />}
        <View style={s.commentRow}>
          <TouchableOpacity
            style={{ marginRight: 10 }}
            onPress={() => navigation.navigate('PublicProfile', { username: c.user?.username })}
            activeOpacity={0.8}
          >
            <AvatarWithFrame size={isReply ? 28 : 34} avatarUrl={c.user?.avatarUrl} username={c.user?.username} />
          </TouchableOpacity>

          <TouchableOpacity
            style={{ flex: 1 }}
            onLongPress={() => { if (isOwn) setDeleteCommentModal(c._id); }}
            onPress={() => { setReplyTo(replyData); inputRef.current?.focus(); }}
            activeOpacity={0.85}
            delayLongPress={400}
          >
            {isReply && c.replyTo?.text ? (
              <View style={s.replyPreview}>
                <Text style={s.replyPreviewTxt} numberOfLines={1}>
                  {'↩ @'}{c.replyTo.username}{': '}{c.replyTo.text}
                </Text>
              </View>
            ) : null}
            <Text style={s.commentUser} onPress={() => navigation.navigate('PublicProfile', { username: c.user?.username })}>
              {'@'}{c.user?.username}
            </Text>
            <Text style={s.commentTxt}>{c.text}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => { setReplyTo(replyData); inputRef.current?.focus(); }}
            style={{ paddingLeft: 10, paddingVertical: 4 }}
          >
            <Ionicons name="return-down-back-outline" size={14} color={C.textDim} />
          </TouchableOpacity>
        </View>

        {!isReply
          ? (post.comments || [])
              .filter(r => r.replyTo?.commentId?.toString() === c._id?.toString())
              .map(r => renderComment(r, true))
          : null}
      </View>
    );
  };

  return (
    <View style={s.root}>
      <ConfirmModal
        visible={!!deleteCommentModal}
        onConfirm={() => handleDeleteComment(deleteCommentModal)}
        onCancel={() => setDeleteCommentModal(null)}
      />

      <SharePostModal
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        post={post}
        currentUserId={user?._id}
      />

      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        {/* ✅ Botón back — estilo blanco igual que ProfileScreen */}
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#ffffff" />
        </TouchableOpacity>

        <Text style={s.headerDate}>{formatDate(post.createdAt)}</Text>

        <TouchableOpacity onPress={() => setShareOpen(true)} style={s.actionBtn}>
          <Ionicons name="share-social-outline" size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={s.authorRow}
          onPress={() => navigation.navigate('PublicProfile', { username: post.author?.username })}
          activeOpacity={0.8}
        >
          <AvatarWithFrame
            size={44}
            avatarUrl={post.author?.avatarUrl}
            username={post.author?.username}
            profileFrame={post.author?.profileFrame}
            frameUrl={post.author?.profileFrameUrl}
          />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={s.authorName}>{'@'}{post.author?.username}</Text>
            <Text style={s.authorMeta}>{'XP '}{post.author?.xp || 0}{' · '}{timeAgo(post.createdAt)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={C.textDim} />
        </TouchableOpacity>

        {isNews ? (
          <View style={s.newsWrap}>
            {post.imageUrl ? <Image source={{ uri: post.imageUrl }} style={s.newsCover} resizeMode="cover" /> : null}
            <View style={s.newsBody}>
              <View style={s.newsBadge}>
                <Ionicons name="newspaper-outline" size={11} color={C.gold} />
                <Text style={s.newsBadgeTxt}>NOTICIA</Text>
              </View>
              {post.title   ? <Text style={s.newsTitle}>{post.title}</Text>     : null}
              {post.content ? <Text style={s.newsContent}>{post.content}</Text> : null}
            </View>
          </View>
        ) : (
          <View style={s.postWrap}>
            {post.content  ? <Text style={s.postContent}>{post.content}</Text> : null}
            {post.imageUrl ? <Image source={{ uri: post.imageUrl }} style={s.postImage} resizeMode="cover" /> : null}
          </View>
        )}

        {post.tags?.length > 0 ? (
          <View style={s.tagsRow}>
            {post.tags.map((t, i) => (
              <View key={i} style={s.tagPill}>
                <Text style={s.tagTxt}>{t}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={s.divider} />

        <View style={s.commentsHeader}>
          <Ionicons name="chatbubble-outline" size={13} color={C.textDim} />
          <Text style={s.commentsTitle}>
            {post.comments?.length || 0}{post.comments?.length !== 1 ? ' comentarios' : ' comentario'}
          </Text>
        </View>

        {/* ✅ Sin texto "sé el primero" — solo el ícono vacío */}
        {post.comments?.length === 0 ? (
          <View style={s.emptyComments}>
            <Ionicons name="chatbubble-outline" size={32} color={C.textDim} />
            <Text style={s.emptyCommentsTxt}>Sin comentarios aún</Text>
          </View>
        ) : null}

        {(post.comments || [])
          .filter(c => !c.replyTo?.commentId)
          .map(c => renderComment(c, false))}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ── Input ── */}
      <View style={[s.inputWrap, { paddingBottom: inputBottomPad }]}>
        {replyTo ? (
          <View style={s.replyBanner}>
            <View style={s.replyBannerAccent} />
            <Text style={s.replyBannerTxt} numberOfLines={1}>{'↩ Respondiendo a @'}{replyTo.username}</Text>
            <TouchableOpacity onPress={() => setReplyTo(null)} style={{ padding: 4 }}>
              <Ionicons name="close" size={14} color={C.textDim} />
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={s.inputRow}>
          <TextInput
            ref={inputRef}
            style={s.input}
            value={comment}
            onChangeText={setComment}
            placeholder="Escribe un comentario..."
            placeholderTextColor={C.textDim}
            multiline
            maxLength={500}
            onKeyPress={isWeb ? (e) => {
              if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
                e.preventDefault?.();
                handleComment();
              }
            } : undefined}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!comment.trim() || sending) && s.sendBtnDisabled]}
            onPress={handleComment}
            disabled={!comment.trim() || sending}
            activeOpacity={0.8}
          >
            {sending
              ? <ActivityIndicator size="small" color="#020509" />
              : <Ionicons name="send" size={15} color="#020509" />}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080f18' },

  // ── Header ──
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: C.cardBorder,
    backgroundColor: '#080f18',
  },
  headerDate: { color: '#ffffff', fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },

  // ✅ Botón back — igual que ProfileScreen: rgba(255,255,255,0.08), borderRadius 10
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  // Botón acción secundaria (share) — mismo estilo
  actionBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },

  authorRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 },
  authorName: { color: C.textHi, fontWeight: '700', fontSize: 15 },
  authorMeta: { color: C.textDim, fontSize: 11, marginTop: 3 },

  newsWrap:     { marginHorizontal: 14, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(234,179,8,0.22)', marginBottom: 16, backgroundColor: C.surface },
  newsCover:    { width: '100%', height: 230 },
  newsBody:     { padding: 16, gap: 10 },
  newsBadge:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.goldDim, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  newsBadgeTxt: { color: C.gold, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  newsTitle:    { color: C.textHi, fontSize: 22, fontWeight: '800', lineHeight: 30 },
  newsContent:  { color: C.textMid, fontSize: 15, lineHeight: 24 },

  postWrap:    { paddingHorizontal: 16, marginBottom: 14 },
  postContent: { color: C.textHi, fontSize: 16, lineHeight: 26, marginBottom: 14, letterSpacing: 0.1 },
  postImage:   { width: '100%', aspectRatio: 16 / 9, borderRadius: 16, backgroundColor: C.surface },

  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, marginBottom: 14 },
  tagPill: { backgroundColor: C.accentDim, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: C.accentBorder },
  tagTxt:  { color: C.accent, fontSize: 11, fontWeight: '600' },

  divider: { height: 1, backgroundColor: C.divider, marginHorizontal: 16, marginVertical: 10 },

  commentsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, marginBottom: 10 },
  commentsTitle:  { color: C.textDim, fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },

  emptyComments:    { alignItems: 'center', paddingVertical: 40, gap: 6 },
  emptyCommentsTxt: { color: C.textDim, fontSize: 13 },

  commentWrap:      { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.divider },
  commentWrapReply: { paddingLeft: 40, borderBottomWidth: 0, paddingVertical: 8 },
  replyLine:        { position: 'absolute', left: 30, top: 0, bottom: 0, width: 1.5, backgroundColor: C.accentBorder },
  commentRow:       { flexDirection: 'row', alignItems: 'flex-start' },
  commentUser:      { color: C.accent, fontWeight: '700', fontSize: 12, marginBottom: 3 },
  commentTxt:       { color: C.textMid, fontSize: 13, lineHeight: 19 },

  replyPreview:    { backgroundColor: C.accentDim, borderLeftWidth: 2, borderLeftColor: C.accent, paddingLeft: 8, paddingVertical: 4, marginBottom: 6, borderRadius: 0 },
  replyPreviewTxt: { color: C.textDim, fontSize: 11 },

  inputWrap: { backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.cardBorder, paddingTop: 10, paddingHorizontal: 12 },
  replyBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.accentDim, borderRadius: 10, borderWidth: 1, borderColor: C.accentBorder, marginBottom: 8, overflow: 'hidden' },
  replyBannerAccent: { width: 3, backgroundColor: C.accent, alignSelf: 'stretch' },
  replyBannerTxt:    { color: C.textDim, fontSize: 12, flex: 1, paddingVertical: 8, paddingHorizontal: 8 },

  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  input: {
    flex: 1, backgroundColor: C.surface, borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 10,
    color: C.textHi, fontSize: 14, maxHeight: 100,
    borderWidth: 1, borderColor: C.cardBorder,
    ...(isWeb ? { outlineStyle: 'none' } : {}),
  },
  sendBtn:         { backgroundColor: C.accent, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: 'rgba(15,227,184,0.2)' },
});
