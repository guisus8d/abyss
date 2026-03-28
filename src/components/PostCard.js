import React, { useState, useRef, useMemo, memo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Image, Modal,
  StyleSheet, TextInput, ScrollView, Animated, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import AvatarWithFrame from './AvatarWithFrame';
import SharePostModal  from './SharePostModal';
import api from '../services/api';

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
  redDim:       'rgba(239,68,68,0.12)',
  redBorder:    'rgba(239,68,68,0.35)',
  gold:         'rgba(251,191,36,1)',
  goldDim:      'rgba(251,191,36,0.12)',
  goldBorder:   'rgba(251,191,36,0.35)',
  divider:      'rgba(255,255,255,0.06)',
  inputBg:      'rgba(6,14,24,0.9)',
};

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60)    return `${s}s`;
  if (s < 3600)  return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function ConfirmModal({ visible, title, body, onConfirm, onCancel }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={cm.overlay}>
        <View style={cm.box}>
          <Text style={cm.title}>{title}</Text>
          <Text style={cm.body}>{body}</Text>
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

function CommentSection({
  post, currentUserId, replyToComment, setReplyToComment,
  commentText, setCommentText, sending, onSubmit, onDeleteComment, goToProfile,
}) {
  const topLevel = useMemo(() => post.comments.filter(c => !c.replyTo?.commentId), [post.comments]);
  const replies  = useMemo(() => post.comments.filter(c => !!c.replyTo?.commentId), [post.comments]);

  return (
    <View style={s.commentsBox}>
      <ScrollView style={{ maxHeight: 280 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {topLevel.map((c, i) => {
          const cReplies = replies.filter(r => r.replyTo.commentId?.toString() === c._id?.toString());
          return (
            <View key={c._id || i}>
              <View style={s.comment}>
                <TouchableOpacity onPress={() => goToProfile(c.user?.username)} style={s.commentAvatarWrap}>
                  <AvatarWithFrame size={30} avatarUrl={c.user?.avatarUrl} username={c.user?.username} />
                </TouchableOpacity>
                <View style={s.commentBubble}>
                  <TouchableOpacity onPress={() => goToProfile(c.user?.username)}>
                    <Text style={s.commentUser}>{c.user?.username}</Text>
                  </TouchableOpacity>
                  <Text style={s.commentText}>{c.text}</Text>
                </View>
                <TouchableOpacity
                  onLongPress={() => {
                    const uid = c.user?._id?.toString() || c.user?.toString();
                    if (uid === currentUserId?.toString()) onDeleteComment(c._id);
                  }}
                  onPress={() => setReplyToComment({ commentId: c._id, username: c.user?.username, text: c.text })}
                  style={s.replyBtn}
                >
                  <Ionicons name="return-down-forward-outline" size={14} color={C.textDim} />
                </TouchableOpacity>
              </View>

              {cReplies.map((r, j) => (
                <View key={r._id || j} style={s.replyRow}>
                  <View style={s.replyConnector} />
                  <TouchableOpacity onPress={() => goToProfile(r.user?.username)} style={s.commentAvatarWrapSm}>
                    <AvatarWithFrame size={24} avatarUrl={r.user?.avatarUrl} username={r.user?.username} />
                  </TouchableOpacity>
                  <View style={[s.commentBubble, { flex: 1 }]}>
                    {r.replyTo?.text && (
                      <View style={s.replyPreview}>
                        <Text style={s.replyPreviewTxt} numberOfLines={1}>
                          ↩ @{r.replyTo.username}: {r.replyTo.text}
                        </Text>
                      </View>
                    )}
                    <TouchableOpacity onPress={() => goToProfile(r.user?.username)}>
                      <Text style={s.commentUser}>{r.user?.username}</Text>
                    </TouchableOpacity>
                    <Text style={s.commentText}>{r.text}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setReplyToComment({ commentId: c._id, username: c.user?.username, text: c.text })}
                    style={s.replyBtn}
                  >
                    <Ionicons name="return-down-forward-outline" size={14} color={C.textDim} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>

      {replyToComment && (
        <View style={s.replyBar}>
          <View style={s.replyBarAccent} />
          <Text style={s.replyBarTxt} numberOfLines={1}>
            ↩ @{replyToComment.username}: {replyToComment.text?.slice(0, 40)}
          </Text>
          <TouchableOpacity onPress={() => setReplyToComment(null)} style={s.replyBarClose}>
            <Ionicons name="close" size={14} color={C.textDim} />
          </TouchableOpacity>
        </View>
      )}

      <View style={s.commentInputRow}>
        <TextInput
          style={s.commentField}
          placeholder="Escribe un comentario..."
          placeholderTextColor={C.textDim}
          value={commentText}
          onChangeText={setCommentText}
          returnKeyType="send"
          onSubmitEditing={onSubmit}
          blurOnSubmit={false}
          onKeyPress={
            Platform.OS === 'web'
              ? (e) => { if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) onSubmit(); }
              : undefined
          }
        />
        <TouchableOpacity
          style={[s.sendBtn, (!commentText.trim() || sending) && s.sendBtnDisabled]}
          onPress={onSubmit}
          disabled={!commentText.trim() || sending}
          activeOpacity={0.8}
        >
          <Ionicons name="send" size={14} color="#020509" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── PostCard ─────────────────────────────────────────────────────────────────

const PostCard = memo(function PostCard({
  post, currentUserId, onReact, onComment, onDelete, navigation, openPickerId, setOpenPickerId,
}) {
  const goToProfile = useCallback((username) => {
    navigation.navigate('PublicProfile', { username });
  }, [navigation]);

  const [showComments,       setShowComments]      = useState(false);
  const [commentText,        setCommentText]        = useState('');
  const [sending,            setSending]            = useState(false);
  const [replyToComment,     setReplyToComment]     = useState(null);
  const [deleteCommentModal, setDeleteCommentModal] = useState(null);
  const [deletePostModal,    setDeletePostModal]    = useState(false);
  const [shareOpen,          setShareOpen]          = useState(false); // ← NUEVO

  const [liked, setLiked] = useState(() =>
    post.reactions.some(r => (r.user?._id || r.user)?.toString() === currentUserId?.toString() && r.type === 'like')
  );
  const [likeCount, setLikeCount] = useState(() =>
    post.reactions.filter(r => r.type === 'like').length
  );
  const likeBlocked = useRef(false);
  const heartScale  = useRef(new Animated.Value(1)).current;

  const { emojiGroups, myEmoji } = useMemo(() => {
    const emojiReactions = post.reactions.filter(r => r.type !== 'like');
    const groups = Object.entries(
      emojiReactions.reduce((acc, r) => { acc[r.type] = (acc[r.type] || 0) + 1; return acc; }, {})
    ).map(([emoji, count]) => ({ emoji, count }));
    const mine = emojiReactions.find(r => (r.user?._id || r.user)?.toString() === currentUserId?.toString());
    return { emojiGroups: groups, myEmoji: mine };
  }, [post.reactions, currentUserId]);

  const ago = useMemo(() => timeAgo(post.createdAt), [post.createdAt]);

  const handleLike = useCallback(() => {
    if (likeBlocked.current) return;
    likeBlocked.current = true;
    setTimeout(() => { likeBlocked.current = false; }, 400);
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount(prev => newLiked ? prev + 1 : prev - 1);
    heartScale.setValue(1);
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.6, useNativeDriver: true, speed: 100, bounciness: 20 }),
      Animated.spring(heartScale, { toValue: 1,   useNativeDriver: true, speed: 80,  bounciness: 4  }),
    ]).start();
    onReact(post._id, 'like');
  }, [liked, heartScale, onReact, post._id]);

  const handleDeletePost = useCallback(() => {
    setDeletePostModal(false);
    onDelete(post._id);
  }, [onDelete, post._id]);

  const handleDeleteComment = useCallback(async (commentId) => {
    try {
      const { data } = await api.delete(`/posts/${post._id}/comment/${commentId}`);
      if (onComment) onComment(post._id, null, null, data.comments);
    } catch (e) { console.log('deleteComment error:', e.message); }
    finally { setDeleteCommentModal(null); }
  }, [post._id, onComment]);

  const submitComment = useCallback(async () => {
    if (!commentText.trim() || sending) return;
    setSending(true);
    const txt   = commentText.trim();
    const reply = replyToComment;
    setCommentText('');
    setReplyToComment(null);
    await onComment(post._id, txt, reply);
    setSending(false);
  }, [commentText, sending, replyToComment, onComment, post._id]);

  const isAuthor = post.author._id === currentUserId || post.author.id === currentUserId;

  return (
    <View style={s.card}>

      <ConfirmModal
        visible={deletePostModal}
        title="¿Borrar este post?"
        body="Esta acción no se puede deshacer"
        onConfirm={handleDeletePost}
        onCancel={() => setDeletePostModal(false)}
      />
      <ConfirmModal
        visible={!!deleteCommentModal}
        title="¿Borrar comentario?"
        body="Esta acción no se puede deshacer"
        onConfirm={() => handleDeleteComment(deleteCommentModal)}
        onCancel={() => setDeleteCommentModal(null)}
      />

      {/* ── Modal compartir ── */}
      <SharePostModal
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        post={post}
        currentUserId={currentUserId}
      />

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => goToProfile(post.author.username)} style={s.avatarWrap}>
          <AvatarWithFrame
            size={40}
            avatarUrl={post.author.avatarUrl}
            username={post.author.username}
            profileFrame={post.author.profileFrame}
            frameUrl={post.author.profileFrameUrl}
          />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <TouchableOpacity onPress={() => goToProfile(post.author.username)}>
            <View style={s.usernameRow}>
              <Text style={s.username}>{post.author.username}</Text>
              {post.author.role === 'mod'   && <View style={s.badgeMod}><Text style={s.badgeModTxt}>MOD</Text></View>}
              {post.author.role === 'admin' && <View style={s.badgeAdmin}><Text style={s.badgeAdminTxt}>ADMIN</Text></View>}
            </View>
          </TouchableOpacity>
          <Text style={s.meta}>XP {post.author.xp} · {ago}</Text>
        </View>

        {isAuthor && (
          <TouchableOpacity onPress={() => setDeletePostModal(true)} style={s.moreBtn} activeOpacity={0.7}>
            <Ionicons name="ellipsis-horizontal" size={16} color={C.textDim} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Contenido ── */}
      {post.postType === 'news' ? (
        <TouchableOpacity
          style={s.newsCard}
          onPress={() => navigation.navigate('PostDetail', { postId: post._id })}
          activeOpacity={0.88}
        >
          {post.imageUrl && <Image source={{ uri: post.imageUrl }} style={s.newsCover} resizeMode="cover" />}
          <View style={s.newsBody}>
            <View style={s.newsBadge}>
              <Ionicons name="newspaper-outline" size={10} color={C.gold} />
              <Text style={s.newsBadgeTxt}>NOTICIA</Text>
            </View>
            {post.title ? <Text style={s.newsTitle}>{post.title}</Text> : null}
            <Text style={s.newsContent} numberOfLines={3}>{post.content}</Text>
          </View>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={() => navigation.navigate('PostDetail', { postId: post._id })}
          activeOpacity={0.9}
        >
          {post.content  ? <Text style={s.bodyText}>{post.content}</Text> : null}
          {post.imageUrl && <Image source={{ uri: post.imageUrl }} style={s.postImage} resizeMode="cover" />}
        </TouchableOpacity>
      )}

      {/* ── Tags ── */}
      {post.tags?.length > 0 && (
        <View style={s.tagsRow}>
          {post.tags.map((t, i) => (
            <View key={i} style={s.tagPill}>
              <Text style={s.tagTxt}>{t}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={s.divider} />

      {/* ── Acciones ── */}
      <View style={s.actionsRow}>

        <TouchableOpacity style={s.actBtn} onPress={handleLike} activeOpacity={0.65}>
          <Animated.View style={{ transform: [{ scale: heartScale }] }}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={19} color={liked ? C.red : C.textDim} />
          </Animated.View>
          <Text style={[s.actCount, liked && { color: C.red }]}>{likeCount}</Text>
        </TouchableOpacity>

        {emojiGroups.map(g => (
          <TouchableOpacity
            key={g.emoji}
            style={[s.emojiPill, myEmoji?.type === g.emoji && s.emojiPillActive]}
            onPress={() => onReact(post._id, g.emoji)}
            activeOpacity={0.7}
          >
            <Text style={s.emojiTxt}>{g.emoji}</Text>
            <Text style={[s.emojiCount, myEmoji?.type === g.emoji && s.emojiCountActive]}>{g.count}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={s.emojiAddBtn}
          onPress={() => setOpenPickerId(prev => prev === post._id ? null : post._id)}
          activeOpacity={0.7}
        >
          <Text style={s.emojiAddTxt}>+</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.actBtn} onPress={() => setShowComments(v => !v)} activeOpacity={0.7}>
          <Ionicons
            name={showComments ? 'chatbubble' : 'chatbubble-outline'}
            size={16}
            color={showComments ? C.accent : C.textDim}
          />
          <Text style={[s.actCount, showComments && { color: C.accent }]}>{post.comments.length}</Text>
        </TouchableOpacity>

        {/* ── Botón compartir ── */}
        <TouchableOpacity
          style={[s.actBtn, { marginLeft: 'auto' }]}
          activeOpacity={0.7}
          onPress={() => setShareOpen(true)}
        >
          <Ionicons name="share-social-outline" size={18} color={C.textDim} />
        </TouchableOpacity>

      </View>

      {/* ── Comentarios ── */}
      {showComments && (
        <CommentSection
          post={post}
          currentUserId={currentUserId}
          replyToComment={replyToComment}
          setReplyToComment={setReplyToComment}
          commentText={commentText}
          setCommentText={setCommentText}
          sending={sending}
          onSubmit={submitComment}
          onDeleteComment={setDeleteCommentModal}
          goToProfile={goToProfile}
        />
      )}
    </View>
  );
}, (prev, next) =>
  prev.post._id       === next.post._id       &&
  prev.post.reactions === next.post.reactions &&
  prev.post.comments  === next.post.comments  &&
  prev.post.content   === next.post.content   &&
  prev.post.imageUrl  === next.post.imageUrl  &&
  prev.post.title     === next.post.title     &&
  prev.post.postType  === next.post.postType  &&
  prev.openPickerId   === next.openPickerId
);

export default PostCard;

const isWeb = Platform.OS === 'web';

const s = StyleSheet.create({
  card: {
    marginHorizontal: 12, marginTop: 10,
    backgroundColor: C.card, borderRadius: 20,
    borderWidth: 1, borderColor: C.cardBorder, padding: 14,
    ...(isWeb ? { cursor: 'default' } : {}),
  },
  header:      { flexDirection: 'row', alignItems: 'center', marginBottom: 13, gap: 10 },
  avatarWrap:  { width: 40, height: 40, overflow: 'visible' },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  username:    { color: C.textHi, fontWeight: '700', fontSize: 14 },
  meta:        { color: C.textDim, fontSize: 11, marginTop: 3 },
  moreBtn:     { width: 32, height: 32, borderRadius: 10, borderWidth: 1, borderColor: C.cardBorder, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  badgeMod:      { backgroundColor: C.goldDim, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1, borderColor: C.goldBorder },
  badgeModTxt:   { color: C.gold, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  badgeAdmin:    { backgroundColor: C.redDim, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1, borderColor: C.redBorder },
  badgeAdminTxt: { color: C.red, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  bodyText:    { color: C.textMid, fontSize: 14, lineHeight: 22, marginBottom: 10, letterSpacing: 0.1 },
  postImage:   { width: '100%', aspectRatio: 16/9, maxHeight: 380, borderRadius: 14, marginBottom: 10, backgroundColor: C.surface },
  newsCard:     { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(234,179,8,0.22)', overflow: 'hidden', marginBottom: 12, backgroundColor: C.surface },
  newsCover:    { width: '100%', height: 170 },
  newsBody:     { padding: 14, gap: 8 },
  newsBadge:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.goldDim, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  newsBadgeTxt: { color: C.gold, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  newsTitle:    { color: C.textHi, fontSize: 15, fontWeight: '700', lineHeight: 21 },
  newsContent:  { color: C.textDim, fontSize: 12.5, lineHeight: 19 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  tagPill: { backgroundColor: C.accentDim, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1, borderColor: C.accentBorder },
  tagTxt:  { color: C.accent, fontSize: 11, fontWeight: '600', opacity: 0.85 },
  divider: { height: 1, backgroundColor: C.divider, marginBottom: 10 },
  actionsRow:      { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, rowGap: 6 },
  actBtn:          { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 2 },
  actCount:        { color: C.textDim, fontSize: 12, fontWeight: '500' },
  emojiPill:       { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.surface, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: C.cardBorder },
  emojiPillActive: { backgroundColor: C.accentDim, borderColor: C.accentBorder },
  emojiTxt:        { fontSize: 14 },
  emojiCount:      { color: C.textDim, fontSize: 11, fontWeight: '600' },
  emojiCountActive:{ color: C.accent },
  emojiAddBtn:     { alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: C.cardBorder },
  emojiAddTxt:     { color: C.textDim, fontSize: 16, fontWeight: '400', lineHeight: 18 },
  commentsBox:         { marginTop: 14, borderTopWidth: 1, borderTopColor: C.divider, paddingTop: 14 },
  comment:             { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 8 },
  commentAvatarWrap:   { width: 30, height: 30, overflow: 'visible' },
  commentBubble:       { flex: 1, backgroundColor: C.surface, borderRadius: 12, borderTopLeftRadius: 4, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: C.cardBorder },
  commentUser:         { color: C.accent, fontSize: 12, fontWeight: '700', marginBottom: 3 },
  commentText:         { color: C.textMid, fontSize: 12.5, lineHeight: 18 },
  replyBtn:            { paddingLeft: 6, paddingVertical: 4, marginTop: 4 },
  replyRow:            { flexDirection: 'row', alignItems: 'flex-start', paddingLeft: 20, marginBottom: 10, gap: 6 },
  replyConnector:      { width: 2, backgroundColor: C.accentBorder, borderRadius: 2, alignSelf: 'stretch', marginRight: 4 },
  commentAvatarWrapSm: { width: 24, height: 24, overflow: 'visible', marginTop: 2 },
  replyPreview:        { backgroundColor: 'rgba(15,227,184,0.06)', borderLeftWidth: 2, borderLeftColor: C.accent, paddingLeft: 7, paddingVertical: 3, marginBottom: 5 },
  replyPreviewTxt:     { color: C.textDim, fontSize: 10.5 },
  replyBar:      { flexDirection: 'row', alignItems: 'center', backgroundColor: C.accentDim, borderRadius: 10, borderWidth: 1, borderColor: C.accentBorder, marginBottom: 8, overflow: 'hidden' },
  replyBarAccent:{ width: 3, backgroundColor: C.accent, alignSelf: 'stretch' },
  replyBarTxt:   { color: C.textDim, fontSize: 11.5, flex: 1, paddingVertical: 8, paddingHorizontal: 8 },
  replyBarClose: { padding: 8 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.inputBg, borderRadius: 14, borderWidth: 1, borderColor: C.cardBorder, paddingHorizontal: 12, paddingVertical: 6, marginTop: 4 },
  commentField:    { flex: 1, color: C.textHi, fontSize: 13, paddingVertical: 4, ...(isWeb ? { outlineStyle: 'none' } : {}) },
  sendBtn:         { backgroundColor: C.accent, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  sendBtnDisabled: { backgroundColor: 'rgba(15,227,184,0.2)' },
});
