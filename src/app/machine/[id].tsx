import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { getMachine } from '@/core/machines';
import { listMyMachines, removeMyMachine, type SavedMachine } from '@/lib/store';
import { TensionGuide } from '@/ui/diagrams';
import { GuideView, SourceLinks } from '@/ui/guide';
import { Button, Card, Chip, Chips, Note, Screen, T } from '@/ui/kit';
import { Fonts, Space, useColors } from '@/ui/theme';

type Tab = 'facts' | 'threading' | 'tension';

export default function MachineScreen() {
  const c = useColors();
  const params = useLocalSearchParams<{ id: string; tab?: Tab; guide?: string }>();
  const machine = getMachine(params.id);
  const [tab, setTab] = useState<Tab>(params.tab ?? 'facts');
  const [saved, setSaved] = useState<SavedMachine | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useFocusEffect(
    useCallback(() => {
      listMyMachines()
        .then((list) => setSaved(list.find((s) => s.machineId === params.id) ?? null))
        .catch(() => {});
    }, [params.id]),
  );

  if (!machine) {
    return (
      <Screen>
        <Note state="bad">We couldn't find this machine.</Note>
      </Screen>
    );
  }

  const remove = async () => {
    if (!saved) return;
    await removeMyMachine(saved.id);
    router.back();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: `${machine.brand} ${machine.model}` }} />
      <Chips>
        <Chip label="Fact sheet" selected={tab === 'facts'} onPress={() => setTab('facts')} />
        <Chip label="Threading" selected={tab === 'threading'} onPress={() => setTab('threading')} />
        <Chip label="Tension" selected={tab === 'tension'} onPress={() => setTab('tension')} />
      </Chips>

      {tab === 'facts' ? (
        <View style={{ gap: Space.l }}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: Space.s, flexWrap: 'wrap' }}>
              <T variant="heading" style={{ fontSize: 20, lineHeight: 26 }}>{`${machine.brand} ${machine.model}`}</T>
              <View style={{ backgroundColor: c.accentSoft, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 }}>
                <T variant="label" color="accent">
                  {machine.typeLabel}
                </T>
              </View>
            </View>
            <View style={{ gap: 6 }}>
              {machine.specs.map(([k, v]) => (
                <View key={k} style={{ flexDirection: 'row', gap: Space.l }}>
                  <T variant="small" style={{ width: 120 }}>
                    {k}
                  </T>
                  <T variant="mono" color="ink" style={{ flex: 1 }}>
                    {v}
                  </T>
                </View>
              ))}
            </View>
          </Card>
          <Card>
            <T variant="label">Settings you'll use</T>
            {machine.has.map((h) => (
              <T key={h}>
                <T color="ok" style={{ fontFamily: Fonts.bodyBold }}>
                  {'✓  '}
                </T>
                {h}
              </T>
            ))}
            <T variant="label" style={{ marginTop: Space.s }}>
              Not on this machine
            </T>
            {machine.hasNot.map((h) => (
              <T key={h} color="muted">{`–  ${h}`}</T>
            ))}
            <T variant="small">{machine.hasNotWhy}</T>
          </Card>
          <Note state={machine.status === 'checked' ? 'ok' : 'warn'}>{machine.checkedNote}</Note>
          <SourceLinks sources={machine.sources} />
        </View>
      ) : null}

      {tab === 'threading' ? (
        <View style={{ gap: Space.m }}>
          <T color="muted">Most stitching problems start with threading, so go slowly the first few times. Tap each step as you finish it.</T>
          <GuideView machine={machine} initial={params.guide} />
        </View>
      ) : null}

      {tab === 'tension' ? <TensionGuide type={machine.type} /> : null}

      <View style={{ gap: Space.m }}>
        {saved ? (
          <Button label="Start a project with this machine" onPress={() => router.push({ pathname: '/project/new', params: { machine: machine.id } })} />
        ) : null}
        {saved ? (
          confirmRemove ? (
            <Card>
              <T>Remove this machine from your list? Your saved projects stay.</T>
              <Button kind="danger" label="Yes, remove it" onPress={remove} />
              <Button kind="ghost" label="Keep it" onPress={() => setConfirmRemove(false)} />
            </Card>
          ) : (
            <Button kind="ghost" label="Remove from my machines" onPress={() => setConfirmRemove(true)} />
          )
        ) : null}
      </View>
    </Screen>
  );
}
