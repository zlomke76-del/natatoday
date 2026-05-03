"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type MusicTrack = {
  id: string;
  title: string;
  artist?: string;
  mood?: string;
  category?: string;
  url: string;
};

type Props = {
  tracks: MusicTrack[];
};

type PlayerSnapshot = {
  trackId?: string;
  time?: number;
  volume?: number;
};

const PLAYER_STORAGE_KEY = "nata-music-player-state";

function cleanTitle(value: string) {
  return value
    .replace(/\.mp3$/i, "")
    .replace(/_/g, " ")
    .replace(/\s+\(\d+\)$/g, "")
    .replace(/\d{4}-\d{2}-\d{2}T\d{6}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function safeTrackTitle(track: MusicTrack | undefined) {
  if (!track) return "No track selected";
  return track.title || cleanTitle(track.url.split("/").pop() || "Untitled track");
}

function readSnapshot(): PlayerSnapshot {
  if (typeof window === "undefined") return {};

  try {
    return JSON.parse(window.localStorage.getItem(PLAYER_STORAGE_KEY) || "{}") as PlayerSnapshot;
  } catch {
    return {};
  }
}

function writeSnapshot(snapshot: PlayerSnapshot) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(snapshot));
}

export default function MusicLibraryPlayer({ tracks }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [library, setLibrary] = useState<MusicTrack[]>(tracks || []);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState("");
  const [volume, setVolume] = useState(0.85);

  const currentTrack = library[currentIndex] || library[0];

  useEffect(() => {
    let active = true;

    async function loadDynamicTracks() {
      try {
        const response = await fetch("/api/nata/music/tracks", { cache: "no-store" });
        const result = await response.json();
        const nextTracks = Array.isArray(result.tracks) ? (result.tracks as MusicTrack[]) : [];

        if (!active || !nextTracks.length) return;

        setLibrary(nextTracks);

        const snapshot = readSnapshot();
        if (snapshot.trackId) {
          const savedIndex = nextTracks.findIndex((track) => track.id === snapshot.trackId);
          if (savedIndex >= 0) setCurrentIndex(savedIndex);
        }

        if (typeof snapshot.volume === "number") {
          setVolume(snapshot.volume);
        }

        setStatus(result.synced ? "Library refreshed from Supabase." : "");
      } catch (error) {
        console.error("Failed to refresh music library:", error);
        setStatus("Using last loaded music library.");
      }
    }

    void loadDynamicTracks();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
    writeSnapshot({ trackId: currentTrack?.id, time: audioRef.current.currentTime || 0, volume });
  }, [volume, currentTrack?.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    const snapshot = readSnapshot();
    if (snapshot.trackId === currentTrack.id && typeof snapshot.time === "number") {
      const restoreTime = Math.max(0, snapshot.time);
      const restore = () => {
        if (Number.isFinite(audio.duration) && restoreTime < audio.duration) {
          audio.currentTime = restoreTime;
        }
      };

      audio.addEventListener("loadedmetadata", restore, { once: true });
      return () => audio.removeEventListener("loadedmetadata", restore);
    }
  }, [currentTrack?.id]);

  const filteredTracks = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) return library;

    return library.filter((track) => {
      return [track.title, track.artist, track.mood, track.category, track.url]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [query, library]);

  async function playTrack(index: number) {
    setCurrentIndex(index);
    setPlaying(true);
    setStatus("");

    window.setTimeout(() => {
      void audioRef.current?.play().catch(() => {
        setPlaying(false);
        setStatus("Press play to start audio.");
      });
    }, 25);
  }

  async function togglePlay() {
    if (!audioRef.current || !currentTrack) return;

    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
      return;
    }

    try {
      await audioRef.current.play();
      setPlaying(true);
      setStatus("");
    } catch {
      setPlaying(false);
      setStatus("Audio could not start automatically. Try pressing play again.");
    }
  }

  function nextTrack() {
    if (!library.length) return;
    const next = currentIndex + 1 >= library.length ? 0 : currentIndex + 1;
    void playTrack(next);
  }

  function previousTrack() {
    if (!library.length) return;
    const previous = currentIndex - 1 < 0 ? library.length - 1 : currentIndex - 1;
    void playTrack(previous);
  }

  function persistProgress() {
    if (!audioRef.current || !currentTrack) return;
    writeSnapshot({
      trackId: currentTrack.id,
      time: audioRef.current.currentTime || 0,
      volume,
    });
  }

  if (!library.length) {
    return (
      <section style={shell}>
        <div style={kicker}>Custom Music Library</div>
        <h2 style={title}>Music library waiting for tracks</h2>
        <p style={copy}>Upload MP3 files to the Supabase bucket and add or sync records in nata.music_tracks.</p>
      </section>
    );
  }

  return (
    <section style={shell}>
      <div style={header}>
        <div>
          <div style={kicker}>Custom Music Library</div>
          <h2 style={title}>Recruiter workspace soundtrack</h2>
          <p style={copy}>
            Supabase-backed audio library. Add songs to the bucket and the player refreshes without a redeploy.
          </p>
        </div>

        <button type="button" onClick={() => setOpen(!open)} style={expandButton}>
          {open ? "Collapse library" : `Expand library · ${library.length}`}
        </button>
      </div>

      <div style={playerCard}>
        <div style={albumMark}>♪</div>

        <div style={{ minWidth: 0 }}>
          <strong style={trackTitle}>{safeTrackTitle(currentTrack)}</strong>
          <p style={trackMeta}>
            {currentTrack?.artist || "NATA Today"}
            {currentTrack?.mood ? ` · ${currentTrack.mood}` : ""}
            {currentTrack?.category ? ` · ${currentTrack.category}` : ""}
          </p>
        </div>

        <div style={controls}>
          <button type="button" onClick={previousTrack} style={controlButton} aria-label="Previous track">
            ‹
          </button>
          <button type="button" onClick={togglePlay} style={playButton}>
            {playing ? "Pause" : "Play"}
          </button>
          <button type="button" onClick={nextTrack} style={controlButton} aria-label="Next track">
            ›
          </button>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={currentTrack?.url}
        onEnded={nextTrack}
        onPause={() => {
          persistProgress();
          setPlaying(false);
        }}
        onPlay={() => setPlaying(true)}
        onTimeUpdate={persistProgress}
        controls
        style={audioStyle}
      />

      <div style={volumeRow}>
        <span>Volume</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(event) => setVolume(Number(event.target.value))}
          style={{ width: "100%" }}
        />
      </div>

      {status ? <div style={helperText}>{status}</div> : null}

      {open ? (
        <div style={libraryPanel}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search music library..."
            style={searchInput}
          />

          <div style={trackGrid}>
            {filteredTracks.map((track) => {
              const originalIndex = library.findIndex((item) => item.id === track.id);
              const active = originalIndex === currentIndex;

              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => playTrack(originalIndex)}
                  style={{
                    ...trackRow,
                    ...(active ? activeTrackRow : null),
                  }}
                >
                  <span style={trackName}>{safeTrackTitle(track)}</span>
                  <span style={trackSub}>
                    {track.artist || "NATA Today"}
                    {track.mood ? ` · ${track.mood}` : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

const shell: React.CSSProperties = {
  marginTop: 48,
  padding: 24,
  borderRadius: 28,
  border: "1px solid rgba(255,255,255,0.12)",
  background:
    "linear-gradient(145deg, rgba(251,191,36,0.12), rgba(20,115,255,0.08)), rgba(7,16,31,0.74)",
  boxShadow: "0 24px 70px rgba(0,0,0,0.22)",
};

const header: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 18,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const kicker: React.CSSProperties = {
  color: "#fbbf24",
  fontWeight: 950,
  fontSize: 12,
  letterSpacing: ".14em",
  textTransform: "uppercase",
  marginBottom: 10,
};

const title: React.CSSProperties = {
  margin: 0,
  color: "#ffffff",
  fontSize: 30,
  lineHeight: 1,
  letterSpacing: "-0.04em",
};

const copy: React.CSSProperties = {
  maxWidth: 800,
  margin: "12px 0 0",
  color: "#bfd6f5",
  lineHeight: 1.55,
};

const expandButton: React.CSSProperties = {
  minHeight: 44,
  padding: "0 16px",
  borderRadius: 999,
  border: "1px solid rgba(251,191,36,0.28)",
  background: "rgba(251,191,36,0.12)",
  color: "#fde68a",
  fontWeight: 950,
  cursor: "pointer",
};

const playerCard: React.CSSProperties = {
  marginTop: 18,
  display: "grid",
  gridTemplateColumns: "64px minmax(0, 1fr) auto",
  gap: 16,
  alignItems: "center",
  padding: 16,
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(3,10,20,0.34)",
};

const albumMark: React.CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: 18,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(251,191,36,0.16)",
  border: "1px solid rgba(251,191,36,0.28)",
  color: "#fde68a",
  fontSize: 30,
  fontWeight: 950,
};

const trackTitle: React.CSSProperties = {
  display: "block",
  color: "#ffffff",
  fontSize: 18,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const trackMeta: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#9fb4d6",
  fontSize: 13,
};

const controls: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
};

const controlButton: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "#ffffff",
  fontWeight: 950,
  cursor: "pointer",
  fontSize: 24,
};

const playButton: React.CSSProperties = {
  minWidth: 86,
  height: 42,
  borderRadius: 999,
  border: "1px solid rgba(96,165,250,0.34)",
  background: "rgba(20,115,255,0.2)",
  color: "#ffffff",
  fontWeight: 950,
  cursor: "pointer",
};

const audioStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 14,
  accentColor: "#fbbf24",
};

const volumeRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "70px minmax(0, 1fr)",
  gap: 12,
  alignItems: "center",
  marginTop: 12,
  color: "#9fb4d6",
  fontSize: 12,
  fontWeight: 850,
};

const libraryPanel: React.CSSProperties = {
  marginTop: 16,
  display: "grid",
  gap: 12,
};

const searchInput: React.CSSProperties = {
  width: "100%",
  minHeight: 44,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "#07101f",
  color: "#ffffff",
  padding: "0 12px",
  outline: "none",
};

const trackGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
};

const trackRow: React.CSSProperties = {
  display: "grid",
  gap: 5,
  textAlign: "left",
  padding: 14,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.045)",
  color: "#ffffff",
  cursor: "pointer",
};

const activeTrackRow: React.CSSProperties = {
  border: "1px solid rgba(251,191,36,0.34)",
  background: "rgba(251,191,36,0.12)",
};

const trackName: React.CSSProperties = {
  fontWeight: 900,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const trackSub: React.CSSProperties = {
  color: "#9fb4d6",
  fontSize: 12,
};

const helperText: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 14,
  background: "rgba(255,255,255,0.045)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#bfd6f5",
  fontSize: 13,
  lineHeight: 1.45,
};
