import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Stack } from "expo-router";
import * as Haptics from "expo-haptics";
import { CameraView, useCameraPermissions } from "expo-camera";
import { checkIn } from "@/lib/db";
import { colors } from "@/lib/theme";
import { PrimaryButton } from "@/components/ui";

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [code, setCode] = useState("");
  const [locked, setLocked] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);

  async function submit(raw: string) {
    const next = raw.trim();
    if (!next || locked) return;
    setLocked(true);
    setCode(next);
    try {
      const checked = await checkIn(next);
      setOk(checked.ok);
      if (checked.ok) {
        setResult(`${checked.guestName ?? "Guest"} is checked in.`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        const reason =
          checked.reason === "already_checked_in"
            ? `${checked.guestName ?? "This guest"} is already checked in.`
            : checked.reason === "not_host"
              ? "You are not working this event."
              : "No ticket matches that code.";
        setResult(reason);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch {
      setOk(false);
      setResult("Could not check in. Try the code again.");
    } finally {
      setTimeout(() => setLocked(false), 1200);
    }
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: "Check in" }} />
      <Text style={styles.lead}>Point at a ticket QR code, or type the 8-character code.</Text>
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
      <TextInput
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        placeholder="Ticket code"
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
      <PrimaryButton label="Check in" disabled={locked} onPress={() => submit(code)} />
      {result ? <Text style={[styles.result, ok ? styles.good : styles.bad]}>{result}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  lead: { fontSize: 16, lineHeight: 22, color: colors.ink },
  cameraWrap: { height: 280, borderRadius: 18, overflow: "hidden", backgroundColor: colors.ink },
  camera: { flex: 1 },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    fontSize: 18,
    letterSpacing: 2,
    color: colors.ink,
  },
  result: { fontSize: 17, fontWeight: "600" },
  good: { color: colors.live },
  bad: { color: colors.danger },
});
