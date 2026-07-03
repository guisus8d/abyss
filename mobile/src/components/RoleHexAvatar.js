import React, { useRef } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Svg, { Defs, ClipPath, Polygon, Image as SvgImage } from 'react-native-svg';

const ROLE_HEX_POINTS = '50,2 93,30 93,68 50,98 7,68 7,30'; // matches mask_role_foreground.png outline

let hexAvatarSeq = 0;

export default function RoleHexAvatar({ avatarUrl, size = 30, borderColor }) {
  const clipId = useRef(`roleHexAvatar-${++hexAvatarSeq}`).current;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Defs>
          <ClipPath id={clipId}>
            <Polygon points={ROLE_HEX_POINTS} />
          </ClipPath>
        </Defs>
        <SvgImage
          href={{ uri: avatarUrl }}
          x="0" y="0" width="100" height="100"
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
        />
      </Svg>
      <Image
        source={require('../../assets/chats/Fiesta/rol/mask_role_foreground.png')}
        style={[StyleSheet.absoluteFill, borderColor && { tintColor: borderColor }]}
        resizeMode="contain"
      />
    </View>
  );
}
