import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type Recruiter = {
  id: string;
  name: string;
  slug: string;
  role: string | null;
  is_active: boolean | null;
  created_at: string | null;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  manager_recruiter_id?: string | null;
  notes?: string | null;
};

type Application = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  screening_status: string | null;
  recruiter_id: string | null;
  fit_score: number | null;
  created_at: string | null;
  job_id: string | null;
};

type Job = {
  id: string;
  title: string | null;
  dealer_slug: string | null;
  public_dealer_name: string | null;
  location: string | null;
};

function label(value: unknown, fallback = "—") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function formatDate(value: unknown) {
  if (!value || typeof value !== "string") return "—";

  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

function initials(name: string) {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default async function RecruiterAdminPage() {
  const { data: recruitersData, error: recruitersError } = await supabaseAdmin
    .schema("nata")
    .from("recruiters")
    .select("*")
    .order("created_at", { ascending: false });

  if (recruitersError) {
    console.error("Failed to load recruiters:", recruitersError);
  }

  const { data: applicationsData, error: applicationsError } = await supabaseAdmin
    .schema("nata")
    .from("applications")
    .select("id,name,email,phone,status,screening_status,recruiter_id,fit_score,created_at,job_id")
    .order("created_at", { ascending: false })
    .limit(75);

  if (applicationsError) {
    console.error("Failed to load applications:", applicationsError);
  }

  const applications = (applicationsData || []) as Application[];
  const recruiters = (recruitersData || []) as Recruiter[];

  const jobIds = Array.from(
    new Set(applications.map((app) => app.job_id).filter(Boolean) as string[])
  );

  const { data: jobsData, error: jobsError } =
    jobIds.length > 0
      ? await supabaseAdmin
          .schema("nata")
          .from("jobs")
          .select("id,title,dealer_slug,public_dealer_name,location")
          .in("id", jobIds)
      : { data: [], error: null };

  if (jobsError) {
    console.error("Failed to load jobs for admin:", jobsError);
  }

  const jobsById = new Map(
    ((jobsData || []) as Job[]).map((job) => [job.id, job])
  );

  const activeRecruiters = recruiters.filter((recruiter) => recruiter.is_active !== false);
  const adminRecruiters = recruiters.filter((recruiter) => recruiter.role === "admin");
  const agentRecruiters = recruiters.filter((recruiter) => recruiter.role === "agent");
  const standardRecruiters = recruiters.filter((recruiter) => recruiter.role === "recruiter");
  const unassignedApplications = applications.filter((app) => !app.recruiter_id);

  return (
    <main style={pageStyle}>
      <section style={wrapStyle}>
        <div style={topNavStyle}>
          <Link href="/recruiter/don/dashboard" style={backLinkStyle}>
            ← Back to Don dashboard
          </Link>
          <Link href="/recruiter/don/candidate-pool" style={secondaryNavButtonStyle}>
            Candidate Pool
          </Link>
        </div>

        <header style={heroStyle}>
          <div>
            <div style={eyebrowStyle}>Recruiter Administration</div>
            <h1 style={titleStyle}>Don’s team control center.</h1>
            <p style={ledeStyle}>
              Add recruiters and agents, keep work assigned, and preserve Don’s full visibility while each operator only works their own queue.
            </p>
          </div>

          <div style={summaryCardStyle}>
            <div style={summaryTitleStyle}>Visibility model</div>
            <p style={summaryTextStyle}>
              Don/admin sees the full operating picture. Recruiters and agents see only assigned candidates and interviews.
            </p>
          </div>
        </header>

        <section style={statsGridStyle}>
          <Stat label="Total team" value={recruiters.length} />
          <Stat label="Active" value={activeRecruiters.length} />
          <Stat label="Admins" value={adminRecruiters.length} />
          <Stat label="Recruiters" value={standardRecruiters.length} />
          <Stat label="Agents" value={agentRecruiters.length} />
          <Stat label="Unassigned candidates" value={unassignedApplications.length} />
        </section>

        <section style={gridTwoStyle}>
          <div style={panelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <div style={eyebrowStyle}>Onboard team member</div>
                <h2 style={panelTitleStyle}>Add recruiter or agent</h2>
              </div>
            </div>

            <form method="POST" action="/api/nata/recruiters/upsert" style={formStyle}>
              <div style={formGridStyle}>
                <Field label="Full name" name="name" placeholder="Example: Sarah Johnson" required />
                <Field label="Slug" name="slug" placeholder="sarah" required />
                <Field label="Email" name="email" type="email" placeholder="sarah@natatoday.ai" />
                <Field label="Phone" name="phone" placeholder="(555) 123-4567" />
                <Field label="Title" name="title" placeholder="Recruiter, Agent, Coordinator" />

                <label style={fieldStyle}>
                  <span style={labelStyle}>Role</span>
                  <select name="role" defaultValue="recruiter" style={inputStyle}>
                    <option value="admin">Admin</option>
                    <option value="recruiter">Recruiter</option>
                    <option value="agent">Agent</option>
                  </select>
                </label>

                <label style={fieldStyle}>
                  <span style={labelStyle}>Manager</span>
                  <select name="managerRecruiterId" defaultValue={adminRecruiters[0]?.id || ""} style={inputStyle}>
                    <option value="">No manager</option>
                    {recruiters.map((recruiter) => (
                      <option key={recruiter.id} value={recruiter.id}>
                        {recruiter.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={fieldStyle}>
                  <span style={labelStyle}>Status</span>
                  <select name="isActive" defaultValue="true" style={inputStyle}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </label>
              </div>

              <label style={{ ...fieldStyle, marginTop: 14 }}>
                <span style={labelStyle}>Internal notes</span>
                <textarea
                  name="notes"
                  rows={4}
                  placeholder="Coverage area, strengths, availability, team notes, or onboarding status."
                  style={textareaStyle}
                />
              </label>

              <div style={noticeStyle}>
                New team members are added to the recruiter roster only. Candidate assignment still controls what they can see and work.
              </div>

              <button type="submit" style={primaryButtonStyle}>
                Add team member
              </button>
            </form>
          </div>

          <div style={panelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <div style={eyebrowStyle}>Team roster</div>
                <h2 style={panelTitleStyle}>Recruiters and agents</h2>
              </div>
            </div>

            <div style={listStyle}>
              {recruiters.length === 0 ? (
                <EmptyState>No recruiters found.</EmptyState>
              ) : (
                recruiters.map((recruiter) => {
                  const manager = recruiters.find(
                    (item) => item.id === recruiter.manager_recruiter_id
                  );

                  return (
                    <article key={recruiter.id} style={teamCardStyle}>
                      <div style={avatarStyle}>{initials(recruiter.name)}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={teamNameStyle}>{recruiter.name}</div>
                        <div style={teamMetaStyle}>
                          {label(recruiter.title, label(recruiter.role, "recruiter"))} · {label(recruiter.email, "No email")}
                        </div>
                        <div style={teamMetaStyle}>
                          Phone: {label(recruiter.phone, "No phone")} · Manager: {manager?.name || "None"}
                        </div>
                        {recruiter.notes ? (
                          <p style={teamNotesStyle}>{recruiter.notes}</p>
                        ) : null}
                      </div>

                      <div style={teamActionsStyle}>
                        <span style={recruiter.is_active === false ? inactiveBadgeStyle : activeBadgeStyle}>
                          {recruiter.is_active === false ? "Inactive" : "Active"}
                        </span>
                        <Link href={`/recruiter/${recruiter.slug}/dashboard`} style={smallLinkStyle}>
                          View workspace
                        </Link>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <section style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <div style={eyebrowStyle}>Candidate assignment</div>
              <h2 style={panelTitleStyle}>Route work to the right operator</h2>
            </div>
            <div style={assignmentHelpStyle}>
              Assignment controls visibility. State still controls execution.
            </div>
          </div>

          <div style={assignmentListStyle}>
            {applications.length === 0 ? (
              <EmptyState>No applications found.</EmptyState>
            ) : (
              applications.map((app) => {
                const job = app.job_id ? jobsById.get(app.job_id) : null;
                const assigned = recruiters.find((recruiter) => recruiter.id === app.recruiter_id);

                return (
                  <article key={app.id} style={assignmentCardStyle}>
                    <div>
                      <div style={candidateNameStyle}>{label(app.name || app.email, "Candidate")}</div>
                      <div style={candidateMetaStyle}>
                        {label(job?.title, "Role pending")} · {label(job?.public_dealer_name || job?.dealer_slug, "Dealer pending")}
                      </div>
                      <div style={candidateMetaStyle}>
                        Status: {label(app.status)} · Screening: {label(app.screening_status)} · Fit: {app.fit_score ?? "—"}
                      </div>
                      <div style={candidateMetaStyle}>
                        Assigned: {assigned?.name || "Unassigned"} · Created: {formatDate(app.created_at)}
                      </div>
                    </div>

                    <form method="POST" action="/api/nata/recruiters/assign" style={assignFormStyle}>
                      <input type="hidden" name="applicationId" value={app.id} />
                      <select name="recruiterId" defaultValue={app.recruiter_id || ""} style={assignSelectStyle}>
                        <option value="">Unassigned</option>
                        {activeRecruiters.map((recruiter) => (
                          <option key={recruiter.id} value={recruiter.id}>
                            {recruiter.name}
                          </option>
                        ))}
                      </select>
                      <button type="submit" style={assignButtonStyle}>
                        Assign
                      </button>
                    </form>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      <input name={name} type={type} placeholder={placeholder} required={required} style={inputStyle} />
    </label>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={statCardStyle}>
      <div style={statValueStyle}>{value}</div>
      <div style={statLabelStyle}>{label}</div>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div style={emptyStyle}>{children}</div>;
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at 20% 0%, rgba(20,115,255,0.18), transparent 34%), #07111f",
  color: "#fff",
  padding: "42px 0 80px",
};

const wrapStyle: React.CSSProperties = {
  width: "min(1280px, calc(100% - 40px))",
  margin: "0 auto",
};

const topNavStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
};

const backLinkStyle: React.CSSProperties = {
  color: "#93c5fd",
  textDecoration: "none",
  fontWeight: 900,
};

const secondaryNavButtonStyle: React.CSSProperties = {
  minHeight: 40,
  display: "inline-flex",
  alignItems: "center",
  padding: "0 14px",
  borderRadius: 999,
  background: "rgba(147,197,253,0.12)",
  border: "1px solid rgba(147,197,253,0.22)",
  color: "#dbeafe",
  textDecoration: "none",
  fontWeight: 900,
};

const heroStyle: React.CSSProperties = {
  marginTop: 28,
  display: "grid",
  gridTemplateColumns: "1fr minmax(300px, 430px)",
  gap: 24,
  alignItems: "end",
};

const eyebrowStyle: React.CSSProperties = {
  color: "#facc15",
  fontWeight: 950,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  fontSize: 12,
};

const titleStyle: React.CSSProperties = {
  margin: "10px 0 0",
  fontSize: "clamp(44px, 6vw, 78px)",
  lineHeight: 0.92,
  letterSpacing: "-0.06em",
};

const ledeStyle: React.CSSProperties = {
  color: "#bfd6f5",
  maxWidth: 760,
  fontSize: 18,
  lineHeight: 1.6,
};

const summaryCardStyle: React.CSSProperties = {
  borderRadius: 24,
  padding: 20,
  background: "rgba(22,163,74,0.12)",
  border: "1px solid rgba(74,222,128,0.24)",
};

const summaryTitleStyle: React.CSSProperties = {
  color: "#bbf7d0",
  fontWeight: 950,
  fontSize: 18,
};

const summaryTextStyle: React.CSSProperties = {
  color: "#dcfce7",
  lineHeight: 1.5,
  margin: "8px 0 0",
};

const statsGridStyle: React.CSSProperties = {
  marginTop: 28,
  display: "grid",
  gridTemplateColumns: "repeat(6, 1fr)",
  gap: 14,
};

const statCardStyle: React.CSSProperties = {
  borderRadius: 22,
  padding: 18,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
};

const statValueStyle: React.CSSProperties = {
  fontSize: 34,
  fontWeight: 950,
};

const statLabelStyle: React.CSSProperties = {
  color: "#9fb4d6",
  marginTop: 4,
  fontWeight: 800,
  fontSize: 13,
};

const gridTwoStyle: React.CSSProperties = {
  marginTop: 28,
  display: "grid",
  gridTemplateColumns: "minmax(420px, 0.85fr) minmax(0, 1.15fr)",
  gap: 18,
  alignItems: "start",
};

const panelStyle: React.CSSProperties = {
  marginTop: 18,
  padding: 22,
  borderRadius: 28,
  background: "rgba(255,255,255,0.055)",
  border: "1px solid rgba(255,255,255,0.12)",
};

const panelHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  marginBottom: 18,
};

const panelTitleStyle: React.CSSProperties = {
  margin: "7px 0 0",
  fontSize: 26,
  letterSpacing: "-0.03em",
};

const formStyle: React.CSSProperties = {
  display: "grid",
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 7,
};

const labelStyle: React.CSSProperties = {
  color: "#dbeafe",
  fontSize: 12,
  fontWeight: 950,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 44,
  padding: "0 12px",
  borderRadius: 13,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(3,7,18,0.84)",
  color: "#fff",
  outline: "none",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 96,
  padding: 12,
  resize: "vertical",
};

const noticeStyle: React.CSSProperties = {
  marginTop: 14,
  padding: 13,
  borderRadius: 16,
  background: "rgba(20,115,255,0.12)",
  border: "1px solid rgba(96,165,250,0.22)",
  color: "#dbeafe",
  fontSize: 13,
  lineHeight: 1.45,
};

const primaryButtonStyle: React.CSSProperties = {
  marginTop: 16,
  width: "100%",
  minHeight: 48,
  borderRadius: 999,
  border: "none",
  background: "linear-gradient(135deg, #1473ff, #0757c9)",
  color: "#fff",
  fontWeight: 950,
  cursor: "pointer",
};

const listStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const teamCardStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "54px 1fr auto",
  gap: 14,
  alignItems: "center",
  borderRadius: 20,
  padding: 14,
  background: "rgba(2,6,23,0.38)",
  border: "1px solid rgba(255,255,255,0.1)",
};

const avatarStyle: React.CSSProperties = {
  width: 54,
  height: 54,
  borderRadius: 18,
  display: "grid",
  placeItems: "center",
  background: "rgba(20,115,255,0.2)",
  border: "1px solid rgba(147,197,253,0.22)",
  color: "#dbeafe",
  fontWeight: 950,
};

const teamNameStyle: React.CSSProperties = {
  fontWeight: 950,
  fontSize: 17,
};

const teamMetaStyle: React.CSSProperties = {
  color: "#9fb4d6",
  marginTop: 4,
  fontSize: 13,
};

const teamNotesStyle: React.CSSProperties = {
  color: "#bfd6f5",
  margin: "8px 0 0",
  fontSize: 13,
  lineHeight: 1.45,
};

const teamActionsStyle: React.CSSProperties = {
  display: "grid",
  justifyItems: "end",
  gap: 9,
};

const activeBadgeStyle: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 999,
  background: "rgba(22,163,74,0.14)",
  border: "1px solid rgba(74,222,128,0.24)",
  color: "#bbf7d0",
  fontWeight: 950,
  fontSize: 12,
};

const inactiveBadgeStyle: React.CSSProperties = {
  ...activeBadgeStyle,
  background: "rgba(148,163,184,0.12)",
  border: "1px solid rgba(148,163,184,0.22)",
  color: "#cbd5e1",
};

const smallLinkStyle: React.CSSProperties = {
  color: "#93c5fd",
  textDecoration: "none",
  fontWeight: 900,
  fontSize: 13,
};

const assignmentHelpStyle: React.CSSProperties = {
  maxWidth: 360,
  color: "#9fb4d6",
  fontSize: 13,
  lineHeight: 1.45,
  textAlign: "right",
};

const assignmentListStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const assignmentCardStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 16,
  alignItems: "center",
  borderRadius: 20,
  padding: 16,
  background: "rgba(2,6,23,0.38)",
  border: "1px solid rgba(255,255,255,0.1)",
};

const candidateNameStyle: React.CSSProperties = {
  fontWeight: 950,
  fontSize: 18,
};

const candidateMetaStyle: React.CSSProperties = {
  color: "#9fb4d6",
  marginTop: 5,
  fontSize: 13,
};

const assignFormStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
};

const assignSelectStyle: React.CSSProperties = {
  ...inputStyle,
  minWidth: 190,
};

const assignButtonStyle: React.CSSProperties = {
  minHeight: 44,
  padding: "0 14px",
  borderRadius: 999,
  border: "1px solid rgba(96,165,250,0.3)",
  background: "rgba(20,115,255,0.16)",
  color: "#dbeafe",
  fontWeight: 950,
  cursor: "pointer",
};

const emptyStyle: React.CSSProperties = {
  padding: 18,
  borderRadius: 18,
  background: "rgba(2,6,23,0.38)",
  border: "1px dashed rgba(255,255,255,0.18)",
  color: "#9fb4d6",
};
