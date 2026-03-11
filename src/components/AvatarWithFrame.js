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
  const hasFrame   = profileFrame === 'frame_001';
  const radius     = size / 2;
  // The inner circle of frame.webp is ~60% of the total image size
  // So frameSize = size / 0.60 makes the circle fit exactly around the avatar
  const frameSize    = hasFrame ? size / 0.70 : size;
  const wrapSize     = frameSize;
  const avatarOffset = (frameSize - size) / 2;

  return (
    <View style={[{ width: wrapSize, height: wrapSize, alignItems: 'center', justifyContent: 'center' }, style]}>
      {/* Avatar circle — centered inside wrapper */}
      <View style={{
        position: 'absolute',
        top: avatarOffset, left: avatarOffset,
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

      {/* Frame — same size as wrapper, sits on top */}
      {hasFrame && (
        <Image
          source={{ uri: FRAME_URL }}
          style={{
            position: 'absolute',
            top: 0, left: 0,
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
