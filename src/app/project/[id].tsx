import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { buildSetupCard } from '@/core/engine';
import { getMachine } from '@/core/machines';
import { askClaude, canAskClaude, deleteProject, getProject, type Project } from '@/lib/store';
import { Button, Card, Note, Rich, Screen, Section, T } from '@/ui/kit';
import { SetupCardView } from '@/ui/setup-card';
import { Space, useColors } from '@/ui/theme';

/** Shows Claude's answer: "## " lines become headings, "- " lines become bullets. */
function Advice({ text }: { text: string }) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      {text.split('\n').map((raw, i) => {
        const line = raw.trim();
        if (!line) return null;
        if (/^#{1,4}\s+/.test(line)) {
          return (
            <T key={i} variant="title" style={{ fontSize: 17, marginTop: i ? Space.s : 0 }}>
              {line.replace(/^#{1,4}\s+/, '')}
            </T>
          );
        }
        if (/^[-*•]\s+/.test(line)) {
          return (
            <View key={i} style={{ flexDirection: 'row', gap: Space.s, paddingLeft: 2 }}>
              <T style={{ color: c.accent }}>•</T>
              <View style={{ flex: 1 }}>
                <Rich text={line.replace(/^[-*•]\s+/, '')} />
              </View>
            </View>
          );
        }
        return <Rich key={i} text={line} />;
      })}
    </View>
  );
}

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    getProject(id)
      .then(setProject)
      .catch(() => setProject(null));
  }, [id]);

  const machine = getMachine(project?.machineId);
  const card = useMemo(() => (project ? buildSetupCard(project) : null), [project]);

  if (project === undefined) {
    return (
      <Screen>
        <ActivityIndicator />
      </Screen>
    );
  }
  if (!project || !card) {
    return (
      <Screen>
        <Note state="bad">This project couldn't be found. It may have been deleted.</Note>
      </Screen>
    );
  }

  const ask = async () => {
    setAsking(true);
    setAskError(null);
    try {
      const advice = await askClaude(project.id);
      setProject({ ...project, advice, adviceAt: new Date().toISOString() });
    } catch (e) {
      setAskError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setAsking(false);
    }
  };

  const remove = async () => {
    await deleteProject(project.id);
    router.back();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: project.title }} />
      <SetupCardView card={card} imageUri={project.imageUri} />

      <Card dashed>
        <T variant="title" style={{ fontSize: 19 }}>
          Ask Claude about this project
        </T>
        {canAskClaude() ? (
          <>
            <T variant="small">
              Claude looks at your design picture, reads your notes, and checks this setup card for your {machine ? `${machine.brand} ${machine.model}` : 'machine'}.
            </T>
            {project.advice ? (
              <View style={{ gap: Space.s }}>
                <Advice text={project.advice} />
                {project.adviceAt ? <T variant="small">{`Answered ${new Date(project.adviceAt).toLocaleString()}`}</T> : null}
              </View>
            ) : null}
            {asking ? <T variant="small" style={{ fontStyle: 'italic' }}>Claude is looking at your project. This can take up to a minute…</T> : null}
            {askError ? <Note state="bad">{askError}</Note> : null}
            <Button label={project.advice ? 'Ask again' : 'Ask Claude'} onPress={ask} loading={asking} />
          </>
        ) : (
          <T variant="small">Asking Claude needs an account, so it's turned off in demo mode. The setup card above works on its own.</T>
        )}
      </Card>

      {machine ? (
        <Section title="Get your machine ready">
          <View style={{ gap: Space.s }}>
            <Button kind="ghost" label="Threading and bobbin steps" onPress={() => router.push({ pathname: '/machine/[id]', params: { id: machine.id, tab: 'threading' } })} />
            <Button kind="ghost" label="What tension should look like" onPress={() => router.push({ pathname: '/machine/[id]', params: { id: machine.id, tab: 'tension' } })} />
          </View>
        </Section>
      ) : null}

      {project.notes ? (
        <Card>
          <T variant="label">Your notes</T>
          <T>{project.notes}</T>
        </Card>
      ) : null}

      {confirmDelete ? (
        <Card>
          <T>Delete this project? This can't be undone.</T>
          <Button kind="danger" label="Yes, delete it" onPress={remove} />
          <Button kind="ghost" label="Keep it" onPress={() => setConfirmDelete(false)} />
        </Card>
      ) : (
        <Button kind="ghost" label="Delete project" onPress={() => setConfirmDelete(true)} />
      )}
    </Screen>
  );
}
