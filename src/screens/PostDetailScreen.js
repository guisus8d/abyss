import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, StatusBar, SafeAreaView, ActivityIndicator,
  TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import AvatarWithFrame from '../components/AvatarWithFrame';

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s/60)}m`;
  if (s < 86400) return `${Math.floor(s/3600)}h`;
  return `${Math.floor(s/86400)}d`;
}

export default function PostDetailScreen({ route, navigation }) {
  const { postId } = route.params;
  const { user } = useAuthStore();
  const [post, setPost]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [comment, setComment]     = useState('');
  const [sending, setSending]     = useState(false);
  const [replyTo, setReplyTo]     = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    loadPost();
  }, []);

  async function loadPost() {
    try {
      const { data } = await api.get(`/posts/${postId}`);
      setPost(data.post);
    } catch {
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }

  async function handleComment() {
    if (!comment.trim() || sending) return;
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
      setSending(false);
    }
  }

  if (loading) return (
    <View style={s.root}><ActivityIndicator color={colors.c1} style={{ marginTop: 60 }} /></View>
  );
  if (!post) return null;

  const isNews = post.postType === 'news';

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.black} />
      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.c1} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{isNews ? 'NOTICIA' : 'POST'}</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

          {/* Autor */}
          <TouchableOpacity style={s.authorRow}
            onPress={() => navigation.navigate('PublicProfile', { username: post.author?.username })}>
            <AvatarWithFrame size={42} avatarUrl={post.author?.avatarUrl}
              username={post.author?.username} profileFrame={post.author?.profileFrame} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={s.authorName}>@{post.author?.username}</Text>
              <Text style={s.authorMeta}>XP {post.author?.xp || 0} · {timeAgo(post.createdAt)}</Text>
            </View>
          </TouchableOpacity>

          {/* Contenido según tipo */}
          {isNews ? (
            <View style={s.newsWrap}>
              {/* Imagen portada */}
              {post.imageUrl && (
                <Image source={{ uri: post.imageUrl }} style={s.newsCover} resizeMode="cover" />
              )}
              <View style={s.newsBody}>
                {/* Badge */}
                <View style={s.newsBadge}>
                  <Ionicons name="newspaper-outline" size={11} color="rgba(251,191,36,1)" />
                  <Text style={s.newsBadgeTxt}>NOTICIA</Text>
                </View>
                {/* Título */}
                {post.title ? <Text style={s.newsTitle}>{post.title}</Text> : null}
                {/* Cuerpo */}
                {post.content ? <Text style={s.newsContent}>{post.content}</Text> : null}
              </View>
            </View>
          ) : (
            <View style={s.quickWrap}>
              {post.content ? <Text style={s.postContent}>{post.content}</Text> : null}
              {post.imageUrl && (
                <Image source={{ uri: post.imageUrl }} style={s.postImage} resizeMode="cover" />
              )}
            </View>
          )}

          {/* Tags */}
          {post.tags?.length > 0 && (
            <View style={s.tagsRow}>
              {post.tags.map((t, i) => <Text key={i} style={s.tag}>{t}</Text>)}
            </View>
          )}

          {/* Divisor */}
          <View style={s.divider} />

          {/* Comentarios */}
          <Text style={s.commentsTitle}>COMENTARIOS ({post.comments?.length || 0})</Text>

          {post.comments?.length === 0 && (
            <View style={s.emptyComments}>
              <Ionicons name="chatbubble-outline" size={28} color={colors.textDim} />
              <Text style={s.emptyCommentsTxt}>Sin comentarios aún — sé el primero</Text>
            </View>
          )}

          {(() => {
            const comments = post.comments || [];
            // Separar padres (sin replyTo) y respuestas
            const parents  = comments.filter(c => !c.replyTo?.commentId);
            const replies  = comments.filter(c => !!c.replyTo?.commentId);

            const getReplies = (parentId) =>
              replies.filter(r => r.replyTo?.commentId?.toString() === parentId?.toString());

            const renderComment = (c, isReply = false) => (
              <View key={c._id || Math.random()} style={[s.commentWrap, isReply && s.commentWrapReply]}>
                {isReply && <View style={s.replyLine} />}
                <TouchableOpacity style={s.comment}
                  onPress={() => {
                    // Si es reply, apunta al padre original del hilo
                    const parentId = isReply ? c.replyTo?.commentId : c._id;
                    const parentUsername = isReply ? c.replyTo?.username : c.user?.username;
                    setReplyTo({ commentId: parentId, username: c.user?.username, text: c.text });
                    inputRef.current?.focus();
                  }}>
                  {/* Preview del comentario al que responde */}
                  {isReply && c.replyTo?.text && (
                    <View style={s.replyPreview}>
                      <Text style={s.replyTxt} numberOfLines={1}>↩ @{c.replyTo.username}: {c.replyTo.text}</Text>
                    </View>
                  )}
                  <View style={s.commentRow}>
                    <View style={s.commentAv}>
                      {c.user?.avatarUrl
                        ? <Image source={{ uri: c.user.avatarUrl }} style={{ width: '100%', height: '100%', borderRadius: 16 }} />
                        : <Text style={{ color: colors.c1, fontWeight: '700', fontSize: 11 }}>{c.user?.username?.[0]?.toUpperCase()}</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.commentUser}>@{c.user?.username}</Text>
                      <Text style={s.commentTxt}>{c.text}</Text>
                    </View>
                    <Ionicons name="return-down-back-outline" size={14} color={colors.textDim} />
                  </View>
                </TouchableOpacity>
                {/* Respuestas anidadas — solo 1 nivel máximo */}
                {!isReply && getReplies(c._id).map(r => renderComment(r, true))}
              </View>
            );

            return parents.map(c => renderComment(c, false));
          })()}
        </ScrollView>

        {/* Input comentar */}
        <View style={s.inputWrap}>
          {replyTo && (
            <View style={s.replyBanner}>
              <Text style={s.replyBannerTxt}>↩ Respondiendo a @{replyTo.username}</Text>
              <TouchableOpacity onPress={() => setReplyTo(null)}>
                <Ionicons name="close" size={14} color={colors.textDim} />
              </TouchableOpacity>
            </View>
          )}
          <View style={s.inputRow}>
            <TextInput
              ref={inputRef}
              style={s.input}
              value={comment}
              onChangeText={setComment}
              placeholder="Escribe un comentario..."
              placeholderTextColor={colors.textDim}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[s.sendBtn, (!comment.trim() || sending) && s.sendBtnDisabled]}
              onPress={handleComment}
              disabled={!comment.trim() || sending}
            >
              {sending
                ? <ActivityIndicator size="small" color={colors.black} />
                : <Ionicons name="send" size={16} color={colors.black} />}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: colors.black },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle:{ fontSize: 13, fontWeight: '900', letterSpacing: 5, color: colors.c1 },
  backBtn:    { width: 40 },

  authorRow:  { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 12 },
  authorName: { color: colors.textHi, fontWeight: '700', fontSize: 14 },
  authorMeta: { color: colors.textDim, fontSize: 11, marginTop: 2 },

  newsWrap:   { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(234,179,8,0.2)', marginBottom: 16 },
  newsCover:  { width: '100%', height: 220 },
  newsBody:   { padding: 16, gap: 10 },
  newsBadge:  { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(234,179,8,0.1)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  newsBadgeTxt:{ color: 'rgba(251,191,36,1)', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  newsTitle:  { color: colors.textHi, fontSize: 22, fontWeight: '800', lineHeight: 28 },
  newsContent:{ color: colors.textMid, fontSize: 15, lineHeight: 24 },

  quickWrap:  { paddingHorizontal: 16, marginBottom: 12 },
  postContent:{ color: colors.textHi, fontSize: 16, lineHeight: 24, marginBottom: 12 },
  postImage:  { width: '100%', aspectRatio: 4/3, borderRadius: 14 },

  tagsRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, marginBottom: 12 },
  tag:        { color: colors.c1, fontSize: 12, backgroundColor: 'rgba(0,229,204,0.08)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },

  divider:    { height: 1, backgroundColor: colors.border, marginVertical: 8 },

  commentsTitle:{ color: colors.textDim, fontSize: 10, letterSpacing: 3, paddingHorizontal: 16, marginBottom: 8, marginTop: 8 },

  emptyComments:  { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyCommentsTxt:{ color: colors.textDim, fontSize: 13 },

  comment:    { paddingVertical: 8 },
  commentWrap:     { paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  commentWrapReply:{ paddingLeft: 36, borderBottomWidth: 0 },
  replyLine:       { position: 'absolute', left: 28, top: 0, bottom: 0, width: 1.5, backgroundColor: colors.border },
  replyPreview:    { backgroundColor: colors.card, borderLeftWidth: 2, borderLeftColor: colors.borderC, paddingLeft: 8, paddingVertical: 4, borderRadius: 4, marginBottom: 6 },
  replyTxt:        { color: colors.textDim, fontSize: 11 },
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  commentAv:  { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.deep, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  commentUser:{ color: colors.c1, fontWeight: '700', fontSize: 12, marginBottom: 3 },
  commentTxt: { color: colors.textMid, fontSize: 13, lineHeight: 18 },
  replyPreview:{ backgroundColor: colors.card, borderLeftWidth: 2, borderLeftColor: colors.border, paddingLeft: 8, paddingVertical: 4, borderRadius: 4, marginBottom: 6 },
  replyTxt:   { color: colors.textDim, fontSize: 11 },

  inputWrap:  { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: 12 },
  replyBanner:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 8 },
  replyBannerTxt:{ color: colors.textDim, fontSize: 12 },
  inputRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  input:      { flex: 1, backgroundColor: colors.card, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: colors.textHi, fontSize: 14, maxHeight: 100, borderWidth: 1, borderColor: colors.border },
  sendBtn:    { backgroundColor: colors.c1, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled:{ backgroundColor: 'rgba(0,229,204,0.3)' },
});
