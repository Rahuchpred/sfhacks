import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import type { TicketWithEvent } from "@shared/types";
import { TicketQr } from "@/components/ticket-qr";
import { Card, Pill, PressableScale, SectionTitle } from "@/components/ui";
import { buildingById, useCampus } from "@/lib/campus";
import { listMyTickets } from "@/lib/db";
import { formatTimeRange, isHappeningNow, placeLabel } from "@/lib/format";
import { SAMPLE_TICKET_CODE, useSample } from "@/lib/sample";
import { colors } from "@/lib/theme";

export default function TicketsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { persona } = useSample();
  const { buildings, events, refresh } = useCampus();
  const [tickets, setTickets] = useState<TicketWithEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const now = Date.now();

  const load = useCallback(async () => {
    try {
      const next = await listMyTickets();
      setTickets(next.filter((ticket) => ticket.code !== SAMPLE_TICKET_CODE));
    } catch {
      // The sample QR does not depend on a session.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const featured =
    events.find((event) => isHappeningNow(event, now)) ??
    events.find((event) => Date.parse(event.startsAt) > now);
  const upcoming = tickets.filter((ticket) => Date.parse(ticket.event.endsAt) >= now);
  const past = tickets.filter((ticket) => Date.parse(ticket.event.endsAt) < now);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.purple}
          onRefresh={async () => {
            setRefreshing(true);
            refresh();
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      <Text style={styles.title}>Tickets</Text>
      <Text style={styles.subtitle}>Show the code at the door. The host can scan it or type it.</Text>

      <TicketQr
        holder="Alex Chen"
        live={featured ? isHappeningNow(featured, now) : false}
        title={featured?.title ?? "Campus event"}
        club={featured?.clubName}
        when={featured ? formatTimeRange(featured, now) : undefined}
        where={
          featured ? placeLabel(buildingById(buildings, featured.buildingId), featured.room) : undefined
        }
      />
      <Text style={styles.hint}>
        {persona === "club" ? "Club sample ticket." : "Alex Chen's sample ticket."} The door reads {SAMPLE_TICKET_CODE}.
      </Text>

      {upcoming.length > 0 ? <SectionTitle>Other tickets</SectionTitle> : null}
      {upcoming.map((ticket) => (
        <PressableScale key={ticket.id} onPress={() => router.push(`/event/${ticket.event.id}`)}>
          <Card>
            <View style={styles.pills}>
              {ticket.checkedInAt ? <Pill label="Checked in" tone="live" /> : <Pill label="Upcoming" />}
            </View>
            <Text style={styles.item}>{ticket.event.title}</Text>
            <Text style={styles.meta}>{ticket.event.clubName}</Text>
            <Text style={styles.meta}>{formatTimeRange(ticket.event, now)}</Text>
            <Text style={styles.meta}>
              {placeLabel(buildingById(buildings, ticket.event.buildingId), ticket.event.room)}
            </Text>
            {ticket.checkedInAt ? null : (
              <View style={styles.qr}>
                <QRCode value={ticket.code} size={148} color={colors.ink} backgroundColor={colors.white} />
                <Text style={styles.smallCode}>{ticket.code}</Text>
              </View>
            )}
          </Card>
        </PressableScale>
      ))}

      {past.length > 0 ? <SectionTitle>Past</SectionTitle> : null}
      {past.map((ticket) => (
        <Card key={ticket.id}>
          <Text style={styles.pastTitle}>{ticket.event.title}</Text>
          <Text style={styles.meta}>
            {ticket.checkedInAt ? "Checked in" : "Not checked in"} · {formatTimeRange(ticket.event, now)}
          </Text>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  title: { fontSize: 34, fontWeight: "700", color: colors.ink },
  subtitle: { fontSize: 15, lineHeight: 21, color: colors.muted, marginBottom: 4 },
  hint: { fontSize: 15, lineHeight: 21, color: colors.muted, textAlign: "center" },
  pills: { flexDirection: "row" },
  item: { fontSize: 17, fontWeight: "600", color: colors.ink },
  pastTitle: { fontSize: 16, fontWeight: "600", color: colors.muted },
  meta: { fontSize: 14, color: colors.muted },
  qr: { alignItems: "center", gap: 8, paddingTop: 8 },
  smallCode: { fontSize: 18, fontWeight: "700", letterSpacing: 4, color: colors.ink },
});
