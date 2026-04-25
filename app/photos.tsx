import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";

const normalizeName = (value?: string) => {
  if (!value) return "there";
  return value.trim() || "there";
};

export default function PhotosScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const safeName = normalizeName(name);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const horizontalPadding = 24;
  const cardPadding = 18;
  const tileSpacing = 10;

  const tileSize = useMemo(() => {
    const usable = width - horizontalPadding * 2 - cardPadding * 2;
    return Math.floor((usable - tileSpacing) / 2);
  }, [width]);

  const [photos, setPhotos] = useState<(string | null)[]>([null, null, null, null]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const selectedCount = photos.filter(Boolean).length;
  const canContinue = selectedCount > 0 && !loading;

  const updatePhotoAtIndex = (index: number, uri: string | null) => {
    setPhotos((prev) => {
      const next = [...prev];
      next[index] = uri;
      return next;
    });
  };

  const openGalleryForSlot = async (index: number) => {
    if (loading) return;

    setErrorMessage("");

    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        setErrorMessage("Please allow photo library access to add pictures.");
        Alert.alert(
          "Permission needed",
          "Please allow access to your photo library to choose images."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (!result.canceled && result.assets.length > 0) {
        const selectedUri = result.assets[0].uri;
        updatePhotoAtIndex(index, selectedUri);
      }
    } catch (error) {
      console.log("Image picker error:", error);
      setErrorMessage("We couldn’t open your photo library. Please try again.");
    }
  };

  const removePhoto = (index: number) => {
    if (loading) return;
    setErrorMessage("");
    updatePhotoAtIndex(index, null);
  };

  const handleSlotPress = (index: number) => {
    if (loading) return;

    if (!photos[index]) {
      openGalleryForSlot(index);
      return;
    }

    Alert.alert("Photo options", "What would you like to do?", [
      {
        text: "Replace photo",
        onPress: () => openGalleryForSlot(index),
      },
      {
        text: "Remove photo",
        style: "destructive",
        onPress: () => removePhoto(index),
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]);
  };

  const uploadPhotosAndContinue = async () => {
    setErrorMessage("");

    if (!photos.some((p) => p !== null)) {
      setErrorMessage("Please add at least one photo to continue.");
      return;
    }

    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setErrorMessage("We couldn’t find your account. Please log in again.");
        setLoading(false);
        return;
      }

      const { error: deleteDbError } = await supabase
        .from("profile_photos")
        .delete()
        .eq("user_id", user.id);

      if (deleteDbError) {
        setErrorMessage("We couldn’t prepare your photos. Please try again.");
        setLoading(false);
        return;
      }

      for (let i = 0; i < photos.length; i++) {
        const photoUri = photos[i];
        if (!photoUri) continue;

        const base64 = await FileSystem.readAsStringAsync(photoUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const arrayBuffer = decode(base64);
        const filePath = `${user.id}/photo-${i + 1}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from("profile-photos")
          .upload(filePath, arrayBuffer, {
            contentType: "image/jpeg",
            upsert: true,
          });

        if (uploadError) {
          setErrorMessage("One of your photos couldn’t be uploaded. Please try again.");
          setLoading(false);
          return;
        }

        const { error: insertError } = await supabase.from("profile_photos").upsert(
          {
            user_id: user.id,
            position: i + 1,
            storage_path: filePath,
          },
          {
            onConflict: "user_id,position",
          }
        );

        if (insertError) {
          setErrorMessage("We couldn’t save your photo selections. Please try again.");
          setLoading(false);
          return;
        }
      }

      setLoading(false);
      router.push("/top5");
    } catch (error) {
      console.log("Unexpected photo upload error:", error);
      setErrorMessage("Something went wrong while uploading your photos.");
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.glow} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom + 24, 32) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.stepText}>Step 2 of onboarding</Text>
          <Text style={styles.welcomeTitle}>Welcome, {safeName}</Text>
          <Text style={styles.title}>Add your photos</Text>
          <Text style={styles.subtitle}>
            Choose up to 4 photos. You only need one to continue.
          </Text>

          <Text style={styles.metaText}>{selectedCount}/4 selected</Text>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <View style={styles.grid}>
            {photos.map((photo, index) => {
              const isRightColumn = index % 2 === 1;
              const isLastRow = index >= 2;

              return (
                <Pressable
                  key={index}
                  onPress={() => handleSlotPress(index)}
                  disabled={loading}
                  style={({ pressed }) => [
                    styles.slotWrapper,
                    {
                      width: tileSize,
                      marginRight: isRightColumn ? 0 : tileSpacing,
                      marginBottom: isLastRow ? 0 : tileSpacing,
                      marginTop: index === 3 ? 10 : 0,
                    },
                    pressed && !loading && styles.slotWrapperPressed,
                    loading && styles.disabled,
                  ]}
                >
                  <View
                    style={[
                      styles.slot,
                      { width: tileSize, height: tileSize },
                      photo && styles.slotFilled,
                    ]}
                  >
                    {photo ? (
                      <>
                        <Image source={{ uri: photo }} style={styles.image} resizeMode="cover" />
                        <View style={styles.photoBadge}>
                          <Text style={styles.photoBadgeText}>Photo {index + 1}</Text>
                        </View>
                      </>
                    ) : (
                      <View style={styles.emptyState}>
                        <Text style={styles.plus}>+</Text>
                        <Text style={styles.emptyText}>Add photo {index + 1}</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            disabled={!canContinue}
            onPress={uploadPhotosAndContinue}
            style={({ pressed }) => [
              styles.primaryButton,
              !canContinue && styles.primaryButtonDisabled,
              pressed && canContinue && styles.primaryButtonPressed,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#F2F2F7" />
            ) : (
              <Text style={styles.primaryButtonText}>Continue</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.back()}
            disabled={loading}
            style={({ pressed }) => [
              styles.backButton,
              pressed && !loading && styles.backButtonPressed,
              loading && styles.disabled,
            ]}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>
      </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
  },
  card: {
    backgroundColor: "#11111A",
    borderWidth: 1,
    borderColor: "#232336",
    borderRadius: 24,
    padding: 18,
  },
  stepText: {
    color: "#9A7BFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#8B5CF6",
    marginBottom: 2,
  },
  title: {
    color: "#F2F2F7",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 8,
  },
  subtitle: {
    color: "#B8B8C7",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  metaText: {
    color: "#6B6B7A",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 12,
  },
  errorText: {
    color: "#FF6B6B",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 18,
  },
  slotWrapper: {
    borderRadius: 16,
  },
  slotWrapperPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  slot: {
    backgroundColor: "#141426",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A3C",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  slotFilled: {
    borderColor: "#3C3470",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 8,
  },
  plus: {
    fontSize: 34,
    color: "#6B6B7A",
    lineHeight: 36,
  },
  emptyText: {
    color: "#B8B8C7",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  photoBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(11,11,18,0.82)",
    borderWidth: 1,
    borderColor: "#30285C",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  photoBadgeText: {
    color: "#F2F2F7",
    fontSize: 11,
    fontWeight: "800",
  },
  primaryButton: {
    width: "100%",
    backgroundColor: "#7C5CFF",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
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