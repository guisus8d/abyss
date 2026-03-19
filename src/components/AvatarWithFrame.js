import React from 'react';
import { View, Image, Text } from 'react-native';

const FRAME_001_URL = 'https://res.cloudinary.com/dlpdzgkeg/image/upload/frames/frame_001.webp';

export default function AvatarWithFrame({
  size = 40,
  avatarUrl,
  username,
  profileFrame,
  frameUrl,
  bgColor = 'rgba(0,229,204,0.1)',
  style,
}) {
  const isSystem    = profileFrame === 'frame_001';
  const hasFrame    = isSystem || !!frameUrl;
  const resolvedUrl = isSystem ? FRAME_001_URL : frameUrl;

  const radius    = size / 2;
  const frameSize = hasFrame ? size / 0.70 : size;
  const offset    = (frameSize - size) / 2;

  return (
    // Contenedor siempre del tamaño del avatar — el frame se sale con overflow visible
    <View style={[{ width: size, height: size, overflow: 'visible' }, style]}>
      {/* Avatar centrado */}
      <View style={{
        width: size, height: size, borderRadius: radius,
        backgroundColor: bgColor,
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={{ width: size, height: size, borderRadius: radius }} />
        ) : (
          <Text style={{ color: '#00e5cc', fontWeight: 'bold', fontSize: size * 0.38 }}>
            {username?.[0]?.toUpperCase()}
          </Text>
        )}
      </View>

      {/* Marco superpuesto — se sale del contenedor pero no empuja nada */}
      {hasFrame && resolvedUrl && (
        <Image
          source={{ uri: resolvedUrl }}
          style={{
            position: 'absolute',
            top: -offset,
            left: -offset,
            width: frameSize,
            height: frameSize,
            zIndex: 10,
          }}
          resizeMode="contain"
          pointerEvents="none"
        />
      )}
    </View>
  );
}
