import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import type { CampusEvent, Club } from "@shared/types";
import { buildingById, useCampus } from "@/lib/campus";
import { getClub, listClubEvents } from "@/lib/db";
import { formatTimeRange, placeLabel } from "@/lib/format";
import { colors } from "@/lib/theme";
import { Card, EmptyState, LoadingLine, PressableScale } from "@/components/ui";

export default function ClubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { buildings } = useCampus();
  const [club, setClub] = useState<Club | null | undefined>(undefined);
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const now = Date.now();

  useEffect(() => {
    if (!id) return;
    getClub(id)
      .then(setClub)
      .catch(() => setClub(null));
    listClubEvents(id)
      .then(setEvents)
      .catch(() => setEvents([]));
  }, [id]);

  if (club === undefined) {
    return (
      <>
        <Stack.Screen options={{ title: "Club" }} />
        <LoadingLine label="Loading club…" />
      </>
    );
  }
  if (!club) {
    return (
      <>
        <Stack.Screen options={{ title: "Club" }} />
        <EmptyState title="Club not found" body="It may have been removed." />
      </>
    );
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: club.name }} />
      <Text style={styles.name}>{club.name}</Text>
      {events.length === 0 ? (
        <EmptyState title="No upcoming events" body="This club has nothing scheduled right now." />
      ) : (
        events.map((event) => (
          <PressableScale key={event.id} onPress={() => router.push(`/event/${event.id}`)}>
            <Card>
              <Text style={styles.event}>{event.title}</Text>
              <Text style={styles.meta}>{formatTimeRange(event, now)}</Text>
              <Text style={styles.meta}>{placeLabel(buildingById(buildings, event.buildingId), event.room)}</Text>
            </Card>
          </PressableScale>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  name: { fontSize: 28, fontWeight: "700", color: colors.ink },
  event: { fontSize: 17, fontWeight: "600", color: colors.ink },
  meta: { fontSize: 14, color: colors.muted },
});
