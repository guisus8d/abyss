import React from 'react';
import { Image, StyleSheet } from 'react-native';

export default function VerifiedIcon({ isCreator, size = 13 }) {
  if (!isCreator) return null;
  return (
    <Image
      source={require('../../assets/icon_verified.png')}
      style={[st.icon, { width: size, height: size }]}
    />
  );
}

const st = StyleSheet.create({
  icon: { resizeMode: 'contain', opacity: 0.9 },
});
