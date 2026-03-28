import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Image, ScrollView, StatusBar,
  ActivityIndicator, Alert, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

const { width: W } = Dimensions.get('window');
const PREVIEW_SIZE = W - 64;

const PACKAGES = [
  { units: 5,  cost: 50,  label: '×5',  badge: null,        desc: '50 ✦' },
  { units: 12, cost: 100, label: '×12', badge: 'AHORRA 40%', desc: '100 ✦' },
  { units: 40, cost: 300, label: '×40', badge: 'AHORRA 60%', desc: '300 ✦' },
];

const BG_COLORS = [
  '#000000','#0a0a1a','#0d1f2d','#1a0a2e',
  '#0a1a0a','#1a1a0a','#2a0a0a','#0a1a2a',
  '#1a2a1a','#2a1a0a',
];
const BG_GRADIENTS = [
  ['#000000','#0d1f2d'],['#0a0a1a','#1a0a2e'],
  ['#0d1f2d','#00e5cc22'],['#1a0a2e','#d946ef22'],
  ['#0a1a0a','#22d3ee22'],['#2a0a0a','#f9731622'],
];

// 5 avatares de muestra para previsualizar
const SAMPLE_AVATARS = [
  { id: 0, letter: '?', bg: 'rgba(0,229,204,0.15)', color: colors.c1,              label: 'Tú' },
  { id: 1, letter: 'A', bg: '#1a0a2e',              color: '#d946ef',               label: 'Axel' },
  { id: 2, letter: 'S', bg: '#0a1a2e',              color: '#00e5cc',               label: 'Sara' },
  { id: 3, letter: 'M', bg: '#1a1a0a',              color: '#f97316',               label: 'Max' },
  { id: 4, letter: 'L', bg: '#0a2a1a',              color: '#22d3ee',               label: 'Luna' },
];

