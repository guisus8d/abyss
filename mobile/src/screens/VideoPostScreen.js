import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, PanResponder, Animated,
  ScrollView, Platform,
} from 'react-native';
import { Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import { BASE_URL } from '../services/api';

const APP_VERSION   = '1.0.0';
const MAX_SEGMENT   = 60;          // seconds
const MAX_DURATION  = 300;         // 5 minutes
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const THUMB_SIZE    = 26;

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function VideoPostScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { token } = useAuthStore();

  const [phase,       setPhase]       = useState('select');
  const [asset,       setAsset]       = useState(null);
  const [title,       setTitle]       = useState('');
  const [progress,    setProgress]    = useState(0);
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [playPosSec,  setPlayPosSec]  = useState(0);
  const [startTimeSt, setStartTimeSt] = useState(0);   // display only
  const [endTimeSt,   setEndTimeSt]   = useState(0);   // display only

  const videoRef = useRef(null);

  // ── Slider refs — never stale inside PanResponder ────────────────────────
  const trackW       = useRef(0);      // pixels
  const durRef       = useRef(0);      // seconds
  const startPxAnim  = useRef(new Animated.Value(0)).current;
  const endPxAnim    = useRef(new Animated.Value(0)).current;
  const startPxSnap  = useRef(0);      // last confirmed px (mirrors anim value)
  const endPxSnap    = useRef(0);

  function syncSlider(dur, w) {
    // initial: start=0, end=min(dur,60)/dur * w
    const endPx = w * Math.min(dur, MAX_SEGMENT) / dur;
    startPxSnap.current = 0;
    endPxSnap.current   = endPx;
    startPxAnim.setValue(0);
    endPxAnim.setValue(endPx);
    setStartTimeSt(0);
    setEndTimeSt(Math.min(dur, MAX_SEGMENT));
  }

  function readTimes() {
    const dur = durRef.current;
    const w   = trackW.current;
    if (!dur || !w) return { st: 0, et: 0 };
    return {
      st: (startPxSnap.current / w) * dur,
      et: (endPxSnap.current  / w) * dur,
    };
  }

  // ── Stop when playhead exits segment ─────────────────────────────────────
  const onPlaybackStatus = useCallback((status) => {
    if (!status.isLoaded) return;
    const pos = (status.positionMillis || 0) / 1000;
    setPlayPosSec(pos);
    const { et } = readTimes();
    if (status.isPlaying && pos >= et) {
      videoRef.current?.pauseAsync();
      setIsPlaying(false);
    }
  }, []);

  // ── Pick video ────────────────────────────────────────────────────────────
  async function pickVideo() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'Videos',
      allowsEditing: false,
      quality: 1,
    });
    if (result.canceled) return;

    const picked    = result.assets[0];
    const durationSec = (picked.duration || 0) / 1000;

    if (durationSec > MAX_DURATION) {
      Alert.alert('Video muy largo', 'Selecciona un video de menos de 5 minutos.');
      return;
    }
    if (picked.fileSize && picked.fileSize > MAX_FILE_SIZE) {
      Alert.alert('Archivo muy grande', 'El video no puede superar 50 MB.');
      return;
    }

    durRef.current = durationSec;
    setAsset(picked);
    setPhase('edit');
  }

  // ── Toggle play ───────────────────────────────────────────────────────────
  async function togglePlay() {
    if (!videoRef.current) return;
    if (isPlaying) {
      await videoRef.current.pauseAsync();
      setIsPlaying(false);
    } else {
      const { st } = readTimes();
      await videoRef.current.setPositionAsync(st * 1000);
      await videoRef.current.playAsync();
      setIsPlaying(true);
    }
  }

  // ── PanResponder — start thumb ────────────────────────────────────────────
  const startPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      startPxAnim.setOffset(startPxSnap.current);
      startPxAnim.setValue(0);
    },
    onPanResponderMove: (_, gs) => {
      const w   = trackW.current;
      const dur = durRef.current;
      if (!w || !dur) return;

      const endPx     = endPxSnap.current;
      const maxSegPx  = (MAX_SEGMENT / dur) * w;
      const minStartPx = Math.max(0, endPx - maxSegPx);
      const maxStartPx = endPx - 1;
      const newPx      = startPxSnap.current + gs.dx;
      const clampedPx  = Math.max(minStartPx, Math.min(newPx, maxStartPx));

      startPxAnim.setValue(clampedPx - startPxSnap.current);
      // live update display (via a separate Animated value trick below — here
      // we just update the snap so readTimes() stays correct mid-drag)
      startPxSnap.current = clampedPx;
      setStartTimeSt((clampedPx / w) * dur);
    },
    onPanResponderRelease: () => {
      startPxAnim.flattenOffset();
      startPxSnap.current = startPxAnim._value;
      const { st } = readTimes();
      setStartTimeSt(st);
    },
  })).current;

  // ── PanResponder — end thumb ──────────────────────────────────────────────
  const endPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      endPxAnim.setOffset(endPxSnap.current);
      endPxAnim.setValue(0);
    },
    onPanResponderMove: (_, gs) => {
      const w   = trackW.current;
      const dur = durRef.current;
      if (!w || !dur) return;

      const startPx  = startPxSnap.current;
      const maxSegPx = (MAX_SEGMENT / dur) * w;
      const minEndPx = startPx + 1;
      const maxEndPx = Math.min(w, startPx + maxSegPx);
      const newPx    = endPxSnap.current + gs.dx;
      const clampedPx = Math.max(minEndPx, Math.min(newPx, maxEndPx));

      endPxAnim.setValue(clampedPx - endPxSnap.current);
      endPxSnap.current = clampedPx;
      setEndTimeSt((clampedPx / w) * dur);
    },
    onPanResponderRelease: () => {
      endPxAnim.flattenOffset();
      endPxSnap.current = endPxAnim._value;
      const { et } = readTimes();
      setEndTimeSt(et);
    },
  })).current;

  // ── Upload & publish ──────────────────────────────────────────────────────
  async function handlePublish() {
    if (!title.trim()) {
      Alert.alert('Titulo requerido', 'Agrega un titulo para el video.');
      return;
    }
    const { st, et } = readTimes();
    setPhase('uploading');
    setProgress(0);

    try {
      const formData = new FormData();
      if (Platform.OS === 'web') {
        const resp = await fetch(asset.uri);
        const blob = await resp.blob();
        formData.append('video', blob, 'video.mp4');
      } else {
        formData.append('video', { uri: asset.uri, type: 'video/mp4', name: 'video.mp4' });
      }
      formData.append('startTime', String(st));

      const { videoUrl, thumbnailUrl } = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${BASE_URL}/posts/upload-video`);
        xhr.setRequestHeader('Authorization',  `Bearer ${token}`);
        xhr.setRequestHeader('x-app-version',  APP_VERSION);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            try { reject(new Error(JSON.parse(xhr.responseText)?.error || 'Error al subir video')); }
            catch { reject(new Error('Error al subir video')); }
          }
        };
        xhr.onerror = () => reject(new Error('Error de red al subir video'));
        xhr.send(formData);
      });

      const postForm = new FormData();
      postForm.append('postType',          'video');
      postForm.append('title',             title.trim());
      postForm.append('content',           title.trim());
      postForm.append('videoUrl',          videoUrl);
      postForm.append('videoDuration',     String(Math.round(et - st)));
      postForm.append('videoStartTime',    String(st));
      postForm.append('videoEndTime',      String(et));
      postForm.append('videoThumbnailUrl', thumbnailUrl);

      const postRes = await fetch(`${BASE_URL}/posts`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'x-app-version': APP_VERSION },
        body:    postForm,
      });
      if (!postRes.ok) {
        const errBody = await postRes.json().catch(() => ({}));
        throw new Error(errBody.error || 'Error al crear el post');
      }

      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.message);
      setPhase('edit');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (phase === 'select') {
    return (
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <View style={s.simpleHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.textHi} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>NUEVO VIDEO</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.selectCenter}>
          <Ionicons name="videocam-outline" size={56} color={colors.textDim} />
          <Text style={s.selectHint}>Selecciona un video de tu galeria</Text>
          <Text style={s.selectSub}>Maximo 5 minutos · 50 MB</Text>
          <TouchableOpacity style={s.selectBtn} onPress={pickVideo} activeOpacity={0.8}>
            <Text style={s.selectBtnTxt}>Seleccionar video</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (phase === 'uploading') {
    return (
      <View style={[s.screen, s.uploadCenter, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.c1} />
        <Text style={s.uploadTitle}>Subiendo video...</Text>
        <View style={s.uploadBarTrack}>
          <View style={[s.uploadBarFill, { width: `${progress}%` }]} />
        </View>
        <Text style={s.uploadPct}>{progress}%</Text>
      </View>
    );
  }

  // phase === 'edit'
  const dur        = durRef.current;
  const canPublish = title.trim().length > 0;
  const progPct    = dur > 0 ? Math.min(100, (playPosSec / dur) * 100) : 0;
  const segSecs    = Math.round(endTimeSt - startTimeSt);

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textHi} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>NUEVO VIDEO</Text>
        <TouchableOpacity
          onPress={handlePublish}
          disabled={!canPublish}
          style={[s.publishBtn, !canPublish && s.publishBtnOff]}
        >
          <Text style={s.publishBtnTxt}>PUBLICAR</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Video */}
        <View style={s.videoWrap}>
          <Video
            ref={videoRef}
            source={{ uri: asset.uri }}
            style={s.video}
            resizeMode="contain"
            shouldPlay={false}
            onPlaybackStatusUpdate={onPlaybackStatus}
            onLoad={(status) => {
              if (status.durationMillis) {
                const d = status.durationMillis / 1000;
                durRef.current = d;
                syncSlider(d, trackW.current || 0);
              }
            }}
          />
          <TouchableOpacity style={s.playOverlay} onPress={togglePlay} activeOpacity={0.8}>
            <Ionicons
              name={isPlaying ? 'pause-circle' : 'play-circle'}
              size={52}
              color="rgba(255,255,255,0.88)"
            />
          </TouchableOpacity>
        </View>

        {/* Playhead bar */}
        <View style={s.posTrack}>
          <View style={[s.posFill, { width: `${progPct}%` }]} />
        </View>

        {/* Range slider */}
        <View style={s.sliderWrap}>
          <Text style={s.sliderInfo}>
            {formatTime(startTimeSt)} — {formatTime(endTimeSt)}
            {'   '}
            <Text style={{ color: colors.c1 }}>{segSecs}s</Text>
          </Text>

          <View
            style={s.sliderTrack}
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              trackW.current = w;
              if (durRef.current > 0) syncSlider(durRef.current, w);
            }}
          >
            <View style={s.sliderRail} />

            {/* Selected region */}
            <Animated.View
              pointerEvents="none"
              style={[
                s.sliderSel,
                {
                  left:  startPxAnim,
                  width: Animated.subtract(endPxAnim, startPxAnim),
                },
              ]}
            />

            {/* Start thumb */}
            <Animated.View
              style={[s.thumb, { left: Animated.subtract(startPxAnim, THUMB_SIZE / 2) }]}
              {...startPan.panHandlers}
            />

            {/* End thumb */}
            <Animated.View
              style={[s.thumb, { left: Animated.subtract(endPxAnim, THUMB_SIZE / 2) }]}
              {...endPan.panHandlers}
            />
          </View>

          <View style={s.sliderTimes}>
            <Text style={s.sliderTimeTxt}>{formatTime(0)}</Text>
            <Text style={s.sliderTimeTxt}>{formatTime(dur)}</Text>
          </View>
        </View>

        {/* Title */}
        <View style={s.titleWrap}>
          <Text style={s.fieldLabel}>TITULO</Text>
          <TextInput
            style={s.titleInput}
            placeholder="Titulo del video"
            placeholderTextColor={colors.textDim}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
            autoCorrect
          />
          <Text style={s.charCount}>{title.length}/100</Text>
        </View>

        <TouchableOpacity style={s.changeBtn} onPress={pickVideo}>
          <Ionicons name="refresh-outline" size={15} color={colors.textDim} />
          <Text style={s.changeTxt}>Cambiar video</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: colors.black },

  // Headers
  header:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  simpleHeader:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn:       { width: 40, alignItems: 'flex-start' },
  headerTitle:   { flex: 1, textAlign: 'center', color: colors.textHi, fontSize: 12, fontWeight: '700', letterSpacing: 3 },
  publishBtn:    { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: colors.c1, borderRadius: 10 },
  publishBtnOff: { backgroundColor: 'rgba(0,229,204,0.25)' },
  publishBtnTxt: { color: '#001a18', fontSize: 12, fontWeight: '700', letterSpacing: 1.5 },

  // Select phase
  selectCenter:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 60 },
  selectHint:    { color: colors.textMid, fontSize: 15, fontWeight: '600', marginTop: 8 },
  selectSub:     { color: colors.textDim, fontSize: 12 },
  selectBtn:     { marginTop: 12, paddingVertical: 14, paddingHorizontal: 32, backgroundColor: colors.c1, borderRadius: 14 },
  selectBtnTxt:  { color: '#001a18', fontWeight: '700', fontSize: 14, letterSpacing: 1 },

  // Upload phase
  uploadCenter:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  uploadTitle:   { color: colors.textHi, fontSize: 15, fontWeight: '600' },
  uploadBarTrack:{ width: '70%', height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  uploadBarFill: { height: '100%', backgroundColor: colors.c1, borderRadius: 3 },
  uploadPct:     { color: colors.textMid, fontSize: 13 },

  // Video
  videoWrap:     { position: 'relative', width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.deep },
  video:         { width: '100%', height: '100%' },
  playOverlay:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },

  // Playhead
  posTrack:      { height: 3, backgroundColor: colors.border },
  posFill:       { height: '100%', backgroundColor: colors.textDim },

  // Slider
  sliderWrap:    { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 },
  sliderInfo:    { color: colors.textMid, fontSize: 13, textAlign: 'center', marginBottom: 18 },
  sliderTrack:   { height: THUMB_SIZE, justifyContent: 'center' },
  sliderRail:    { position: 'absolute', left: 0, right: 0, height: 4, backgroundColor: colors.border, borderRadius: 2, top: (THUMB_SIZE - 4) / 2 },
  sliderSel:     { position: 'absolute', height: 4, backgroundColor: colors.c1, borderRadius: 2, top: (THUMB_SIZE - 4) / 2 },
  thumb:         { position: 'absolute', width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: THUMB_SIZE / 2, backgroundColor: colors.c1, top: 0 },
  sliderTimes:   { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  sliderTimeTxt: { color: colors.textDim, fontSize: 11 },

  // Title
  titleWrap:     { paddingHorizontal: 20, paddingTop: 24 },
  fieldLabel:    { color: colors.textDim, fontSize: 10, letterSpacing: 2, marginBottom: 8 },
  titleInput:    { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderC, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.textHi, fontSize: 15 },
  charCount:     { color: colors.textDim, fontSize: 11, textAlign: 'right', marginTop: 4 },

  changeBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: 24, padding: 8 },
  changeTxt:     { color: colors.textDim, fontSize: 13 },
});
