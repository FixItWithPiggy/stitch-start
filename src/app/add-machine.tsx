import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { MACHINES, searchMachines } from '@/core/machines';
import { useAuth } from '@/lib/auth';
import { addMyMachine, requestMachine } from '@/lib/store';
import { Button, Card, Field, Note, Screen, T } from '@/ui/kit';
import { Space } from '@/ui/theme';

export default function AddMachine() {
  const { isCloud } = useAuth();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);
  const result = searchMachines(query);
  const list = query.trim().length < 2 ? MACHINES : result.matches;

  const add = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      await addMyMachine(id);
      router.replace({ pathname: '/machine/[id]', params: { id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const request = async () => {
    try {
      await requestMachine(query);
      setRequested(true);
    } catch {
      setError('Could not send the request. Try again.');
    }
  };

  return (
    <Screen>
      <Field
        label="Brand and model number"
        placeholder="For example: Poolin EOC05"
        value={query}
        onChangeText={(t) => {
          setQuery(t);
          setRequested(false);
        }}
        autoCorrect={false}
        autoFocus
        hint="The model number is usually on a sticker on the back or bottom of the machine."
      />
      {error ? <Note state="bad">{error}</Note> : null}
      <View style={{ gap: Space.m }}>
        {query.trim().length < 2 ? <T variant="label">Machines we know so far</T> : null}
        {list.map((m) => (
          <Card key={m.id}>
            <View style={{ gap: 2 }}>
              <T variant="heading">{`${m.brand} ${m.model}`}</T>
              <T variant="small">{`${m.typeLabel} · ${m.specs[0]?.[0]}: ${m.specs[0]?.[1]}`}</T>
            </View>
            <Button label="Add to my machines" onPress={() => add(m.id)} loading={busy === m.id} />
          </Card>
        ))}
        {query.trim().length >= 2 && list.length === 0 ? (
          <Note state="warn">
            <View style={{ gap: Space.s }}>
              <T>
                {result.brandOnly
                  ? `Add the model number too. Settings change a lot from one ${result.brandOnly} model to the next.`
                  : `We don't have a profile for "${query.trim()}" yet. Each profile is built from the manufacturer's manual, so new machines are added one at a time.`}
              </T>
              {isCloud && !result.brandOnly ? (
                requested ? (
                  <T color="ok">Thanks. We'll use your request to decide which machine to add next.</T>
                ) : (
                  <Button kind="ghost" label="Request this machine" onPress={request} />
                )
              ) : null}
            </View>
          </Note>
        ) : null}
      </View>
    </Screen>
  );
}
