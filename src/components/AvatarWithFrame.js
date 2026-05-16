import React from 'react';
import { View, Image, Text } from 'react-native';
import { Image as ExpoImage } from 'expo-image';

const FRAME_001_URL       = 'https://res.cloudinary.com/dlpdzgkeg/image/upload/frames/frame_001.webp';
const BADGE_ADMIN        = require('../../assets/badge-admin.png');
const BADGE_MOD          = require('../../assets/badge-mod.png');
const BADGE_COL          = require('../../assets/badge-col.png');

const BADGE_BY_ROLE = { admin: BADGE_ADMIN, mod: BADGE_MOD, collaborator: BADGE_COL };

export default function AvatarWithFrame({
  size = 40,
  avatarUrl,
  username,
  profileFrame,
  frameUrl,
  bgColor = 'rgba(0,229,204,0.1)',
  style,
  banned = false,
  badgeRole,
}) {
  if (banned) {
    return (
      <Image
        source={require('../../assets/ban-icon.png')}
        style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
      />
    );
  }
  const isSystem    = profileFrame === 'frame_001';
  const hasFrame    = isSystem || !!frameUrl;
  const resolvedUrl = isSystem ? FRAME_001_URL : frameUrl;
  const radius      = size / 2;
  const frameSize   = size * 1.42; // ~1/0.70
  const offset      = (frameSize - size) / 2;
  const badgeSize   = size * 0.45;
  const badgeSource = BADGE_BY_ROLE[badgeRole] ?? null;

  // Sin marco — simple
  if (!hasFrame) {
    return (
      <View style={[{ width: size, height: size }, style]}>
        <View style={{
          width: size, height: size, borderRadius: radius,
          backgroundColor: bgColor,
          alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {avatarUrl
            ? <Image source={{ uri: avatarUrl }} style={{ width: size, height: size, borderRadius: radius }} />
            : <Text style={{ color: '#16B88A', fontWeight: 'bold', fontSize: size * 0.38 }}>
                {username?.[0]?.toUpperCase()}
              </Text>}
        </View>
        {badgeSource && (
          <Image
            source={badgeSource}
            style={{ position: 'absolute', bottom: -badgeSize * 0.38, left: (size - badgeSize) / 2, width: badgeSize, height: badgeSize, zIndex: 20 }}
          />
        )}
      </View>
    );
  }

  // Con marco:
  // - El contenedor externo es frameSize x frameSize (para que el frame no se clipee)
  // - Los márgenes negativos compensan para que no empuje el layout
  // - El avatar está centrado dentro
  return (
    <View style={[{
      width: frameSize,
      height: frameSize,
      marginTop: -offset,
      marginBottom: -offset,
      marginLeft: -offset,
      marginRight: -offset,
      alignItems: 'center',
      justifyContent: 'center',
    }, style]}>
      {/* Avatar */}
      <View style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: bgColor,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {avatarUrl
          ? <Image source={{ uri: avatarUrl }} style={{ width: size, height: size, borderRadius: radius }} />
          : <Text style={{ color: '#16B88A', fontWeight: 'bold', fontSize: size * 0.38 }}>
              {username?.[0]?.toUpperCase()}
            </Text>}
      </View>

      {/* Frame animado encima */}
      {resolvedUrl && (
        <ExpoImage
          source={{ uri: resolvedUrl }}
          style={{
            position: 'absolute',
            top: 0, left: 0,
            width: frameSize,
            height: frameSize,
            zIndex: 10,
          }}
          contentFit="contain"
        />
      )}

      {/* Badge de rol — encima del marco */}
      {badgeSource && (
        <Image
          source={badgeSource}
          style={{ position: 'absolute', bottom: offset - badgeSize * 0.38, left: (frameSize - badgeSize) / 2, width: badgeSize, height: badgeSize, zIndex: 20 }}
        />
      )}
    </View>
  );
}
