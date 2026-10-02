import { ScrollView, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PEOPLE, useSample } from "@/lib/sample";
import { colors } from "@/lib/theme";
import { Card, PressableScale, PrimaryButton } from "@/components/ui";

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { persona } = useSample();
  const person = persona ? PEOPLE[persona] : null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}
    >
      <Text style={styles.title}>More</Text>
      {person ? (
        <Card>
          <Text style={styles.item}>{person.name}</Text>
          <Text style={styles.meta}>{person.line}</Text>
        </Card>
      ) : null}
      <PrimaryButton label="Switch sample" onPress={() => router.push("/welcome")} />

      <Menu label="Clubs" detail="Directory" onPress={() => router.push("/clubs")} />
      <Menu label="Safety notices" detail="University Police" onPress={() => router.push("/safety")} />
      {persona === "student" ? (
        <Menu label="Help board" detail="One-time help from faculty" onPress={() => router.push("/help")} />
      ) : null}
    </ScrollView>
  );
}

function Menu({ label, detail, onPress }: { label: string; detail: string; onPress: () => void }) {
  return (
    <PressableScale accessibilityRole="button" onPress={onPress}>
      <Card>
        <Text style={styles.item}>{label}</Text>
        <Text style={styles.meta}>{detail}</Text>
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 10 },
  title: { fontSize: 34, fontWeight: "700", color: colors.ink, marginBottom: 6 },
  item: { fontSize: 17, fontWeight: "600", color: colors.ink },
  meta: { fontSize: 14, color: colors.muted },
});
