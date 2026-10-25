import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { buildSetupCard, estimateLetterWidth, fileKindFromName, fmt, labelFor, projectOptions } from '@/core/engine';
import { getMachine } from '@/core/machines';
import type { ProjectInput } from '@/core/types';
import { createProject, listMyMachines, type PickedImage, type SavedMachine } from '@/lib/store';
import { Button, Chip, Chips, Field, Note, Screen, Section, T } from '@/ui/kit';
import { SetupCardView } from '@/ui/setup-card';
import { Radius, Space } from '@/ui/theme';

const num = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};

export default function NewProject() {
  const params = useLocalSearchParams<{ machine?: string }>();
  const [saved, setSaved] = useState<SavedMachine[]>([]);
  const [machineId, setMachineId] = useState<string | undefined>(params.machine);
  const machine = getMachine(machineId);
  const opts = machine ? projectOptions(machine) : null;

  const [chosenType, setProjectType] = useState('');
  const [chosenItem, setItem] = useState('');
  // Fall back to the first choice when a choice doesn't exist on the selected machine.
  const projectType = opts?.types.some((t) => t.id === chosenType) ? chosenType : (opts?.types[0]?.id ?? '');
  const item = opts?.items.some((i) => i.id === chosenItem) ? chosenItem : (opts?.items[0]?.id ?? '');
  const [letterText, setLetterText] = useState('');
  const [letterHeight, setLetterHeight] = useState('1');
  const [width, setWidth] = useState('3');
  const [height, setHeight] = useState('3');
  const [notes, setNotes] = useState('');
  const [title, setTitle] = useState('');
  const [image, setImage] = useState<(PickedImage & { ratio?: number }) | null>(null);
  const [file, setFile] = useState<{ name: string; ext: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMyMachines().then((list) => {
      setSaved(list);
      if (!machineId && list[0]) setMachineId(list[0].machineId);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps


  const isEmb = machine?.type === 'embroidery';
  const lettering = isEmb && projectType === 'lettering';

  const input: ProjectInput | null =
    machine && projectType && item
      ? {
          machineId: machine.id,
          projectType,
          item,
          letterText: lettering ? letterText : null,
          letterHeight: lettering ? num(letterHeight) : null,
          width: isEmb && !lettering ? num(width) : null,
          height: isEmb && !lettering ? num(height) : null,
          notes: notes.trim() || null,
          fileKind: image ? 'image' : file ? 'other' : null,
          fileExt: image ? (image.mimeType?.split('/')[1] ?? 'jpg') : file?.ext ?? null,
        }
      : null;
  const card = input ? buildSetupCard(input) : null;

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, base64: true });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    const ratio = a.width && a.height ? a.height / a.width : undefined;
    setImage({ uri: a.uri, base64: a.base64, mimeType: a.mimeType ?? 'image/jpeg', ratio });
    setFile(null);
    if (ratio && !lettering) {
      const w = num(width) ?? 3;
      setHeight(fmt(Math.round(w * ratio * 8) / 8));
    }
  };

  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: false, multiple: false });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    const k = fileKindFromName(a.name, a.mimeType);
    if (k.kind === 'image') {
      setImage({ uri: a.uri, mimeType: a.mimeType ?? `image/${k.ext}` });
      setFile(null);
    } else {
      setFile({ name: a.name, ext: k.ext });
      setImage(null);
    }
  };

  const defaultTitle = () => {
    if (!machine || !opts) return 'My project';
    const itemLabel = labelFor(opts.items, item).split(' (')[0];
    if (lettering && letterText.trim()) return `"${letterText.trim()}" on ${itemLabel.toLowerCase()}`;
    return `${labelFor(opts.types, projectType)} on ${itemLabel.toLowerCase()}`;
  };

  const save = async () => {
    if (!input || !machine) return;
    setBusy(true);
    setError(null);
    try {
      const project = await createProject({ ...input, title: title.trim() || defaultTitle() }, image);
      router.replace({ pathname: '/project/[id]', params: { id: project.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Try again.');
      setBusy(false);
    }
  };

  if (saved.length === 0 && !machine) {
    return (
      <Screen>
        <Note>Add a machine first so the app knows which settings you have.</Note>
        <Button label="Add a machine" onPress={() => router.replace('/add-machine')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Section title="Machine" step={1}>
        <Chips>
          {saved.map((s) => {
            const m = getMachine(s.machineId);
            return m ? <Chip key={s.id} label={`${m.brand} ${m.model}`} selected={s.machineId === machineId} onPress={() => setMachineId(s.machineId)} /> : null;
          })}
        </Chips>
      </Section>

      {machine && opts ? (
        <Section title="Project" step={2}>
          <T variant="heading" style={{ fontSize: 14 }}>
            What are you making?
          </T>
          <Chips>
            {opts.types.map((t) => (
              <Chip key={t.id} label={t.label} selected={t.id === projectType} onPress={() => setProjectType(t.id)} />
            ))}
          </Chips>
          <T variant="heading" style={{ fontSize: 14 }}>
            {isEmb ? 'Item and fabric' : 'Fabric'}
          </T>
          <Chips>
            {opts.items.map((i) => (
              <Chip key={i.id} label={i.label} selected={i.id === item} onPress={() => setItem(i.id)} />
            ))}
          </Chips>

          {lettering ? (
            <View style={{ flexDirection: 'row', gap: Space.m }}>
              <Field label="Text to stitch" value={letterText} onChangeText={setLetterText} placeholder="Kendall" />
              <Field label="Letter height (in)" value={letterHeight} onChangeText={setLetterHeight} keyboardType="decimal-pad" />
            </View>
          ) : null}
          {lettering && num(letterHeight) ? (
            <T variant="small">{`Estimated design size: ${fmt(estimateLetterWidth(letterText || 'Name', num(letterHeight)!))}″ × ${letterHeight}″`}</T>
          ) : null}
          {isEmb && !lettering ? (
            <View style={{ flexDirection: 'row', gap: Space.m }}>
              <Field
                label="Design width (in)"
                value={width}
                onChangeText={(t) => {
                  setWidth(t);
                  const w = num(t);
                  if (image?.ratio && w) setHeight(fmt(Math.round(w * image.ratio * 8) / 8));
                }}
                keyboardType="decimal-pad"
              />
              <Field label="Design height (in)" value={height} onChangeText={setHeight} keyboardType="decimal-pad" />
            </View>
          ) : null}

          {isEmb ? (
            <View style={{ gap: Space.s }}>
              <T variant="heading" style={{ fontSize: 14 }}>
                Your design (optional)
              </T>
              <T variant="small">Add a picture of the design so Claude can look at it, or attach the stitch file to check it works on your machine.</T>
              <View style={{ flexDirection: 'row', gap: Space.s, flexWrap: 'wrap' }}>
                <Button kind="ghost" label={image ? 'Change picture' : 'Add a picture'} onPress={pickImage} />
                <Button kind="ghost" label={file ? 'Change stitch file' : 'Attach stitch file'} onPress={pickFile} />
              </View>
              {image ? <Image source={{ uri: image.uri }} style={{ width: 120, height: 120, borderRadius: Radius.s }} contentFit="cover" accessibilityLabel="Your design picture" /> : null}
              {file ? <T variant="mono" color="ink">{file.name}</T> : null}
            </View>
          ) : null}

          <Field
            label="Anything else? (optional)"
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="For example: navy thread on natural canvas, it's a gift"
          />
          <Field label="Project name (optional)" value={title} onChangeText={setTitle} placeholder={defaultTitle()} />
        </Section>
      ) : null}

      {card ? (
        <Section title="Setup card" step={3}>
          <SetupCardView card={card} imageUri={image?.uri} />
          {error ? <Note state="bad">{error}</Note> : null}
          <Button label="Save project" onPress={save} loading={busy} />
        </Section>
      ) : null}
    </Screen>
  );
}
