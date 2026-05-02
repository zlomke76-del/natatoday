import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export default async function RecruiterAdminPage() {
  // ✅ FIX: add schema("nata")
  const { data: recruiters } = await supabaseAdmin
    .schema("nata")
    .from("recruiters")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: applications } = await supabaseAdmin
    .schema("nata")
    .from("applications")
    .select("id, name, status, recruiter_id, fit_score")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="shell">
      <h1>Recruiter Admin</h1>

      {/* TEAM */}
      <section>
        <h2>Team</h2>

        <div style={{ display: "grid", gap: 12 }}>
          {recruiters?.length ? (
            recruiters.map((r) => (
              <div key={r.id} style={card}>
                <strong>{r.name}</strong>
                <span>{r.role}</span>
                <span>{r.is_active ? "Active" : "Inactive"}</span>
              </div>
            ))
          ) : (
            <div>No recruiters found</div>
          )}
        </div>
      </section>

      {/* ASSIGNMENT */}
      <section style={{ marginTop: 40 }}>
        <h2>Candidate Assignment</h2>

        <div style={{ display: "grid", gap: 12 }}>
          {applications?.length ? (
            applications.map((app) => (
              <div key={app.id} style={card}>
                <div>
                  <strong>{app.name}</strong>
                  <div>Status: {app.status}</div>
                  <div>Fit: {app.fit_score ?? "-"}</div>
                </div>

                <form method="POST" action="/api/nata/recruiters/assign">
                  <input type="hidden" name="applicationId" value={app.id} />

                  <select
                    name="recruiterId"
                    defaultValue={app.recruiter_id || ""}
                  >
                    <option value="">Unassigned</option>
                    {recruiters?.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>

                  <button type="submit">Assign</button>
                </form>
              </div>
            ))
          ) : (
            <div>No applications found</div>
          )}
        </div>
      </section>
    </main>
  );
}

const card = {
  padding: 16,
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};
