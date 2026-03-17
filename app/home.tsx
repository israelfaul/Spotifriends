import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from "react-native";
import { calculateCompatibility } from "../lib/compatibility";
import { supabase } from "../lib/supabase";

type CandidateSong = {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  subgenres: string[];
};

type CandidateProfile = {
  id: string;
  name: string;
  photos: string[];
  songs: CandidateSong[];
  compatibility: number;
};

export default function HomeScreen() {
  const { width } = useWindowDimensions();

  const [profiles, setProfiles] = useState<CandidateProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [selectedSongIndex, setSelectedSongIndex] = useState<number | null>(null);

  const imageSize = width - 48;

  useEffect(() => {
    const fetchSongsWithSubgenres = async (userId: string): Promise<CandidateSong[]> => {
      const { data: top5Rows, error: top5Error } = await supabase
        .from("user_top5")
        .select("position, song_id")
        .eq("user_id", userId)
        .order("position", { ascending: true });

      if (top5Error) {
        throw new Error(top5Error.message);
      }

      const songIds = top5Rows?.map((row) => row.song_id) ?? [];
      if (songIds.length === 0) return [];

      const { data: songRows, error: songError } = await supabase
        .from("songs")
        .select("id, title, artist, cover_url")
        .in("id", songIds);

      if (songError) {
        throw new Error(songError.message);
      }

      const { data: linkRows, error: linkError } = await supabase
        .from("song_subgenres")
        .select("song_id, subgenre_id")
        .in("song_id", songIds);

      if (linkError) {
        throw new Error(linkError.message);
      }

      const subgenreIds = [...new Set((linkRows ?? []).map((row) => row.subgenre_id))];

      let subgenreMap = new Map<string, string>();

      if (subgenreIds.length > 0) {
        const { data: subgenreRows, error: subgenreError } = await supabase
          .from("subgenres")
          .select("id, name")
          .in("id", subgenreIds);

        if (subgenreError) {
          throw new Error(subgenreError.message);
        }

        subgenreMap = new Map(
          (subgenreRows ?? []).map((row) => [row.id, row.name])
        );
      }

      const songToSubgenres = new Map<string, string[]>();

      for (const link of linkRows ?? []) {
        const existing = songToSubgenres.get(link.song_id) ?? [];
        const subgenreName = subgenreMap.get(link.subgenre_id);

        if (subgenreName) {
          existing.push(subgenreName);
          songToSubgenres.set(link.song_id, existing);
        }
      }

      const songMap = new Map(
        (songRows ?? []).map((song) => [
          song.id,
          {
            id: song.id,
            title: song.title,
            artist: song.artist,
            coverUrl: song.cover_url ?? "",
            subgenres: songToSubgenres.get(song.id) ?? [],
          },
        ])
      );

      return (top5Rows ?? [])
        .map((row) => songMap.get(row.song_id))
        .filter(Boolean) as CandidateSong[];
    };

    const fetchAllCandidateProfiles = async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          console.log("No authenticated user found");
          setLoading(false);
          return;
        }

        const currentUserSongs = await fetchSongsWithSubgenres(user.id);

        console.log(
          "Current user Top 5:",
          currentUserSongs.map((song) => ({
            title: song.title,
            artist: song.artist,
            subgenres: song.subgenres,
          }))
        );

        const { data: otherProfiles, error: profileError } = await supabase
          .from("profiles")
          .select("id, display_name")
          .neq("id", user.id);

        if (profileError) {
          console.log("Profile fetch error:", profileError.message);
          setLoading(false);
          return;
        }

        if (!otherProfiles || otherProfiles.length === 0) {
          setProfiles([]);
          setLoading(false);
          return;
        }

        const builtProfiles: CandidateProfile[] = [];

        for (const candidate of otherProfiles) {
          const { data: photoRows, error: photoError } = await supabase
            .from("profile_photos")
            .select("position, storage_path")
            .eq("user_id", candidate.id)
            .order("position", { ascending: true });

          if (photoError) {
            console.log(`Photo fetch error for ${candidate.display_name}:`, photoError.message);
            continue;
          }

          const photoUrls =
            photoRows?.map((row) => {
              const { data } = supabase.storage
                .from("profile-photos")
                .getPublicUrl(row.storage_path);

              return data.publicUrl;
            }) ?? [];

          const candidateSongs = await fetchSongsWithSubgenres(candidate.id);

          console.log(
            `Candidate Top 5 (${candidate.display_name}):`,
            candidateSongs.map((song) => ({
              title: song.title,
              artist: song.artist,
              subgenres: song.subgenres,
            }))
          );

          // Skip incomplete candidate profiles for now
          if (candidateSongs.length < 5 || photoUrls.length === 0) {
            continue;
          }

          const compatibilityResult = calculateCompatibility(
            currentUserSongs,
            candidateSongs
          );

          console.log(
            `Compatibility result (${candidate.display_name}):`,
            compatibilityResult
          );

          builtProfiles.push({
            id: candidate.id,
            name: candidate.display_name,
            photos: photoUrls,
            songs: candidateSongs,
            compatibility: compatibilityResult.score,
          });
        }

        builtProfiles.sort((a, b) => b.compatibility - a.compatibility);

        setProfiles(builtProfiles);
        setCurrentIndex(0);
        setPhotoIndex(0);
        setSelectedSongIndex(null);
      } catch (error) {
        console.log("Unexpected home fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllCandidateProfiles();
  }, []);

  const currentProfile = profiles[currentIndex] ?? null;

  const handleNextPhoto = () => {
    if (!currentProfile || currentProfile.photos.length === 0) return;
    setPhotoIndex((prev) => (prev + 1) % currentProfile.photos.length);
  };

  const handlePreviousPhoto = () => {
    if (!currentProfile || currentProfile.photos.length === 0) return;
    setPhotoIndex((prev) =>
      prev === 0 ? currentProfile.photos.length - 1 : prev - 1
    );
  };

  const handleNextProfile = () => {
    if (currentIndex < profiles.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setPhotoIndex(0);
      setSelectedSongIndex(null);
    }
  };

  const getCompatibilityColor = (score: number) => {
    if (score >= 90) return "#A855F7";
    if (score >= 75) return "#8B5CF6";
    if (score >= 60) return "#C084FC";
    return "#B8B8C7";
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B5CF6" />
      </View>
    );
  }

  if (!currentProfile) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.emptyText}>No compatible profiles available yet.</Text>
      </View>
    );
  }

  const selectedSong =
    selectedSongIndex !== null ? currentProfile.songs[selectedSongIndex] : null;

  const activePhoto =
    currentProfile.photos.length > 0
      ? currentProfile.photos[photoIndex]
      : "https://picsum.photos/seed/fallbackprofile/600";

  return (
    <View style={styles.container}>
      <View style={styles.photoWrapper}>
        <Image
          source={{ uri: activePhoto }}
          style={[
            styles.mainPhoto,
            {
              width: imageSize,
              height: imageSize,
            },
          ]}
        />

        <View style={styles.photoTapOverlay}>
          <Pressable style={styles.photoTapZone} onPress={handlePreviousPhoto} />
          <Pressable style={styles.photoTapZone} onPress={handleNextPhoto} />
        </View>
      </View>

      <View style={styles.photoIndicatorRow}>
        {currentProfile.photos.map((_, index) => (
          <View
            key={index}
            style={[
              styles.photoIndicator,
              index === photoIndex && styles.photoIndicatorActive,
            ]}
          />
        ))}
      </View>

      <View style={styles.infoBlock}>
        <Text style={styles.name}>{currentProfile.name}</Text>
        <Text
          style={[
            styles.compatibility,
            { color: getCompatibilityColor(currentProfile.compatibility) },
          ]}
        >
          {currentProfile.compatibility}% Similarity
        </Text>
      </View>

      <View style={styles.songRow}>
        {currentProfile.songs.map((song, index) => {
          const isSelected = selectedSongIndex === index;

          return (
            <Pressable
              key={song.id}
              onPress={() => setSelectedSongIndex(index)}
              style={[
                styles.songCoverWrapper,
                isSelected && styles.songCoverWrapperSelected,
              ]}
            >
              {song.coverUrl ? (
                <Image
                  source={{ uri: song.coverUrl }}
                  style={[
                    styles.songCover,
                    isSelected && styles.songCoverSelected,
                  ]}
                />
              ) : (
                <View
                  style={[
                    styles.songFallback,
                    isSelected && styles.songCoverSelected,
                  ]}
                >
                  <Text style={styles.songFallbackText}>♪</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.songInfoBox}>
        {selectedSong ? (
          <>
            <Text style={styles.songInfoTitle} numberOfLines={1}>
              {selectedSong.title}
            </Text>
            <Text style={styles.songInfoArtist} numberOfLines={1}>
              {selectedSong.artist}
            </Text>
          </>
        ) : (
          <Text style={styles.songInfoPlaceholder}>
            Tap a song to view details
          </Text>
        )}
      </View>

      <View style={styles.actionRow}>
        <Pressable style={styles.secondaryButton} onPress={handleNextProfile}>
          <Text style={styles.secondaryButtonText}>Skip</Text>
        </Pressable>

        <Pressable style={styles.primaryButton} onPress={handleNextProfile}>
          <Text style={styles.primaryButtonText}>Connect</Text>
        </Pressable>
      </View>

      <View style={styles.bottomNav}>
        <Pressable style={styles.navItem}>
          <Text style={styles.navItemActive}>Spot</Text>
        </Pressable>

        <Pressable style={styles.navItem}>
          <Text style={styles.navItemText}>Matches</Text>
        </Pressable>

        <Pressable style={styles.navItem}>
          <Text style={styles.navItemText}>Profile</Text>
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
    paddingHorizontal: 24,
  },

  emptyText: {
    color: "#F2F2F7",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },

  container: {
    flex: 1,
    backgroundColor: "#0B0B12",
    paddingTop: 56,
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },

  photoWrapper: {
    alignSelf: "center",
    position: "relative",
  },

  mainPhoto: {
    borderRadius: 18,
    backgroundColor: "#141426",
  },

  photoTapOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    borderRadius: 18,
    overflow: "hidden",
  },

  photoTapZone: {
    flex: 1,
  },

  photoIndicatorRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },

  photoIndicator: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#3A3A4F",
  },

  photoIndicatorActive: {
    width: 10,
    height: 10,
    backgroundColor: "#8B5CF6",
  },

  infoBlock: {
    marginTop: 18,
    marginBottom: 18,
  },

  name: {
    color: "#F2F2F7",
    fontSize: 33,
    fontWeight: "800",
    marginBottom: 6,
  },

  compatibility: {
    fontSize: 22,
    fontWeight: "300",
    letterSpacing: 1,
  },

  songRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  songCoverWrapper: {
    width: 64,
    height: 64,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#141426",
    borderWidth: 1,
    borderColor: "transparent",
  },

  songCoverWrapperSelected: {
    borderColor: "#8B5CF6",
  },

  songCover: {
    width: "100%",
    height: "100%",
  },

  songCoverSelected: {
    opacity: 0.55,
  },

  songFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#141426",
  },

  songFallbackText: {
    color: "#B8B8C7",
    fontSize: 22,
  },

  songInfoBox: {
    minHeight: 52,
    justifyContent: "center",
    marginBottom: 20,
    width: "100%",
  },

  songInfoTitle: {
    color: "#F2F2F7",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "left",
  },

  songInfoArtist: {
    color: "#B8B8C7",
    fontSize: 13,
    marginTop: 2,
    textAlign: "left",
  },

  songInfoPlaceholder: {
    color: "#6B6B7A",
    fontSize: 14,
  },

  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },

  primaryButton: {
    flex: 1,
    backgroundColor: "#7C5CFF",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },

  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#2A2A3C",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#141426",
  },

  secondaryButtonText: {
    color: "#F2F2F7",
    fontSize: 16,
    fontWeight: "700",
  },

  bottomNav: {
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