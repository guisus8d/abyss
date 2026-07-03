import React, { memo, useCallback } from 'react';
import {
  Modal, View, FlatList, TouchableOpacity, Text, StyleSheet,
  Dimensions, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EMOJI_LIST } from '../constants/emojis';

const NUM_COLS  = 8;
const ITEM_SIZE = Math.floor(Dimensions.get('window').width / NUM_COLS);

const EmojiItem = memo(function EmojiItem({ item, onSelect }) {
  return (
    <TouchableOpacity
      style={[p.item, { width: ITEM_SIZE, height: ITEM_SIZE }]}
      onPress={() => onSelect(item)}
      activeOpacity={0.65}
    >
      <Text style={p.emoji}>{item}</Text>
    </TouchableOpacity>
  );
});

function EmojiPickerSheet({ visible, onSelect, onClose }) {
  const insets = useSafeAreaInsets();

  const renderItem = useCallback(({ item }) => (
    <EmojiItem item={item} onSelect={onSelect} />
  ), [onSelect]);

  const getItemLayout = useCallback((_, index) => ({
    length: ITEM_SIZE,
    offset: ITEM_SIZE * Math.floor(index / NUM_COLS),
    index,
  }), []);

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={p.backdrop}>
        <Pressable
          style={[p.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
          onPress={e => e.stopPropagation()}
        >
          <View style={p.handle} />
          <FlatList
            data={EMOJI_LIST}
            keyExtractor={item => item}
            numColumns={NUM_COLS}
            renderItem={renderItem}
            getItemLayout={getItemLayout}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
          />
        </Pressable>
      </View>
    </Modal>
  );
}

export default memo(EmojiPickerSheet);

const p = StyleSheet.create({
  backdrop: { flex:1, justifyContent:'flex-end' },
  sheet:    { backgroundColor:'#0b1521', borderTopLeftRadius:22, borderTopRightRadius:22, borderWidth:1, borderColor:'rgba(255,255,255,0.07)', paddingTop:12 },
  handle:   { width:38, height:4, backgroundColor:'rgba(255,255,255,0.15)', borderRadius:2, alignSelf:'center', marginBottom:12 },
  item:     { alignItems:'center', justifyContent:'center' },
  emoji:    { fontSize:26 },
});
