import { Figtree_400Regular, Figtree_600SemiBold, Figtree_700Bold } from '@expo-google-fonts/figtree';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import { YoungSerif_400Regular } from '@expo-google-fonts/young-serif';
import { useFonts } from 'expo-font';
import { Link, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Pressable } from 'react-native';

import { AuthProvider, useAuth } from '@/lib/auth';
import { T } from '@/ui/kit';
import { Fonts, useColors } from '@/ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    YoungSerif_400Regular,
    Figtree_400Regular,
    Figtree_600SemiBold,
    Figtree_700Bold,
    IBMPlexMono_500Medium,
  });
  return (
    <AuthProvider>
      <Navigator fontsReady={loaded || !!error} />
    </AuthProvider>
  );
}

function Navigator({ fontsReady }: { fontsReady: boolean }) {
  const { loading, signedIn } = useAuth();
  const c = useColors();
  const ready = fontsReady && !loading;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.bg },
          headerTintColor: c.accent,
          // Body font in headers: the display face draws digits old-style (EOC05 would read like EOCo5).
          headerTitleStyle: { fontFamily: Fonts.bodyBold, fontSize: 17, color: c.ink },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: c.bg },
          headerBackButtonDisplayMode: 'minimal',
        }}>
        <Stack.Protected guard={signedIn} redirectTo="/sign-in">
          <Stack.Screen
            name="index"
            options={{
              title: 'Stitch Start',
              headerRight: () => (
                <Link href="/account" asChild>
                  <Pressable accessibilityRole="button" hitSlop={10}>
                    <T color="accent" style={{ fontFamily: Fonts.bodySemi }}>
                      Account
                    </T>
                  </Pressable>
                </Link>
              ),
            }}
          />
          <Stack.Screen name="add-machine" options={{ title: 'Add a machine' }} />
          <Stack.Screen name="machine/[id]" options={{ title: 'Machine' }} />
          <Stack.Screen name="project/new" options={{ title: 'New project' }} />
          <Stack.Screen name="project/[id]" options={{ title: 'Project' }} />
          <Stack.Screen name="account" options={{ title: 'Account' }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn} redirectTo="/">
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
        {/* Listed last so signed-out people land on sign-in, not here. Open to everyone. */}
        <Stack.Screen name="privacy" options={{ title: 'Privacy policy' }} />
      </Stack>
    </>
  );
}
