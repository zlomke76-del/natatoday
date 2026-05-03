export type SoundKey =
  | "candidate_new"
  | "candidate_ready"
  | "candidate_not_fit"
  | "candidate_high_value"
  | "interview_scheduled"
  | "interview_reminder"
  | "message_received"
  | "message_sent"
  | "action_success"
  | "action_blocked"
  | "processing_loop"
  | "dealer_action_required"
  | "event_no_show"
  | "focus_mode_enter"
  | "focus_mode_exit"
  | "queue_cleared";

const SOUND_PATH = "/sounds";
const SOUND_ENABLED_KEY = "nata:sound-enabled";
const SOUND_VOLUME_KEY = "nata:sound-volume";

const cache: Partial<Record<SoundKey, HTMLAudioElement>> = {};
const lastPlayed: Partial<Record<SoundKey, number>> = {};

const DEFAULT_VOLUME = 0.58;
const MIN_REPEAT_MS = 650;

const SOUND_VOLUME: Partial<Record<SoundKey, number>> = {
  candidate_new: 0.5,
  candidate_ready: 0.58,
  candidate_not_fit: 0.42,
  candidate_high_value: 0.72,
  interview_scheduled: 0.56,
  interview_reminder: 0.62,
  message_received: 0.5,
  message_sent: 0.42,
  action_success: 0.5,
  action_blocked: 0.6,
  processing_loop: 0.22,
  dealer_action_required: 0.7,
  event_no_show: 0.56,
  focus_mode_enter: 0.48,
  focus_mode_exit: 0.44,
  queue_cleared: 0.62,
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function getSoundEnabled(): boolean {
  if (!isBrowser()) return false;

  const stored = window.localStorage.getItem(SOUND_ENABLED_KEY);
  return stored !== "false";
}

export function setSoundEnabled(value: boolean): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(SOUND_ENABLED_KEY, value ? "true" : "false");
}

export function getSoundVolume(): number {
  if (!isBrowser()) return DEFAULT_VOLUME;

  const stored = Number(window.localStorage.getItem(SOUND_VOLUME_KEY));
  if (!Number.isFinite(stored)) return DEFAULT_VOLUME;

  return Math.min(1, Math.max(0, stored));
}

export function setSoundVolume(value: number): void {
  if (!isBrowser()) return;

  const safeValue = Math.min(1, Math.max(0, value));
  window.localStorage.setItem(SOUND_VOLUME_KEY, String(safeValue));
}

function getAudio(key: SoundKey): HTMLAudioElement | null {
  if (!isBrowser()) return null;

  let audio = cache[key];

  if (!audio) {
    audio = new Audio(`${SOUND_PATH}/${key}.mp3`);
    audio.preload = "auto";
    cache[key] = audio;
  }

  return audio;
}

export function preloadSounds(keys: SoundKey[]): void {
  if (!isBrowser()) return;

  for (const key of keys) {
    const audio = getAudio(key);
    if (audio) audio.load();
  }
}

export function playSound(key: SoundKey, options?: { force?: boolean; volume?: number }): void {
  try {
    if (!isBrowser()) return;
    if (!options?.force && !getSoundEnabled()) return;

    const now = Date.now();
    const last = lastPlayed[key] || 0;

    if (!options?.force && now - last < MIN_REPEAT_MS) return;

    const audio = getAudio(key);
    if (!audio) return;

    const globalVolume = getSoundVolume();
    const soundVolume = options?.volume ?? SOUND_VOLUME[key] ?? DEFAULT_VOLUME;

    audio.volume = Math.min(1, Math.max(0, globalVolume * soundVolume));
    audio.currentTime = 0;
    lastPlayed[key] = now;

    void audio.play().catch(() => {
      // Browsers may block audio until user interaction. Ignore safely.
    });
  } catch (error) {
    console.error("NATA sound playback failed:", error);
  }
}
