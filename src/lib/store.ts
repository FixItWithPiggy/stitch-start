// All saving and loading goes through this file.
// Cloud mode: Supabase (each person only ever sees their own rows).
// Demo mode: this device only, via AsyncStorage.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { decode } from 'base64-arraybuffer';
import { FunctionsHttpError } from '@supabase/supabase-js';

import type { ProjectInput } from '@/core/types';

import { supabase } from './supabase';

export interface SavedMachine {
  id: string;
  machineId: string;
  createdAt: string;
}

export interface Project extends ProjectInput {
  id: string;
  title: string;
  imagePath?: string | null;
  /** A URL or local file the app can display. */
  imageUri?: string | null;
  advice?: string | null;
  adviceAt?: string | null;
  createdAt: string;
}

export type ProjectDraft = Omit<Project, 'id' | 'createdAt' | 'imagePath' | 'imageUri' | 'advice' | 'adviceAt'>;

export interface PickedImage {
  uri: string;
  base64?: string | null;
  mimeType?: string | null;
}

const LOCAL_MACHINES = 'stitchstart.machines.v1';
const LOCAL_PROJECTS = 'stitchstart.projects.v1';
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

async function readLocal<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}
async function writeLocal<T>(key: string, rows: T[]) {
  await AsyncStorage.setItem(key, JSON.stringify(rows));
}

