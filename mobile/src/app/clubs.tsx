import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { Stack, useRouter } from "expo-router";
import type { Club } from "@shared/types";
import { listClubs } from "@/lib/db";
import { colors } from "@/lib/theme";
import { Card, EmptyState, LoadingLine, PressableScale } from "@/components/ui";

export default function ClubsScreen() {
  const router = useRouter();
  const [clubs, setClubs] = useState<Club[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    listClubs()
      .then(setClubs)
      .catch(() => setError(true));
  }, []);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Clubs" }} />
      {clubs === null && !error ? <LoadingLine /> : null}
      {error ? <EmptyState title="Could not load clubs" body="Try again in a moment." /> : null}
      {clubs?.length === 0 ? <EmptyState title="No clubs yet" body="When a club is created, it shows up here." /> : null}
      {clubs?.map((club) => (
        <PressableScale key={club.id} onPress={() => router.push(`/club/${club.id}`)}>
          <Card>
            <Text style={styles.name}>{club.name}</Text>
          </Card>
        </PressableScale>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 10, paddingBottom: 40 },
  name: { fontSize: 17, fontWeight: "600", color: colors.ink },
});
