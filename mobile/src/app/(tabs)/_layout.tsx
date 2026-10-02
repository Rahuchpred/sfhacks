import { Redirect } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useSample } from "@/lib/sample";
import { colors } from "@/lib/theme";

export default function TabLayout() {
  const { ready, persona } = useSample();
  if (!ready) return null;
  if (!persona) return <Redirect href="/welcome" />;

  return (
    <NativeTabs key={persona} tintColor={colors.purple}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Campus</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="map" md="map" />
      </NativeTabs.Trigger>
      {persona === "student" ? (
        <NativeTabs.Trigger name="food">
          <NativeTabs.Trigger.Label>Food</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="fork.knife" md="restaurant" />
        </NativeTabs.Trigger>
      ) : null}
      {persona === "student" ? (
        <NativeTabs.Trigger name="tickets">
          <NativeTabs.Trigger.Label>Tickets</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="ticket" md="confirmation_number" />
        </NativeTabs.Trigger>
      ) : null}
      {persona === "faculty" ? (
        <NativeTabs.Trigger name="requests">
          <NativeTabs.Trigger.Label>Help</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="person.2" md="groups" />
        </NativeTabs.Trigger>
      ) : null}
      {persona === "faculty" ? (
        <NativeTabs.Trigger name="roster">
          <NativeTabs.Trigger.Label>Roster</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="list.bullet" md="format_list_bulleted" />
        </NativeTabs.Trigger>
      ) : null}
      {persona === "club" ? (
        <NativeTabs.Trigger name="door">
          <NativeTabs.Trigger.Label>Door</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="qrcode.viewfinder" md="qr_code_scanner" />
        </NativeTabs.Trigger>
      ) : null}
      {persona === "club" ? (
        <NativeTabs.Trigger name="food">
          <NativeTabs.Trigger.Label>Food</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="fork.knife" md="restaurant" />
        </NativeTabs.Trigger>
      ) : null}
      <NativeTabs.Trigger name="more">
        <NativeTabs.Trigger.Label>More</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="ellipsis.circle" md="more_horiz" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
