import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";

type SongRow = {
  id: string;
  title: string;
  artist: string;
  cover_url: string | null;
};

type SelectedSong = {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
};

const EMPTY_TOP5: (SelectedSong | null)[] = [null, null, null, null, null];
const params = useLocalSearchParams();

export default function SongListScreen() {
  const insets = useSafeAreaInsets();
  const { slot, top5 } = useLocalSearchParams<{ slot: string; top5?: string }>();

  const [songs, setSongs] = useState<SongRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const slotIndex = Number(slot);
  const safeSlotIndex =
    !Number.isNaN(slotIndex) && slotIndex >= 0 && slotIndex < 5 ? slotIndex : 0;

  const parsedTop5 = useMemo<(SelectedSong | null)[]>(() => {
    try {
      if (!top5) return EMPTY_TOP5;
      const parsed = JSON.parse(top5) as (SelectedSong | null)[];
      return Array.isArray(parsed) && parsed.length === 5 ? parsed : EMPTY_TOP5;
    } catch {
      return EMPTY_TOP5;
    }
  }, [top5]);

  const currentSlotSong = parsedTop5[safeSlotIndex];

  useEffect(() => {
    const fetchSongs = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("songs")
        .select("id, title, artist, cover_url")
        .order("title", { ascending: true });

      if (error) {
        console.log("Song fetch error:", error.message);
        setErrorMessage("We couldn’t load songs right now. Please try again.");
      } else {
        setSongs(data ?? []);
      }

      setLoading(false);
    };

    fetchSongs();
  }, []);

  const filteredSongs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return songs;

    return songs.filter((song) => {
      return (
        song.title.toLowerCase().includes(query) ||
        song.artist.toLowerCase().includes(query)
      );
    });
  }, [songs, searchQuery]);

  const handleSelectSong = async (song: SongRow) => {
    try {
      setErrorMessage("");

      const nextTop5 = [...parsedTop5];

      const duplicateIndex = nextTop5.findIndex(
        (selectedSong, index) =>
          selectedSong?.id === song.id && index !== safeSlotIndex
      );

      if (duplicateIndex !== -1) {
        setErrorMessage(
          `"${song.title}" is already in your Top 5. Please choose a different song.`
        );
        return;
      }

      setSelectingId(song.id);

      nextTop5[safeSlotIndex] = {
        id: song.id,
        title: song.title,
        artist: song.artist,
        coverUrl: song.cover_url ?? "",
      };

      if (params.mode === "profile") {
  // Save directly to DB
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("user_top_songs").upsert({
    user_id: user.id,
    song_id: song.id,
    position: safeSlotIndex + 1,
  });

  router.back();
} else {
  // onboarding (keep your existing behavior)
  router.replace({
    pathname: "/top5",
    params: {
      top5: JSON.stringify(nextTop5),
    },
  });
}
    } catch (error) {
      console.log("Song selection error:", error);
      setErrorMessage("We couldn’t select that song. Please try again.");
      setSelectingId(null);
    }
  };

  const renderLoadingState = () => {
    return (
      <View style={styles.loadingCard}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.loadingText}>Loading songs...</Text>
      </View>
    );
  };

  const renderEmptyState = () => {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>No songs found</Text>
        <Text style={styles.emptySubtitle}>
          Try a different title or artist name.
        </Text>
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom + 20, 32) },
      ]}
    >
      <View style={styles.glow} />

      <View style={styles.headerCard}>
        <Text style={styles.stepText}>Pick a song</Text>
        <Text style={styles.title}>Choose a song</Text>
        <Text style={styles.subtitle}>
          Selecting for spot #{safeSlotIndex + 1}
          {currentSlotSong ? ` • replacing "${currentSlotSong.title}"` : ""}
        </Text>

        <TextInput
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            if (errorMessage) setErrorMessage("");
          }}
          placeholder="Search by title or artist"
          placeholderTextColor="#6B6B7A"
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </View>

      {loading ? (
        renderLoadingState()
      ) : (
        <FlatList
          data={filteredSongs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={renderEmptyState}
          renderItem={({ item }) => {
            const alreadySelectedElsewhere = parsedTop5.some(
              (selectedSong, index) =>
                selectedSong?.id === item.id && index !== safeSlotIndex
            );

            const isCurrentSlotSong = currentSlotSong?.id === item.id;
            const isSelecting = selectingId === item.id;

            return (
              <Pressable
                style={({ pressed }) => [
                  styles.row,
                  alreadySelectedElsewhere && styles.rowDisabled,
                  isCurrentSlotSong && styles.rowCurrent,
                  pressed &&
                    !alreadySelectedElsewhere &&
                    !isSelecting &&
                    styles.rowPressed,
                ]}
                onPress={() => handleSelectSong(item)}
              >
                <View style={styles.cover}>
                  {item.cover_url ? (
                    <Image source={{ uri: item.cover_url }} style={styles.coverImg} />
                  ) : (
                    <Text style={styles.plus}>♪</Text>
                  )}
                </View>

                <View style={styles.textCol}>
                  <Text style={styles.songTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.songArtist} numberOfLines={1}>
                    {item.artist}
                  </Text>

                  {alreadySelectedElsewhere ? (
                    <Text style={styles.rowMetaText}>Already in your Top 5</Text>
                  ) : isCurrentSlotSong ? (
                    <Text style={styles.rowMetaTextCurrent}>Currently selected</Text>
                  ) : null}
                </View>

                <View style={styles.rightSide}>
                  {isSelecting ? (
                    <ActivityIndicator size="small" color="#9A7BFF" />
                  ) : alreadySelectedElsewhere ? (
                    <Text style={styles.lockedText}>Added</Text>
                  ) : (
                    <Text style={styles.chevron}>›</Text>
                  )}
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [
          styles.backButton,
          pressed && styles.backButtonPressed,
        ]}
      >
        <Text style={styles.backButtonText}>Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0B12",
    paddingHorizontal: 24,
    paddingTop: 54,
  },
  glow: {
    position: "absolute",
    top: 110,
    alignSelf: "center",
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "#7C5CFF",
    opacity: 0.08,
  },
  headerCard: {
    backgroundColor: "#11111A",
    borderWidth: 1,
    borderColor: "#232336",
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
  },
  stepText: {
    color: "#9A7BFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  title: {
    color: "#F2F2F7",
    fontSize: 32,
    fontWeight: "800",
  },
  subtitle: {
    color: "#B8B8C7",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 14,
  },
  searchInput: {
    backgroundColor: "#141426",
    borderWidth: 1,
    borderColor: "#2A2A3C",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#F2F2F7",
    fontSize: 15,
  },
  errorText: {
    color: "#FF6B6B",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 10,
  },
  loadingCard: {
    flex: 1,
    backgroundColor: "#11111A",
    borderWidth: 1,
    borderColor: "#232336",
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    minHeight: 220,
  },
  loadingText: {
    color: "#B8B8C7",
    fontSize: 15,
    fontWeight: "600",
  },
  listContent: {
    gap: 12,
    paddingBottom: 20,
    flexGrow: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#141426",
    borderWidth: 1,
    borderColor: "#2A2A3C",
    borderRadius: 14,
    padding: 12,
  },
  rowPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
  rowDisabled: {
    opacity: 0.55,
  },
  rowCurrent: {
    borderColor: "#7C5CFF",
    backgroundColor: "#17172B",
  },
  cover: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: "#1C1C34",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  coverImg: {
    width: "100%",
    height: "100%",
  },
  plus: {
    color: "#6B6B7A",
    fontSize: 24,
  },
  textCol: {
    flex: 1,
    marginLeft: 12,
  },
  songTitle: {
    color: "#F2F2F7",
    fontSize: 16,
    fontWeight: "800",
  },
  songArtist: {
    color: "#B8B8C7",
    fontSize: 13,
    marginTop: 2,
  },
  rowMetaText: {
    color: "#FFB0B0",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
  },
  rowMetaTextCurrent: {
    color: "#B9A8FF",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
  },
  rightSide: {
    width: 52,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  chevron: {
    color: "#9A7BFF",
    fontSize: 22,
    fontWeight: "800",
  },
  lockedText: {
    color: "#8A8AA0",
    fontSize: 12,
    fontWeight: "800",
  },
  emptyCard: {
    backgroundColor: "#11111A",
    borderWidth: 1,
    borderColor: "#232336",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  emptyTitle: {
    color: "#F2F2F7",
    fontSize: 18,
    fontWeight: "800",
  },
  emptySubtitle: {
    color: "#B8B8C7",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 8,
  },
  backButton: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#2A2A3C",
    backgroundColor: "#141426",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 16,
  },
  backButtonPressed: {
    opacity: 0.9,
  },
  backButtonText: {
    color: "#F2F2F7",
    fontSize: 15,
    fontWeight: "700",
  },
});