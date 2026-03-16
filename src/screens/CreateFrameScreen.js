import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Image, ScrollView, StatusBar, SafeAreaView,
  ActivityIndicator, Alert, Dimensions, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

const { width: W } = Dimensions.get('window');

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
const SAMPLE_AVATARS = [
  { letter:'A', name:'axel',  bg:'#1a0a2e', color:'#d946ef' },
  { letter:'S', name:'sara',  bg:'#0a1a2e', color:'#00e5cc' },
  { letter:'M', name:'max',   bg:'#1a1a0a', color:'#f97316' },
  { letter:'L', name:'luna',  bg:'#0a2a1a', color:'#22d3ee' },
];

export default function CreateFrameScreen({ navigation }) {
  const { user, updateUser } = useAuthStore();
  const [tab, setTab]           = useState('editor');   // 'editor' | 'info'
  const [name, setName]         = useState('');
  const [description, setDesc]  = useState('');
  const [price, setPrice]       = useState('50');
  const [frameImage, setFrameImg] = useState(null);
  const [bgType, setBgType]     = useState('color');
  const [bgColor, setBgColor]   = useState('#0d1f2d');
  const [bgGradient, setBgGrad] = useState(['#000000','#0d1f2d']);
  const [bgImage, setBgImage]   = useState(null);
  const [publishing, setPublishing] = useState(false);

  const canCreate = (user?.xp || 0) >= 200 && (user?.coins || 0) >= 50;

  async function pickFrame() {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:['images'], allowsEditing:true, aspect:[1,1], quality:1,
    });
    if (!r.canceled) setFrameImg(r.assets[0].uri);
  }

  async function pickBgImage() {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:['images'], allowsEditing:true, aspect:[1,1], quality:0.8,
    });
    if (!r.canceled) { setBgImage(r.assets[0].uri); setBgType('image'); }
  }

  async function handleCreate() {
    if (!name.trim()) return Alert.alert('Falta nombre','Ponle un nombre a tu marco');
    if (!frameImage)  return Alert.alert('Falta imagen','Sube la imagen del marco');
    if (!canCreate)   return Alert.alert('Sin permisos','Necesitas 200 XP y 50 monedas');
    setPublishing(true);
    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('description', description.trim());
      formData.append('price', price || '50');
      formData.append('bgType', bgType);
      formData.append('bgColor', bgColor);
      formData.append('bgGradient', JSON.stringify(bgGradient));
      const blob = await fetch(frameImage).then(r => r.blob());
      formData.append('image', blob, 'frame.png');
      const { data } = await api.post('/frames', formData, {
        headers:{ 'Content-Type':'multipart/form-data' },
      });
      updateUser({ ...user, coins: data.newCoins });
      Alert.alert('✦ Marco creado',
        `Tienes 5 unidades de "${name}". Publícalo desde Mi Colección.`,
        [
          { text:'Ver colección', onPress:() => navigation.replace('Collection') },
          { text:'OK', onPress:() => navigation.goBack() },
        ]
      );
    } catch(e) {
      Alert.alert('Error', e.response?.data?.error || 'No se pudo crear');
    } finally { setPublishing(false); }
  }

  function BgBlock({ style }) {
    if (bgType==='image' && bgImage)
      return <Image source={{ uri:bgImage }} style={[style,{position:'absolute'}]} resizeMode="cover" />;
    if (bgType==='gradient')
      return <LinearGradient colors={bgGradient} style={[style,{position:'absolute'}]} />;
    return <View style={[style,{position:'absolute',backgroundColor:bgColor}]} />;
  }

  function AvatarSample({ letter, bg, color, size=52, frameSize=74 }) {
    const offset = (frameSize - size) / 2;
    return (
      <View style={{ width:frameSize, height:frameSize, alignItems:'center', justifyContent:'center' }}>
        <View style={{ width:size, height:size, borderRadius:size/2, backgroundColor:bg,
          alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
          <Text style={{ color, fontSize:size*0.38, fontWeight:'800' }}>{letter}</Text>
        </View>
        {frameImage && (
          <Image source={{ uri:frameImage }} resizeMode="contain" pointerEvents="none"
            style={{ position:'absolute', top:0, left:0, width:frameSize, height:frameSize }} />
        )}
      </View>
    );
  }

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
            <TouchableOpacity style={[s.tabPillBtn, tab==='editor' && s.tabPillActive]}
              onPress={() => setTab('editor')}>
              <Ionicons name="brush-outline" size={14} color={tab==='editor' ? colors.c1 : colors.textDim} />
            </TouchableOpacity>
            <TouchableOpacity style={[s.tabPillBtn, tab==='info' && s.tabPillActive]}
              onPress={() => setTab('info')}>
              <Ionicons name="information-circle-outline" size={14} color={tab==='info' ? colors.c1 : colors.textDim} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {tab === 'info' ? (
        /* ── TAB INFO ── */
        <ScrollView contentContainerStyle={{ padding:24, gap:18 }} showsVerticalScrollIndicator={false}>
          <View style={s.infoCard}>
            <View style={s.infoIcon}><Ionicons name="sparkles" size={22} color="rgba(244,114,182,1)" /></View>
            <Text style={s.infoTitle}>¿Qué es un marco?</Text>
            <Text style={s.infoBody}>Un marco es una imagen decorativa que rodea el avatar de un usuario. Se superpone encima de la foto de perfil y aparece en posts, chats y perfiles.</Text>
          </View>
          <View style={s.infoCard}>
            <View style={[s.infoIcon,{backgroundColor:'rgba(0,229,204,0.1)',borderColor:'rgba(0,229,204,0.3)'}]}>
              <Ionicons name="shield-checkmark-outline" size={22} color={colors.c1} />
            </View>
            <Text style={s.infoTitle}>Requisitos para crear</Text>
            <View style={s.infoReqs}>
              <View style={s.infoReqItem}>
                <Ionicons name={user?.xp>=200?'checkmark-circle':'close-circle'} size={16}
                  color={user?.xp>=200?colors.c1:'rgba(239,68,68,0.7)'} />
                <Text style={s.infoReqTxt}>200 XP mínimo <Text style={{color:colors.c1}}>(tienes {user?.xp||0})</Text></Text>
              </View>
              <View style={s.infoReqItem}>
                <Ionicons name={(user?.coins||0)>=50?'checkmark-circle':'close-circle'} size={16}
                  color={(user?.coins||0)>=50?'rgba(251,191,36,1)':'rgba(239,68,68,0.7)'} />
                <Text style={s.infoReqTxt}>50 monedas <Text style={{color:'rgba(251,191,36,1)'}}>✦ (tienes {user?.coins||0})</Text></Text>
              </View>
            </View>
          </View>
          <View style={s.infoCard}>
            <View style={[s.infoIcon,{backgroundColor:'rgba(251,191,36,0.1)',borderColor:'rgba(251,191,36,0.3)'}]}>
              <Ionicons name="bag-outline" size={22} color="rgba(251,191,36,1)" />
            </View>
            <Text style={s.infoTitle}>¿Cómo funciona la venta?</Text>
            <Text style={s.infoBody}>Al crear un marco recibes <Text style={{color:colors.c1,fontWeight:'700'}}>5 unidades</Text>. Puedes publicarlas en tu tienda desde Mi Colección y cobrar monedas por cada compra. Tú recibes el <Text style={{color:'rgba(251,191,36,1)',fontWeight:'700'}}>85%</Text> de cada venta.</Text>
          </View>
          <View style={s.infoCard}>
            <View style={[s.infoIcon,{backgroundColor:'rgba(41,121,255,0.1)',borderColor:'rgba(41,121,255,0.3)'}]}>
              <Ionicons name="images-outline" size={22} color="rgba(41,121,255,1)" />
            </View>
            <Text style={s.infoTitle}>Formato de imagen</Text>
            <Text style={s.infoBody}>Usa <Text style={{color:colors.c1,fontWeight:'700'}}>PNG o WebP con fondo transparente</Text>. El marco debe ser cuadrado (1:1) y se recomienda 600×600px para mejor calidad. El diseño del marco debe rodear un círculo central.</Text>
          </View>
          <TouchableOpacity style={s.infoStartBtn} onPress={() => setTab('editor')}>
            <Ionicons name="brush-outline" size={16} color="#000" />
            <Text style={s.infoStartBtnTxt}>Ir al editor</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        /* ── TAB EDITOR ── */
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

          {!canCreate && (
            <View style={s.reqBanner}>
              <Ionicons name="warning-outline" size={16} color="rgba(251,191,36,1)" />
              <Text style={s.reqTxt}>
                {user?.xp < 200 ? `Faltan ${200-(user?.xp||0)} XP` : ''}
                {user?.xp < 200 && (user?.coins||0) < 50 ? ' y ' : ''}
                {(user?.coins||0) < 50 ? `Faltan ${50-(user?.coins||0)} ✦` : ''}
                {' '}para crear marcos.{' '}
                <Text style={{textDecorationLine:'underline'}} onPress={() => setTab('info')}>Ver info</Text>
              </Text>
            </View>
          )}

          {/* ── PREVIEW ── */}
          <View style={s.previewSection}>
            {/* Preview principal con fondo */}
            <View style={s.previewBig}>
              <BgBlock style={StyleSheet.absoluteFillObject} />
              <View style={s.previewMainWrap}>
                <View style={{width:90,height:90,alignItems:'center',justifyContent:'center'}}>
                  <View style={{width:70,height:70,borderRadius:35,backgroundColor:'rgba(0,229,204,0.15)',
                    alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
                    {user?.avatarUrl
                      ? <Image source={{uri:user.avatarUrl}} style={{width:70,height:70,borderRadius:35}} />
                      : <Text style={{color:colors.c1,fontSize:28,fontWeight:'800'}}>{user?.username?.[0]?.toUpperCase()}</Text>}
                  </View>
                  {frameImage && (
                    <Image source={{uri:frameImage}} resizeMode="contain" pointerEvents="none"
                      style={{position:'absolute',top:0,left:0,width:90,height:90}} />
                  )}
                </View>
                <Text style={s.previewMainName}>{name || 'Nombre del marco'}</Text>
              </View>
            </View>

            {/* Ejemplos */}
            <Text style={s.previewExLabel}>VISTA EN OTROS PERFILES</Text>
            <View style={s.previewExRow}>
              {SAMPLE_AVATARS.map((av,i) => (
                <View key={i} style={s.previewExItem}>
                  <AvatarSample {...av} />
                  <Text style={s.previewExName}>@{av.name}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Imagen marco */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>IMAGEN DEL MARCO *</Text>
            <Text style={s.sectionHint}>PNG/WebP con fondo transparente · 600×600px recomendado</Text>
            <TouchableOpacity style={s.uploadBtn} onPress={pickFrame}>
              {frameImage
                ? <Image source={{uri:frameImage}} style={s.uploadPreview} resizeMode="contain" />
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

          {/* Fondo del preview */}
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

          {/* Precio */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>PRECIO POR 5 UNIDADES</Text>
            <Text style={s.sectionHint}>El comprador obtiene 5 unidades. Tú recibes el 85%.</Text>
            <View style={s.priceRow}>
              {['25','50','75','100'].map(p => (
                <TouchableOpacity key={p} style={[s.priceBtn,price===p&&s.priceBtnActive]}
                  onPress={() => setPrice(p)}>
                  <Text style={[s.priceTxt,price===p&&s.priceTxtActive]}>✦{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Costo */}
          <View style={s.costBanner}>
            <Ionicons name="wallet-outline" size={16} color={colors.textDim} />
            <Text style={s.costTxt}>
              Crear cuesta <Text style={{color:'rgba(251,191,36,1)'}}>50 monedas</Text> y requiere <Text style={{color:colors.c1}}>200 XP</Text>. Recibirás 5 unidades.
            </Text>
          </View>

          <TouchableOpacity style={[s.createBtn,(!canCreate||publishing)&&s.createBtnDisabled]}
            onPress={handleCreate} disabled={!canCreate||publishing}>
            {publishing
              ? <ActivityIndicator color="#000" size={18} />
              : <><Ionicons name="sparkles" size={18} color="#000" /><Text style={s.createBtnTxt}>Crear marco (50 ✦)</Text></>}
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex:1, backgroundColor:colors.black },
  header:      { flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:14, justifyContent:'space-between' },
  backBtn:     { padding:4 },
  headerTitle: { color:colors.textHi, fontSize:13, fontWeight:'800', letterSpacing:2.5, flex:1, textAlign:'center' },

  tabPill:       { flexDirection:'row', backgroundColor:'rgba(255,255,255,0.05)', borderRadius:10, padding:3, gap:2 },
  tabPillBtn:    { width:32, height:28, alignItems:'center', justifyContent:'center', borderRadius:8 },
  tabPillActive: { backgroundColor:'rgba(0,229,204,0.12)' },

  scroll: { paddingBottom:40 },

  reqBanner: { flexDirection:'row', alignItems:'center', gap:8, margin:16, padding:12, backgroundColor:'rgba(251,191,36,0.08)', borderRadius:12, borderWidth:1, borderColor:'rgba(251,191,36,0.2)' },
  reqTxt:    { color:'rgba(251,191,36,0.9)', fontSize:12, flex:1 },

  // Preview
  previewSection:  { paddingHorizontal:16, paddingVertical:16, gap:12 },
  previewBig:      { width:'100%', height:160, borderRadius:20, overflow:'hidden', borderWidth:1, borderColor:colors.border, alignItems:'center', justifyContent:'center' },
  previewMainWrap: { alignItems:'center', gap:8 },
  previewMainName: { color:colors.textHi, fontSize:12, fontWeight:'700' },
  previewExLabel:  { color:colors.textDim, fontSize:9, fontWeight:'800', letterSpacing:2, marginTop:4 },
  previewExRow:    { flexDirection:'row', justifyContent:'space-around' },
  previewExItem:   { alignItems:'center', gap:4 },
  previewExName:   { color:colors.textDim, fontSize:9 },

  // Sections
  section:      { paddingHorizontal:16, marginBottom:20 },
  sectionLabel: { color:colors.textDim, fontSize:9, fontWeight:'800', letterSpacing:2.5, marginBottom:8 },
  sectionHint:  { color:colors.textDim, fontSize:11, marginBottom:10 },

  uploadBtn:     { height:110, borderRadius:16, borderWidth:1, borderColor:colors.border, borderStyle:'dashed', overflow:'hidden', backgroundColor:'rgba(255,255,255,0.02)' },
  uploadPreview: { width:'100%', height:'100%' },
  uploadEmpty:   { flex:1, alignItems:'center', justifyContent:'center', gap:6 },
  uploadTxt:     { color:colors.textDim, fontSize:12 },
  uploadHint:    { color:colors.textDim, fontSize:10, opacity:0.6 },

  input:      { backgroundColor:'rgba(255,255,255,0.04)', borderWidth:1, borderColor:colors.border, borderRadius:12, paddingHorizontal:14, paddingVertical:10, color:colors.textHi, fontSize:14 },
  charCount:  { color:colors.textDim, fontSize:10, textAlign:'right', marginTop:4 },

  bgTypePicker:    { flexDirection:'row', gap:8, marginBottom:12 },
  bgTypeBtn:       { paddingHorizontal:16, paddingVertical:8, borderRadius:10, borderWidth:1, borderColor:colors.border, backgroundColor:'rgba(255,255,255,0.03)' },
  bgTypeBtnActive: { borderColor:colors.c1, backgroundColor:'rgba(0,229,204,0.1)' },
  bgTypeTxt:       { color:colors.textDim, fontSize:12, fontWeight:'600' },
  bgTypeTxtActive: { color:colors.c1 },

  colorGrid:         { flexDirection:'row', flexWrap:'wrap', gap:8 },
  colorSwatch:       { width:36, height:36, borderRadius:10, borderWidth:2, borderColor:'transparent' },
  colorSwatchActive: { borderColor:colors.c1 },
  gradSwatch:        { width:36, height:36, borderRadius:10, overflow:'hidden', borderWidth:2, borderColor:'transparent' },

  priceRow:       { flexDirection:'row', gap:8, flexWrap:'wrap' },
  priceBtn:       { paddingHorizontal:16, paddingVertical:10, borderRadius:12, borderWidth:1, borderColor:colors.border, backgroundColor:'rgba(255,255,255,0.03)' },
  priceBtnActive: { borderColor:'rgba(251,191,36,0.6)', backgroundColor:'rgba(251,191,36,0.08)' },
  priceTxt:       { color:colors.textDim, fontSize:13, fontWeight:'700' },
  priceTxtActive: { color:'rgba(251,191,36,1)' },

  costBanner: { flexDirection:'row', alignItems:'flex-start', gap:8, marginHorizontal:16, marginBottom:20, padding:12, backgroundColor:'rgba(255,255,255,0.03)', borderRadius:12, borderWidth:1, borderColor:colors.border },
  costTxt:    { color:colors.textDim, fontSize:12, flex:1, lineHeight:18 },

  createBtn:         { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, marginHorizontal:16, paddingVertical:16, borderRadius:18, backgroundColor:'rgba(244,114,182,0.85)' },
  createBtnDisabled: { opacity:0.4 },
  createBtnTxt:      { color:'#000', fontSize:15, fontWeight:'800' },

  // Info tab
  infoCard:     { backgroundColor:'rgba(255,255,255,0.03)', borderRadius:16, borderWidth:1, borderColor:colors.border, padding:16, gap:10 },
  infoIcon:     { width:44, height:44, borderRadius:12, backgroundColor:'rgba(244,114,182,0.1)', borderWidth:1, borderColor:'rgba(244,114,182,0.3)', alignItems:'center', justifyContent:'center' },
  infoTitle:    { color:colors.textHi, fontSize:15, fontWeight:'700' },
  infoBody:     { color:colors.textDim, fontSize:13, lineHeight:20 },
  infoReqs:     { gap:8 },
  infoReqItem:  { flexDirection:'row', alignItems:'center', gap:8 },
  infoReqTxt:   { color:colors.textMid, fontSize:13 },
  infoStartBtn: { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, paddingVertical:14, borderRadius:16, backgroundColor:colors.c1 },
  infoStartBtnTxt: { color:'#000', fontSize:14, fontWeight:'800' },
});
