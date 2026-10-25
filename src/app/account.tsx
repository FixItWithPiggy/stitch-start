import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { signOut, useAuth } from '@/lib/auth';
import { deleteAccount } from '@/lib/store';
import { Button, Card, Note, Screen, T } from '@/ui/kit';

export default function Account() {
  const { isCloud, email } = useAuth();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cleared, setCleared] = useState(false);

  const doDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount();
      if (!isCloud) {
        setCleared(true);
        setConfirm(false);
        router.replace('/');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      {isCloud ? (
        <Card>
          <T variant="label">Signed in as</T>
          <T variant="heading">{email ?? ''}</T>
          <Button kind="ghost" label="Sign out" onPress={() => signOut()} />
        </Card>
      ) : (
        <Note>Demo mode: there is no account. Your machines and projects are saved on this device only.</Note>
      )}

      <Card>
        <T variant="heading">{isCloud ? 'Delete my account' : 'Clear saved data'}</T>
        <T variant="small">
          {isCloud
            ? 'This permanently deletes your account, your saved machines, your projects and your uploaded pictures.'
            : 'This removes your saved machines and projects from this device.'}
        </T>
        {cleared ? <Note state="ok">Your saved data was cleared.</Note> : null}
        {error ? <Note state="bad">{error}</Note> : null}
        {confirm ? (
          <>
            <T>Are you sure? This can't be undone.</T>
            <Button kind="danger" label={isCloud ? 'Yes, delete everything' : 'Yes, clear it'} onPress={doDelete} loading={busy} />
            <Button kind="ghost" label="Cancel" onPress={() => setConfirm(false)} />
          </>
        ) : (
          <Button kind="danger" label={isCloud ? 'Delete my account' : 'Clear saved data'} onPress={() => setConfirm(true)} />
        )}
      </Card>

      <T variant="small">
        Stitch Start gives starting points based on each machine's published specs and common sewing guidelines. Always test on a scrap of the
        same fabric first.
      </T>
      <Link href="/privacy" asChild>
        <Pressable accessibilityRole="link">
          <T variant="small" color="accent">
            Privacy policy
          </T>
        </Pressable>
      </Link>
    </Screen>
  );
}
