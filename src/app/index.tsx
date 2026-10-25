import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { getMachine } from '@/core/machines';
import { labelFor, projectOptions } from '@/core/engine';
import { useAuth } from '@/lib/auth';
import { listMyMachines, listProjects, type Project, type SavedMachine } from '@/lib/store';
import { Button, Card, Note, Screen, Section, T } from '@/ui/kit';
import { Radius, Space, useColors } from '@/ui/theme';

export default function Home() {
  const c = useColors();
  const { isCloud } = useAuth();
  const [machines, setMachines] = useState<SavedMachine[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      Promise.all([listMyMachines(), listProjects()])
        .then(([m, p]) => {
          if (!live) return;
          setMachines(m);
          setProjects(p);
          setError(null);
        })
        .catch((e) => live && setError(e instanceof Error ? e.message : 'Could not load your things.'));
      return () => {
        live = false;
      };
    }, []),
  );

  const hasMachines = (machines?.length ?? 0) > 0;

  return (
    <Screen>
      <T color="muted">Tell it your machine and your design. It tells you how to set up.</T>
      {!isCloud ? (
        <Note state="warn">
          Demo mode: everything is saved on this device only. Accounts and Ask Claude turn on once the app is connected to its
          server (see the launch guide).
        </Note>
      ) : null}
      {error ? <Note state="bad">{error}</Note> : null}

      <Section title="My machines" step={1}>
        {machines && machines.length === 0 ? (
          <T color="muted">Add the machine you sew or embroider with. The app uses its exact settings.</T>
        ) : null}
        {machines?.map((sm) => {
          const m = getMachine(sm.machineId);
          if (!m) return null;
          return (
            <Pressable
              key={sm.id}
              accessibilityRole="button"
              accessibilityLabel={`${m.brand} ${m.model}, ${m.typeLabel}. Open fact sheet and threading guides.`}
              onPress={() => router.push({ pathname: '/machine/[id]', params: { id: m.id } })}>
              {({ pressed }) => (
                <Card style={{ flexDirection: 'row', alignItems: 'center', opacity: pressed ? 0.85 : 1 }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T variant="heading">{`${m.brand} ${m.model}`}</T>
                    <T variant="small">{m.has.join(' · ')}</T>
                  </View>
                  <View style={{ backgroundColor: c.accentSoft, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 }}>
                    <T variant="label" color="accent">
                      {m.type === 'embroidery' ? 'Embroidery' : 'Sewing'}
                    </T>
                  </View>
                </Card>
              )}
            </Pressable>
          );
        })}
        <Button kind={hasMachines ? 'ghost' : 'primary'} label="Add a machine" onPress={() => router.push('/add-machine')} />
      </Section>

      <Section title="My projects" step={2}>
        {projects.length === 0 ? (
          <T color="muted">
            {hasMachines
              ? 'Start a project to get your setup card: fabric, needle, thread, stabilizer, tension and sizing.'
              : 'Add a machine first, then start a project.'}
          </T>
        ) : null}
        {projects.map((p) => {
          const m = getMachine(p.machineId);
          const opts = m ? projectOptions(m) : null;
          return (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/project/[id]', params: { id: p.id } })}>
              {({ pressed }) => (
                <View
                  style={{
                    backgroundColor: c.surface,
                    borderWidth: 1,
                    borderColor: c.line,
                    borderRadius: Radius.m,
                    padding: Space.l,
                    gap: 2,
                    opacity: pressed ? 0.85 : 1,
                  }}>
                  <T variant="heading">{p.title}</T>
                  <T variant="small">
                    {[m ? `${m.brand} ${m.model}` : 'Unknown machine', opts ? labelFor(opts.items, p.item) : null, new Date(p.createdAt).toLocaleDateString()]
                      .filter(Boolean)
                      .join(' · ')}
                  </T>
                </View>
              )}
            </Pressable>
          );
        })}
        <Button label="Start a project" disabled={!hasMachines} onPress={() => router.push('/project/new')} />
      </Section>
    </Screen>
  );
}
