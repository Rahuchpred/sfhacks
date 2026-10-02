import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "@/lib/auth";
import { CampusProvider } from "@/lib/campus";
import { SampleProvider } from "@/lib/sample";
import { colors } from "@/lib/theme";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SampleProvider>
        <AuthProvider>
          <CampusProvider>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerTintColor: colors.purple,
                headerShadowVisible: false,
                headerStyle: { backgroundColor: colors.background },
                contentStyle: { backgroundColor: colors.background },
                headerBackButtonDisplayMode: "minimal",
                headerLargeTitle: true,
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
          </CampusProvider>
        </AuthProvider>
      </SampleProvider>
    </GestureHandlerRootView>
  );
}
