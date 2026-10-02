import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card, Pill } from "@/components/ui";
import { colors } from "@/lib/theme";

const REQUESTS = [
  {
    title: "Note-taker for CS 210",
    when: "Thursday afternoon, 2 hours",
    reward: "Reward: course credit",
    spots: "1 spot open",
  },
  {
    title: "Hackathon lab setup",
    when: "This evening at Annex I",
    reward: "Reward: volunteer hours",
    spots: "2 spots",
  },
] as const;

export default function RequestsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}
    >
      <Text style={styles.title}>Help</Text>
      <Text style={styles.subtitle}>Requests you posted</Text>
      <Text style={styles.who}>Dr. Priya Shah · Computer Science</Text>

      {REQUESTS.map((request) => (
        <Card key={request.title}>
          <View style={styles.pills}>
            <Pill label="Open" tone="live" />
          </View>
          <Text style={styles.item}>{request.title}</Text>
          <Text style={styles.meta}>{request.when}</Text>
          <Text style={styles.meta}>{request.reward}</Text>
          <Text style={styles.meta}>{request.spots}</Text>
        </Card>
      ))}

      <Card>
        <Text style={styles.quiet}>Students offer help from their phones. You accept them here.</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, gap: 12 },
  title: { fontSize: 34, fontWeight: "700", color: colors.ink, letterSpacing: 0.2 },
  subtitle: { fontSize: 15, lineHeight: 21, color: colors.muted },
  who: { fontSize: 15, color: colors.purple, marginBottom: 4 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  item: { fontSize: 17, fontWeight: "600", color: colors.ink },
  meta: { fontSize: 14, lineHeight: 20, color: colors.muted },
  quiet: { fontSize: 15, lineHeight: 21, color: colors.muted },
});
