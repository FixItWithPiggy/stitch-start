// Step-by-step threading guides with tap-to-check steps.
import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import type { Machine } from '@/core/types';

import { Chip, Chips, Rich, T } from './kit';
import { Fonts, Radius, Space, useColors } from './theme';

export function GuideView({ machine, initial }: { machine: Machine; initial?: string }) {
  const c = useColors();
  const [key, setKey] = useState(initial && machine.guides.some((g) => g.key === initial) ? initial : machine.guides[0]?.key);
  const [done, setDone] = useState<Record<string, Set<number>>>({});
  const guide = machine.guides.find((g) => g.key === key);
  if (!guide) return null;
  const doneSet = done[guide.key] ?? new Set<number>();
  const total = guide.steps.filter((s) => typeof s === 'string').length;

  const toggle = (n: number) =>
    setDone((prev) => {
      const next = new Set(prev[guide.key] ?? []);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return { ...prev, [guide.key]: next };
    });

  let n = 0;
  return (
    <View style={{ gap: Space.m }}>
      <Chips>
        {machine.guides.map((g) => (
          <Chip key={g.key} label={g.tab} selected={g.key === guide.key} onPress={() => setKey(g.key)} />
        ))}
      </Chips>
      <View style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: Radius.m, overflow: 'hidden' }}>
        <View
          style={{
            padding: Space.l,
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: Space.s,
            borderBottomWidth: 2,
            borderStyle: 'dashed',
            borderColor: c.accent,
          }}>
          <T variant="title" style={{ fontSize: 19 }}>
            {guide.title}
          </T>
          <View style={{ flexDirection: 'row', gap: Space.m, alignItems: 'baseline' }}>
            <T variant="mono" color="muted">{`${doneSet.size} of ${total} done`}</T>
            {doneSet.size ? (
              <Pressable accessibilityRole="button" onPress={() => setDone((p) => ({ ...p, [guide.key]: new Set() }))}>
                <T variant="small" color="accent" style={{ fontFamily: Fonts.bodySemi }}>
                  Start over
                </T>
              </Pressable>
            ) : null}
          </View>
        </View>
        {guide.steps.map((s, i) => {
          if (typeof s !== 'string') {
            return (
              <View key={`g${i}`} style={{ paddingHorizontal: Space.l, paddingTop: Space.l, paddingBottom: 4 }}>
                <T variant="label" color="accent">
                  {s.group}
                </T>
              </View>
            );
          }
          const idx = n++;
          const isDone = doneSet.has(idx);
          return (
            <Pressable
              key={i}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isDone }}
              accessibilityLabel={`Step ${idx + 1}. ${s.replace(/\*\*/g, '')}`}
              onPress={() => toggle(idx)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                gap: Space.m,
                paddingHorizontal: Space.l,
                paddingVertical: 12,
                borderTopWidth: 1,
                borderColor: c.line,
                backgroundColor: pressed ? c.bg : 'transparent',
              })}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: isDone ? c.ok : c.line,
                  backgroundColor: isDone ? c.ok : c.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <T variant="mono" color={isDone ? 'surface' : 'muted'} style={{ fontSize: 12 }}>
                  {isDone ? '✓' : String(idx + 1)}
                </T>
              </View>
              <View style={{ flex: 1, opacity: isDone ? 0.55 : 1 }}>
                <Rich text={s} />
              </View>
            </Pressable>
          );
        })}
        <View style={{ padding: Space.l, gap: Space.s, backgroundColor: c.bg }}>
          {guide.tips.map((tip, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: Space.s }}>
              <T color="accent">•</T>
              <T variant="small" color="ink" style={{ flex: 1 }}>
                {tip}
              </T>
            </View>
          ))}
          <SourceLinks sources={guide.sources} />
        </View>
      </View>
    </View>
  );
}

export function SourceLinks({ sources }: { sources: { label: string; url?: string }[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      <T variant="small">Source:</T>
      {sources.map((s, i) =>
        s.url ? (
          <Pressable key={i} accessibilityRole="link" onPress={() => Linking.openURL(s.url!)}>
            <T variant="small" color="accent" style={{ textDecorationLine: 'underline' }}>
              {s.label}
            </T>
          </Pressable>
        ) : (
          <T key={i} variant="small">
            {s.label}
          </T>
        ),
      )}
    </View>
  );
}
