import React, { useState, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

const SCREEN_W = Dimensions.get('window').width;

export default function VideoPlayer({ post, navigation, fullWidth = false }) {
  const videoRef = useRef(null);
  const [playing,         setPlaying]         = useState(false);
  const [videoDimensions, setVideoDimensions] = useState(null);
  const [isFinished,      setIsFinished]      = useState(false);

  const cardW      = fullWidth ? SCREEN_W : SCREEN_W * 0.65;
  const videoRatio = videoDimensions
    ? videoDimensions.height / videoDimensions.width
    : 9 / 16;
  const videoH     = Math.min(cardW * videoRatio, SCREEN_W * 1.2);

  async function togglePlay() {
    if (!videoRef.current) return;
    if (playing) {
      await videoRef.current.pauseAsync();
    } else {
      setIsFinished(false);
      await videoRef.current.playAsync();
    }
  }

  return (
    <View style={[s.wrap, { width: cardW, height: videoH, alignSelf: fullWidth ? 'stretch' : 'flex-start' }]}>
      <Video
        ref={videoRef}
        source={{ uri: post.videoUrl }}
        posterSource={post.videoThumbnailUrl ? { uri: post.videoThumbnailUrl } : undefined}
        usePoster={!!post.videoThumbnailUrl}
        shouldPlay={playing}
        resizeMode="contain"
        useNativeControls={false}
        style={s.video}
        initialPositionMillis={(post.videoStartTime || 0) * 1000}
        onReadyForDisplay={({ naturalSize }) => {
          if (naturalSize?.width && naturalSize?.height) {
            setVideoDimensions({ width: naturalSize.width, height: naturalSize.height });
          }
        }}
        onPlaybackStatusUpdate={(status) => {
          if (!status.isLoaded) return;
          if (status.didJustFinish) {
            setIsFinished(true);
            setPlaying(false);
            videoRef.current?.pauseAsync().then(() =>
              videoRef.current?.setPositionAsync((post.videoStartTime || 0) * 1000)
            );
          } else {
            setPlaying(status.isPlaying);
          }
        }}
      />

      {/* Overlay de navegacion — solo cuando hay navigation y el video no esta reproduciendose */}
      {!playing && navigation && (
        <TouchableOpacity
          style={[StyleSheet.absoluteFill, { zIndex: 1 }]}
          onPress={() => navigation.navigate('PostDetail', { postId: post._id })}
          activeOpacity={1}
        />
      )}

      {/* Boton play/pause — siempre encima */}
      <TouchableOpacity style={[s.overlay, { zIndex: 2 }]} onPress={togglePlay} activeOpacity={0.8}>
        {!playing && (
          <Ionicons name="play-circle" size={fullWidth ? 56 : 48} color="rgba(255,255,255,0.90)" />
        )}
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:    { backgroundColor: 'transparent', borderRadius: 12, overflow: 'hidden', marginBottom: 10 },
  video:   { width: '100%', height: '100%' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
