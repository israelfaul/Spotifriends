import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { supabase } from "../lib/supabase";

type PhotoSlot = {
  position: number;
  storagePath: string | null;
  url: string | null;
};

export default function EditPhotosScreen() {
  const { width } = useWindowDimensions();
  const [photos, setPhotos] = useState<PhotoSlot[]>([
    { position: 1, storagePath: null, url: null },
    { position: 2, storagePath: null, url: null },
    { position: 3, storagePath: null, url: null },
    { position: 4, storagePath: null, url: null },
  ]);
  const [loading, setLoading] = useState(true);

  const tileSpacing = 12;
  const horizontalPadding = 24;
  const tileSize = Math.floor((width - horizontalPadding * 2 - tileSpacing) / 2);

  const loadPhotos = async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("profile_photos")
      .select("position, storage_path")
      .eq("user_id", user.id)
      .order("position", { ascending: true });

    if (error) {
      console.log("Load photos error:", error.message);
      setLoading(false);
      return;
    }

    const nextPhotos: PhotoSlot[] = [1, 2, 3, 4].map((position) => {
      const found = data?.find((photo) => photo.position === position);

      if (!found) {
        return { position, storagePath: null, url: null };
      }

      const { data: publicData } = supabase.storage
        .from("profile-photos")
        .getPublicUrl(found.storage_path);

      return {
        position,
        storagePath: found.storage_path,
        url: `${publicData.publicUrl}?t=${Date.now()}`,
      };
    });

    setPhotos(nextPhotos);
    setLoading(false);
  };

  useEffect(() => {
    loadPhotos();
  }, []);

  const replacePhoto = async (position: number) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission needed", "Please allow photo access.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (result.canceled) return;

    const selectedUri = result.assets[0].uri;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const filePath = `${user.id}/photo-${position}.jpg`;

    const base64 = await FileSystem.readAsStringAsync(selectedUri, {
      encoding: "base64",
    });

    const { error: uploadError } = await supabase.storage
      .from("profile-photos")
      .upload(filePath, decode(base64), {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      Alert.alert("Upload error", uploadError.message);
      return;
    }

    const { error: upsertError } = await supabase.from("profile_photos").upsert(
      {
        user_id: user.id,
        position,
        storage_path: filePath,
      },
      {
        onConflict: "user_id,position",
      }
    );

    if (upsertError) {
      Alert.alert("Database error", upsertError.message);
      return;
    }

    await loadPhotos();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B5CF6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Edit Photos</Text>

      <View style={styles.grid}>
        {photos.map((photo, index) => {
          const isRightColumn = index % 2 === 1;
          const isLastRow = index >= 2;

          return (
            <Pressable
              key={photo.position}
              onPress={() => replacePhoto(photo.position)}
              style={[
                styles.slot,
                {
                  width: tileSize,
                  height: tileSize,
                  marginRight: isRightColumn ? 0 : tileSpacing,
                  marginBottom: isLastRow ? 0 : tileSpacing,
                },
              ]}
            >
              {photo.url ? (
                <Image source={{ uri: photo.url }} style={styles.image} />
              ) : (
                <Text style={styles.plus}>+</Text>
              )}
            </Pressable>
          );
        })}
      </View>

      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backButtonText}>Back</Text>
      </Pressable>
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
    paddingHorizontal: 24,
    paddingTop: 70,
  },

  title: {
    color: "#F2F2F7",
    fontSize: 34,
    fontWeight: "800",
    marginBottom: 22,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 24,
  },

  slot: {
    backgroundColor: "#141426",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2A2A3C",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },

  image: {
    width: "100%",
    height: "100%",
  },

  plus: {
    color: "#8B5CF6",
    fontSize: 42,
    fontWeight: "700",
  },

  backButton: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#2A2A3C",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },

  backButtonText: {
    color: "#F2F2F7",
    fontSize: 15,
    fontWeight: "700",
  },
});