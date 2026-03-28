import React, { useState, useEffect } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, StatusBar, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../theme/colors";
import api from "../services/api";
import { useAuthStore } from "../store/authStore";
import AvatarWithFrame from "../components/AvatarWithFrame";

export default function FollowListScreen({ route, navigation }) {
  const { username, type } = route.params;
  const { user: me } = useAuthStore();
  const [list, setList]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [followingMap, setFollowingMap] = useState({});
  const [loadingBtn, setLoadingBtn] = useState({});

  useEffect(() => {
    Promise.all([
      api.get(`/social/${type}/${username}`),
      api.get(`/social/following/${me.username}`),
    ])
      .then(([listRes, myFollowingRes]) => {
        const users = listRes.data[type] || []; console.log("USERS:", JSON.stringify(users.slice(0,2)));
        setList(users);
        const myFollowing = myFollowingRes.data.following || [];
        const map = {};
        users.forEach(u => {
          map[u._id] = myFollowing.some(f => f._id === u._id || f === u._id);
        });
        setFollowingMap(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleFollow(targetUsername, targetId) {
    setLoadingBtn(prev => ({ ...prev, [targetId]: true }));
    try {
      const { data } = await api.post(`/social/follow/${targetUsername}`);
      setFollowingMap(prev => ({ ...prev, [targetId]: data.following }));
    } catch {}
    finally {
      setLoadingBtn(prev => ({ ...prev, [targetId]: false }));
    }
  }

  function getButtonLabel(item) {
    const iFollow      = !!followingMap[item._id];
    const theyFollowMe = (item.followers || []).some(f => f._id === me._id || f === me._id);
    if (iFollow && theyFollowMe) return "Amigos";
    if (iFollow) return "Siguiendo";
    return "Seguir";
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.black} />
      <SafeAreaView>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backTxt}>←</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>
            {type === "followers" ? "SEGUIDORES" : "SIGUIENDO"}
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>
      {loading ? (
        <ActivityIndicator color={colors.c1} style={{ marginTop: 40 }} />
      ) : list.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTxt}>
            {type === "followers" ? "Sin seguidores aún" : "Sin seguidos aún"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={u => u._id}
          renderItem={({ item }) => {
            const iFollow  = !!followingMap[item._id];
            const label    = getButtonLabel(item);
            const isMe     = item._id === me?._id;
            const btnLoading = loadingBtn[item._id];
            const showBtn  = !isMe && (username !== me?.username || type === "followers");
            return (
              <TouchableOpacity
                style={s.item}
                onPress={() => navigation.navigate("PublicProfile", { username: item.username })}
              >
                <AvatarWithFrame
                  size={44}
                  avatarUrl={item.avatarUrl}
                  username={item.username}
                  profileFrame={item.profileFrame}
                  frameUrl={item.profileFrameUrl}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.username}>@{item.username}</Text>
                  <Text style={s.xp}>XP {item.xp || 0}</Text>
                </View>
                {showBtn && (
                  <TouchableOpacity
                    onPress={e => { e.stopPropagation(); handleFollow(item.username, item._id); }}
                    disabled={btnLoading}
                  >
                    {iFollow ? (
                      <View style={s.btnFollowing}>
                        <Text style={s.btnFollowingTxt}>{btnLoading ? "..." : label}</Text>
                      </View>
                    ) : (
                      <LinearGradient colors={["#006b63", "#00e5cc"]} style={s.btnFollow} start={{x:0,y:0}} end={{x:1,y:0}}>
                        <Text style={s.btnFollowTxt}>{btnLoading ? "..." : "Seguir"}</Text>
                      </LinearGradient>
                    )}
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: colors.black },
  header:         {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle:    { fontSize: 16, fontWeight: "900", letterSpacing: 6, color: colors.c1 },
  backBtn:        { padding: 8, width: 40 },
  backTxt:        { color: colors.c1, fontSize: 22 },
  item:           {
    flexDirection: "row", alignItems: "center",
    padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  username:       { color: colors.textHi, fontWeight: "600", fontSize: 14 },
  xp:             { color: colors.textDim, fontSize: 11, marginTop: 2 },
  btnFollow:      { borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16, alignItems: "center" },
  btnFollowTxt:   { color: "#001a18", fontWeight: "700", fontSize: 13 },
  btnFollowing:   { borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.borderC, alignItems: "center" },
  btnFollowingTxt:{ color: colors.c1, fontWeight: "700", fontSize: 13 },
  empty:          { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyTxt:       { color: colors.textDim, fontSize: 14 },
});
