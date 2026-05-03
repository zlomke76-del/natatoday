"use client";

import { useMemo, useRef, useState } from "react";

type MusicTrack = {
  title: string;
  artist?: string;
  file: string;
  mood?: string;
};

type Props = {
  tracks: MusicTrack[];
};

function cleanTitle(value: string) {
  return value
    .replace(/\.mp3$/i, "")
    .replace(/_/g, " ")
    .replace(/\s+\(\d+\)$/g, "")
    .replace(/\d{4}-\d{2}-\d{2}T\d{6}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function MusicLibraryPlayer({ tracks }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const currentTrack = tracks[currentIndex] || tracks[0];

  const filteredTracks = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) return tracks;

    return tracks.filter((track) => {
      return [
        track.title,
        cleanTitle(track.file),
        track.artist,
        track.mood,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [query, tracks]);

  async function playTrack(index: number) {
    setCurrentIndex(index);
    setPlaying(true);

    window.setTimeout(() => {
      void audioRef.current?.play().catch(() => {
        setPlaying(false);
      });
    }, 25);
  }

  async function togglePlay() {
    if (!audioRef.current) return;

    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
      return;
    }

    try {
      await audioRef.current.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  }

  function nextTrack() {
    const next = currentIndex + 1 >= tracks.length ? 0 : currentIndex + 1;
    void playTrack(next);
  }

  function previousTrack() {
    const previous = currentIndex - 1 < 0 ? tracks.length - 1 : currentIndex - 1;
    void playTrack(previous);
  }

  if (!tracks.length) return null;

  return (
    <section style={shell}>
      <div style={header}>
        <div>
          <div style={kicker}>Custom Music Library</div>
          <h2 style={title}>Recruiter workspace soundtrack</h2>
          <p style={copy}>
            Play uploaded NATA audio tracks while working through candidates,
            interviews, communications, and dealer follow-up.
          </p>
        </div>

        <button type="button" onClick={() => setOpen(!open)} style={expandButton}>
          {open ? "Collapse library" : `Expand library · ${tracks.length}`}
        </button>
      </div>

      <div style={playerCard}>
        <div style={albumMark}>♪</div>

        <div style={{ minWidth: 0 }}>
          <strong style={trackTitle}>
            {currentTrack.title || cleanTitle(currentTrack.file)}
          </strong>
          <p style={trackMeta}>
            {currentTrack.artist || "NATA Today"}{" "}
            {currentTrack.mood ? `· ${currentTrack.mood}` : ""}
          </p>
        </div>

        <div style={controls}>
          <button type="button" onClick={previousTrack} style={controlButton}>
            ‹
          </button>
          <button type="button" onClick={togglePlay} style={playButton}>
            {playing ? "Pause" : "Play"}
          </button>
          <button type="button" onClick={nextTrack} style={controlButton}>
            ›
          </button>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={`/audio/${currentTrack.file}`}
        onEnded={nextTrack}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        controls
        style={audioStyle}
      />

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
              const originalIndex = tracks.findIndex((item) => item.file === track.file);
              const active = originalIndex === currentIndex;

              return (
                <button
                  key={track.file}
                  type="button"
                  onClick={() => playTrack(originalIndex)}
                  style={{
                    ...trackRow,
                    ...(active ? activeTrackRow : null),
                  }}
                >
                  <span style={trackName}>{track.title || cleanTitle(track.file)}</span>
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
