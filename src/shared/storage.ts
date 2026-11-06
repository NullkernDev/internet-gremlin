import {
  DEFAULT_POSITION,
  DEFAULT_SETTINGS,
  defaultPet,
  type PetState,
  type Position,
  type Settings,
  type StoredData,
} from './types';

/**
 * A tiny storage abstraction. In the extension it is backed by
 * chrome.storage.local; the promo demo uses an in-memory version so the very
 * same UI code can run on a plain web page.
 */
export interface Store {
  load(): Promise<StoredData>;
  saveSettings(patch: Partial<Settings>): Promise<void>;
  savePosition(patch: Partial<Position>): Promise<void>;
  /** Read-modify-write against the freshest stored pet state. */
  updatePet(fn: (pet: PetState) => Partial<PetState>): Promise<PetState>;
  subscribe(cb: (data: Partial<StoredData>) => void): () => void;
  reset(what: 'relationship' | 'everything'): Promise<void>;
  dump(): Promise<Record<string, unknown>>;
}

function normalise(raw: Partial<StoredData>): StoredData {
  const pet = { ...defaultPet(), ...(raw.pet ?? {}) };
  pet.favorites = { ...defaultPet().favorites, ...(raw.pet?.favorites ?? {}) };
  return {
    settings: { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) },
    pet,
    position: { ...DEFAULT_POSITION, ...(raw.position ?? {}) },
  };
}

export function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage?.local;
}

export class ChromeStore implements Store {
  async load(): Promise<StoredData> {
    const raw = (await chrome.storage.local.get(['settings', 'pet', 'position'])) as Partial<StoredData>;
    return normalise(raw);
  }
  async saveSettings(patch: Partial<Settings>): Promise<void> {
    const { settings } = await this.load();
    await chrome.storage.local.set({ settings: { ...settings, ...patch } });
  }
  async savePosition(patch: Partial<Position>): Promise<void> {
    const { position } = await this.load();
    await chrome.storage.local.set({ position: { ...position, ...patch } });
  }
  async updatePet(fn: (pet: PetState) => Partial<PetState>): Promise<PetState> {
    const { pet } = await this.load();
    const next = { ...pet, ...fn(pet) };
    await chrome.storage.local.set({ pet: next });
    return next;
  }
  subscribe(cb: (data: Partial<StoredData>) => void): () => void {
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'local') return;
      const out: Partial<StoredData> = {};
      if (changes.settings) out.settings = { ...DEFAULT_SETTINGS, ...(changes.settings.newValue as Settings) };
      if (changes.position) out.position = { ...DEFAULT_POSITION, ...(changes.position.newValue as Position) };
      if (changes.pet) out.pet = normalise({ pet: changes.pet.newValue as PetState }).pet;
      if (Object.keys(out).length) cb(out);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }
  async reset(what: 'relationship' | 'everything'): Promise<void> {
    if (what === 'everything') {
      await chrome.storage.local.clear();
      await chrome.storage.local.set({ settings: { ...DEFAULT_SETTINGS, onboarded: true } });
      return;
    }
    const { pet } = await this.load();
    const fresh = defaultPet();
    // keep the secrets collection & gallery: those are achievements, not feelings
    await chrome.storage.local.set({ pet: { ...fresh, secrets: pet.secrets, seen: pet.seen } });
  }
  async dump(): Promise<Record<string, unknown>> {
    return chrome.storage.local.get(null);
  }
}

export class MemoryStore implements Store {
  private data: StoredData;
  private subs = new Set<(d: Partial<StoredData>) => void>();
  constructor(initial: Partial<StoredData> = {}) {
    this.data = normalise(initial);
  }
  async load(): Promise<StoredData> {
    return structuredClone(this.data);
  }
  private emit(d: Partial<StoredData>) {
    this.subs.forEach((s) => s(structuredClone(d)));
  }
  async saveSettings(patch: Partial<Settings>): Promise<void> {
    this.data.settings = { ...this.data.settings, ...patch };
    this.emit({ settings: this.data.settings });
  }
  async savePosition(patch: Partial<Position>): Promise<void> {
    this.data.position = { ...this.data.position, ...patch };
    this.emit({ position: this.data.position });
  }
  async updatePet(fn: (pet: PetState) => Partial<PetState>): Promise<PetState> {
    this.data.pet = { ...this.data.pet, ...fn(this.data.pet) };
    this.emit({ pet: this.data.pet });
    return structuredClone(this.data.pet);
  }
  subscribe(cb: (data: Partial<StoredData>) => void): () => void {
    this.subs.add(cb);
    return () => this.subs.delete(cb);
  }
  async reset(what: 'relationship' | 'everything'): Promise<void> {
    if (what === 'everything') this.data = normalise({});
    else this.data.pet = defaultPet();
    this.emit(this.data);
  }
  async dump(): Promise<Record<string, unknown>> {
    return structuredClone(this.data) as unknown as Record<string, unknown>;
  }
}

export function createStore(): Store {
  return hasChromeStorage() ? new ChromeStore() : new MemoryStore();
}
