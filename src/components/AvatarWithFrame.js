import React from 'react';
import { View, Image, Text } from 'react-native';

const FRAME_URL = 'https://res.cloudinary.com/dlpdzgkeg/image/upload/frames/frame_001.webp';

/**
 * AvatarWithFrame
 * Props:
 *   size         — diameter in px (default 40)
 *   avatarUrl    — image URL or null
 *   username     — fallback initial letter
 *   profileFrame — 'frame_001' | 'default' | null
 *   bgColor      — background color of the circle (default teal tint)
 *   style        — extra style for the outer wrapper
 */
export default function AvatarWithFrame({
  size = 40,
  avatarUrl,
  username,
  profileFrame,
  bgColor = 'rgba(0,229,204,0.1)',
  style,
}) {
  const hasFrame  = profileFrame === 'frame_001';
  const radius    = size / 2;
  const frameSize = size * 1.28;
  const offset    = -((frameSize - size) / 2);

  return (
    <View style={[{ width: size, height: size, position: 'relative' }, style]}>
      {/* Avatar circle */}
      <View style={{
        width: size, height: size, borderRadius: radius,
        backgroundColor: bgColor,
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={{ width: size, height: size, borderRadius: radius }}
          />
        ) : (
          <Text style={{ color: '#00e5cc', fontWeight: 'bold', fontSize: size * 0.38 }}>
            {username?.[0]?.toUpperCase()}
          </Text>
        )}
      </View>

      {/* Frame overlay */}
      {hasFrame && (
        <Image
          source={{ uri: FRAME_URL }}
          style={{
            position: 'absolute',
            top: offset, left: offset,
            width: frameSize, height: frameSize,
            zIndex: 10,
          }}
          resizeMode="contain"
          pointerEvents="none"
        />
      )}
    </View>
  );
}
