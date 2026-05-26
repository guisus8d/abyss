import React from 'react';
import { Image } from 'react-native';

const source = require('../../assets/icons/coins.png');

export default function CoinIcon({ size = 16, style }) {
  return (
    <Image
      source={source}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
    />
  );
}
