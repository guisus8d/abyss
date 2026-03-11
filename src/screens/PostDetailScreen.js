import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, StatusBar, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { colors } from '../theme/colors';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

export default function PostDetailScreen({ route, navigation }) {
  const { postId } = route.params;
  const { user } = useAuthStore();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/posts/${postId}`)
      .then(({ data }) => setPost(data.post))
      .catch(() => navigation.goBack())
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <View style={s.root}>
      <ActivityIndicator color={colors.c1} style={{ marginTop: 60 }} />
    </View>
  );

  if (!post) return null;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.black} />
      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backTxt}>←</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>POST</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={s.content}>
        {/* Autor */}
        <TouchableOpacity style={s.authorRow} onPress={() => navigation.navigate('PublicProfile', { username: post.author?.username })}>
          <View style={s.avatar}>
            {post.author?.avatarUrl
              ? <Image source={{ uri: post.author.avatarUrl }} style={s.avatarImg} />
              : <Text style={s.avatarTxt}>{post.author?.username?.[0]?.toUpperCase()}</Text>
            }
          </View>
          <View>
            <Text style={s.authorName}>@{post.author?.username}</Text>
            <Text style={s.authorXp}>XP {post.author?.xp || 0}</Text>
          </View>
        </TouchableOpacity>

        {/* Contenido */}
        <Text style={s.postContent}>{post.content}</Text>
        {post.imageUrl && <Image source={{ uri: post.imageUrl }} style={s.postImage} resizeMode="cover" />}

        {/* Comentarios */}
        <Text style={s.commentsTitle}>COMENTARIOS ({post.comments?.length || 0})</Text>
        {post.comments?.map((c, i) => (
          <View key={i} style={s.comment}>
            {c.replyTo?.username && (
              <View style={s.replyPreview}>
                <Text style={s.replyTxt}>↩ @{c.replyTo.username}: {c.replyTo.text?.slice(0, 40)}</Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', marginTop: c.replyTo ? 4 : 0 }}>
              <Text style={s.commentUser}>@{c.user?.username} </Text>
              <Text style={s.commentTxt}>{c.text}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: colors.black },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle:  { fontSize: 14, fontWeight: '900', letterSpacing: 4, color: colors.c1 },
  backBtn:      { padding: 8, width: 40 },
  backTxt:      { color: colors.c1, fontSize: 22 },
  content:      { padding: 16 },
  authorRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  avatar:       { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,229,204,0.1)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg:    { width: 40, height: 40, borderRadius: 20 },
  avatarTxt:    { color: colors.c1, fontWeight: 'bold' },
  authorName:   { color: colors.textHi, fontWeight: '700', fontSize: 14 },
  authorXp:     { color: colors.textDim, fontSize: 11 },
  postContent:  { color: colors.textHi, fontSize: 15, lineHeight: 22, marginBottom: 12 },
  postImage:    { width: '100%', aspectRatio: 16/9, borderRadius: 12, marginBottom: 16 },
  commentsTitle:{ color: colors.textDim, fontSize: 11, letterSpacing: 3, marginTop: 16, marginBottom: 10 },
  comment:      { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#111' },
  replyPreview: { backgroundColor: '#1e1e1e', borderLeftWidth: 3, borderLeftColor: '#555', paddingLeft: 8, paddingVertical: 4, borderRadius: 4, marginBottom: 4 },
  replyTxt:     { color: '#888', fontSize: 11 },
  commentUser:  { color: colors.c1, fontWeight: '700', fontSize: 13 },
  commentTxt:   { color: colors.textMid, fontSize: 13, flex: 1 },
});
