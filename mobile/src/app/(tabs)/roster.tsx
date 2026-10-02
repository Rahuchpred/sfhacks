import { ScrollView, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "@/components/ui";
import { useCampus } from "@/lib/campus";
import { isHappeningNow } from "@/lib/format";
import { colors } from "@/lib/theme";

const FALLBACK_EVENT = "SF Hacks x GDG AI Hackathon";

const ROSTER = [
  { name: "Alex Chen", major: "Computer Science", status: "Checked in", checkedIn: true },
  {
    name: "Jordan Lee",
    major: "Computer Science",
    status: "Registered, not checked in yet",
    checkedIn: false,
  },
  { name: "Mina Alvarez", major: "Design", status: "Checked in", checkedIn: true },
  { name: "Sam Okonkwo", major: "Biology", status: "Registered", checkedIn: false },
] as const;

export default function RosterScreen() {
  const insets = useSafeAreaInsets();
  const { status, events } = useCampus();
  const now = Date.now();
  const featured =
    status === "ready"
      ? events.find((event) => isHappeningNow(event, now) || Date.parse(event.startsAt) >= now)
      : undefined;
  const checkedIn = ROSTER.filter((person) => person.checkedIn).length;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}
    >
      <Text style={styles.title}>Roster</Text>
      <Text style={styles.subtitle}>{featured?.title ?? FALLBACK_EVENT}</Text>
      <Text style={styles.count}>
        {checkedIn} checked in · {ROSTER.length} registered
      </Text>

      {ROSTER.map((person) => (
        <Card key={person.name}>
          <Text style={styles.name}>{person.name}</Text>
          <Text style={styles.major}>{person.major}</Text>
          <Text style={[styles.status, person.checkedIn ? styles.checkedIn : styles.waiting]}>{person.status}</Text>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, gap: 12 },
  title: { fontSize: 34, fontWeight: "700", color: colors.ink, letterSpacing: 0.2 },
  subtitle: { fontSize: 15, lineHeight: 21, color: colors.muted },
  count: { fontSize: 15, fontWeight: "600", color: colors.ink, marginBottom: 4 },
  name: { fontSize: 17, fontWeight: "600", color: colors.ink },
  major: { fontSize: 14, color: colors.muted },
  status: { fontSize: 14, fontWeight: "600" },
  checkedIn: { color: colors.live },
  waiting: { color: colors.muted },
});
