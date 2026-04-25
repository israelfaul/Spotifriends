import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";

type Song = {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
};

type RowItem = { id: number };

const EMPTY_TOP5: (Song | null)[] = [null, null, null, null, null];

export default function Top5Screen() {
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{
    top5?: string;
  }>();

  const [top5, setTop5] = useState<(Song | null)[]>(EMPTY_TOP5);
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const rows: RowItem[] = useMemo(
    () => Array.from({ length: 5 }, (_, i) => ({ id: i })),
    []
  );

  const selectedCount = top5.filter(Boolean).length;
  const canContinue = selectedCount === 5 && !saving;

  useEffect(() => {
    if (!params.top5) return;

    try {
      const parsed = JSON.parse(params.top5) as (Song | null)[];

      if (!Array.isArray(parsed) || parsed.length !== 5) {
        setErrorMessage("We couldn’t load your Top 5 correctly. Please try again.");
        return;
      }

      const songIds = parsed
        .filter((song): song is Song => song !== null)
        .map((song) => song.id);

      const hasDuplicates = new Set(songIds).size !== songIds.length;

      if (hasDuplicates) {
        const duplicateSong = parsed
          .filter((song): song is Song => song !== null)
          .find(
            (song, index, arr) =>
              arr.findIndex((s) => s.id === song.id) !== index
          );

        const message = duplicateSong
          ? `"${duplicateSong.title}" has already been selected. Please choose a different song.`
          : "You already picked that song. Please choose a different one.";

        setErrorMessage(message);
        Alert.alert("Duplicate song", message);
        return;
      }

      setErrorMessage("");
      setTop5(parsed);
    } catch (error) {
      console.log("Failed to parse top5 params:", error);
      setErrorMessage("We couldn’t load your Top 5 correctly. Please try again.");
    }
  }, [params.top5]);

  const onPickSong = (index: number) => {
    if (saving) return;
    setErrorMessage("");

    router.push({
      pathname: "/song-list",
      params: {
        slot: String(index),
        top5: JSON.stringify(top5),
      },
    });
  };

  const onClearSong = (index: number) => {
    if (saving) return;

    setErrorMessage("");
    setTop5((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  };

  const saveTop5ToDatabase = async () => {
    setErrorMessage("");

    if (!top5.every((song) => song !== null)) {
      setErrorMessage("Please choose all 5 songs before continuing.");
      return;
    }

    try {
      setSaving(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setErrorMessage("No authenticated user found. Please log in again.");
        setSaving(false);
        return;
      }

      const { error: deleteError } = await supabase
        .from("user_top5")
        .delete()
        .eq("user_id", user.id);

      if (deleteError) {
        setErrorMessage(deleteError.message);
        setSaving(false);
        return;
      }

      for (let i = 0; i < top5.length; i++) {
        const song = top5[i];
        if (!song) continue;

        const { error: top5Error } = await supabase
          .from("user_top5")
          .upsert(
            {
              user_id: user.id,
              position: i + 1,
              song_id: song.id,
            },
            {
              onConflict: "user_id,position",
            }
          );

        if (top5Error) {
          setErrorMessage(top5Error.message);
          setSaving(false);
          return;
        }
      }

      setSaving(false);
      Alert.alert("Success", "Your Top 5 was saved.");
      router.replace("/home");
    } catch (error) {
      console.log("Unexpected Top 5 save error:", error);
      setErrorMessage("Something went wrong while saving your songs.");
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.glow} />

      <FlatList
        data={rows}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: insets.top + 12,
            paddingBottom: Math.max(insets.bottom + 24, 32),
          },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerCard}>
            <Text style={styles.stepText}>Build your list</Text>
            <Text style={styles.title}>Your Top 5</Text>
            <Text style={styles.subtitle}>
              Pick five unique songs that best represent your taste.
            </Text>

            <View style={styles.metaRow}>
              <Text style={styles.countText}>{selectedCount}/5 selected</Text>
              <Text style={styles.metaHint}>Tap a row to add or change a song</Text>
            </View>

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          </View>
        }
        renderItem={({ item }) => {
          const index = item.id;
          const song = top5[index];
          const slotNumber = index + 1;

          return (
            <Pressable
              style={({ pressed }) => [
                styles.row,
                song ? styles.rowFilled : styles.rowEmpty,
                pressed && !saving && styles.rowPressed,
                saving && styles.disabled,
              ]}
              onPress={() => onPickSong(index)}
              disabled={saving}
            >
              <View style={styles.slotPill}>
                <Text style={styles.slotPillText}>#{slotNumber}</Text>
              </View>

              <View style={styles.cover}>
                {song ? (
                  <Image source={{ uri: song.coverUrl }} style={styles.coverImg} />
                ) : (
                  <Text style={styles.plus}>+</Text>
                )}
              </View>

              {song ? (
                <View style={styles.textCol}>
                  <Text style={styles.songTitle} numberOfLines={1}>
                    {song.title}
                  </Text>
                  <Text style={styles.songArtist} numberOfLines={1}>
                    {song.artist}
                  </Text>
                </View>
              ) : (
                <View style={styles.centerTextContainer}>
                  <Text style={styles.centerText}>Choose a song</Text>
                  <Text style={styles.emptySubtext}>Pick your #{slotNumber} song</Text>
                </View>
              )}

              {song ? (
                <Pressable
                  onPress={() => onClearSong(index)}
                  hitSlop={10}
                  style={styles.rightIcon}
                  disabled={saving}
                >
                  <Text style={styles.rightIconText}>×</Text>
                </Pressable>
              ) : (
                <View style={styles.rightIcon}>
                  <Text style={styles.rightChevron}>›</Text>
                </View>
              )}
            </Pressable>
          );
        }}
        ListFooterComponent={
          <View style={styles.buttonBlock}>
            <Pressable
              disabled={!canContinue}
              onPress={saveTop5ToDatabase}
              style={({ pressed }) => [
                styles.primaryButton,
                !canContinue && styles.primaryButtonDisabled,
                pressed && canContinue && styles.primaryButtonPressed,
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#F2F2F7" />
              ) : (
                <Text style={styles.primaryButtonText}>Continue</Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.backButton,
                pressed && !saving && styles.backButtonPressed,
                saving && styles.disabled,
              ]}
              disabled={saving}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0B12",
    paddingHorizontal: 24,
  },
  glow: {
    position: "absolute",
    top: 90,
    alignSelf: "center",
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "#7C5CFF",
    opacity: 0.08,
  },
  listContent: {
    gap: 10,
  },
  headerCard: {
    backgroundColor: "#11111A",
    borderWidth: 1,
    borderColor: "#232336",
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
  },
  stepText: {
    color: "#9A7BFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  title: {
    color: "#F2F2F7",
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: "#B8B8C7",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 12,
  },
  metaRow: {
    gap: 4,
  },
  countText: {
    color: "#F2F2F7",
    fontSize: 14,
    fontWeight: "800",
  },
  metaHint: {
    color: "#6B6B7A",
    fontSize: 12,
    fontWeight: "600",
  },
  errorText: {
    color: "#FF6B6B",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
  },
  rowEmpty: {
    backgroundColor: "#141426",
    borderColor: "#2A2A3C",
  },
  rowFilled: {
    backgroundColor: "#161629",
    borderColor: "#342D66",
  },
  rowPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
  slotPill: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: "#1C1C34",
    borderWidth: 1,
    borderColor: "#2A2A3C",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  slotPillText: {
    color: "#B9A8FF",
    fontSize: 11,
    fontWeight: "800",
  },
  cover: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#1C1C34",
    borderWidth: 1,
    borderColor: "#2A2A3C",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  coverImg: {
    width: "100%",
    height: "100%",
  },
  plus: {
    fontSize: 24,
    color: "#6B6B7A",
  },
  textCol: {
    flex: 1,
    marginLeft: 10,
    gap: 2,
  },
  songTitle: {
    color: "#F2F2F7",
    fontSize: 15,
    fontWeight: "800",
  },
  songArtist: {
    color: "#B8B8C7",
    fontSize: 12,
    fontWeight: "600",
  },
  centerTextContainer: {
    flex: 1,
    justifyContent: "center",
    marginLeft: 10,
  },
  centerText: {
    color: "#F2F2F7",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "left",
  },
  emptySubtext: {
    color: "#8A8AA0",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
  rightIcon: {
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  rightIconText: {
    color: "#FF8B8B",
    fontSize: 22,
    fontWeight: "800",
  },
  rightChevron: {
    color: "#9A7BFF",
    fontSize: 20,
    fontWeight: "800",
  },
  buttonBlock: {
    marginTop: 16,
    gap: 12,
  },
  primaryButton: {
    width: "100%",
    backgroundColor: "#7C5CFF",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  primaryButtonDisabled: {
    backgroundColor: "#2A2A3C",
  },
  primaryButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  primaryButtonText: {
    color: "#F2F2F7",
    fontSize: 16,
    fontWeight: "800",
  },
  backButton: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#2A2A3C",
    backgroundColor: "#141426",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  backButtonPressed: {
    opacity: 0.9,
  },
  backButtonText: {
    color: "#F2F2F7",
    fontSize: 15,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.7,
  },
});