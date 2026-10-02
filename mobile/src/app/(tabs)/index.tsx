import { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { AppleMaps } from "expo-maps";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CampusEvent } from "@shared/types";
import { buildingById, useCampus } from "@/lib/campus";
import { PEOPLE, useSample } from "@/lib/sample";
import { categoryLabel, formatTimeRange, isHappeningNow, placeLabel } from "@/lib/format";
import { colors } from "@/lib/theme";
import { Card, EmptyState, LoadingLine, Pill, PressableScale } from "@/components/ui";

const CAMPUS = { latitude: 37.7241, longitude: -122.4799 };

type Filter = "all" | "now" | "food";

export default function CampusScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { status, buildings, events, rescues } = useCampus();
  const { persona } = useSample();
  const [filter, setFilter] = useState<Filter>("all");
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const now = Date.now();

  const visible = useMemo(() => {
    return events.filter((event) => {
      if (buildingId && event.buildingId !== buildingId) return false;
      if (filter === "now") return isHappeningNow(event, now);
      if (filter === "food") return event.hasFood;
      return true;
    });
  }, [events, buildingId, filter, now]);

  const markers = useMemo(() => {
    const ids = new Set<string>();
    for (const event of events) ids.add(event.buildingId);
    for (const rescue of rescues) ids.add(rescue.buildingId);
    return [...ids].flatMap((id) => {
      const building = buildingById(buildings, id);
      if (!building) return [];
      const hasRescue = rescues.some((rescue) => rescue.buildingId === id);
      return [
        {
          id,
          coordinates: { latitude: building.lat, longitude: building.lng },
          title: building.name,
          systemImage: hasRescue ? "fork.knife" : "mappin",
          tintColor: hasRescue ? colors.gold : colors.purple,
        },
      ];
    });
  }, [buildings, events, rescues]);

  const selected = buildingId ? buildingById(buildings, buildingId) : undefined;
  const liveCount = events.filter((event) => isHappeningNow(event, now)).length;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Campus</Text>
        {persona ? (
          <Text style={styles.subtitle}>
            {PEOPLE[persona].name} · {PEOPLE[persona].line}
          </Text>
        ) : null}
        <Text style={styles.subtitle}>
          {status === "ready"
            ? liveCount > 0
              ? `${liveCount} happening now · ${events.length} upcoming`
              : `${events.length} upcoming on campus`
            : "SF State"}
        </Text>
        <View style={styles.filters}>
          <FilterChip label="All" active={filter === "all"} onPress={() => setFilter("all")} />
          <FilterChip label="Now" active={filter === "now"} onPress={() => setFilter("now")} />
          <FilterChip label="Food" active={filter === "food"} onPress={() => setFilter("food")} />
          {selected ? (
            <FilterChip label={selected.name} active onPress={() => setBuildingId(null)} />
          ) : null}
        </View>
      </View>
      <AppleMaps.View
        style={styles.map}
        cameraPosition={{ coordinates: CAMPUS, zoom: 15 }}
        markers={markers}
        onMarkerClick={(marker) => {
          if (marker.id) setBuildingId(marker.id);
        }}
      />
      {status === "loading" ? (
        <LoadingLine />
      ) : status === "error" ? (
        <EmptyState title="Could not load campus" body="Check the connection and pull the list again in a moment." />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(event) => event.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          ListEmptyComponent={
            <EmptyState
              title="Nothing here"
              body={selected ? "No events at this building match the filter." : "No upcoming events match this filter."}
            />
          }
          renderItem={({ item }) => (
            <EventRow
              event={item}
              place={placeLabel(buildingById(buildings, item.buildingId), item.room)}
              now={now}
              onPress={() => router.push(`/event/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <PressableScale
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

function EventRow({
  event,
  place,
  now,
  onPress,
}: {
  event: CampusEvent;
  place: string;
  now: number;
  onPress: () => void;
}) {
  const live = isHappeningNow(event, now);
  const category = categoryLabel(event.tags);
  return (
    <PressableScale accessibilityRole="button" onPress={onPress}>
      <Card>
        <View style={styles.rowTop}>
          {live ? <Pill label="Now" tone="live" /> : null}
          {category ? <Pill label={category} /> : null}
          {event.hasFood ? <Pill label="Food" tone="gold" /> : null}
        </View>
        <Text style={styles.eventTitle}>{event.title}</Text>
        <Text style={styles.meta}>{event.clubName}</Text>
        <Text style={styles.meta}>{formatTimeRange(event, now)}</Text>
        <Text style={styles.meta}>{place}</Text>
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingBottom: 10, gap: 4 },
  title: { fontSize: 34, fontWeight: "700", color: colors.ink, letterSpacing: 0.2 },
  subtitle: { fontSize: 15, color: colors.muted },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: {
    minHeight: 32,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  chipActive: { backgroundColor: colors.purple },
  chipText: { color: colors.ink, fontSize: 14, fontWeight: "600", maxWidth: 160 },
  chipTextActive: { color: colors.white },
  map: { height: 240, marginHorizontal: 16, borderRadius: 18, overflow: "hidden" },
  list: { padding: 16, gap: 10, paddingBottom: 32 },
  rowTop: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  eventTitle: { fontSize: 17, fontWeight: "600", color: colors.ink },
  meta: { fontSize: 14, color: colors.muted },
});
