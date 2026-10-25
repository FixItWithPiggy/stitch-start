// Privacy policy. Apple and Google need a public link to one; on the website it lives at /privacy.
// DRAFT: review it (ideally with a lawyer) and fill in the contact email before launch.
import { Stack } from 'expo-router';
import { View } from 'react-native';

import { Screen, T } from '@/ui/kit';
import { Space } from '@/ui/theme';

const CONTACT_EMAIL = 'support@example.com'; // TODO: replace with your support email

const SECTIONS: [string, string][] = [
  ['What we collect', 'Your email address and password (stored securely by our sign-in provider), the machines you save, your projects (fabric, sizes and notes), and any design pictures you upload.'],
  ['How we use it', 'Only to run Stitch Start: to show your setup cards, save your projects, and answer "Ask Claude" requests. We do not sell your information or use it for advertising.'],
  ['Ask Claude', 'When you tap Ask Claude, your project details, notes and design picture are sent to Anthropic, the company that makes Claude, to write the answer. Anthropic does not use data sent through its API to train its models by default.'],
  ['Where it is stored', 'Your account and projects are stored with Supabase. Only you can see your projects and pictures.'],
  ['Deleting your data', 'You can delete your account at any time from the Account screen. This permanently removes your account, machines, projects and pictures.'],
  ['Children', 'Stitch Start is not directed at children under 13.'],
  ['Contact', `Questions? Email ${CONTACT_EMAIL}.`],
];

export default function Privacy() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Privacy policy', headerShown: true }} />
      <T variant="small">Last updated: October 2026</T>
      {SECTIONS.map(([h, body]) => (
        <View key={h} style={{ gap: Space.xs }}>
          <T variant="heading">{h}</T>
          <T>{body}</T>
        </View>
      ))}
    </Screen>
  );
}
