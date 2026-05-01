import Nav from "../../../../components/Nav";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export default async function AvailabilityPage({
  params,
}: {
  params: { recruiterSlug: string };
}) {
  const { recruiterSlug } = params;

  const { data: recruiter } = await supabaseAdmin
    .schema("nata")
    .from("recruiters")
    .select("*")
    .eq("slug", recruiterSlug)
    .single();

  if (!recruiter) {
    return <div>Recruiter not found</div>;
  }

  const { data: availability } = await supabaseAdmin
    .schema("nata")
    .from("recruiter_availability")
    .select("*")
    .eq("recruiter_id", recruiter.id);

  const map: Record<string, any> = {};
  (availability || []).forEach((row) => {
    map[row.day_of_week] = row;
  });

  return (
    <main className="shell">
      <Nav />

      <section style={{ width: "min(900px, calc(100% - 40px))", margin: "0 auto", padding: "60px 0" }}>
        <div className="eyebrow">Availability Control</div>
        <h1>{recruiter.name} — Weekly Schedule</h1>

        <p style={{ color: "#cfe2ff", marginTop: 10 }}>
          This controls when candidates can book interviews automatically.
        </p>

        <div style={{ marginTop: 30, display: "grid", gap: 14 }}>
          {DAYS.map((day, index) => {
            const row = map[index] || {};

            return (
              <div key={day} style={card}>
                <div style={{ fontWeight: 800 }}>{day}</div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={badge(row.is_available)}>
                    {row.is_available ? "Available" : "Off"}
                  </span>

                  <span style={{ color: "#9fb1cc" }}>
                    {row.start_time || "--:--"} → {row.end_time || "--:--"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

const card: React.CSSProperties = {
  padding: 18,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

function badge(active?: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 999,
    fontWeight: 800,
    background: active
      ? "rgba(34,197,94,0.15)"
      : "rgba(248,113,113,0.15)",
    color: active ? "#86efac" : "#fca5a5",
    border: active
      ? "1px solid rgba(34,197,94,0.3)"
      : "1px solid rgba(248,113,113,0.3)",
  };
}
