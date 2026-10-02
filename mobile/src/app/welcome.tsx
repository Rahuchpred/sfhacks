import { ScrollView, StyleSheet, Text } from "react-native";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import { PEOPLE, useSample, type Persona } from "@/lib/sample";
import { colors } from "@/lib/theme";
import { Card, PressableScale } from "@/components/ui";

const CARDS: { persona: Persona; kicker: string; detail: string }[] = [
  { persona: "student", kicker: "Student", detail: "Tickets, food, the map." },
  { persona: "faculty", kicker: "Faculty", detail: "Help requests and a roster." },
  { persona: "club", kicker: "Club", detail: "Door check-in." },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { ready, choose } = useSample();

  function enter(next: Persona) {
    void Haptics.selectionAsync();
    choose(next);
    router.replace("/");
  }

  if (!ready) return null;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Welcome" }} />
      <Text style={styles.lead}>Pick a sample person. Nothing is emailed.</Text>
      {CARDS.map((card) => {
        const person = PEOPLE[card.persona];
        return (
          <PressableScale
            key={card.persona}
            accessibilityRole="button"
            accessibilityLabel={`${person.name}. ${card.detail}`}
            onPress={() => enter(card.persona)}
          >
            <Card style={styles.card}>
              <Text style={styles.kicker}>{card.kicker}</Text>
              <Text style={styles.name}>{person.name}</Text>
              <Text style={styles.line}>{person.line}</Text>
              <Text style={styles.detail}>{card.detail}</Text>
            </Card>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  lead: { fontSize: 16, lineHeight: 22, color: colors.ink, marginBottom: 4 },
  card: { gap: 4, paddingVertical: 22 },
  kicker: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.purple,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  name: { fontSize: 22, fontWeight: "700", color: colors.ink },
  line: { fontSize: 15, color: colors.muted },
  detail: { fontSize: 16, lineHeight: 22, color: colors.ink, marginTop: 6 },
});
