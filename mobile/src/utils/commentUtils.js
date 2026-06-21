import React from 'react';
import { Text, Linking } from 'react-native';

export const COMMENT_EMOJIS = ['❤️','😂','😍','🔥','👏','😮','😢','😡','💯','👍'];

const URL_RE = /https?:\/\/[^\s]+/g;

function openUrl(url, navigation) {
  let m;
  m = url.match(/(?:abyss:\/\/|https?:\/\/abyss\.social\/)post\/([a-zA-Z0-9]{1,})/i);
  if (m) { navigation.navigate('PostDetail', { postId: m[1] }); return; }
  m = url.match(/(?:abyss:\/\/|https?:\/\/abyss\.social\/)user\/([^/?#\s]+)/i);
  if (m) { navigation.navigate('PublicProfile', { username: m[1] }); return; }
  Linking.openURL(url).catch(() => {});
}

export function renderCommentText(text, navigation, baseStyle, linkStyle) {
  const parts = [];
  let last = 0;
  let m;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text)) !== null) {
    if (m.index > last) parts.push({ kind: 'text', val: text.slice(last, m.index) });
    parts.push({ kind: 'url', val: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ kind: 'text', val: text.slice(last) });
  if (parts.length === 0) return <Text style={baseStyle}>{text}</Text>;
  return (
    <Text style={baseStyle}>
      {parts.map((p, i) =>
        p.kind === 'url'
          ? <Text key={i} style={linkStyle} onPress={() => openUrl(p.val, navigation)}>{p.val}</Text>
          : <Text key={i}>{p.val}</Text>
      )}
    </Text>
  );
}
