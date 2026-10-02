import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { saveMyProfile } from "@/lib/db";
import { colors } from "@/lib/theme";
import { PrimaryButton, QuietButton } from "@/components/ui";

export default function ProfileScreen() {
  const router = useRouter();
  const { email, profile, role, refreshProfile, signOut } = useAuth();
  const [name, setName] = useState(profile?.fullName ?? "");
  const [major, setMajor] = useState(profile?.major ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await saveMyProfile({
        fullName: name.trim(),
        major: major.trim(),
        bio: bio.trim(),
        gradYear: profile?.gradYear ?? null,
        linkedinUrl: profile?.linkedinUrl ?? null,
        githubUrl: profile?.githubUrl ?? null,
        resumeUrl: profile?.resumeUrl ?? null,
        department: profile?.department ?? "",
        company: profile?.company ?? "",
        recruiterVisible: profile?.recruiterVisible ?? false,
      });
      await refreshProfile();
      setSaved(true);
    } catch {
      setError("Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: "Profile" }} />
      <Text style={styles.email}>{email}</Text>
      <Text style={styles.meta}>{role ?? "No role yet"}{profile?.sfsuVerified ? " · SFSU verified" : ""}</Text>
      {!role ? <PrimaryButton label="Choose a role" onPress={() => router.push("/welcome")} /> : null}
      <Field label="Name" value={name} onChangeText={setName} />
      <Field label="Major" value={major} onChangeText={setMajor} />
      <Field label="Bio" value={bio} onChangeText={setBio} multiline />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {saved ? <Text style={styles.saved}>Saved.</Text> : null}
      <PrimaryButton label={busy ? "Saving…" : "Save"} disabled={busy} onPress={save} />
      <QuietButton
        label="Sign out"
        onPress={async () => {
          await signOut();
          router.back();
        }}
      />
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        placeholderTextColor={colors.muted}
        style={[styles.input, multiline && styles.multiline]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 10, paddingBottom: 48 },
  email: { fontSize: 16, fontWeight: "600", color: colors.ink },
  meta: { fontSize: 14, color: colors.muted, marginBottom: 6 },
  label: { fontSize: 13, fontWeight: "600", color: colors.muted },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.ink,
  },
  multiline: { minHeight: 96, paddingTop: 12, textAlignVertical: "top" },
  error: { color: colors.danger, fontSize: 15 },
  saved: { color: colors.live, fontSize: 15 },
});
