import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import type { CampusEvent, Ticket } from "@shared/types";
import { TicketQr } from "@/components/ticket-qr";
import { useAuth } from "@/lib/auth";
import { buildingById, useCampus } from "@/lib/campus";
import { cancelRsvp, getEvent, getMyTicket, rsvpEvent } from "@/lib/db";
import { categoryLabel, formatTimeRange, isHappeningNow, placeLabel } from "@/lib/format";
import { SAMPLE_TICKET_CODE, useSample } from "@/lib/sample";
import { colors } from "@/lib/theme";
import { Card, EmptyState, LoadingLine, Pill, PrimaryButton, QuietButton } from "@/components/ui";

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role } = useAuth();
  const { persona } = useSample();
  const { buildings } = useCampus();
  const [event, setEvent] = useState<CampusEvent | null | undefined>(undefined);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = Date.now();

  const sampleTicket = persona === "student" || persona === "club";

  const load = useCallback(async () => {
    if (!id) return;
    const next = await getEvent(id);
    setEvent(next);
    if (sampleTicket || !role || !next) setTicket(null);
    else setTicket(await getMyTicket(next.id).catch(() => null));
  }, [id, role, sampleTicket]);

  useEffect(() => {
    load().catch(() => setEvent(null));
  }, [load]);

  if (event === undefined) {
    return (
      <>
        <Stack.Screen options={{ title: "Event" }} />
        <LoadingLine label="Loading event…" />
      </>
    );
  }
  if (!event) {
    return (
      <>
        <Stack.Screen options={{ title: "Event" }} />
        <EmptyState title="Event not found" body="It may have been removed." />
      </>
    );
  }

  const live = isHappeningNow(event, now);
  const ended = Date.parse(event.endsAt) < now;
  const category = categoryLabel(event.tags);

  async function register() {
    if (persona) return;
    setBusy(true);
    setError(null);
    try {
      const next = await rsvpEvent(event!.id);
      setTicket(next);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setError("Could not register. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (persona) return;
    setBusy(true);
    setError(null);
    try {
      await cancelRsvp(event!.id);
      setTicket(null);
    } catch {
      setError("Could not cancel. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: event.title }} />
      <View style={styles.pills}>
        {live ? <Pill label="Happening now" tone="live" /> : null}
        {category ? <Pill label={category} /> : null}
        {event.hasFood ? <Pill label="Food" tone="gold" /> : null}
      </View>
      <Text style={styles.title}>{event.title}</Text>
      <Text style={styles.club}>{event.clubName}</Text>
      <Card>
        <Text style={styles.label}>When</Text>
        <Text style={styles.value}>{formatTimeRange(event, now)}</Text>
        <Text style={styles.label}>Where</Text>
        <Text style={styles.value}>{placeLabel(buildingById(buildings, event.buildingId), event.room)}</Text>
        <Text style={styles.label}>Going</Text>
        <Text style={styles.value}>{event.rsvpCount}</Text>
      </Card>
      {event.description ? <Text style={styles.body}>{event.description}</Text> : null}
      {event.foodItems.length > 0 ? (
        <Text style={styles.body}>Food: {event.foodItems.join(", ")}</Text>
      ) : null}

      {sampleTicket ? (
        <View style={styles.sample}>
          <TicketQr />
          <Text style={styles.sampleLine}>This is the sample ticket. The door reads {SAMPLE_TICKET_CODE}.</Text>
        </View>
      ) : ticket ? (
        <Card style={styles.ticket}>
          <Text style={styles.label}>{ticket.checkedInAt ? "Checked in" : "Your ticket"}</Text>
          {ticket.checkedInAt ? null : (
            <>
              <QRCode value={ticket.code} size={180} color={colors.ink} backgroundColor={colors.white} />
              <Text style={styles.code}>{ticket.code}</Text>
            </>
          )}
        </Card>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!ended && !ticket && !persona ? (
        <PrimaryButton label={busy ? "Registering…" : "Register"} disabled={busy} onPress={register} />
      ) : null}
      {!ended && ticket && !ticket.checkedInAt && !persona ? (
        <QuietButton label={busy ? "Cancelling…" : "Cancel registration"} onPress={cancel} />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  title: { fontSize: 28, fontWeight: "700", color: colors.ink },
  club: { fontSize: 16, color: colors.muted, marginTop: -8 },
  label: { fontSize: 13, fontWeight: "600", color: colors.muted },
  value: { fontSize: 16, color: colors.ink, marginBottom: 4 },
  body: { fontSize: 16, lineHeight: 23, color: colors.ink },
  ticket: { alignItems: "center" },
  sample: { gap: 8 },
  sampleLine: { fontSize: 15, lineHeight: 21, color: colors.muted, textAlign: "center" },
  code: { fontSize: 20, fontWeight: "700", letterSpacing: 4, color: colors.ink },
  error: { color: colors.danger, fontSize: 15 },
});
