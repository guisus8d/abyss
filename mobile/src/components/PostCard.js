import React, { useState, useRef, useMemo, memo, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Image, Modal, FlatList, ActivityIndicator,
  StyleSheet, TextInput, ScrollView, Animated, Platform,
} from 'react-native';
import VideoPlayer from './VideoPlayer';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import AvatarWithFrame from './AvatarWithFrame';
import SharePostModal  from './SharePostModal';
import GuestAuthModal  from './GuestAuthModal';
import api from '../services/api';
import GenderIcon from './GenderIcon';
import VerifiedIcon from './VerifiedIcon';
import { renderCommentText, COMMENT_EMOJIS } from '../utils/commentUtils';
import EmojiPill from './EmojiPill';
import EmojiPickerSheet from './EmojiPickerSheet';
import FloatingEmoji from './FloatingEmoji';

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
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
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

function ReactorsModal({ visible, postId, initialFilter, onClose }) {
  const [reactions, setReactions] = useState({});
  const [filter,    setFilter]    = useState(initialFilter);
  const [loading,   setLoading]   = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) return;
    setFilter(initialFilter);
    setLoading(true);
    api.get(`/posts/${postId}/reactions`)
      .then(({ data }) => setReactions(data.reactions || {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible, postId, initialFilter]);

  const types   = Object.keys(reactions);
  const listData = filter && reactions[filter]
    ? reactions[filter]
    : Object.values(reactions).flat();

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={rm.overlay}>
        <View style={[rm.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={rm.handle} />
          <Text style={rm.title}>Reacciones</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={rm.tabs} contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
            {types.map(t => (
              <TouchableOpacity key={t} style={[rm.tab, filter === t && rm.tabActive]} onPress={() => setFilter(t)}>
                <Text style={rm.tabEmoji}>{t === 'like' ? '❤️' : t}</Text>
                <Text style={[rm.tabCount, filter === t && rm.tabCountActive]}>{reactions[t]?.length}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {loading
            ? <ActivityIndicator color={C.accent} style={{ marginVertical: 24 }} />
            : (
              <FlatList
                data={listData}
                keyExtractor={(u, i) => u?._id?.toString() || String(i)}
                style={{ maxHeight: 280 }}
                renderItem={({ item: u }) => (
                  <View style={rm.userRow}>
                    <AvatarWithFrame size={34} avatarUrl={u?.avatarUrl} username={u?.username} />
                    <Text style={rm.userTxt}>@{u?.username}</Text>
                    <GenderIcon gender={u?.gender} size={12} />
                    <VerifiedIcon isCreator={u?.isCreator} size={12} />
                  </View>
                )}
                ListEmptyComponent={<Text style={rm.empty}>Sin reacciones todavía</Text>}
              />
            )
          }
          <TouchableOpacity style={rm.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={rm.closeTxt}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function CommentSection({
  post, currentUserId, replyToComment, setReplyToComment,
  commentText, setCommentText, sending, onSubmit, onDeleteComment, goToProfile, onViewAll,
  isGuest, onGuestAction, navigation,
}) {
  const [commentReactions, setCommentReactions] = useState(() => {
    const map = {};
    post.comments.forEach(c => { if (c._id) map[String(c._id)] = c.reactions || []; });
    return map;
  });
  const [commentPickerFor, setCommentPickerFor] = useState(null);

  useEffect(() => {
    setCommentReactions(prev => {
      const next = { ...prev };
      let changed = false;
      post.comments.forEach(c => {
        const key = String(c._id);
        if (key && !(key in next)) { next[key] = c.reactions || []; changed = true; }
      });
      return changed ? next : prev;
    });
  }, [post.comments]);

  const handleCommentReact = useCallback(async (commentId, emoji) => {
    const key = String(commentId);
    setCommentPickerFor(null);
    let snapshot;
    setCommentReactions(prev => {
      snapshot = prev[key] || [];
      const current = [...snapshot];
      const idx = current.findIndex(r => String(r.user?._id ?? r.user) === String(currentUserId));
      if (idx >= 0) {
        if (current[idx].type === emoji) current.splice(idx, 1);
        else current[idx] = { ...current[idx], type: emoji };
      } else {
        current.push({ user: currentUserId, type: emoji });
      }
      return { ...prev, [key]: current };
    });
    try {
      const { data } = await api.post(`/posts/${String(post._id)}/comment/${key}/react`, { type: emoji });
      setCommentReactions(prev => ({ ...prev, [key]: data.reactions || [] }));
    } catch (e) {
      console.warn('handleCommentReact error:', e?.response?.data?.error || e?.message);
      setCommentReactions(prev => ({ ...prev, [key]: snapshot || [] }));
    }
  }, [post._id, currentUserId]);

  const topLevel = useMemo(() => post.comments.filter(c => !c.replyTo?.commentId), [post.comments]);
  const replies  = useMemo(() => post.comments.filter(c => !!c.replyTo?.commentId), [post.comments]);
  const preview  = topLevel.slice(0, 2);
  const remaining = topLevel.length - preview.length;

  return (
    <View style={s.commentsBox}>
      <ScrollView style={{ maxHeight: 280 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {preview.map((c, i) => {
          const cReplies = replies.filter(r => r.replyTo.commentId?.toString() === c._id?.toString());
          return (
            <View key={c._id || i}>
              <View style={s.comment}>
                <TouchableOpacity onPress={() => goToProfile(c.user?.username)} style={s.commentAvatarWrap}>
                  <AvatarWithFrame size={30} avatarUrl={c.user?.avatarUrl} username={c.user?.username} />
                </TouchableOpacity>
                <View style={s.commentBubble}>
                  <TouchableOpacity onPress={() => goToProfile(c.user?.username)}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                      <Text style={s.commentUser}>{c.user?.username}</Text>
                      <GenderIcon gender={c.user?.gender} size={11} />
                      <VerifiedIcon isCreator={c.user?.isCreator} size={11} />
                    </View>
                  </TouchableOpacity>
                  {renderCommentText(c.text, navigation, s.commentText, s.commentLink)}
                  {/* Reacciones al comentario */}
                  {(() => {
                    const rxs = commentReactions[String(c._id)] || [];
                    const groups = rxs.reduce((acc, r) => { acc[r.type] = (acc[r.type] || 0) + 1; return acc; }, {});
                    return (
                      <View style={s.commentReactRow}>
                        {Object.entries(groups).map(([emoji, count]) => (
                          <TouchableOpacity key={emoji} style={s.commentReactPill} onPress={() => handleCommentReact(String(c._id), emoji)}>
                            <Text style={s.commentReactEmoji}>{emoji}</Text>
                            <Text style={s.commentReactCount}>{count}</Text>
                          </TouchableOpacity>
                        ))}
                        {!isGuest && (
                          <TouchableOpacity style={s.commentReactAdd} onPress={() => setCommentPickerFor(commentPickerFor === String(c._id) ? null : String(c._id))}>
                            <Text style={s.commentReactAddTxt}>+</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })()}
                  {commentPickerFor === String(c._id) && (
                    <View style={s.commentEmojiPicker}>
                      {COMMENT_EMOJIS.map(e => (
                        <TouchableOpacity key={e} style={s.commentEmojiBtn} onPress={() => handleCommentReact(String(c._id), e)}>
                          <Text style={{ fontSize: 18 }}>{e}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
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
                          ↩ {r.replyTo.username}: {r.replyTo.text}
                        </Text>
                      </View>
                    )}
                    <TouchableOpacity onPress={() => goToProfile(r.user?.username)}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                        <Text style={s.commentUser}>{r.user?.username}</Text>
                        <GenderIcon gender={r.user?.gender} size={11} />
                        <VerifiedIcon isCreator={r.user?.isCreator} size={11} />
                      </View>
                    </TouchableOpacity>
                    {renderCommentText(r.text, navigation, s.commentText, s.commentLink)}
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

      {remaining > 0 && onViewAll && (
        <TouchableOpacity onPress={onViewAll} style={s.viewAllBtn}>
          <Text style={s.viewAllTxt}>Ver los {topLevel.length} comentarios</Text>
        </TouchableOpacity>
      )}

      {replyToComment && (
        <View style={s.replyBar}>
          <View style={s.replyBarAccent} />
          <Text style={s.replyBarTxt} numberOfLines={1}>
            ↩ {replyToComment.username}: {replyToComment.text?.slice(0, 40)}
          </Text>
          <TouchableOpacity onPress={() => setReplyToComment(null)} style={s.replyBarClose}>
            <Ionicons name="close" size={14} color={C.textDim} />
          </TouchableOpacity>
        </View>
      )}

      {isGuest ? (
        <TouchableOpacity style={s.guestCommentBtn} onPress={onGuestAction} activeOpacity={0.8}>
          <Ionicons name="lock-closed-outline" size={14} color={C.accent} />
          <Text style={s.guestCommentTxt}>Inicia sesión para comentar</Text>
        </TouchableOpacity>
      ) : (
        <View style={s.commentInputRow}>
          <TextInput
            style={s.commentField}
            placeholder="Escribe un comentario..."
            placeholderTextColor={C.textDim}
            value={commentText}
            onChangeText={setCommentText}
            returnKeyType="send"
            onSubmitEditing={Platform.OS !== 'web' ? onSubmit : undefined}
            blurOnSubmit={false}
            onKeyPress={
              Platform.OS === 'web'
                ? (e) => { if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) { e.preventDefault?.(); onSubmit(); } }
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
      )}
    </View>
  );
}

// ─── PostCard ─────────────────────────────────────────────────────────────────

const PostCard = memo(function PostCard({
  post, currentUserId, onReact, onComment, onDelete, navigation, isGuest,
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
  const [shareOpen,          setShareOpen]          = useState(false);
  const [showGuestModal,     setShowGuestModal]     = useState(false);
  const [reactorsFilter,     setReactorsFilter]     = useState(null);
  const [showPicker,         setShowPicker]         = useState(false);
  const [maxEmojiError,      setMaxEmojiError]      = useState(false);
  const [float,              setFloat]              = useState(null);

  const [liked, setLiked] = useState(() =>
    post.reactions.some(r => (r.user?._id || r.user)?.toString() === currentUserId?.toString() && r.type === 'like')
  );
  const [likeCount, setLikeCount] = useState(() =>
    post.reactions.filter(r => r.type === 'like').length
  );
  const likeBlocked  = useRef(false);
  const sendingRef   = useRef(false);
  const heartScale  = useRef(new Animated.Value(1)).current;

  const { emojiGroups, myEmojiSet } = useMemo(() => {
    const emojiReactions = post.reactions.filter(r => r.type !== 'like');
    const groups = Object.entries(
      emojiReactions.reduce((acc, r) => { acc[r.type] = (acc[r.type] || 0) + 1; return acc; }, {})
    ).map(([emoji, count]) => ({ emoji, count }));
    const myTypes = emojiReactions
      .filter(r => (r.user?._id || r.user)?.toString() === currentUserId?.toString())
      .map(r => r.type);
    return { emojiGroups: groups, myEmojiSet: new Set(myTypes) };
  }, [post.reactions, currentUserId]);

  const ago = useMemo(() => timeAgo(post.createdAt), [post.createdAt]);

  const triggerFloat = useCallback((emoji) => {
    setFloat({ key: Date.now(), emoji });
  }, []);

  const handleLike = useCallback(() => {
    if (isGuest) { setShowGuestModal(true); return; }
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
    triggerFloat('❤️');
    onReact(post._id, 'like');
  }, [liked, heartScale, onReact, post._id, isGuest, triggerFloat]);

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
    if (!commentText.trim() || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    const txt   = commentText.trim();
    const reply = replyToComment;
    setCommentText('');
    setReplyToComment(null);
    await onComment(post._id, txt, reply);
    sendingRef.current = false;
    setSending(false);
  }, [commentText, replyToComment, onComment, post._id]);

  const handlePickEmoji = useCallback((emoji) => {
    setShowPicker(false);
    const distinctTypes = new Set(
      post.reactions.filter(r => r.type !== 'like').map(r => r.type)
    );
    if (!distinctTypes.has(emoji) && distinctTypes.size >= 20) {
      setMaxEmojiError(true);
      setTimeout(() => setMaxEmojiError(false), 3000);
      return;
    }
    triggerFloat(emoji);
    onReact(post._id, emoji);
  }, [post.reactions, onReact, post._id, triggerFloat]);

  const isAuthor = post.author?._id?.toString() === currentUserId?.toString() ||
                   post.author?.id?.toString()  === currentUserId?.toString();

  return (
    <View style={s.cardOuter}>
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

      {/* ── Modal guest ── */}
      <GuestAuthModal visible={showGuestModal} onClose={() => setShowGuestModal(false)} />

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

        <View style={{ flex: 1, flexDirection: 'column', justifyContent: 'center' }}>
          <TouchableOpacity onPress={() => goToProfile(post.author.username)}>
            <View style={s.usernameRow}>
              <Text style={s.username}>{post.author.username}</Text>
              <GenderIcon gender={post.author.gender} />
              <VerifiedIcon isCreator={post.author.isCreator} />
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
      ) : post.postType === 'video' && post.videoUrl ? (
        <View>
          <TouchableOpacity onPress={() => navigation.navigate('PostDetail', { postId: post._id })} activeOpacity={0.8}>
            {post.title ? <Text style={[s.bodyText, { fontWeight: '600', marginBottom: 6 }]}>{post.title}</Text> : null}
          </TouchableOpacity>
          <VideoPlayer post={post} navigation={navigation} />
        </View>
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

        <TouchableOpacity style={s.actBtn} onPress={handleLike} onLongPress={() => setReactorsFilter('like')} activeOpacity={0.65}>
          <Animated.View style={{ transform: [{ scale: heartScale }] }}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={19} color={liked ? C.red : C.textDim} />
          </Animated.View>
          <Text style={[s.actCount, liked && { color: C.red }]}>{likeCount}</Text>
        </TouchableOpacity>

        {emojiGroups.map(g => (
          <EmojiPill
            key={g.emoji}
            emoji={g.emoji}
            count={g.count}
            isActive={myEmojiSet.has(g.emoji)}
            onPress={() => {
              if (isGuest) { setShowGuestModal(true); return; }
              triggerFloat(g.emoji);
              onReact(post._id, g.emoji);
            }}
            onLongPress={() => setReactorsFilter(g.emoji)}
          />
        ))}

        <TouchableOpacity
          style={s.emojiAddBtn}
          onPress={() => isGuest ? setShowGuestModal(true) : setShowPicker(true)}
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

      {maxEmojiError && (
        <Text style={s.maxEmojiErr}>Maximo 20 tipos de emoji por post</Text>
      )}

      <EmojiPickerSheet
        visible={showPicker}
        onSelect={handlePickEmoji}
        onClose={() => setShowPicker(false)}
      />

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
          onViewAll={() => navigation.navigate('PostDetail', { postId: post._id })}
          isGuest={isGuest}
          onGuestAction={() => setShowGuestModal(true)}
          navigation={navigation}
        />
      )}

      {/* ── Reactores ── */}
      <ReactorsModal
        visible={!!reactorsFilter}
        postId={post._id}
        initialFilter={reactorsFilter}
        onClose={() => setReactorsFilter(null)}
      />
    </View>

    {float && (
      <FloatingEmoji
        key={float.key}
        emoji={float.emoji}
        onDone={() => setFloat(null)}
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
  prev.post.videoUrl  === next.post.videoUrl  &&
  prev.post.title     === next.post.title     &&
  prev.post.postType  === next.post.postType  &&
  prev.isGuest        === next.isGuest
);

export default PostCard;

const isWeb = Platform.OS === 'web';

const s = StyleSheet.create({
  cardOuter: { marginHorizontal: 12, marginTop: 10 },
  card: {
    backgroundColor: C.card, borderRadius: 20,
    borderWidth: 1, borderColor: C.cardBorder, padding: 14,
    ...(isWeb ? { cursor: 'default' } : {}),
  },
  header:      { flexDirection: 'row', alignItems: 'center', marginBottom: 13, gap: 10 },
  avatarWrap:  { width: 60, height: 60, overflow: 'visible', alignItems: 'center', justifyContent: 'center' },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  username:    { color: C.textHi, fontWeight: '700', fontSize: 15 },
  genderIcon:  { width: 13, height: 13, resizeMode: 'contain', opacity: 0.7 },
  meta:        { color: C.textDim, fontSize: 12, marginTop: 2 },
  moreBtn:     { width: 32, height: 32, borderRadius: 10, borderWidth: 1, borderColor: C.cardBorder, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
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
  actionsRow:  { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, rowGap: 6 },
  actBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 2 },
  actCount:    { color: C.textDim, fontSize: 12, fontWeight: '500' },
  emojiAddBtn: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  emojiAddTxt: { color: 'rgba(230,240,255,0.35)', fontSize: 16, fontWeight: '400', lineHeight: 18 },
  maxEmojiErr: { color: 'rgba(239,68,68,0.75)', fontSize: 11, marginTop: 4 },
  commentsBox:         { marginTop: 14, borderTopWidth: 1, borderTopColor: C.divider, paddingTop: 14 },
  viewAllBtn:          { paddingVertical: 8, alignItems: 'center' },
  viewAllTxt:          { color: C.accent, fontSize: 12, fontWeight: '600' },
  comment:             { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 8 },
  commentAvatarWrap:   { width: 30, height: 30, overflow: 'visible' },
  commentBubble:       { flex: 1, backgroundColor: C.surface, borderRadius: 12, borderTopLeftRadius: 4, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: C.cardBorder },
  commentUser:         { color: C.accent, fontSize: 12, fontWeight: '700', marginBottom: 3 },
  commentText:         { color: C.textMid, fontSize: 12.5, lineHeight: 18 },
  commentLink:         { color: C.accent, textDecorationLine: 'underline' },
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
  commentInputRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: C.inputBg, borderRadius: 14, borderWidth: 1, borderColor: C.cardBorder, paddingHorizontal: 12, paddingVertical: 6, marginTop: 4 },
  commentField:     { flex: 1, color: C.textHi, fontSize: 13, paddingVertical: 4, ...(isWeb ? { outlineStyle: 'none' } : {}) },
  sendBtn:          { backgroundColor: C.accent, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  sendBtnDisabled:  { backgroundColor: 'rgba(15,227,184,0.2)' },
  guestCommentBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 10, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(15,227,184,0.2)', backgroundColor: 'rgba(15,227,184,0.05)' },
  guestCommentTxt:  { color: C.accent, fontSize: 13, fontWeight: '600' },
  commentReactRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 5 },
  commentReactPill: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: C.cardBorder },
  commentReactEmoji:{ fontSize: 11 },
  commentReactCount:{ color: C.textDim, fontSize: 10, fontWeight: '600' },
  commentReactAdd:  { alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: C.cardBorder, backgroundColor: 'rgba(255,255,255,0.04)' },
  commentReactAddTxt:{ color: C.textDim, fontSize: 12, lineHeight: 14 },
  commentEmojiPicker:{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, gap: 4, backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.cardBorder, padding: 6 },
  commentEmojiBtn:  { padding: 3 },
});

const rm = StyleSheet.create({
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
  sheet:         { backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 12, borderWidth: 1, borderColor: C.cardBorder },
  handle:        { width: 38, height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  title:         { color: C.textHi, fontWeight: '700', fontSize: 16, marginBottom: 12 },
  tabs:          { flexGrow: 0, marginBottom: 12 },
  tab:           { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: C.cardBorder, backgroundColor: C.surface },
  tabActive:     { borderColor: C.accentBorder, backgroundColor: C.accentDim },
  tabEmoji:      { fontSize: 16 },
  tabCount:      { color: C.textDim, fontSize: 12, fontWeight: '600' },
  tabCountActive:{ color: C.accent },
  userRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  userTxt:       { color: C.textHi, fontSize: 14, fontWeight: '600' },
  empty:         { color: C.textDim, fontSize: 13, textAlign: 'center', paddingVertical: 24 },
  closeBtn:      { marginTop: 16, paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: C.cardBorder, alignItems: 'center' },
  closeTxt:      { color: C.textDim, fontWeight: '600', fontSize: 14 },
});
