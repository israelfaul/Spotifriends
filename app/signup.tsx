import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";

const isValidEmail = (value: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
};

export default function SignupScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  
  const cleanEmail = email.trim();

  const emailHasError =
    emailTouched &&
    cleanEmail.length > 0 &&
    !isValidEmail(cleanEmail);

  const passwordHasError =
    passwordTouched &&
    password.length > 0 &&
    password.length < 6;

  const canSubmit = useMemo(() => {
    return isValidEmail(cleanEmail) && password.length >= 6 && !loading;
  }, [cleanEmail, password, loading]);

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 8,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -8,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const onSignup = async () => {
    const cleanEmail = email.trim();
    setErrorMessage("");
    
    setEmailTouched(true);
    setPasswordTouched(true);

    if (!isValidEmail(cleanEmail)) {
      setErrorMessage("Please enter a valid email address.");
      triggerShake();
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      triggerShake();
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
    });

    setLoading(false);

    if (error) {
      if (error.message.toLowerCase().includes("already")) {
        setErrorMessage("An account with this email already exists.");
      } else {
        setErrorMessage("Something went wrong. Please try again.");
      }
      triggerShake();
      return;
    }


    console.log("Signup success:", data.user?.id);
    router.replace("/name");
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Animated.View
        style={[
          styles.content,
          {
            transform: [{ translateX: shakeAnim }],
          },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Sign Up</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errorMessage) setErrorMessage("");
              }}
              onBlur={() => setEmailTouched(true)}
              placeholder="you@example.com"
              placeholderTextColor="#6B6B7A"
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
              style={[styles.input, errorMessage ? styles.inputError : null]}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errorMessage) setErrorMessage("");
              }}
              onBlur={() => setPasswordTouched(true)}
              placeholder="At least 6 characters"
              placeholderTextColor="#6B6B7A"
              secureTextEntry
              editable={!loading}
              style={[styles.input, errorMessage ? styles.inputError : null]}
            />
            {emailHasError ? (
              <Text style={styles.errorText}>
                Enter a valid email address.
              </Text>
            ) : null}
            {passwordHasError ? (
              <Text style={styles.errorText}>
                Password must be at least 6 characters.
              </Text>
            ) : null}
          </View>

          {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              (!canSubmit || loading) && styles.primaryButtonDisabled,
              pressed && canSubmit && !loading && styles.primaryButtonPressed,
            ]}
            disabled={!canSubmit || loading}
            onPress={onSignup}
          >
            {loading ? (
              <ActivityIndicator color="#F2F2F7" />
            ) : (
              <Text style={styles.primaryButtonText}>Continue</Text>
            )}
          </Pressable>

          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0B12",
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  content: {
    flex: 1,
  },
  header: {
    marginTop: 18,
    marginBottom: 28,
  },
  title: {
    color: "#F2F2F7",
    fontSize: 34,
    fontWeight: "800",
  },
  form: {
    gap: 14,
  },
  field: {
    gap: 8,
  },
  label: {
    color: "#B8B8C7",
    fontSize: 13,
  },
  input: {
    backgroundColor: "#141426",
    borderWidth: 1,
    borderColor: "#2A2A3C",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#F2F2F7",
    fontSize: 16,
  },
  inputError: {
    borderColor: "#FF6B6B",
  },
  errorText: {
    color: "#FF6B6B",
    fontSize: 14,
    marginTop: -4,
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: "#7C5CFF",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  primaryButtonPressed: {
    opacity: 0.9,
  },
  primaryButtonDisabled: {
    backgroundColor: "#2A2A3C",
  },
  primaryButtonText: {
    color: "#F2F2F7",
    fontSize: 16,
    fontWeight: "800",
  },
  backButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#2A2A3C",
    backgroundColor: "#141426",
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