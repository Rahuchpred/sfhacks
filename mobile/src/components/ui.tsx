import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { colors } from "@/lib/theme";

export function PressableScale({ style, children, ...props }: PressableProps) {
  const reduced = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  return (
    <Animated.View
      style={{
        transform: [{ scale: reduced || !pressed ? 1 : 0.97 }],
        transitionProperty: "transform",
        transitionDuration: 120,
        transitionTimingFunction: "ease-out",
      }}
    >
      <Pressable
        {...props}
        style={style}
        onPressIn={(event) => {
          setPressed(true);
          props.onPressIn?.(event);
        }}
        onPressOut={(event) => {
          setPressed(false);
          props.onPressOut?.(event);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Pill({
  label,
  tone = "purple",
}: {
  label: string;
  tone?: "purple" | "gold" | "live" | "muted";
}) {
  const toneStyle =
    tone === "gold" ? styles.pillGold : tone === "live" ? styles.pillLive : tone === "muted" ? styles.pillMuted : styles.pillPurple;
  const textStyle =
    tone === "gold"
      ? styles.pillGoldText
      : tone === "live"
        ? styles.pillLiveText
        : tone === "muted"
          ? styles.pillMutedText
          : styles.pillPurpleText;
  return (
    <View style={[styles.pill, toneStyle]}>
      <Text style={[styles.pillText, textStyle]}>{label}</Text>
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  tone = "purple",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: "purple" | "gold";
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, tone === "gold" ? styles.buttonGold : styles.buttonPurple, disabled && styles.buttonDisabled]}
    >
      <Text style={[styles.buttonText, tone === "gold" && styles.buttonTextInk]}>{label}</Text>
    </PressableScale>
  );
}

export function QuietButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale accessibilityRole="button" onPress={onPress} style={styles.quiet}>
      <Text style={styles.quietText}>{label}</Text>
    </PressableScale>
  );
}

export function SectionTitle({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.section, style]}>{children}</Text>;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

export function LoadingLine({ label = "Loading…" }: { label?: string }) {
  return <Text style={styles.loading}>{label}</Text>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderCurve: "continuous",
    padding: 16,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  pill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillText: { fontSize: 12, fontWeight: "600" },
  pillPurple: { backgroundColor: colors.purpleSoft },
  pillPurpleText: { color: colors.purple },
  pillGold: { backgroundColor: colors.goldSoft },
  pillGoldText: { color: "#6B5200" },
  pillLive: { backgroundColor: colors.liveSoft },
  pillLiveText: { color: colors.live },
  pillMuted: { backgroundColor: colors.purpleSoft },
  pillMutedText: { color: colors.muted },
  button: {
    minHeight: 48,
    borderRadius: 14,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  buttonPurple: { backgroundColor: colors.purple },
  buttonGold: { backgroundColor: colors.gold },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: "600" },
  buttonTextInk: { color: colors.ink },
  quiet: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  quietText: { color: colors.purple, fontSize: 16, fontWeight: "600" },
  section: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  empty: { paddingVertical: 28, gap: 6 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: colors.ink },
  emptyBody: { fontSize: 15, lineHeight: 21, color: colors.muted },
  loading: { color: colors.muted, fontSize: 15, paddingVertical: 12 },
});
