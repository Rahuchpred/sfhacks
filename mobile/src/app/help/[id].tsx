import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput } from "react-native";
import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import type { HelpRequest } from "@shared/types";
import { useAuth } from "@/lib/auth";
import { getHelpRequest, offerHelp } from "@/lib/db";
import { colors } from "@/lib/theme";
import { Card, EmptyState, LoadingLine, Pill, PrimaryButton } from "@/components/ui";

export default function HelpDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { role } = useAuth();
  const [request, setRequest] = useState<HelpRequest | null | undefined>(undefined);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getHelpRequest(id)
      .then(setRequest)
      .catch(() => setRequest(null));
  }, [id]);

  if (request === undefined) {
    return (
      <>
        <Stack.Screen options={{ title: "Request" }} />
        <LoadingLine />
      </>
    );
  }
  if (!request) {
    return (
      <>
        <Stack.Screen options={{ title: "Request" }} />
        <EmptyState title="Request not found" body="It may have been closed." />
      </>
    );
  }

  async function offer() {
    if (role !== "student") {
      router.push("/welcome");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await offerHelp(request!.id, note.trim());
      setDone(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setError("Could not send the offer. You may already have one on this request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Request" }} />
      <Pill label={request.rewardType} tone="gold" />
      <Text style={styles.title}>{request.title}</Text>
      <Text style={styles.meta}>
        {request.requesterName}
        {request.department ? ` · ${request.department}` : ""}
      </Text>
      <Text style={styles.body}>{request.description}</Text>
      <Card>
        <Text style={styles.label}>Time</Text>
        <Text style={styles.value}>{request.timeNeeded}</Text>
        <Text style={styles.label}>You get</Text>
        <Text style={styles.value}>{request.rewardDetail || request.rewardType}</Text>
        {request.skills.length > 0 ? (
          <>
            <Text style={styles.label}>Skills</Text>
            <Text style={styles.value}>{request.skills.join(", ")}</Text>
          </>
        ) : null}
      </Card>
      {done ? (
        <Text style={styles.body}>Offer sent. The requester decides from the website.</Text>
      ) : (
        <>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="A short note about why you can help"
            placeholderTextColor={colors.muted}
            multiline
            style={styles.input}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton label={busy ? "Sending…" : "Offer to help"} disabled={busy} onPress={offer} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: "700", color: colors.ink },
  meta: { fontSize: 15, color: colors.muted, marginTop: -6 },
  body: { fontSize: 16, lineHeight: 23, color: colors.ink },
  label: { fontSize: 13, fontWeight: "600", color: colors.muted },
  value: { fontSize: 16, color: colors.ink, marginBottom: 4 },
  input: {
    minHeight: 96,
    borderRadius: 14,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.white,
    padding: 14,
    fontSize: 16,
    color: colors.ink,
    textAlignVertical: "top",
  },
  error: { color: colors.danger, fontSize: 15 },
});