async function userId(): Promise<string> {
  const { data } = await supabase!.auth.getUser();
  if (!data.user) throw new Error('Please sign in again.');
  return data.user.id;
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

// ---------- Machines ----------

export async function listMyMachines(): Promise<SavedMachine[]> {
  if (!supabase) return readLocal<SavedMachine>(LOCAL_MACHINES);
  const { data, error } = await supabase.from('user_machines').select('id, machine_id, created_at').order('created_at');
  fail(error);
  return (data ?? []).map((r) => ({ id: r.id, machineId: r.machine_id, createdAt: r.created_at }));
}

export async function addMyMachine(machineId: string): Promise<void> {
  const existing = await listMyMachines();
  if (existing.some((m) => m.machineId === machineId)) return;
  if (!supabase) {
    await writeLocal(LOCAL_MACHINES, [...existing, { id: newId(), machineId, createdAt: new Date().toISOString() }]);
    return;
  }
  const { error } = await supabase.from('user_machines').insert({ machine_id: machineId });
  fail(error);
}

export async function removeMyMachine(id: string): Promise<void> {
  if (!supabase) {
    const rows = await readLocal<SavedMachine>(LOCAL_MACHINES);
    await writeLocal(LOCAL_MACHINES, rows.filter((r) => r.id !== id));
    return;
  }
  const { error } = await supabase.from('user_machines').delete().eq('id', id);
  fail(error);
}

/** Records a machine someone couldn't find, so you know which profiles to add next. */
export async function requestMachine(text: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('machine_requests').insert({ brand_model: text.trim().slice(0, 120) });
  fail(error);
}

// ---------- Projects ----------

type ProjectRow = {
  id: string;
  machine_id: string;
  title: string;
  project_type: string;
  item: string;
  letter_text: string | null;
  letter_height: number | null;
  width: number | null;
  height: number | null;
  notes: string | null;
  file_kind: 'image' | 'other' | null;
  file_ext: string | null;
  image_path: string | null;
  advice: string | null;
  advice_at: string | null;
  created_at: string;
};

const fromRow = (r: ProjectRow): Project => ({
  id: r.id,
  machineId: r.machine_id,
  title: r.title,
  projectType: r.project_type,
  item: r.item,
  letterText: r.letter_text,
  letterHeight: r.letter_height,
  width: r.width,
  height: r.height,
  notes: r.notes,
  fileKind: r.file_kind,
  fileExt: r.file_ext,
  imagePath: r.image_path,
  advice: r.advice,
  adviceAt: r.advice_at,
  createdAt: r.created_at,
});

const toRow = (d: ProjectDraft) => ({
  machine_id: d.machineId,
  title: d.title,
  project_type: d.projectType,
  item: d.item,
  letter_text: d.letterText ?? null,
  letter_height: d.letterHeight ?? null,
  width: d.width ?? null,
  height: d.height ?? null,
  notes: d.notes ?? null,
  file_kind: d.fileKind ?? null,
  file_ext: d.fileExt ?? null,
});

export async function listProjects(): Promise<Project[]> {
  if (!supabase) {
    const rows = await readLocal<Project>(LOCAL_PROJECTS);
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
  fail(error);
  return (data as ProjectRow[]).map(fromRow);
}

export async function getProject(id: string): Promise<Project | null> {
  if (!supabase) {
    const rows = await readLocal<Project>(LOCAL_PROJECTS);
    return rows.find((p) => p.id === id) ?? null;
  }
  const { data, error } = await supabase.from('projects').select('*').eq('id', id).maybeSingle();
  fail(error);
  if (!data) return null;
  const p = fromRow(data as ProjectRow);
  if (p.imagePath) {
    const { data: signed } = await supabase.storage.from('designs').createSignedUrl(p.imagePath, 60 * 60);
    p.imageUri = signed?.signedUrl ?? null;
  }
  return p;
}

export async function createProject(draft: ProjectDraft, image?: PickedImage | null): Promise<Project> {
  if (!supabase) {
    const p: Project = { ...draft, id: newId(), createdAt: new Date().toISOString(), imageUri: image?.uri ?? null };
    const rows = await readLocal<Project>(LOCAL_PROJECTS);
    await writeLocal(LOCAL_PROJECTS, [p, ...rows]);
    return p;
  }
  const uid = await userId();
  const { data, error } = await supabase.from('projects').insert(toRow(draft)).select('*').single();
  fail(error);
  const project = fromRow(data as ProjectRow);
  if (image) {
    const ext = (image.mimeType?.split('/')[1] ?? 'jpg').replace('jpeg', 'jpg');
    const path = `${uid}/${project.id}.${ext}`;
    const body = image.base64 ? decode(image.base64) : await (await fetch(image.uri)).arrayBuffer();
    const up = await supabase.storage.from('designs').upload(path, body, { contentType: image.mimeType ?? 'image/jpeg', upsert: true });
    if (!up.error) {
      await supabase.from('projects').update({ image_path: path }).eq('id', project.id);
      project.imagePath = path;
    }
  }
  return project;
}

export async function deleteProject(id: string): Promise<void> {
  if (!supabase) {
    const rows = await readLocal<Project>(LOCAL_PROJECTS);
    await writeLocal(LOCAL_PROJECTS, rows.filter((r) => r.id !== id));
    return;
  }
  const { data } = await supabase.from('projects').select('image_path').eq('id', id).maybeSingle();
  if (data?.image_path) await supabase.storage.from('designs').remove([data.image_path]);
  const { error } = await supabase.from('projects').delete().eq('id', id);
  fail(error);
}

// ---------- Claude ----------

export const canAskClaude = () => supabase !== null;

/** Asks Claude to review a saved project. The server builds the prompt and keeps the API key. */
export async function askClaude(projectId: string): Promise<string> {
  if (!supabase) throw new Error('Asking Claude needs an account. It is turned off in demo mode.');
  const { data, error } = await supabase.functions.invoke('advise', { body: { projectId } });
  if (error) {
    let message: string | null = null;
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json();
        if (typeof body?.error === 'string') message = body.error;
      } catch {
        // Not JSON; fall through to the general message.
      }
    }
    if (message) throw new Error(message);
    throw new Error("Couldn't reach Claude. Check your connection and try again.");
  }
  return (data as { advice: string }).advice;
}

// ---------- Account ----------

export async function deleteAccount(): Promise<void> {
  if (!supabase) {
    await AsyncStorage.multiRemove([LOCAL_MACHINES, LOCAL_PROJECTS]);
    return;
  }
  const { error } = await supabase.functions.invoke('delete-account', { body: {} });
  if (error) throw new Error("Couldn't delete your account. Try again, or contact support.");
  await supabase.auth.signOut();
}
