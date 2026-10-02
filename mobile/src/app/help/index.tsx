import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { Stack, useRouter } from "expo-router";
import type { HelpRequest } from "@shared/types";
import { listOpenHelpRequests } from "@/lib/db";
import { colors } from "@/lib/theme";
import { Card, EmptyState, LoadingLine, Pill, PressableScale } from "@/components/ui";

export default function HelpScreen() {
  const router = useRouter();
  const [requests, setRequests] = useState<HelpRequest[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    listOpenHelpRequests()
      .then(setRequests)
      .catch(() => setError(true));
  }, []);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Help board" }} />
      <Text style={styles.lead}>Faculty and staff ask for one-time help. Every request says what you get.</Text>
      {requests === null && !error ? <LoadingLine /> : null}
      {error ? <EmptyState title="Could not load the board" body="Try again in a moment." /> : null}
      {requests?.length === 0 ? <EmptyState title="No open requests" body="Check back when someone posts." /> : null}
      {requests?.map((request) => (
        <PressableScale key={request.id} onPress={() => router.push(`/help/${request.id}`)}>
          <Card>
            <Pill label={request.rewardType} tone="gold" />
            <Text style={styles.title}>{request.title}</Text>
            <Text style={styles.meta}>
              {request.requesterName}
              {request.department ? ` · ${request.department}` : ""}
            </Text>
            <Text style={styles.meta}>{request.timeNeeded}</Text>
          </Card>
        </PressableScale>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  lead: { fontSize: 15, lineHeight: 21, color: colors.muted },
  title: { fontSize: 17, fontWeight: "600", color: colors.ink },
  meta: { fontSize: 14, color: colors.muted },
});
