import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { buildingById, useCampus } from "@/lib/campus";
import { formatTime, placeLabel } from "@/lib/format";
import { useSample } from "@/lib/sample";
import { colors } from "@/lib/theme";
import { Card, EmptyState, LoadingLine, Pill, PrimaryButton } from "@/components/ui";

export default function FoodScreen() {
  const insets = useSafeAreaInsets();
  const { persona } = useSample();
  const { status, buildings, rescues, refresh } = useCampus();
  const [message, setMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  function onRefresh() {
    setRefreshing(true);
    refresh();
    setRefreshing(false);
  }

  function claim() {
    if (!persona) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setMessage("Your pickup code is FOOD4ALX. Show it when you collect the food.");
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.purple} />}
    >
      <Text style={styles.title}>Free food</Text>
      <Text style={styles.subtitle}>Leftovers posted by clubs, before they are thrown away.</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}

      <View style={styles.block}>
        <Text style={styles.section}>Open now</Text>
        {status === "loading" ? <LoadingLine /> : null}
        {status === "error" ? (
          <EmptyState title="Could not load food" body="Pull down to try again." />
        ) : null}
        {status === "ready" && rescues.length === 0 ? (
          <EmptyState title="No leftovers posted" body="When a club has extra food, it shows up here." />
        ) : null}
        {rescues.map((rescue) => (
          <Card key={rescue.id}>
            <View style={styles.pills}>
              <Pill label={`${rescue.portionsLeft} left`} tone="gold" />
              {rescue.dietary.slice(0, 2).map((tag) => (
                <Pill key={tag} label={tag} tone="muted" />
              ))}
            </View>
            <Text style={styles.item}>{rescue.items}</Text>
            <Text style={styles.meta}>
              {placeLabel(buildingById(buildings, rescue.buildingId), rescue.room)}
            </Text>
            <Text style={styles.meta}>Safe until {formatTime(rescue.safeUntil)}</Text>
            <PrimaryButton tone="gold" label="Claim a portion" onPress={claim} />
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  title: { fontSize: 34, fontWeight: "700", color: colors.ink },
  subtitle: { fontSize: 15, lineHeight: 21, color: colors.muted },
  message: { fontSize: 15, lineHeight: 21, color: colors.ink },
  block: { gap: 10 },
  section: { fontSize: 13, fontWeight: "600", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  item: { fontSize: 17, fontWeight: "600", color: colors.ink },
  meta: { fontSize: 14, color: colors.muted },
});
