import { useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { checkIn } from "@/lib/db";
import { colors } from "@/lib/theme";
import { Card, PrimaryButton } from "@/components/ui";

// Matches SAMPLE_TICKET_CODE. sample.tsx is not in this tree yet, so the code is inlined.
const SAMPLE_TICKET_CODE = "ALEX26QR";

type Guest = {
  name: string;
  checkedIn: boolean;
};

const STARTING_GUESTS: Guest[] = [
  { name: "Alex Chen", checkedIn: false },
  { name: "Mina Alvarez", checkedIn: true },
  { name: "Sam Okonkwo", checkedIn: false },
];

export default function DoorScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [code, setCode] = useState("");
  const [locked, setLocked] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const [guests, setGuests] = useState(STARTING_GUESTS);
  const busy = useRef(false);
  const alexCheckedIn = useRef(false);

  async function submit(raw: string) {
    const next = raw.trim().toUpperCase();
    if (!next || busy.current) return;
    busy.current = true;
    setLocked(true);
    setCode(next);
    try {
      if (next === SAMPLE_TICKET_CODE) {
        if (alexCheckedIn.current) {
          setOk(false);
          setResult("Alex Chen is already checked in.");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else {
          alexCheckedIn.current = true;
          setGuests((current) =>
            current.map((guest) => (guest.name === "Alex Chen" ? { ...guest, checkedIn: true } : guest)),
          );
          setOk(true);
          setResult("Alex Chen is checked in.");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        return;
      }

      try {
        const checked = await checkIn(next);
        if (!checked.ok) {
          setOk(false);
          setResult("No ticket matches that code.");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return;
        }
        setOk(true);
        setResult(`${checked.guestName ?? "Guest"} is checked in.`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        setOk(false);
        setResult("No ticket matches that code.");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setTimeout(() => {
        busy.current = false;
        setLocked(false);
      }, 1200);
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Door</Text>
      <Text style={styles.subtitle}>Gator Coders · Jordan Lee</Text>

      <Text style={styles.label}>Ticket code</Text>
      <TextInput
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="ALEX26QR"
        placeholderTextColor={colors.muted}
        style={styles.input}
        accessibilityLabel="Ticket code"
      />
      <PrimaryButton label="Check in" disabled={locked} onPress={() => submit(code)} />

      {permission?.granted ? (
        <View style={styles.cameraWrap}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={locked ? undefined : ({ data }) => submit(data)}
          />
        </View>
      ) : (
        <PrimaryButton label="Allow the camera" onPress={() => requestPermission()} />
      )}

      {result ? <Text style={[styles.result, ok ? styles.good : styles.bad]}>{result}</Text> : null}

      <Text style={styles.section}>Guest list</Text>
      {guests.map((guest) => (
        <Card key={guest.name}>
          <Text style={styles.name}>{guest.name}</Text>
          <Text style={[styles.status, guest.checkedIn ? styles.good : styles.waiting]}>
            {guest.checkedIn ? "Checked in" : "Not checked in"}
          </Text>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, gap: 12 },
  title: { fontSize: 34, fontWeight: "700", color: colors.ink, letterSpacing: 0.2 },
  subtitle: { fontSize: 15, color: colors.muted, marginBottom: 6 },
  label: { fontSize: 13, fontWeight: "600", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  input: {
    minHeight: 56,
    borderRadius: 14,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    fontSize: 22,
    fontWeight: "600",
    letterSpacing: 2,
    color: colors.ink,
  },
  cameraWrap: { height: 220, borderRadius: 18, overflow: "hidden", backgroundColor: colors.ink },
  camera: { flex: 1 },
  result: { fontSize: 17, fontWeight: "600" },
  good: { color: colors.live },
  bad: { color: colors.danger },
  waiting: { color: colors.muted },
  section: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  name: { fontSize: 17, fontWeight: "600", color: colors.ink },
  status: { fontSize: 14, fontWeight: "600" },
});
