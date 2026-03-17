import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Image, Modal,
  StyleSheet, TextInput, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import AvatarWithFrame from './AvatarWithFrame';
import api from '../services/api';

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s/60)}m`;
  if (s < 86400) return `${Math.floor(s/3600)}h`;
  return `${Math.floor(s/86400)}d`;
}

export default function PostCard({ post, currentUserId, onReact, onComment, onDelete, navigation, openPickerId, setOpenPickerId }) {
  const [showComments, setShowComments]     = useState(false);
  const [commentText, setCommentText]       = useState('');
  const [sending, setSending]               = useState(false);
  const [replyToComment, setReplyToComment] = useState(null);
  const [deleteCommentModal, setDeleteCommentModal] = useState(null);

  const likeCount      = post.reactions.filter(r => r.type === 'like').length;
  const hasLiked       = post.reactions.some(r => (r.user?._id || r.user) === currentUserId && r.type === 'like');
  const emojiReactions = post.reactions.filter(r => r.type !== 'like');
  const emojiGroups    = Object.entries(
    emojiReactions.reduce((acc, r) => { acc[r.type] = (acc[r.type] || 0) + 1; return acc; }, {})
  ).map(([emoji, count]) => ({ emoji, count }));
  const myEmoji = emojiReactions.find(r => {
    const uid = r.user?._id || r.user;
    return uid?.toString() === currentUserId?.toString();
  });

  async function handleDeleteComment(commentId) {
    try {
      const { data } = await api.delete(`/posts/${post._id}/comment/${commentId}`);
      if (onComment) onComment(post._id, null, null, data.comments);
    } catch (e) { console.log('deleteComment error:', e.message); }
    finally { setDeleteCommentModal(null); }
  }

  async function submitComment() {
    if (!commentText.trim() || sending) return;
    setSending(true);
    const txt   = commentText.trim();
    const reply = replyToComment;
    setCommentText('');
    setReplyToComment(null);
    await onComment(post._id, txt, reply);
    setSending(false);
  }

  return (
    <View style={s.card}>
      {/* Modal borrar comentario */}
      <Modal visible={!!deleteCommentModal} transparent animationType="fade" onRequestClose={() => setDeleteCommentModal(null)}>
        <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.7)', alignItems:'center', justifyContent:'center', padding:24 }}>
          <View style={{ backgroundColor:'#0d1f2d', borderRadius:20, padding:24, width:'100%', borderWidth:1, borderColor:'rgba(255,255,255,0.08)' }}>
            <Text style={{ color:'#fff', fontSize:16, fontWeight:'700', textAlign:'center', marginBottom:8 }}>¿Borrar comentario?</Text>
            <Text style={{ color:'rgba(255,255,255,0.4)', fontSize:13, textAlign:'center', marginBottom:24 }}>Esta acción no se puede deshacer</Text>
            <View style={{ flexDirection:'row', gap:12 }}>
              <TouchableOpacity onPress={() => setDeleteCommentModal(null)}
                style={{ flex:1, paddingVertical:12, borderRadius:14, borderWidth:1, borderColor:'rgba(255,255,255,0.12)', alignItems:'center' }}>
                <Text style={{ color:'rgba(255,255,255,0.5)', fontWeight:'600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeleteComment(deleteCommentModal)}
                style={{ flex:1, paddingVertical:12, borderRadius:14, backgroundColor:'rgba(239,68,68,0.8)', alignItems:'center' }}>
                <Text style={{ color:'#fff', fontWeight:'700' }}>Borrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={s.cardHead}>
        <TouchableOpacity onPress={() => navigation.navigate('PublicProfile', { username: post.author.username })} style={{ marginRight: 10 }}>
          <AvatarWithFrame size={38} avatarUrl={post.author.avatarUrl} username={post.author.username} profileFrame={post.author.profileFrame} frameUrl={post.author.profileFrameUrl} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <TouchableOpacity onPress={() => navigation.navigate('PublicProfile', { username: post.author.username })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={s.cardUser}>{post.author.username}</Text>
              {post.author.role === 'mod' && <View style={s.modBadge}><Text style={s.modBadgeTxt}>MOD</Text></View>}
              {post.author.role === 'admin' && <View style={s.adminBadge}><Text style={s.adminBadgeTxt}>ADMIN</Text></View>}
            </View>
          </TouchableOpacity>
          <Text style={s.cardMeta}>XP {post.author.xp} · {timeAgo(post.createdAt)}</Text>
        </View>
        {(post.author._id === currentUserId || post.author.id === currentUserId) && (
          <TouchableOpacity onPress={() => {
            if (window.confirm('¿Seguro que quieres borrar este post?')) onDelete(post._id);
          }} style={s.deleteBtn}>
            <Text style={s.deleteBtnTxt}>···</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Contenido */}
      {post.postType === 'news' ? (
        <TouchableOpacity style={s.newsCard} onPress={() => navigation.navigate('PostDetail', { postId: post._id })}>
          {post.imageUrl && <Image source={{ uri: post.imageUrl }} style={s.newsCover} resizeMode="cover" />}
          <View style={s.newsBody}>
            <View style={s.newsBadge}>
              <Ionicons name="newspaper-outline" size={10} color="rgba(251,191,36,1)" />
              <Text style={s.newsBadgeTxt}>NOTICIA</Text>
            </View>
            {post.title ? <Text style={s.newsTitle}>{post.title}</Text> : null}
            <Text style={s.newsContent} numberOfLines={3}>{post.content}</Text>
          </View>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={() => navigation.navigate('PostDetail', { postId: post._id })}>
          {post.content ? <Text style={s.cardBody}>{post.content}</Text> : null}
          {post.imageUrl && <Image source={{ uri: post.imageUrl }} style={s.postImage} />}
        </TouchableOpacity>
      )}

      {/* Tags */}
      {post.tags?.length > 0 && (
        <View style={s.tagsRow}>
          {post.tags.map((t, i) => <Text key={i} style={s.tag}>{t}</Text>)}
        </View>
      )}

      {/* Acciones */}
      <View style={s.cardActions}>
        <TouchableOpacity style={s.act} onPress={() => onReact(post._id, 'like')}>
          <Ionicons name={hasLiked ? 'heart' : 'heart-outline'} size={18} color={hasLiked ? colors.c3 : colors.textDim} />
          <Text style={s.actCount}>{likeCount}</Text>
        </TouchableOpacity>

        {emojiGroups.map(g => (
          <TouchableOpacity key={g.emoji} style={s.act} onPress={() => onReact(post._id, g.emoji)}>
            <Text style={[s.actIcon, myEmoji?.type === g.emoji && { opacity: 1 }]}>{g.emoji}</Text>
            <Text style={s.actCount}>{g.count}</Text>
          </TouchableOpacity>
        ))}

        <View>
          <TouchableOpacity style={s.act} onPress={() => setOpenPickerId(prev => prev === post._id ? null : post._id)}>
            <Ionicons name="add" size={18} color="#fff" />
          </TouchableOpacity>
          {openPickerId === post._id && (
            <View style={s.emojiPicker}>
              {['😂','😮','😢','😡','🤯','👏','🥰','💀','🔥','👀','💯','🫶','😍','🤣','😭','🙌'].map(e => (
                <TouchableOpacity key={e} style={s.emojiOpt} onPress={() => { onReact(post._id, e); setOpenPickerId(null); }}>
                  <Text style={s.emojiOptTxt}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity style={s.act} onPress={() => setShowComments(!showComments)}>
          <Ionicons name="chatbubble-outline" size={15} color="#fff" />
          <Text style={s.actCount}>{post.comments.length}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.act, { marginLeft: 'auto' }]}>
          <Ionicons name="share-outline" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Comentarios */}
      {showComments && (
        <View style={s.commentsBox}>
          <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
            {(() => {
              const topLevel = post.comments.filter(c => !c.replyTo?.commentId);
              const replies  = post.comments.filter(c => !!c.replyTo?.commentId);
              return topLevel.map((c, i) => {
                const cReplies = replies.filter(r => r.replyTo.commentId?.toString() === c._id?.toString());
                return (
                  <View key={i}>
                    {/* Comentario principal */}
                    <View style={s.comment}>
                      <TouchableOpacity
                        onPress={() => navigation.navigate('PublicProfile', { username: c.user?.username })}
                        style={{ marginRight: 8 }}
                      >
                        <AvatarWithFrame
                          size={28}
                          avatarUrl={c.user?.avatarUrl}
                          username={c.user?.username}
                          profileFrame={c.user?.profileFrame}
                          frameUrl={c.user?.profileFrameUrl}
                        />
                      </TouchableOpacity>
                      <View style={{ flex: 1 }}>
                        <TouchableOpacity onPress={() => navigation.navigate('PublicProfile', { username: c.user?.username })}>
                          <Text style={s.commentUser}>{c.user?.username}</Text>
                        </TouchableOpacity>
                        <Text style={s.commentText}>{c.text}</Text>
                      </View>
                      <TouchableOpacity
                        onLongPress={() => { const uid = c.user?._id?.toString() || c.user?.toString(); if (uid === currentUserId?.toString()) setDeleteCommentModal(c._id); }}
                        onPress={() => setReplyToComment({ commentId: c._id, username: c.user?.username, text: c.text })}
                      >
                        <Ionicons name="return-down-forward-outline" size={14} color="#555" />
                      </TouchableOpacity>
                    </View>

                    {/* Respuestas */}
                    {cReplies.map((r, j) => (
                      <View key={j} style={s.commentReply}>
                        <View style={s.commentReplyLine} />
                        <TouchableOpacity
                          onPress={() => navigation.navigate('PublicProfile', { username: r.user?.username })}
                          style={{ marginRight: 8 }}
                        >
                          <AvatarWithFrame
                            size={24}
                            avatarUrl={r.user?.avatarUrl}
                            username={r.user?.username}
                            profileFrame={r.user?.profileFrame}
                            frameUrl={r.user?.profileFrameUrl}
                          />
                        </TouchableOpacity>
                        <View style={{ flex: 1 }}>
                          <TouchableOpacity onPress={() => navigation.navigate('PublicProfile', { username: r.user?.username })}>
                            <Text style={s.commentUser}>{r.user?.username}</Text>
                          </TouchableOpacity>
                          <Text style={s.commentText}>{r.text}</Text>
                        </View>
                        <TouchableOpacity onPress={() => setReplyToComment({ commentId: c._id, username: c.user?.username, text: c.text })}>
                          <Ionicons name="return-down-forward-outline" size={14} color="#555" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                );
              });
            })()}
          </ScrollView>

          {replyToComment && (
            <View style={s.commentReplyBar}>
              <Text style={s.commentReplyBarTxt} numberOfLines={1}>↩ @{replyToComment.username}: {replyToComment.text?.slice(0,40)}</Text>
              <TouchableOpacity onPress={() => setReplyToComment(null)}>
                <Text style={{ color: '#888', paddingHorizontal: 8 }}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={s.commentInput}>
            <TextInput
              style={s.commentField}
              placeholder="Escribe un comentario..."
              placeholderTextColor={colors.textDim}
              value={commentText}
              onChangeText={setCommentText}
            />
            <TouchableOpacity
              style={[s.sendBtn, (!commentText.trim() || sending) && s.sendBtnDisabled]}
              onPress={submitComment}
              disabled={!commentText.trim() || sending}
            >
              <Ionicons name="send" size={15} color={colors.black} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card:       { marginHorizontal: 16, marginTop: 12, backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 16 },
  cardHead:   { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cardUser:   { color: colors.textHi, fontWeight: '600', fontSize: 13 },
  cardMeta:   { color: colors.textDim, fontSize: 10, marginTop: 1 },
  cardBody:   { color: colors.textMid, fontSize: 13, lineHeight: 20, marginBottom: 10 },
  deleteBtn:  { padding: 8, marginLeft: 4, backgroundColor: 'rgba(255,0,0,0.15)', borderRadius: 8 },
  deleteBtnTxt:{ color: '#ff4444', fontSize: 18, fontWeight: 'bold' },
  postImage:  { width: '100%', aspectRatio: 4/3, borderRadius: 12, marginBottom: 10, backgroundColor: colors.surface },
  newsCard:   { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(234,179,8,0.2)', overflow: 'hidden', marginBottom: 10 },
  newsCover:  { width: '100%', height: 160 },
  newsBody:   { padding: 12, gap: 8 },
  newsBadge:  { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(234,179,8,0.1)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  newsBadgeTxt:{ color: 'rgba(251,191,36,1)', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  newsTitle:  { color: colors.textHi, fontSize: 16, fontWeight: '700', lineHeight: 22 },
  newsContent:{ color: colors.textDim, fontSize: 13, lineHeight: 20 },
  tagsRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  tag:        { color: colors.c1, fontSize: 11, opacity: 0.7 },
  cardActions:{ flexDirection: 'row', alignItems: 'center', gap: 20 },
  act:        { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actIcon:    { fontSize: 16, color: colors.textDim },
  actCount:   { color: colors.textDim, fontSize: 12 },
  emojiPicker:{ position: 'absolute', bottom: 36, left: -60, zIndex: 99, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.borderC, flexDirection: 'row', flexWrap: 'wrap', padding: 8, gap: 4, width: 220 },
  emojiOpt:   { padding: 5 },
  emojiOptTxt:{ fontSize: 22 },
  commentsBox:{ marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  comment:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  commentUser:{ color: colors.c1, fontSize: 12, fontWeight: '600', marginBottom: 1 },
  commentText:{ color: colors.textMid, fontSize: 12 },
  commentReply:     { flexDirection: 'row', alignItems: 'flex-start', paddingLeft: 16, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#111' },
  commentReplyLine: { width: 2, backgroundColor: '#333', marginRight: 10, borderRadius: 2, alignSelf: 'stretch' },
  commentReplyBar:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', padding: 6, borderRadius: 8, marginBottom: 4 },
  commentReplyBarTxt:{ color: '#888', fontSize: 11, flex: 1 },
  commentInput: { flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: 'rgba(8,20,36,0.95)', borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 6 },
  commentField: { flex: 1, color: colors.textHi, fontSize: 13 },
  sendBtn:      { backgroundColor: colors.c1, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  sendBtnDisabled:{ backgroundColor: 'rgba(0,229,204,0.3)' },
  modBadge:   { backgroundColor: 'rgba(251,191,36,0.15)', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1, borderColor: 'rgba(251,191,36,0.4)' },
  modBadgeTxt:{ color: 'rgba(251,191,36,1)', fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  adminBadge: { backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)' },
  adminBadgeTxt:{ color: 'rgba(239,68,68,0.9)', fontSize: 8, fontWeight: '800', letterSpacing: 1 },
});