export default function CreateFrameScreen({ navigation }) {
  const { user, updateUser } = useAuthStore();
  const [tab, setTab]         = useState('preview');  // 'preview' | 'editor' | 'info'
  const [name, setName]       = useState('');
  const [description, setDesc]= useState('');
  const [pkg, setPkg]         = useState(0);           // índice del paquete
  const [frameImage, setFrameImg] = useState(null);  // { uri, mimeType }
  const [bgType, setBgType]   = useState('color');
  const [bgColor, setBgColor] = useState('#0d1f2d');
  const [bgGradient, setBgGrad] = useState(['#000000','#0d1f2d']);
  const [bgImage, setBgImage] = useState(null);
  const [selectedAvatar, setSelectedAvatar] = useState(0);
  const [publishing, setPublishing] = useState(false);

  const selectedPkg = PACKAGES[pkg];
  const canCreate   = (user?.xp || 0) >= 200 && (user?.coins || 0) >= selectedPkg.cost;
  const frameUri    = frameImage?.uri || null;

  async function pickFrame() {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:['images'], allowsEditing:true, aspect:[1,1], quality:1,
    });
    if (!r.canceled) {
      const asset = r.assets[0];
      setFrameImg({ uri: asset.uri, mimeType: asset.mimeType || 'image/png' });
    }
  }

  async function pickBgImage() {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:['images'], allowsEditing:true, aspect:[1,1], quality:0.8,
    });
    if (!r.canceled) { setBgImage(r.assets[0].uri); setBgType('image'); }
  }

  async function handleCreate() {
    if (!name.trim())  return Alert.alert('Falta nombre', 'Ponle un nombre a tu marco');
    if (!frameImage?.uri) return Alert.alert('Falta imagen', 'Sube la imagen del marco');
    if (!canCreate)    return Alert.alert('Sin recursos', `Necesitas ${selectedPkg.cost} ✦ y 200 XP`);
    setPublishing(true);
    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('description', description.trim());
      formData.append('price', '50');
      formData.append('bgType', bgType);
      formData.append('bgColor', bgColor);
      formData.append('bgGradient', JSON.stringify(bgGradient));
      formData.append('units', String(selectedPkg.units));
      formData.append('cost', String(selectedPkg.cost));
      const blob = await fetch(frameImage.uri).then(r => r.blob());
      // Usar mimeType guardado por ImagePicker — la fuente más confiable
      const mime = frameImage.mimeType || blob.type || 'image/png';
      const ext  = mime.includes('webp') ? 'webp'
                 : mime.includes('png')  ? 'png'
                 : mime.includes('gif')  ? 'gif'
                 : 'jpg';
      const namedBlob = new Blob([blob], { type: mime });
      formData.append('image', namedBlob, `frame.${ext}`);
      const { data } = await api.post('/frames', formData, {
        headers: { 'Content-Type':'multipart/form-data' },
      });
      updateUser({ ...user, coins: data.newCoins });
      Alert.alert(
        '✦ Marco creado',
        `Tienes ${selectedPkg.units} unidades de "${name}".\n\nPublica tu marco en tu tienda desde Mi Colección.`,
        [
          { text:'Ver colección', onPress:() => navigation.replace('Collection') },
          { text:'OK', onPress:() => navigation.goBack() },
        ]
      );
    } catch(e) {
      Alert.alert('Error', e.response?.data?.error || 'No se pudo crear');
    } finally { setPublishing(false); }
  }

  // Fondo del preview
  function BgBlock({ style }) {
    if (bgType==='image' && bgImage)
      return <Image source={{uri:bgImage}} style={[style,{position:'absolute'}]} resizeMode="cover" />;
    if (bgType==='gradient')
      return <LinearGradient colors={bgGradient} style={[style,{position:'absolute'}]} />;
    return <View style={[style,{position:'absolute',backgroundColor:bgColor}]} />;
  }

  const av = SAMPLE_AVATARS[selectedAvatar];
  const avatarUri = selectedAvatar === 0 ? user?.avatarUrl : null;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.textHi} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>CREAR MARCO</Text>
          {/* Tabs */}
          <View style={s.tabPill}>
            {[
              {key:'preview', icon:'eye-outline'},
              {key:'editor',  icon:'brush-outline'},
              {key:'info',    icon:'information-circle-outline'},
            ].map(t => (
              <TouchableOpacity key={t.key}
                style={[s.tabPillBtn, tab===t.key && s.tabPillActive]}
                onPress={() => setTab(t.key)}>
                <Ionicons name={t.icon} size={14} color={tab===t.key ? colors.c1 : colors.textDim} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </SafeAreaView>

      {/* ── TAB PREVIEW ── */}
      {tab === 'preview' && (
        <View style={s.previewTab}>
          {/* Preview principal — pantalla completa estilo */}
          <View style={s.previewStage}>
            <BgBlock style={StyleSheet.absoluteFillObject} />
            {/* Overlay sutil */}
            <View style={[StyleSheet.absoluteFillObject, {backgroundColor:'rgba(0,0,0,0.15)'}]} />
            {/* Avatar + marco */}
            <View style={s.previewAvatarContainer}>
              <View style={s.previewCircle}>
                {avatarUri
                  ? <Image source={{uri:avatarUri}} style={s.previewCircleImg} />
                  : <Text style={[s.previewCircleTxt,{color:av.color}]}>
                      {av.letter === '?' ? (user?.username?.[0]?.toUpperCase() || '?') : av.letter}
                    </Text>}
              </View>
              {frameImage?.uri && (
                <Image source={{uri:frameImage.uri}} resizeMode="contain" pointerEvents="none"
                  style={s.previewFrameOverlay} />
              )}
            </View>
            <Text style={s.previewLabel}>{name || 'Nombre del marco'}</Text>
            {!frameImage && (
              <Text style={s.previewHint}>Sube un marco para ver la preview</Text>
            )}
          </View>

          {/* Selector de avatar de muestra */}
          <View style={s.avatarSelector}>
            <Text style={s.avatarSelectorLabel}>PREVISUALIZAR CON</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.avatarSelectorRow}>
              {SAMPLE_AVATARS.map((a, i) => (
                <TouchableOpacity key={i} style={[s.avatarSampleBtn, selectedAvatar===i && s.avatarSampleBtnActive]}
                  onPress={() => setSelectedAvatar(i)}>
                  <View style={[s.avatarSampleCircle, {backgroundColor: a.id===0 && user?.avatarUrl ? 'transparent' : a.bg}]}>
                    {a.id===0 && user?.avatarUrl
                      ? <Image source={{uri:user.avatarUrl}} style={s.avatarSampleImg} />
                      : <Text style={[s.avatarSampleTxt,{color:a.color}]}>
                          {a.letter==='?' ? (user?.username?.[0]?.toUpperCase()||'?') : a.letter}
                        </Text>}
                  </View>
                  <Text style={[s.avatarSampleName, selectedAvatar===i && {color:colors.c1}]}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Acciones rápidas */}
          <View style={s.previewActions}>
            <TouchableOpacity style={s.previewActionBtn} onPress={pickFrame}>
              <Ionicons name="sparkles-outline" size={16} color="rgba(244,114,182,1)" />
              <Text style={[s.previewActionTxt,{color:'rgba(244,114,182,1)'}]}>
                {frameImage ? 'Cambiar marco' : 'Subir marco'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.previewActionBtn} onPress={() => setTab('editor')}>
              <Ionicons name="brush-outline" size={16} color={colors.c1} />
              <Text style={[s.previewActionTxt,{color:colors.c1}]}>Editar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── TAB EDITOR ── */}
      {tab === 'editor' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

          {!canCreate && (
            <View style={s.reqBanner}>
              <Ionicons name="warning-outline" size={16} color="rgba(251,191,36,1)" />
              <Text style={s.reqTxt}>
                {(user?.xp||0) < 200 ? `Faltan ${200-(user?.xp||0)} XP · ` : ''}
                {(user?.coins||0) < selectedPkg.cost ? `Faltan ${selectedPkg.cost-(user?.coins||0)} ✦` : ''}
                {'  '}
                <Text style={{textDecorationLine:'underline'}} onPress={() => setTab('info')}>Ver info</Text>
              </Text>
            </View>
          )}

          {/* Imagen del marco */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>IMAGEN DEL MARCO *</Text>
            <Text style={s.sectionHint}>PNG o WebP con fondo transparente · 600×600px recomendado</Text>
            <TouchableOpacity style={s.uploadBtn} onPress={pickFrame}>
              {frameImage
                ? <Image source={{uri:frameImage.uri}} style={s.uploadPreview} resizeMode="contain" />
                : <View style={s.uploadEmpty}>
                    <Ionicons name="cloud-upload-outline" size={32} color={colors.c1} />
                    <Text style={s.uploadTxt}>Toca para subir</Text>
                    <Text style={s.uploadHint}>PNG · WebP · JPG</Text>
                  </View>}
            </TouchableOpacity>
          </View>

          {/* Nombre */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>NOMBRE *</Text>
            <TextInput style={s.input} value={name} onChangeText={setName}
              placeholder="Ej: Marco Nebulosa" placeholderTextColor={colors.textDim} maxLength={50} />
            <Text style={s.charCount}>{name.length}/50</Text>
          </View>

          {/* Descripción */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>DESCRIPCIÓN</Text>
            <TextInput style={[s.input,{height:80,textAlignVertical:'top',paddingTop:10}]}
              value={description} onChangeText={setDesc}
              placeholder="Describe tu marco..." placeholderTextColor={colors.textDim}
              multiline maxLength={200} />
          </View>

          {/* Fondo */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>FONDO DEL PREVIEW</Text>
            <View style={s.bgTypePicker}>
              {[['color','Color'],['gradient','Gradiente'],['image','Imagen']].map(([k,l]) => (
                <TouchableOpacity key={k} style={[s.bgTypeBtn,bgType===k&&s.bgTypeBtnActive]}
                  onPress={() => setBgType(k)}>
                  <Text style={[s.bgTypeTxt,bgType===k&&s.bgTypeTxtActive]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {bgType==='color' && (
              <View style={s.colorGrid}>
                {BG_COLORS.map(col => (
                  <TouchableOpacity key={col}
                    style={[s.colorSwatch,{backgroundColor:col},bgColor===col&&s.colorSwatchActive]}
                    onPress={() => setBgColor(col)} />
                ))}
              </View>
            )}
            {bgType==='gradient' && (
              <View style={s.colorGrid}>
                {BG_GRADIENTS.map((grad,i) => (
                  <TouchableOpacity key={i}
                    style={[s.gradSwatch,bgGradient===grad&&s.colorSwatchActive]}
                    onPress={() => setBgGrad(grad)}>
                    <LinearGradient colors={grad} style={StyleSheet.absoluteFillObject} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {bgType==='image' && (
              <TouchableOpacity style={s.uploadBtn} onPress={pickBgImage}>
                {bgImage
                  ? <Image source={{uri:bgImage}} style={s.uploadPreview} resizeMode="cover" />
                  : <View style={s.uploadEmpty}>
                      <Ionicons name="image-outline" size={28} color={colors.textDim} />
                      <Text style={s.uploadTxt}>Subir imagen de fondo</Text>
                    </View>}
              </TouchableOpacity>
            )}
          </View>

          {/* Paquetes */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>ELIGE TU PAQUETE</Text>
            <Text style={s.sectionHint}>Cuántas unidades recibirás al crear este marco</Text>
            <View style={s.packagesGrid}>
              {PACKAGES.map((p, i) => (
                <TouchableOpacity key={i} style={[s.pkgCard, pkg===i && s.pkgCardActive]}
                  onPress={() => setPkg(i)}>
                  {p.badge && (
                    <View style={s.pkgBadge}><Text style={s.pkgBadgeTxt}>{p.badge}</Text></View>
                  )}
                  <Text style={[s.pkgUnits, pkg===i && {color:colors.c1}]}>{p.label}</Text>
                  <Text style={s.pkgUnitsLabel}>unidades</Text>
                  <View style={s.pkgPrice}>
                    <Text style={s.pkgPriceTxt}>✦{p.cost}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Info costo */}
          <View style={s.costBanner}>
            <Ionicons name="wallet-outline" size={16} color={colors.textDim} />
            <Text style={s.costTxt}>
              Recibirás <Text style={{color:colors.c1,fontWeight:'700'}}>{selectedPkg.units} unidades</Text> por <Text style={{color:'rgba(251,191,36,1)',fontWeight:'700'}}>✦{selectedPkg.cost}</Text>. Publica en tu tienda y cobra monedas.
            </Text>
          </View>

          <TouchableOpacity style={[s.createBtn,(!canCreate||publishing)&&s.createBtnDisabled]}
            onPress={handleCreate} disabled={!canCreate||publishing}>
            {publishing
              ? <ActivityIndicator color="#000" size={18} />
              : <><Ionicons name="sparkles" size={18} color="#000" />
                  <Text style={s.createBtnTxt}>Crear marco · ✦{selectedPkg.cost}</Text></>}
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── TAB INFO ── */}
      {tab === 'info' && (
        <ScrollView contentContainerStyle={{padding:20,gap:16}} showsVerticalScrollIndicator={false}>
          <View style={s.infoCard}>
            <View style={s.infoIcon}><Ionicons name="sparkles" size={22} color="rgba(244,114,182,1)" /></View>
            <Text style={s.infoTitle}>¿Qué es un marco?</Text>
            <Text style={s.infoBody}>Un marco es una imagen decorativa que rodea el avatar. Se superpone encima de la foto de perfil y aparece en posts, chats y perfiles de toda la app.</Text>
          </View>
          <View style={s.infoCard}>
            <View style={[s.infoIcon,{backgroundColor:'rgba(0,229,204,0.1)',borderColor:'rgba(0,229,204,0.3)'}]}>
              <Ionicons name="shield-checkmark-outline" size={22} color={colors.c1} />
            </View>
            <Text style={s.infoTitle}>Requisitos</Text>
            <View style={{gap:8}}>
              {[
                {ok:(user?.xp||0)>=200, txt:`200 XP mínimo`, val:`tienes ${user?.xp||0}`},
                {ok:(user?.coins||0)>=50, txt:'50 monedas mínimo', val:`tienes ${user?.coins||0} ✦`},
              ].map((r,i) => (
                <View key={i} style={{flexDirection:'row',alignItems:'center',gap:8}}>
                  <Ionicons name={r.ok?'checkmark-circle':'close-circle'} size={16}
                    color={r.ok?colors.c1:'rgba(239,68,68,0.7)'} />
                  <Text style={{color:colors.textMid,fontSize:13}}>{r.txt} <Text style={{color:colors.textDim}}>({r.val})</Text></Text>
                </View>
              ))}
            </View>
          </View>
          <View style={s.infoCard}>
            <View style={[s.infoIcon,{backgroundColor:'rgba(251,191,36,0.1)',borderColor:'rgba(251,191,36,0.3)'}]}>
              <Ionicons name="bag-outline" size={22} color="rgba(251,191,36,1)" />
            </View>
            <Text style={s.infoTitle}>Flujo de venta</Text>
            <View style={{gap:10}}>
              {['1. Creas el marco y recibes unidades','2. Publicas en tu tienda propia','3. Aparece en la tienda general','4. Otros compran y tú recibes el 85%'].map((t,i) => (
                <View key={i} style={{flexDirection:'row',gap:8,alignItems:'flex-start'}}>
                  <View style={{width:20,height:20,borderRadius:10,backgroundColor:'rgba(251,191,36,0.15)',alignItems:'center',justifyContent:'center'}}>
                    <Text style={{color:'rgba(251,191,36,1)',fontSize:10,fontWeight:'800'}}>{i+1}</Text>
                  </View>
                  <Text style={{color:colors.textMid,fontSize:13,flex:1}}>{t.substring(3)}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={s.infoCard}>
            <View style={[s.infoIcon,{backgroundColor:'rgba(41,121,255,0.1)',borderColor:'rgba(41,121,255,0.3)'}]}>
              <Ionicons name="images-outline" size={22} color="rgba(41,121,255,1)" />
            </View>
            <Text style={s.infoTitle}>Formato de imagen</Text>
            <Text style={s.infoBody}>Usa PNG o WebP con <Text style={{color:colors.c1,fontWeight:'700'}}>fondo transparente</Text>. Cuadrado 1:1, recomendado 600×600px. El marco debe rodear un círculo central dejando el centro vacío.</Text>
          </View>
          <TouchableOpacity style={s.infoStartBtn} onPress={() => setTab('editor')}>
            <Ionicons name="brush-outline" size={16} color="#000" />
            <Text style={s.infoStartBtnTxt}>Ir al editor</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex:1, backgroundColor:colors.black },
  header:      { flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:14 },
  backBtn:     { padding:4, marginRight:8 },
  headerTitle: { color:colors.textHi, fontSize:13, fontWeight:'800', letterSpacing:2.5, flex:1, textAlign:'center' },
  tabPill:       { flexDirection:'row', backgroundColor:'rgba(255,255,255,0.05)', borderRadius:10, padding:3, gap:2 },
  tabPillBtn:    { width:32, height:28, alignItems:'center', justifyContent:'center', borderRadius:8 },
  tabPillActive: { backgroundColor:'rgba(0,229,204,0.12)' },

  // PREVIEW TAB
  previewTab:   { flex:1 },
  previewStage: { flex:1, alignItems:'center', justifyContent:'center', position:'relative' },
  previewAvatarContainer: { width:130, height:130, alignItems:'center', justifyContent:'center' },
  previewCircle: { width:100, height:100, borderRadius:50, backgroundColor:'rgba(0,229,204,0.15)', alignItems:'center', justifyContent:'center', overflow:'hidden' },
  previewCircleImg: { width:100, height:100, borderRadius:50 },
  previewCircleTxt: { fontSize:42, fontWeight:'800' },
  previewFrameOverlay: { position:'absolute', top:0, left:0, width:130, height:130 },
  previewLabel: { color:colors.textHi, fontSize:14, fontWeight:'700', marginTop:12, textShadowColor:'rgba(0,0,0,0.8)', textShadowOffset:{width:0,height:1}, textShadowRadius:4 },
  previewHint:  { color:colors.textDim, fontSize:12, marginTop:6 },

  avatarSelector:      { backgroundColor:'rgba(255,255,255,0.03)', borderTopWidth:1, borderTopColor:colors.border, paddingVertical:12 },
  avatarSelectorLabel: { color:colors.textDim, fontSize:9, fontWeight:'800', letterSpacing:2, marginLeft:16, marginBottom:10 },
  avatarSelectorRow:   { paddingHorizontal:16, gap:14 },
  avatarSampleBtn:     { alignItems:'center', gap:4 },
  avatarSampleBtnActive: {},
  avatarSampleCircle:  { width:44, height:44, borderRadius:22, alignItems:'center', justifyContent:'center', borderWidth:2, borderColor:'transparent', overflow:'hidden' },
  avatarSampleImg:     { width:44, height:44, borderRadius:22 },
  avatarSampleTxt:     { fontSize:18, fontWeight:'800' },
  avatarSampleName:    { color:colors.textDim, fontSize:9 },

  previewActions: { flexDirection:'row', paddingHorizontal:16, paddingVertical:12, gap:12, borderTopWidth:1, borderTopColor:colors.border },
  previewActionBtn: { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, paddingVertical:12, borderRadius:14, borderWidth:1, borderColor:colors.border, backgroundColor:'rgba(255,255,255,0.03)' },
  previewActionTxt: { fontSize:13, fontWeight:'700' },

  // EDITOR TAB
  scroll:    { paddingBottom:40 },
  reqBanner: { flexDirection:'row', alignItems:'center', gap:8, margin:16, padding:12, backgroundColor:'rgba(251,191,36,0.08)', borderRadius:12, borderWidth:1, borderColor:'rgba(251,191,36,0.2)' },
  reqTxt:    { color:'rgba(251,191,36,0.9)', fontSize:12, flex:1 },

  section:      { paddingHorizontal:16, marginBottom:20, marginTop:16 },
  sectionLabel: { color:colors.textDim, fontSize:9, fontWeight:'800', letterSpacing:2.5, marginBottom:8 },
  sectionHint:  { color:colors.textDim, fontSize:11, marginBottom:10 },

  uploadBtn:     { height:110, borderRadius:16, borderWidth:1, borderColor:colors.border, borderStyle:'dashed', overflow:'hidden', backgroundColor:'rgba(255,255,255,0.02)' },
  uploadPreview: { width:'100%', height:'100%' },
  uploadEmpty:   { flex:1, alignItems:'center', justifyContent:'center', gap:6 },
  uploadTxt:     { color:colors.textDim, fontSize:12 },
  uploadHint:    { color:colors.textDim, fontSize:10, opacity:0.6 },

  input:     { backgroundColor:'rgba(255,255,255,0.04)', borderWidth:1, borderColor:colors.border, borderRadius:12, paddingHorizontal:14, paddingVertical:10, color:colors.textHi, fontSize:14 },
  charCount: { color:colors.textDim, fontSize:10, textAlign:'right', marginTop:4 },

  bgTypePicker:    { flexDirection:'row', gap:8, marginBottom:12 },
  bgTypeBtn:       { paddingHorizontal:14, paddingVertical:8, borderRadius:10, borderWidth:1, borderColor:colors.border, backgroundColor:'rgba(255,255,255,0.03)' },
  bgTypeBtnActive: { borderColor:colors.c1, backgroundColor:'rgba(0,229,204,0.1)' },
  bgTypeTxt:       { color:colors.textDim, fontSize:12, fontWeight:'600' },
  bgTypeTxtActive: { color:colors.c1 },

  colorGrid:         { flexDirection:'row', flexWrap:'wrap', gap:8 },
  colorSwatch:       { width:36, height:36, borderRadius:10, borderWidth:2, borderColor:'transparent' },
  colorSwatchActive: { borderColor:colors.c1 },
  gradSwatch:        { width:36, height:36, borderRadius:10, overflow:'hidden', borderWidth:2, borderColor:'transparent' },

  packagesGrid:  { flexDirection:'row', gap:10 },
  pkgCard:       { flex:1, backgroundColor:'rgba(255,255,255,0.03)', borderRadius:16, borderWidth:1, borderColor:colors.border, padding:14, alignItems:'center', gap:4, position:'relative', overflow:'hidden' },
  pkgCardActive: { borderColor:colors.c1, backgroundColor:'rgba(0,229,204,0.07)' },
  pkgBadge:      { position:'absolute', top:0, right:0, backgroundColor:'rgba(251,191,36,0.9)', paddingHorizontal:6, paddingVertical:2, borderBottomLeftRadius:8 },
  pkgBadgeTxt:   { color:'#000', fontSize:7, fontWeight:'900', letterSpacing:0.5 },
  pkgUnits:      { color:colors.textHi, fontSize:24, fontWeight:'900' },
  pkgUnitsLabel: { color:colors.textDim, fontSize:10 },
  pkgPrice:      { marginTop:6, backgroundColor:'rgba(251,191,36,0.1)', borderRadius:8, paddingHorizontal:10, paddingVertical:4, borderWidth:1, borderColor:'rgba(251,191,36,0.3)' },
  pkgPriceTxt:   { color:'rgba(251,191,36,1)', fontSize:12, fontWeight:'800' },

  costBanner: { flexDirection:'row', alignItems:'flex-start', gap:8, marginHorizontal:16, marginBottom:20, padding:12, backgroundColor:'rgba(255,255,255,0.03)', borderRadius:12, borderWidth:1, borderColor:colors.border },
  costTxt:    { color:colors.textDim, fontSize:12, flex:1, lineHeight:18 },

  createBtn:         { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, marginHorizontal:16, marginBottom:24, paddingVertical:16, borderRadius:18, backgroundColor:'rgba(244,114,182,0.85)' },
  createBtnDisabled: { opacity:0.4 },
  createBtnTxt:      { color:'#000', fontSize:15, fontWeight:'800' },

  // INFO TAB
  infoCard:    { backgroundColor:'rgba(255,255,255,0.03)', borderRadius:16, borderWidth:1, borderColor:colors.border, padding:16, gap:10 },
  infoIcon:    { width:44, height:44, borderRadius:12, backgroundColor:'rgba(244,114,182,0.1)', borderWidth:1, borderColor:'rgba(244,114,182,0.3)', alignItems:'center', justifyContent:'center' },
  infoTitle:   { color:colors.textHi, fontSize:15, fontWeight:'700' },
  infoBody:    { color:colors.textDim, fontSize:13, lineHeight:20 },
  infoStartBtn:    { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, paddingVertical:14, borderRadius:16, backgroundColor:colors.c1 },
  infoStartBtnTxt: { color:'#000', fontSize:14, fontWeight:'800' },
});
