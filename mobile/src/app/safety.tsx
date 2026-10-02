import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { Stack } from "expo-router";
import type { SafetyNotice } from "@shared/types";
import { listSafetyNotices } from "@/lib/db";
import { dayLabel } from "@/lib/format";
import { colors } from "@/lib/theme";
import { Card, EmptyState, LoadingLine } from "@/components/ui";

export default function SafetyScreen() {
  const [notices, setNotices] = useState<SafetyNotice[] | null>(null);
  const [error, setError] = useState(false);
  const now = Date.now();

  useEffect(() => {
    listSafetyNotices()
      .then(setNotices)
      .catch(() => setError(true));
  }, []);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Safety" }} />
      <Text style={styles.lead}>Official notices from University Police. This is not a live emergency line.</Text>
      {notices === null && !error ? <LoadingLine /> : null}
      {error ? <EmptyState title="Could not load notices" body="Try again in a moment." /> : null}
      {notices?.length === 0 ? <EmptyState title="No notices" body="Nothing has been posted." /> : null}
      {notices?.map((notice) => (
        <Card key={notice.id}>
          <Text style={styles.kind}>{notice.category || notice.kind}</Text>
          <Text style={styles.title}>{notice.title}</Text>
          <Text style={styles.body}>{notice.summary}</Text>
          <Text style={styles.meta}>
            {notice.area}
            {notice.occurredOn ? ` · ${dayLabel(notice.occurredOn, now)}` : ""}
          </Text>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  lead: { fontSize: 15, lineHeight: 21, color: colors.muted },
  kind: { fontSize: 13, fontWeight: "600", color: colors.purple },
  title: { fontSize: 17, fontWeight: "600", color: colors.ink },
  body: { fontSize: 15, lineHeight: 21, color: colors.ink },
  meta: { fontSize: 14, color: colors.muted },
});
