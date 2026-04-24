import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";


export default function WelcomeScreen() {
  const [isNavigating, setIsNavigating] = useState(false);
  useFocusEffect(
  useCallback(() => {
    setIsNavigating(false);
  }, [])
);

  const goTo = (path: "/login" | "/signup") => {
    if (isNavigating) return;
    setIsNavigating(true);
    router.push(path);
  };

  return (
    <View style={styles.container}>
      <View style={styles.glow} />

      <View style={styles.heroCard}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>music + friends</Text>
        </View>

        <Text style={styles.title}>Spotifriends</Text>
        <Text style={styles.subtitle}>
          Share your top songs, discover mutual favorites, and spot a friend through music.
        </Text>
      </View>

      <View style={styles.buttonRow}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && !isNavigating && styles.primaryButtonPressed,
            isNavigating && styles.buttonDisabled,
          ]}
          onPress={() => goTo("/login")}
          disabled={isNavigating}
        >
          <Text style={styles.primaryButtonText}>Log In</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && !isNavigating && styles.secondaryButtonPressed,
            isNavigating && styles.buttonDisabled,
          ]}
          onPress={() => goTo("/signup")}
          disabled={isNavigating}
        >
          <Text style={styles.secondaryButtonText}>Sign Up</Text>
        </Pressable>
      </View>

      <Text style={styles.footerText}>
        Build your Top 5 and connect through taste.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0B12",
    justifyContent: "center",
    paddingHorizontal: 24,
    position: "relative",
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

  heroCard: {
    backgroundColor: "#11111A",
    borderWidth: 1,
    borderColor: "#232336",
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 28,
  },

  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#1A1730",
    borderWidth: 1,
    borderColor: "#30285C",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 16,
  },

  badgeText: {
    color: "#B9A8FF",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "lowercase",
  },

  title: {
    color: "#7C5CFF",
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: 0.6,
  },

  subtitle: {
    color: "#B8B8C7",
    marginTop: 12,
    fontSize: 16,
    lineHeight: 24,
  },

  buttonRow: {
    width: "100%",
    marginTop: 28,
    gap: 14,
  },

  primaryButton: {
    backgroundColor: "#7C5CFF",
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
  },

  primaryButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },

  primaryButtonText: {
    color: "#F2F2F7",
    fontSize: 16,
    fontWeight: "800",
  },

  secondaryButton: {
    borderWidth: 1,
    borderColor: "#2A2A3C",
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "#141426",
  },

  secondaryButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },

  secondaryButtonText: {
    color: "#F2F2F7",
    fontSize: 16,
    fontWeight: "800",
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  footerText: {
    marginTop: 18,
    textAlign: "center",
    color: "#6B6B7A",
    fontSize: 13,
    fontWeight: "600",
  },
});