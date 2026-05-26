import React, { useState, useRef } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import api from '../services/api';

export default function MentionInput({ value, onChangeText, style, placeholder, multiline, maxLength, autoFocus }) {
  const [suggestions, setSuggestions] = useState([]);
  const [mentionQuery, setMentionQuery] = useState(null);
  const debounceRef = useRef(null);

  async function handleChange(text) {
    onChangeText(text);
    // Detectar @ seguido de texto
    const match = text.match(/@(\w*)$/);
    if (match) {
      const query = match[1];
      setMentionQuery(query);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        if (query.length === 0) { setSuggestions([]); return; }
        try {
          const { data } = await api.get(`/users/search?q=${query}&limit=5`);
          setSuggestions(data.users || []);
        } catch { setSuggestions([]); }
      }, 300);
    } else {
      setMentionQuery(null);
      setSuggestions([]);
    }
  }

  function pickUser(username) {
    // Reemplazar @query por @username completo
    const newText = value.replace(/@(\w*)$/, `@${username} `);
    onChangeText(newText);
    setSuggestions([]);
    setMentionQuery(null);
  }

  return (
    <View style={{ position: 'relative' }}>
      {suggestions.length > 0 && (
        <View style={s.dropdown}>
          {suggestions.map(u => (
            <TouchableOpacity key={u._id} style={s.item} onPress={() => pickUser(u.username)}>
              <Text style={s.at}>@</Text>
              <Text style={s.username}>{u.username}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <TextInput
        style={style}
        placeholder={placeholder}
        placeholderTextColor={colors.textDim}
        value={value}
        onChangeText={handleChange}
        multiline={multiline}
        maxLength={maxLength}
        autoFocus={autoFocus}
      />
    </View>
  );
}

const s = StyleSheet.create({
  dropdown: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1, borderColor: '#333',
    borderRadius: 10, marginBottom: 4,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: '#222',
    gap: 4,
  },
  at:       { color: '#666', fontSize: 13 },
  username: { color: '#eee', fontSize: 13, fontWeight: '600' },
});
