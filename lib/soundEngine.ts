type SoundKey =
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
  | "focus_mode_exit";

const SOUND_PATH = "/sounds";

const cache: Record<string, HTMLAudioElement> = {};

export function playSound(key: SoundKey) {
  try {
    if (typeof window === "undefined") return;

    let audio = cache[key];

    if (!audio) {
      audio = new Audio(`${SOUND_PATH}/${key}.mp3`);
      audio.preload = "auto";
      audio.volume = 0.6;
      cache[key] = audio;
    }

    audio.currentTime = 0;
    void audio.play().catch(() => {});
  } catch (err) {
    console.error("Sound error:", err);
  }
}
