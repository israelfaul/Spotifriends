import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";

type ProfilePhoto = {
  position: number;
  storage_path: string;
};

type PlaylistSong = {
  id: string;
  title: string;
  artist: string;
  cover_url: string | null;
};

export default function ProfileScreen() {
  const [displayName, setDisplayName] = useState("");
  const [firstPhotoUrl, setFirstPhotoUrl] = useState<string | null>(null);
  const [songs, setSongs] = useState<PlaylistSong[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          console.log("Profile user error:", userError?.message);
          setLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", user.id)
          .maybeSingle();

        setDisplayName(profile?.display_name ?? "Your Profile");

        const { data: photos } = await supabase
          .from("profile_photos")
          .select("position, storage_path")
          .eq("user_id", user.id)
          .order("position", { ascending: true });

        const firstPhoto = (photos as ProfilePhoto[] | null)?.find(
          (photo) => photo.position === 1
        );

        if (firstPhoto) {
          const { data } = supabase.storage
            .from("profile-photos")
            .getPublicUrl(firstPhoto.storage_path);

          setFirstPhotoUrl(`${data.publicUrl}?t=${Date.now()}`);
        }

        const { data: top5Rows } = await supabase
          .from("user_top5")
          .select("position, song_id")
          .eq("user_id", user.id)
          .order("position", { ascending: true });

        const songIds = top5Rows?.map((row) => row.song_id) ?? [];

        if (songIds.length > 0) {
          const { data: songRows } = await supabase
            .from("songs")
            .select("id, title, artist, cover_url")
            .in("id", songIds);

          const songMap = new Map(
            (songRows ?? []).map((song) => [song.id, song])
          );

          const orderedSongs = (top5Rows ?? [])
            .map((row) => songMap.get(row.song_id))
            .filter(Boolean) as PlaylistSong[];

          setSongs(orderedSongs);
        }
      } catch (error) {
        console.log("Unexpected profile load error:", error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B5CF6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Pressable
          style={styles.avatarWrapper}
          onPress={() => router.push("/edit-photos")}
        >
          {firstPhotoUrl ? (
            <Image source={{ uri: firstPhotoUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarPlaceholderText}>+</Text>
            </View>
          )}
        </Pressable>

        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.helperText}>Tap your photo to edit pictures</Text>

        <Pressable
          style={styles.playlistBox}
          onPress={() => router.push("/top5")}
        >
          <Text style={styles.sectionTitle}>Current Playlist</Text>
          <Text style={styles.sectionHint}>Tap to edit songs</Text>

          {songs.length > 0 ? (
            songs.map((song, index) => (
              <View key={song.id} style={styles.songRow}>
                <Text style={styles.songNumber}>{index + 1}</Text>
                <View>
                  <Text style={styles.songTitle}>{song.title}</Text>
                  <Text style={styles.songArtist}>{song.artist}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No songs selected yet.</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.bottomNav}>
        <Pressable style={styles.navItem} onPress={() => router.push("/home")}>
          <Text style={styles.navItemText}>Spot</Text>
        </Pressable>

        <Pressable style={styles.navItem}>
          <Text style={styles.navItemText}>Matches</Text>
        </Pressable>

        <Pressable style={styles.navItem}>
          <Text style={styles.navItemActive}>Profile</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0B0B12",
    alignItems: "center",
    justifyContent: "center",
  },

  container: {
    flex: 1,
    backgroundColor: "#0B0B12",
    paddingTop: 70,
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },

  content: {
    alignItems: "center",
  },

  avatarWrapper: {
    width: 150,
    height: 150,
    borderRadius: 75,
    overflow: "hidden",
    backgroundColor: "#141426",
    borderWidth: 2,
    borderColor: "#8B5CF6",
    alignItems: "center",
    justifyContent: "center",
  },

  avatar: {
    width: "100%",
    height: "100%",
  },

  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#141426",
  },

  avatarPlaceholderText: {
    color: "#8B5CF6",
    fontSize: 42,
    fontWeight: "700",
  },

  name: {
    color: "#F2F2F7",
    fontSize: 33,
    fontWeight: "800",
    marginTop: 18,
  },

  helperText: {
    color: "#B8B8C7",
    fontSize: 14,
    marginTop: 8,
    marginBottom: 24,
  },

  playlistBox: {
    width: "100%",
    backgroundColor: "#141426",
    borderWidth: 1,
    borderColor: "#2A2A3C",
    borderRadius: 16,
    padding: 16,
  },

  sectionTitle: {
    color: "#F2F2F7",
    fontSize: 18,
    fontWeight: "800",
  },

  sectionHint: {
    color: "#B8B8C7",
    fontSize: 13,
    marginTop: 2,
    marginBottom: 14,
  },

  songRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  songNumber: {
    color: "#8B5CF6",
    fontSize: 15,
    fontWeight: "800",
    width: 26,
  },

  songTitle: {
    color: "#F2F2F7",
    fontSize: 15,
    fontWeight: "700",
  },

  songArtist: {
    color: "#B8B8C7",
    fontSize: 13,
    marginTop: 2,
  },

  emptyText: {
    color: "#B8B8C7",
    fontSize: 14,
  },

  bottomNav: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 58,
    borderTopWidth: 1,
    borderTopColor: "#1E1E2D",
    marginBottom: 6,
  },

  navItem: {
    alignItems: "center",
    justifyContent: "center",
  },

  navItemActive: {
    color: "#8B5CF6",
    fontSize: 15,
    fontWeight: "800",
  },

  navItemText: {
    color: "#B8B8C7",
    fontSize: 15,
    fontWeight: "600",
  },
});