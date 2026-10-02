import { StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { SAMPLE_TICKET_CODE } from "@/lib/sample";
import { colors } from "@/lib/theme";
import { Card, Pill } from "@/components/ui";

export function TicketQr({
  holder,
  title,
  club,
  when,
  where,
  live = false,
}: {
  holder?: string;
  title?: string;
  club?: string;
  when?: string;
  where?: string;
  live?: boolean;
}) {
  const hasDetails = Boolean(holder || title || club || when || where || live);

  return (
    <Card style={styles.card}>
      {hasDetails ? (
        <View style={styles.details}>
          {holder || live ? (
            <View style={styles.pills}>
              {holder ? <Pill label={holder} /> : null}
              {live ? <Pill label="Happening now" tone="live" /> : null}
            </View>
          ) : null}
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {club ? <Text style={styles.club}>{club}</Text> : null}
          {when ? <Text style={styles.meta}>{when}</Text> : null}
          {where ? <Text style={styles.meta}>{where}</Text> : null}
        </View>
      ) : null}
      <View
        style={styles.qrWrap}
        accessibilityRole="image"
        accessibilityLabel={`Ticket QR code ${SAMPLE_TICKET_CODE}`}
      >
        <QRCode
          value={SAMPLE_TICKET_CODE}
          size={220}
          color={colors.ink}
          backgroundColor={colors.white}
          quietZone={16}
        />
        <Text selectable style={styles.code}>
          {SAMPLE_TICKET_CODE}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "stretch",
    gap: 18,
    paddingVertical: 22,
    paddingHorizontal: 18,
  },
  details: { gap: 4 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: "700", color: colors.ink },
  club: { fontSize: 16, color: colors.muted },
  meta: { fontSize: 15, lineHeight: 21, color: colors.muted },
  qrWrap: { alignItems: "center", gap: 16 },
  code: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 6,
    color: colors.ink,
    textAlign: "center",
  },
});
