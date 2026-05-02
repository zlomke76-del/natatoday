import type { CSSProperties } from "react";
import Link from "next/link";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type RecruiterRole = "admin" | "recruiter" | "agent" | "system";
type RecruiterStatus = "invited" | "active" | "suspended" | "inactive";

type PermissionSet = {
  can_assign?: boolean;
  can_interview?: boolean;
  can_approve?: boolean;
  can_view_all?: boolean;
};

type Recruiter = {
  id: string;
  name: string;
  slug: string;
  role: RecruiterRole | string | null;
  is_active: boolean | null;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  manager_recruiter_id?: string | null;
  notes?: string | null;
  permissions?: PermissionSet | null;
  status?: RecruiterStatus | string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type Application = {
  id: string;
  name: string | null;
  email?: string | null;
  phone?: string | null;
  status: string | null;
  screening_status?: string | null;
  recruiter_id: string | null;
  fit_score: number | null;
  job_id?: string | null;
  created_at?: string | null;
  virtual_interview_status?: string | null;
};

type AssignmentRow = Application & {
  jobs?: {
    title?: string | null;
    public_dealer_name?: string | null;
    dealer_slug?: string | null;
  } | null;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  recruiter: "Recruiter",
  agent: "Agent",
  system: "System",
};

const STATUS_LABELS: Record<string, string> = {
  invited: "Invited",
  active: "Active",
  suspended: "Suspended",
  inactive: "Inactive",
};

function normalizeText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeRole(value: unknown): RecruiterRole {
  const role = normalizeText(value, "recruiter").toLowerCase();

  if (role === "admin") return "admin";
  if (role === "agent") return "agent";
  if (role === "system") return "system";
  return "recruiter";
}

function normalizeStatus(value: unknown, isActive?: boolean | null): RecruiterStatus {
  const status = normalizeText(value).toLowerCase();

  if (status === "active") return "active";
  if (status === "suspended") return "suspended";
  if (status === "inactive") return "inactive";
  if (status === "invited") return "invited";

  return isActive === false ? "inactive" : "active";
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function permissionDefaults(role: RecruiterRole): PermissionSet {
  if (role === "admin" || role === "system") {
    return {
      can_assign: true,
      can_interview: true,
      can_approve: true,
      can_view_all: true,
    };
  }

  if (role === "recruiter") {
    return {
      can_assign: false,
      can_interview: true,
      can_approve: true,
      can_view_all: false,
    };
  }

  return {
    can_assign: false,
    can_interview: false,
    can_approve: false,
    can_view_all: false,
  };
}

function mergePermissions(role: RecruiterRole, permissions?: PermissionSet | null) {
  return {
    ...permissionDefaults(role),
    ...(permissions || {}),
  };
}

function countAssigned(applications: AssignmentRow[], recruiterId: string) {
  return applications.filter((item) => item.recruiter_id === recruiterId).length;
}

function countPendingInterviews(applications: AssignmentRow[], recruiterId: string) {
  return applications.filter((item) => {
    const status = normalizeText(item.status).toLowerCase();
    const virtualStatus = normalizeText(item.virtual_interview_status).toLowerCase();
    return (
      item.recruiter_id === recruiterId &&
      (status === "virtual_scheduled" || virtualStatus === "scheduled")
    );
  }).length;
}

function groupRecruiters(recruiters: Recruiter[], role: RecruiterRole) {
  return recruiters.filter((recruiter) => normalizeRole(recruiter.role) === role);
}

async function getAdminData() {
  const [{ data: recruitersData, error: recruitersError }, { data: applicationsData, error: applicationsError }] =
    await Promise.all([
      supabaseAdmin
        .schema("nata")
        .from("recruiters")
        .select("*")
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .schema("nata")
        .from("applications")
        .select(
          "id,name,email,phone,status,screening_status,recruiter_id,fit_score,job_id,created_at,virtual_interview_status,jobs(title,public_dealer_name,dealer_slug)"
        )
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

  if (recruitersError) {
    console.error("Failed to load recruiters:", recruitersError);
  }

  if (applicationsError) {
    console.error("Failed to load applications:", applicationsError);
  }

  return {
    recruiters: ((recruitersData || []) as Recruiter[]).map((recruiter) => {
      const role = normalizeRole(recruiter.role);
      return {
        ...recruiter,
        role,
        status: normalizeStatus(recruiter.status, recruiter.is_active),
        permissions: mergePermissions(role, recruiter.permissions),
      };
    }),
    applications: (applicationsData || []) as AssignmentRow[],
  };
}

export default async function RecruiterAdminPage() {
  const { recruiters, applications } = await getAdminData();

  const activeRecruiters = recruiters.filter(
    (recruiter) => normalizeStatus(recruiter.status, recruiter.is_active) === "active"
  );

  const unassignedCandidates = applications.filter((application) => !application.recruiter_id);
  const admins = groupRecruiters(recruiters, "admin");
  const workingRecruiters = groupRecruiters(recruiters, "recruiter");
  const agents = groupRecruiters(recruiters, "agent");

  return (
    <main style={pageStyle}>
      <section style={wrapStyle}>
        <div style={topBarStyle}>
          <Link href="/recruiter/don/dashboard" style={backLinkStyle}>
            ← Don dashboard
          </Link>
          <Link href="/recruiter/dashboard" style={backLinkStyle}>
            Recruiter workspace
          </Link>
        </div>

        <div style={heroGridStyle}>
          <div>
            <div style={eyebrowStyle}>Recruiter Authority Console</div>
            <h1 style={titleStyle}>Recruiter Admin</h1>
            <p style={ledeStyle}>
              Add recruiters and agents, control their execution permissions, and assign candidate work without changing the
              underlying hiring states.
            </p>
          </div>

          <div style={principleCardStyle}>
            <div style={principleTitleStyle}>Operating rule</div>
            <p style={principleTextStyle}>
              Don keeps full visibility. Recruiters and agents only see the work assigned to them unless explicit authority
              says otherwise.
            </p>
          </div>
        </div>

        <div style={statsGridStyle}>
          <Metric label="Total team" value={recruiters.length} />
          <Metric label="Active" value={activeRecruiters.length} />
          <Metric label="Admins" value={admins.length} />
          <Metric label="Recruiters" value={workingRecruiters.length} />
          <Metric label="Agents" value={agents.length} />
          <Metric label="Unassigned candidates" value={unassignedCandidates.length} />
        </div>

        <div style={mainGridStyle}>
          <section style={panelStyle}>
            <div style={eyebrowStyle}>Onboard team member</div>
            <h2 style={panelTitleStyle}>Add recruiter or agent</h2>

            <form method="POST" action="/api/nata/recruiters/upsert" style={formStyle}>
              <div style={formGridStyle}>
                <Field label="Full name" name="name" placeholder="Brandy Diamond" required />
                <Field label="Slug" name="slug" placeholder="brandy-diamond" required />
                <Field label="Email" name="email" type="email" placeholder="brandy@natatoday.ai" />
                <Field label="Phone" name="phone" placeholder="(555) 123-4567" />
                <Field label="Title" name="title" placeholder="Recruiter, Agent, Coordinator" />

                <label style={labelStyle}>
                  <span>Role</span>
                  <select name="role" defaultValue="recruiter" style={inputStyle}>
                    <option value="admin">Admin</option>
                    <option value="recruiter">Recruiter</option>
                    <option value="agent">Agent</option>
                  </select>
                </label>

                <label style={labelStyle}>
                  <span>Manager</span>
                  <select name="manager_recruiter_id" defaultValue="" style={inputStyle}>
                    <option value="">No manager</option>
                    {recruiters.map((recruiter) => (
                      <option key={recruiter.id} value={recruiter.id}>
                        {recruiter.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={labelStyle}>
                  <span>Status</span>
                  <select name="status" defaultValue="invited" style={inputStyle}>
                    <option value="invited">Invited</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              </div>

              <fieldset style={permissionFieldsetStyle}>
                <legend style={permissionLegendStyle}>Execution permissions</legend>
                <Check name="can_view_all" label="Can view all candidates and recruiters" />
                <Check name="can_assign" label="Can assign candidates" />
                <Check name="can_approve" label="Can approve candidates for interview" />
                <Check name="can_interview" label="Can conduct virtual interviews" defaultChecked />
              </fieldset>

              <label style={labelStyle}>
                <span>Internal notes</span>
                <textarea
                  name="notes"
                  rows={4}
                  placeholder="Coverage area, strengths, availability, team notes, or onboarding status."
                  style={textAreaStyle}
                />
              </label>

              <div style={noticeStyle}>
                New team members are added to the roster only. Candidate assignment still controls what they can see and work.
              </div>

              <button type="submit" style={primaryButtonStyle}>
                Add team member
              </button>
            </form>
          </section>

          <section style={panelStyle}>
            <div style={eyebrowStyle}>Live workforce state</div>
            <h2 style={panelTitleStyle}>Recruiters and agents</h2>

            <RosterGroup
              title="Admins"
              recruiters={admins}
              applications={applications}
              allRecruiters={recruiters}
            />
            <RosterGroup
              title="Recruiters"
              recruiters={workingRecruiters}
              applications={applications}
              allRecruiters={recruiters}
            />
            <RosterGroup
              title="Agents"
              recruiters={agents}
              applications={applications}
              allRecruiters={recruiters}
            />

            {recruiters.length === 0 ? (
              <div style={emptyStateStyle}>No recruiters found.</div>
            ) : null}
          </section>
        </div>

        <section style={{ ...panelStyle, marginTop: 18 }}>
          <div style={panelHeaderStyle}>
            <div>
              <div style={eyebrowStyle}>Candidate assignment</div>
              <h2 style={panelTitleStyle}>Assign visible work</h2>
            </div>
            <span style={subtleNoteStyle}>Assignment controls visibility. State still controls execution.</span>
          </div>

          <div style={assignmentListStyle}>
            {applications.length === 0 ? (
              <div style={emptyStateStyle}>No candidates found.</div>
            ) : (
              applications.map((application) => {
                const assigned = recruiters.find((recruiter) => recruiter.id === application.recruiter_id);
                const roleTitle = application.jobs?.title || "Role pending";
                const dealerName =
                  application.jobs?.public_dealer_name || application.jobs?.dealer_slug || "Dealer pending";

                return (
                  <article key={application.id} style={assignmentCardStyle}>
                    <div>
                      <h3 style={candidateNameStyle}>{application.name || application.email || "Candidate"}</h3>
                      <p style={candidateMetaStyle}>
                        {roleTitle} · {dealerName}
                      </p>
                      <div style={pillRowStyle}>
                        <span style={statusPillStyle}>{application.status || "new"}</span>
                        <span style={statusPillStyle}>Fit {application.fit_score ?? "—"}</span>
                        <span style={assigned ? assignedPillStyle : warningPillStyle}>
                          {assigned ? `Assigned to ${assigned.name}` : "Unassigned"}
                        </span>
                      </div>
                    </div>

                    <form method="POST" action="/api/nata/recruiters/assign" style={assignmentFormStyle}>
                      <input type="hidden" name="applicationId" value={application.id} />
                      <select name="recruiterId" defaultValue={application.recruiter_id || ""} style={compactSelectStyle}>
                        <option value="">Unassigned</option>
                        {activeRecruiters.map((recruiter) => (
                          <option key={recruiter.id} value={recruiter.id}>
                            {recruiter.name}
                          </option>
                        ))}
                      </select>
                      <button type="submit" style={secondaryButtonStyle}>
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div style={metricCardStyle}>
      <div style={metricValueStyle}>{value}</div>
      <div style={metricLabelStyle}>{label}</div>
    </div>
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
    <label style={labelStyle}>
      <span>{label}</span>
      <input name={name} type={type} placeholder={placeholder} required={required} style={inputStyle} />
    </label>
  );
}

function Check({
  name,
  label,
  defaultChecked = false,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label style={checkStyle}>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      <span>{label}</span>
    </label>
  );
}

function RosterGroup({
  title,
  recruiters,
  applications,
  allRecruiters,
}: {
  title: string;
  recruiters: Recruiter[];
  applications: AssignmentRow[];
  allRecruiters: Recruiter[];
}) {
  return (
    <div style={rosterGroupStyle}>
      <h3 style={rosterGroupTitleStyle}>{title}</h3>

      {recruiters.length === 0 ? (
        <div style={emptyRosterStyle}>None yet.</div>
      ) : (
        recruiters.map((recruiter) => {
          const role = normalizeRole(recruiter.role);
          const permissions = mergePermissions(role, recruiter.permissions);
          const status = normalizeStatus(recruiter.status, recruiter.is_active);
          const manager = allRecruiters.find((item) => item.id === recruiter.manager_recruiter_id);

          return (
            <article key={recruiter.id} style={rosterCardStyle}>
              <div style={avatarStyle}>{initials(recruiter.name)}</div>

              <div style={{ minWidth: 0 }}>
                <h4 style={rosterNameStyle}>{recruiter.name}</h4>
                <p style={rosterMetaStyle}>
                  {ROLE_LABELS[role] || role} · {recruiter.title || "No title"}
                </p>
                <p style={rosterMetaStyle}>
                  {recruiter.email || "No email"} · {recruiter.phone || "No phone"} · Manager: {manager?.name || "None"}
                </p>
                <div style={permissionPillRowStyle}>
                  {permissions.can_view_all ? <span style={permissionPillStyle}>View all</span> : null}
                  {permissions.can_assign ? <span style={permissionPillStyle}>Assign</span> : null}
                  {permissions.can_approve ? <span style={permissionPillStyle}>Approve</span> : null}
                  {permissions.can_interview ? <span style={permissionPillStyle}>Interview</span> : null}
                </div>
              </div>

              <div style={rosterRightStyle}>
                <span style={status === "active" ? activePillStyle : invitedPillStyle}>
                  {STATUS_LABELS[status] || status}
                </span>
                <span style={workloadStyle}>{countAssigned(applications, recruiter.id)} assigned</span>
                <span style={workloadStyle}>{countPendingInterviews(applications, recruiter.id)} interviews</span>
                <Link href={`/recruiter/${recruiter.slug}/dashboard`} style={workspaceLinkStyle}>
                  View workspace
                </Link>
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at 20% 0%, rgba(20,115,255,0.2), transparent 34%), #07111f",
  color: "#fff",
  padding: "38px 0 80px",
};

const wrapStyle: CSSProperties = {
  width: "min(1320px, calc(100% - 40px))",
  margin: "0 auto",
};

const topBarStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  flexWrap: "wrap",
};

const backLinkStyle: CSSProperties = {
  color: "#93c5fd",
  textDecoration: "none",
  fontWeight: 900,
};

const heroGridStyle: CSSProperties = {
  marginTop: 28,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 380px)",
  gap: 24,
  alignItems: "end",
};

const eyebrowStyle: CSSProperties = {
  color: "#facc15",
  fontWeight: 950,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  fontSize: 12,
};

const titleStyle: CSSProperties = {
  margin: "10px 0 0",
  fontSize: "clamp(54px, 8vw, 108px)",
  lineHeight: 0.88,
  letterSpacing: "-0.06em",
};

const ledeStyle: CSSProperties = {
  color: "#bfd6f5",
  maxWidth: 780,
  fontSize: 18,
  lineHeight: 1.6,
};

const principleCardStyle: CSSProperties = {
  borderRadius: 24,
  padding: 20,
  background: "rgba(20,115,255,0.12)",
  border: "1px solid rgba(96,165,250,0.22)",
};

const principleTitleStyle: CSSProperties = {
  fontWeight: 950,
  color: "#dbeafe",
  fontSize: 18,
};

const principleTextStyle: CSSProperties = {
  margin: "8px 0 0",
  color: "#bfd6f5",
  lineHeight: 1.5,
};

const statsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(6, 1fr)",
  gap: 14,
  marginTop: 28,
};

const metricCardStyle: CSSProperties = {
  borderRadius: 22,
  padding: 20,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
};

const metricValueStyle: CSSProperties = {
  fontSize: 34,
  fontWeight: 950,
};

const metricLabelStyle: CSSProperties = {
  color: "#9fb4d6",
  marginTop: 4,
  fontWeight: 850,
};

const mainGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(390px, 0.8fr) minmax(0, 1.2fr)",
  gap: 18,
  marginTop: 36,
  alignItems: "start",
};

const panelStyle: CSSProperties = {
  borderRadius: 28,
  padding: 22,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
};

const panelHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 18,
  alignItems: "end",
  flexWrap: "wrap",
};

const panelTitleStyle: CSSProperties = {
  margin: "8px 0 18px",
  fontSize: 28,
  letterSpacing: "-0.035em",
};

const formStyle: CSSProperties = {
  display: "grid",
  gap: 14,
};

const formGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const labelStyle: CSSProperties = {
  display: "grid",
  gap: 7,
  color: "#dbeafe",
  fontSize: 13,
  fontWeight: 900,
};

const inputStyle: CSSProperties = {
  minHeight: 44,
  padding: "0 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(3,7,18,0.82)",
  color: "#fff",
  outline: "none",
};

const textAreaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 90,
  padding: 12,
  resize: "vertical",
};

const permissionFieldsetStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 18,
  padding: 14,
  display: "grid",
  gap: 10,
};

const permissionLegendStyle: CSSProperties = {
  color: "#facc15",
  fontWeight: 950,
  padding: "0 8px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  fontSize: 11,
};

const checkStyle: CSSProperties = {
  display: "flex",
  gap: 9,
  alignItems: "center",
  color: "#dbeafe",
  fontSize: 13,
  fontWeight: 800,
};

const noticeStyle: CSSProperties = {
  padding: 12,
  borderRadius: 14,
  background: "rgba(37,99,235,0.12)",
  border: "1px solid rgba(96,165,250,0.24)",
  color: "#dbeafe",
  fontSize: 13,
  lineHeight: 1.45,
};

const primaryButtonStyle: CSSProperties = {
  minHeight: 48,
  borderRadius: 999,
  border: "none",
  background: "linear-gradient(135deg, #1473ff, #0757c9)",
  color: "#fff",
  fontWeight: 950,
  cursor: "pointer",
  fontSize: 15,
};

const rosterGroupStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  marginTop: 18,
};

const rosterGroupTitleStyle: CSSProperties = {
  margin: 0,
  color: "#facc15",
  fontSize: 13,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
};

const rosterCardStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "54px minmax(0, 1fr) auto",
  gap: 14,
  alignItems: "center",
  padding: 14,
  borderRadius: 20,
  background: "rgba(2,6,23,0.36)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const avatarStyle: CSSProperties = {
  width: 54,
  height: 54,
  borderRadius: 16,
  display: "grid",
  placeItems: "center",
  background: "rgba(20,115,255,0.22)",
  border: "1px solid rgba(147,197,253,0.22)",
  color: "#dbeafe",
  fontWeight: 950,
};

const rosterNameStyle: CSSProperties = {
  margin: 0,
  fontSize: 18,
};

const rosterMetaStyle: CSSProperties = {
  margin: "4px 0 0",
  color: "#9fb4d6",
  fontSize: 13,
};

const permissionPillRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  marginTop: 8,
};

const permissionPillStyle: CSSProperties = {
  padding: "5px 8px",
  borderRadius: 999,
  background: "rgba(147,197,253,0.12)",
  border: "1px solid rgba(147,197,253,0.18)",
  color: "#dbeafe",
  fontSize: 11,
  fontWeight: 900,
};

const rosterRightStyle: CSSProperties = {
  display: "grid",
  justifyItems: "end",
  gap: 6,
};

const activePillStyle: CSSProperties = {
  padding: "7px 10px",
  borderRadius: 999,
  background: "rgba(34,197,94,0.14)",
  border: "1px solid rgba(34,197,94,0.28)",
  color: "#86efac",
  fontSize: 12,
  fontWeight: 950,
};

const invitedPillStyle: CSSProperties = {
  padding: "7px 10px",
  borderRadius: 999,
  background: "rgba(251,191,36,0.14)",
  border: "1px solid rgba(251,191,36,0.28)",
  color: "#fbbf24",
  fontSize: 12,
  fontWeight: 950,
};

const workloadStyle: CSSProperties = {
  color: "#bfd6f5",
  fontSize: 12,
  fontWeight: 850,
};

const workspaceLinkStyle: CSSProperties = {
  color: "#93c5fd",
  textDecoration: "none",
  fontWeight: 900,
  fontSize: 13,
};

const emptyRosterStyle: CSSProperties = {
  padding: 14,
  borderRadius: 16,
  background: "rgba(2,6,23,0.36)",
  color: "#9fb4d6",
};

const emptyStateStyle: CSSProperties = {
  padding: 18,
  borderRadius: 18,
  background: "rgba(2,6,23,0.36)",
  color: "#9fb4d6",
};

const subtleNoteStyle: CSSProperties = {
  color: "#9fb4d6",
  fontSize: 13,
  fontWeight: 850,
};

const assignmentListStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  marginTop: 16,
};

const assignmentCardStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 14,
  alignItems: "center",
  padding: 14,
  borderRadius: 18,
  background: "rgba(2,6,23,0.36)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const candidateNameStyle: CSSProperties = {
  margin: 0,
  fontSize: 18,
};

const candidateMetaStyle: CSSProperties = {
  margin: "5px 0 0",
  color: "#9fb4d6",
  fontSize: 13,
};

const pillRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 7,
  marginTop: 9,
};

const statusPillStyle: CSSProperties = {
  padding: "5px 8px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#dbeafe",
  fontSize: 11,
  fontWeight: 900,
};

const assignedPillStyle: CSSProperties = {
  ...statusPillStyle,
  background: "rgba(34,197,94,0.12)",
  border: "1px solid rgba(34,197,94,0.22)",
  color: "#bbf7d0",
};

const warningPillStyle: CSSProperties = {
  ...statusPillStyle,
  background: "rgba(251,191,36,0.12)",
  border: "1px solid rgba(251,191,36,0.22)",
  color: "#facc15",
};

const assignmentFormStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
};

const compactSelectStyle: CSSProperties = {
  minHeight: 38,
  minWidth: 180,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(3,7,18,0.82)",
  color: "#fff",
  padding: "0 10px",
};

const secondaryButtonStyle: CSSProperties = {
  minHeight: 38,
  padding: "0 13px",
  borderRadius: 999,
  border: "1px solid rgba(147,197,253,0.22)",
  background: "rgba(147,197,253,0.12)",
  color: "#dbeafe",
  fontWeight: 950,
  cursor: "pointer",
};
