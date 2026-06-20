import React from 'react';
import { Image, StyleSheet } from 'react-native';

export default function GenderIcon({ gender, size = 13 }) {
  if (gender === 'hombre') {
    return <Image source={require('../../assets/generos/ic_male_new.png')} style={[st.icon, { width: size, height: size, tintColor: '#5bb8ff' }]} />;
  }
  if (gender === 'mujer') {
    return <Image source={require('../../assets/generos/ic_female_new.png')} style={[st.icon, { width: size, height: size, tintColor: '#f87fd6' }]} />;
  }
  return null;
}

const st = StyleSheet.create({
  icon: { resizeMode: 'contain', opacity: 0.85 },
});
