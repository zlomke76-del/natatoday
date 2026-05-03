"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getSoundEnabled,
  getSoundVolume,
  playSound,
  preloadSounds,
  setSoundEnabled,
  setSoundVolume,
  type SoundKey,
} from "../../../../lib/soundEngine";

type Props = {
  recruiterSlug: string;
  candidateQueueCount: number;
  reviewRequiredCount: number;
  interviewQueueCount: number;
  waitingOnCandidateCount: number;
  dealerScheduledCount: number;
  blockedCount: number;
  inboxCount: number;
  sentCount: number;
  highValueCandidateCount?: number;
  packetPendingCount?: number;
  showControls?: boolean;
};

type Snapshot = {
  candidateQueueCount: number;
  reviewRequiredCount: number;
  interviewQueueCount: number;
  waitingOnCandidateCount: number;
  dealerScheduledCount: number;
  blockedCount: number;
  inboxCount: number;
  sentCount: number;
  highValueCandidateCount: number;
  packetPendingCount: number;
};

const IMPORTANT_SOUNDS: SoundKey[] = [
  "candidate_new",
  "candidate_ready",
  "candidate_not_fit",
  "candidate_high_value",
  "interview_scheduled",
  "interview_reminder",
  "message_received",
  "message_sent",
  "dealer_action_required",
  "event_no_show",
  "queue_cleared",
];

function buildSnapshot(props: Props): Snapshot {
  return {
    candidateQueueCount: props.candidateQueueCount,
    reviewRequiredCount: props.reviewRequiredCount,
    interviewQueueCount: props.interviewQueueCount,
    waitingOnCandidateCount: props.waitingOnCandidateCount,
    dealerScheduledCount: props.dealerScheduledCount,
    blockedCount: props.blockedCount,
    inboxCount: props.inboxCount,
    sentCount: props.sentCount,
    highValueCandidateCount: props.highValueCandidateCount || 0,
    packetPendingCount: props.packetPendingCount || 0,
  };
}

function increased(current: number, previous: number): boolean {
  return current > previous;
}

function totalWork(snapshot: Snapshot): number {
  return (
    snapshot.candidateQueueCount +
    snapshot.reviewRequiredCount +
    snapshot.interviewQueueCount +
    snapshot.waitingOnCandidateCount +
    snapshot.dealerScheduledCount +
    snapshot.packetPendingCount
  );
}

export default function NataSystemSoundBridge(props: Props) {
  const storageKey = `nata:sound-snapshot:${props.recruiterSlug}`;
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const [volume, setVolumeState] = useState(0.58);

  const snapshot = useMemo(() => buildSnapshot(props), [props]);
  const previousRef = useRef<Snapshot | null>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    setSoundEnabledState(getSoundEnabled());
    setVolumeState(getSoundVolume());
    preloadSounds(IMPORTANT_SOUNDS);
  }, []);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    try {
      const stored = window.localStorage.getItem(storageKey);
      previousRef.current = stored ? (JSON.parse(stored) as Snapshot) : snapshot;
    } catch {
      previousRef.current = snapshot;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
  }, [snapshot, storageKey]);

  useEffect(() => {
    const previous = previousRef.current;

    if (!previous) {
      previousRef.current = snapshot;
      return;
    }

    const soundQueue: SoundKey[] = [];

    if (increased(snapshot.highValueCandidateCount, previous.highValueCandidateCount)) {
      soundQueue.push("candidate_high_value");
    }

    if (increased(snapshot.inboxCount, previous.inboxCount)) {
      soundQueue.push("message_received");
    }

    if (increased(snapshot.sentCount, previous.sentCount)) {
      soundQueue.push("message_sent");
    }

    if (increased(snapshot.reviewRequiredCount, previous.reviewRequiredCount)) {
      soundQueue.push("dealer_action_required");
    }

    if (increased(snapshot.interviewQueueCount, previous.interviewQueueCount)) {
      soundQueue.push("interview_scheduled");
    }

    if (increased(snapshot.waitingOnCandidateCount, previous.waitingOnCandidateCount)) {
      soundQueue.push("interview_reminder");
    }

    if (increased(snapshot.dealerScheduledCount, previous.dealerScheduledCount)) {
      soundQueue.push("candidate_ready");
    }

    if (increased(snapshot.blockedCount, previous.blockedCount)) {
      soundQueue.push("candidate_not_fit");
    }

    if (increased(snapshot.candidateQueueCount, previous.candidateQueueCount)) {
      soundQueue.push("candidate_new");
    }

    if (previous && totalWork(previous) > 0 && totalWork(snapshot) === 0) {
      soundQueue.push("queue_cleared");
    }

    const uniqueSounds = Array.from(new Set(soundQueue));

    uniqueSounds.forEach((sound, index) => {
      window.setTimeout(() => playSound(sound), index * 180);
    });

    previousRef.current = snapshot;
    window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
  }, [snapshot, storageKey]);

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    setSoundEnabledState(next);

    if (next) {
      playSound("action_success", { force: true, volume: 0.45 });
    }
  }

  function updateVolume(value: number) {
    setSoundVolume(value);
    setVolumeState(value);
  }

  if (!props.showControls) return null;

  return (
    <div style={soundPanel} aria-label="NATA system sound controls">
      <button type="button" onClick={toggleSound} style={soundToggle}>
        {soundEnabled ? "Sound on" : "Sound off"}
      </button>
      <label style={volumeLabel}>
        <span>Volume</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={(event) => updateVolume(Number(event.target.value))}
          style={volumeInput}
        />
      </label>
    </div>
  );
}

const soundPanel: React.CSSProperties = {
  position: "fixed",
  right: 18,
  bottom: 18,
  zIndex: 50,
  display: "flex",
  gap: 10,
  alignItems: "center",
  padding: 10,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(3,10,20,0.84)",
  boxShadow: "0 18px 50px rgba(0,0,0,0.32)",
  backdropFilter: "blur(14px)",
};

const soundToggle: React.CSSProperties = {
  minHeight: 34,
  padding: "0 12px",
  borderRadius: 999,
  border: "1px solid rgba(251,191,36,0.28)",
  background: "rgba(251,191,36,0.12)",
  color: "#fde68a",
  fontWeight: 900,
  cursor: "pointer",
};

const volumeLabel: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  color: "#bfd6f5",
  fontSize: 12,
  fontWeight: 800,
};

const volumeInput: React.CSSProperties = {
  width: 90,
  accentColor: "#fbbf24",
};
