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
  can_manage_team?: boolean;
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

type AssignmentRow = {
  id: string;
  name: string | null;
  email?: string | null;
  phone?: string | null;
  status: string | null;
  screening_status?: string | null;
  recruiter_id: string | null;
  assigned_recruiter?: string | null;
  fit_score: number | null;
  job_id?: string | null;
  created_at?: string | null;
  virtual_interview_status?: string | null;
  jobs?: {
    id?: string | null;
    dealer_id?: string | null;
    title?: string | null;
    public_dealer_name?: string | null;
    dealer_slug?: string | null;
  } | null;
  dealer_assigned_recruiter_id?: string | null;
  dealer_name?: string | null;
};

type BookingRow = {
  id: string;
  recruiter_id: string | null;
  status: string | null;
  starts_at?: string | null;
};

type DealerRow = {
  id: string;
  name: string | null;
  slug: string | null;
  assigned_recruiter_id: string | null;
  multi_store_group?: string | null;
};

type LoadSnapshot = {
  recruiter: Recruiter;
  assignedCount: number;
  interviewCount: number;
  completedRecentCount: number;
  loadScore: number;
  capacityStatus: "stable" | "watch" | "critical";
};

type SuggestedAction = {
  application: AssignmentRow | null;
  recruiter: Recruiter | null;
  reason: string;
  explanation: string;
};

type RecruiterAdminPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

const BACKLOG_THRESHOLD = 10;
const LOAD_VARIANCE_THRESHOLD = 6;
const LEAD_RECRUITER_OVERLOAD_THRESHOLD = 15;

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

const ASSIGNMENT_MESSAGES: Record<string, string> = {
  manual: "Manual assignment saved.",
  cleared: "Assignment cleared.",
  suggested: "Suggested assignment generated.",
  auto: "Controlled auto-assignment completed.",
  held: "Auto-assignment held because pressure is below threshold.",
  rebalanced: "One overloaded assignment was rebalanced.",
  no_eligible: "No eligible candidates available for assignment.",
  no_rebalance: "No safe rebalance target found.",
  error: "Assignment action failed.",
};

function normalizeText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeLower(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function normalizeRole(value: unknown): RecruiterRole {
  const role = normalizeLower(value) || "recruiter";
  if (role === "admin") return "admin";
  if (role === "agent") return "agent";
  if (role === "system") return "system";
  return "recruiter";
}

function normalizeStatus(value: unknown, isActive?: boolean | null): RecruiterStatus {
  const status = normalizeLower(value);
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
      can_manage_team: true,
    };
  }

  if (role === "recruiter") {
    return {
      can_assign: false,
      can_interview: true,
      can_approve: true,
      can_view_all: false,
      can_manage_team: false,
    };
  }

  return {
    can_assign: false,
    can_interview: false,
    can_approve: false,
    can_view_all: false,
    can_manage_team: false,
  };
}

function mergePermissions(role: RecruiterRole, permissions?: PermissionSet | null) {
  return {
    ...permissionDefaults(role),
    ...(permissions || {}),
  };
}

function canReceiveInterviewWork(recruiter: Recruiter) {
  const status = normalizeStatus(recruiter.status, recruiter.is_active);
  const role = normalizeRole(recruiter.role);
  const permissions = mergePermissions(role, recruiter.permissions);

  if (status !== "active") return false;
  if (recruiter.is_active === false) return false;
  if (role === "agent" && permissions.can_interview !== true) return false;

  return role === "admin" || role === "recruiter" || permissions.can_interview === true;
}

function isInterviewBacklog(application: AssignmentRow) {
  const status = normalizeLower(application.status);
  const screening = normalizeLower(application.screening_status);
  const virtualStatus = normalizeLower(application.virtual_interview_status);

  if (status === "not_fit" || status === "placed" || status === "rejected") return false;
  if (screening === "not_fit" || screening === "rejected") return false;
  if (virtualStatus === "completed" || status === "virtual_completed") return false;

  return (
    status === "virtual_invited" ||
    status === "virtual_scheduled" ||
    status === "needs_review" ||
    screening === "virtual_invited" ||
    screening === "needs_review" ||
    (typeof application.fit_score === "number" && application.fit_score >= 70)
  );
}

function isOpenAssignedWork(application: AssignmentRow) {
  const status = normalizeLower(application.status);
  const screening = normalizeLower(application.screening_status);
  const virtualStatus = normalizeLower(application.virtual_interview_status);

  if (!application.recruiter_id) return false;
  if (status === "not_fit" || status === "placed" || status === "rejected") return false;
  if (screening === "not_fit" || screening === "rejected") return false;
  if (virtualStatus === "completed" || status === "virtual_completed") return false;

  return true;
}

function isScheduledInterview(application: AssignmentRow) {
  const status = normalizeLower(application.status);
  const virtualStatus = normalizeLower(application.virtual_interview_status);
  return status === "virtual_scheduled" || virtualStatus === "scheduled";
}

function isActiveBooking(booking: BookingRow) {
  const status = normalizeLower(booking.status);
  return !!booking.recruiter_id && !["cancelled", "canceled", "completed", "no_show"].includes(status);
}

function isCompletedRecently(application: AssignmentRow) {
  const status = normalizeLower(application.status);
  const virtualStatus = normalizeLower(application.virtual_interview_status);
  const createdAt = application.created_at ? new Date(application.created_at).getTime() : 0;
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

  return (status === "virtual_completed" || virtualStatus === "completed") && createdAt >= oneDayAgo;
}

function buildLoadSnapshots(recruiters: Recruiter[], applications: AssignmentRow[], bookings: BookingRow[]): LoadSnapshot[] {
  return recruiters
    .filter(canReceiveInterviewWork)
    .map((recruiter) => {
      const assignedCount = applications.filter(
        (application) => application.recruiter_id === recruiter.id && isOpenAssignedWork(application)
      ).length;
      const interviewCount =
        bookings.filter((booking) => booking.recruiter_id === recruiter.id && isActiveBooking(booking)).length ||
        applications.filter((application) => application.recruiter_id === recruiter.id && isScheduledInterview(application)).length;
      const completedRecentCount = applications.filter(
        (application) => application.recruiter_id === recruiter.id && isCompletedRecently(application)
      ).length;
      const loadScore = assignedCount + interviewCount * 3 - completedRecentCount * 2;
      const capacityStatus: LoadSnapshot["capacityStatus"] =
        loadScore >= LEAD_RECRUITER_OVERLOAD_THRESHOLD ? "critical" : loadScore >= 10 ? "watch" : "stable";

      return {
        recruiter,
        assignedCount,
        interviewCount,
        completedRecentCount,
        loadScore,
        capacityStatus,
      };
    })
    .sort((a, b) => b.loadScore - a.loadScore);
}

function getLoad(loadSnapshots: LoadSnapshot[], recruiterId: string) {
  return (
    loadSnapshots.find((snapshot) => snapshot.recruiter.id === recruiterId) || {
      recruiter: { id: recruiterId, name: "Unknown", slug: "", role: "recruiter", is_active: false },
      assignedCount: 0,
      interviewCount: 0,
      completedRecentCount: 0,
      loadScore: 0,
      capacityStatus: "stable" as const,
    }
  );
}

function getQueryValue(searchParams: RecruiterAdminPageProps["searchParams"], key: string) {
  const value = searchParams?.[key];
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function groupRecruiters(recruiters: Recruiter[], role: RecruiterRole) {
  return recruiters.filter((recruiter) => normalizeRole(recruiter.role) === role);
}

function pressureReasons(input: {
  backlogCount: number;
  unassignedBacklogCount: number;
  loadVariance: number;
  highestLoad: number;
}) {
  const reasons: string[] = [];

  if (input.backlogCount >= BACKLOG_THRESHOLD) {
    reasons.push(`Interview backlog is ${input.backlogCount}, above the ${BACKLOG_THRESHOLD} threshold.`);
  }

  if (input.unassignedBacklogCount > 0) {
    reasons.push(`${input.unassignedBacklogCount} eligible candidate${input.unassignedBacklogCount === 1 ? " is" : "s are"} unassigned.`);
  }

  if (input.loadVariance >= LOAD_VARIANCE_THRESHOLD) {
    reasons.push(`Recruiter load variance is ${input.loadVariance}, above the ${LOAD_VARIANCE_THRESHOLD} threshold.`);
  }

  if (input.highestLoad >= LEAD_RECRUITER_OVERLOAD_THRESHOLD) {
    reasons.push(`Highest recruiter load is ${input.highestLoad}, above the ${LEAD_RECRUITER_OVERLOAD_THRESHOLD} overload threshold.`);
  }

  return reasons;
}

function buildSuggestedAction(input: {
  applications: AssignmentRow[];
  snapshots: LoadSnapshot[];
  pressureActive: boolean;
}): SuggestedAction {
  const eligible = input.applications.filter((application) => !application.recruiter_id && isInterviewBacklog(application));
  const application = eligible[0] || null;

  if (!application || input.snapshots.length === 0) {
    return {
      application: null,
      recruiter: null,
      reason: "none",
      explanation: "No eligible unassigned backlog candidate is available for assignment.",
    };
  }

  const dealerDefault = application.dealer_assigned_recruiter_id
    ? input.snapshots.find((snapshot) => snapshot.recruiter.id === application.dealer_assigned_recruiter_id)
    : null;

  if (dealerDefault && !input.pressureActive) {
    return {
      application,
      recruiter: dealerDefault.recruiter,
      reason: "dealer_default",
      explanation: "Dealer default recruiter is available and system pressure is below threshold.",
    };
  }

  const lowestLoad = [...input.snapshots].sort((a, b) => a.loadScore - b.loadScore)[0];

  return {
    application,
    recruiter: lowestLoad?.recruiter || null,
    reason: input.pressureActive ? "overflow_lowest_load" : "lowest_load",
    explanation: input.pressureActive
      ? "Workload pressure is active, so the suggested assignment protects flow by choosing the lowest current load."
      : "No dealer default was available, so the suggested assignment uses the lowest current load.",
  };
}

async function getAdminData() {
  const [recruitersResult, applicationsResult, bookingsResult, dealersResult] = await Promise.all([
    supabaseAdmin
      .schema("nata")
      .from("recruiters")
      .select("*")
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .schema("nata")
      .from("applications")
      .select(
        "id,name,email,phone,status,screening_status,recruiter_id,assigned_recruiter,fit_score,job_id,created_at,virtual_interview_status,jobs(id,dealer_id,title,public_dealer_name,dealer_slug)"
      )
      .order("created_at", { ascending: false })
      .limit(150),
    supabaseAdmin
      .schema("nata")
      .from("interview_bookings")
      .select("id,recruiter_id,status,starts_at")
      .gte("starts_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(500),
    supabaseAdmin
      .schema("nata")
      .from("dealers")
      .select("id,name,slug,assigned_recruiter_id,multi_store_group")
      .limit(500),
  ]);

  if (recruitersResult.error) console.error("Failed to load recruiters:", recruitersResult.error);
  if (applicationsResult.error) console.error("Failed to load applications:", applicationsResult.error);
  if (bookingsResult.error) console.error("Failed to load interview bookings:", bookingsResult.error);
  if (dealersResult.error) console.error("Failed to load dealers:", dealersResult.error);

  const recruiters = ((recruitersResult.data || []) as Recruiter[]).map((recruiter) => {
    const role = normalizeRole(recruiter.role);
    return {
      ...recruiter,
      role,
      status: normalizeStatus(recruiter.status, recruiter.is_active),
      permissions: mergePermissions(role, recruiter.permissions),
    };
  });

  const dealers = (dealersResult.data || []) as DealerRow[];
  const dealerMap = new Map(dealers.map((dealer) => [dealer.id, dealer]));
  const applications = ((applicationsResult.data || []) as AssignmentRow[]).map((application) => {
    const dealerId = application.jobs?.dealer_id || null;
    const dealer = dealerId ? dealerMap.get(dealerId) : undefined;
    return {
      ...application,
      dealer_assigned_recruiter_id: dealer?.assigned_recruiter_id || null,
      dealer_name: dealer?.name || application.jobs?.public_dealer_name || application.jobs?.dealer_slug || null,
    };
  });

  return {
    recruiters,
    applications,
    bookings: (bookingsResult.data || []) as BookingRow[],
    dealers,
  };
}

export default async function RecruiterAdminPage({ searchParams }: RecruiterAdminPageProps) {
  const { recruiters, applications, bookings, dealers } = await getAdminData();

  const activeRecruiters = recruiters.filter((recruiter) => normalizeStatus(recruiter.status, recruiter.is_active) === "active");
  const assignableRecruiters = activeRecruiters.filter(canReceiveInterviewWork);
  const admins = groupRecruiters(recruiters, "admin");
  const workingRecruiters = groupRecruiters(recruiters, "recruiter");
  const agents = groupRecruiters(recruiters, "agent");
  const backlogCandidates = applications.filter(isInterviewBacklog);
  const unassignedCandidates = applications.filter((application) => !application.recruiter_id);
  const unassignedBacklogCandidates = backlogCandidates.filter((application) => !application.recruiter_id);
  const scheduledInterviewCount = applications.filter(isScheduledInterview).length;
  const loadSnapshots = buildLoadSnapshots(assignableRecruiters, applications, bookings);
  const highestLoad = loadSnapshots.length ? Math.max(...loadSnapshots.map((snapshot) => snapshot.loadScore)) : 0;
  const lowestLoad = loadSnapshots.length ? Math.min(...loadSnapshots.map((snapshot) => snapshot.loadScore)) : 0;
  const loadVariance = highestLoad - lowestLoad;
  const reasons = pressureReasons({
    backlogCount: backlogCandidates.length,
    unassignedBacklogCount: unassignedBacklogCandidates.length,
    loadVariance,
    highestLoad,
  });
  const pressureActive = reasons.length > 0;
  const suggested = buildSuggestedAction({ applications, snapshots: loadSnapshots, pressureActive });

  const inviteStatus = getQueryValue(searchParams, "invite");
  const assignStatus = getQueryValue(searchParams, "assign");
  const suggestedFromRoute = getQueryValue(searchParams, "suggested");
  const assignedCount = getQueryValue(searchParams, "count");

  return (
    <main style={pageStyle}>
      <div style={wrapStyle}>
        <div style={topBarStyle}>
          <Link href="/careers" style={backLinkStyle}>← NATA Today</Link>
          <Link href="/recruiter/don/dashboard" style={backLinkStyle}>Open recruiter cockpit →</Link>
        </div>

        <section style={heroGridStyle}>
          <div>
            <div style={eyebrowStyle}>NATA Today Admin</div>
            <h1 style={titleStyle}>Execution control layer.</h1>
            <p style={ledeStyle}>
              Monitor live hiring pressure, protect interview capacity, assign ownership, and keep every candidate moving through controlled state.
            </p>
          </div>

          <div style={principleCardStyle}>
            <div style={principleTitleStyle}>Control rule</div>
            <p style={principleTextStyle}>
              Assignment controls visibility. State controls execution. Automation only activates when workload pressure threatens flow.
            </p>
          </div>
        </section>

        <section style={statsGridStyle}>
          <Metric label="Recruiters / agents" value={recruiters.length} />
          <Metric label="Active operators" value={activeRecruiters.length} />
          <Metric label="Dealers" value={dealers.length} />
          <Metric label="Candidates tracked" value={applications.length} />
          <Metric label="Interview backlog" value={backlogCandidates.length} tone={backlogCandidates.length >= BACKLOG_THRESHOLD ? "warn" : "normal"} />
          <Metric label="Unassigned backlog" value={unassignedBacklogCandidates.length} tone={unassignedBacklogCandidates.length ? "warn" : "normal"} />
          <Metric label="Scheduled interviews" value={scheduledInterviewCount} />
          <Metric label="Load variance" value={loadVariance} tone={loadVariance >= LOAD_VARIANCE_THRESHOLD ? "warn" : "normal"} />
        </section>

        <section style={controlPanelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <div style={eyebrowStyle}>Live system state</div>
              <h2 style={panelTitleStyle}>Operational nerve center</h2>
            </div>
            <span style={pressureActive ? pressurePillStyle : stablePillStyle}>
              {pressureActive ? "Pressure active" : "Flow stable"}
            </span>
          </div>

          {assignStatus ? (
            <div style={noticeStyle}>
              <strong>{ASSIGNMENT_MESSAGES[assignStatus] || `Assignment result: ${assignStatus}`}</strong>
              {suggestedFromRoute ? ` Suggested: ${suggestedFromRoute}.` : ""}
              {assignedCount ? ` Count: ${assignedCount}.` : ""}
            </div>
          ) : null}

          {inviteStatus ? (
            <div style={noticeStyle}>Invite status: <strong>{inviteStatus}</strong></div>
          ) : null}

          <div style={systemGridStyle}>
            <StatusCard
              title="Interview capacity"
              value={highestLoad >= LEAD_RECRUITER_OVERLOAD_THRESHOLD ? "Critical" : highestLoad >= 10 ? "Watch" : "Stable"}
              copy={`${scheduledInterviewCount} scheduled / active interview obligations are visible in the current window.`}
              tone={highestLoad >= LEAD_RECRUITER_OVERLOAD_THRESHOLD ? "critical" : highestLoad >= 10 ? "watch" : "stable"}
            />
            <StatusCard
              title="Backlog state"
              value={backlogCandidates.length >= BACKLOG_THRESHOLD ? "Over threshold" : "Within threshold"}
              copy={`${backlogCandidates.length} candidates are in interview or review backlog; ${unassignedBacklogCandidates.length} need ownership.`}
              tone={backlogCandidates.length >= BACKLOG_THRESHOLD || unassignedBacklogCandidates.length ? "watch" : "stable"}
            />
            <StatusCard
              title="Load balance"
              value={loadVariance >= LOAD_VARIANCE_THRESHOLD ? "Uneven" : "Balanced"}
              copy={`Highest load ${highestLoad}; lowest load ${lowestLoad}; variance ${loadVariance}.`}
              tone={loadVariance >= LOAD_VARIANCE_THRESHOLD ? "critical" : "stable"}
            />
          </div>

          <div style={reasonBoxStyle}>
            <div style={reasonTitleStyle}>Why the system is {pressureActive ? "signaling pressure" : "holding automation"}</div>
            {reasons.length ? (
              <ul style={reasonListStyle}>
                {reasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            ) : (
              <p style={reasonTextStyle}>No threshold is currently breached. Manual and dealer-based assignment should remain the default path.</p>
            )}
          </div>

          <div style={suggestionCardStyle}>
            <div>
              <div style={eyebrowStyle}>Assist mode</div>
              <h3 style={suggestionTitleStyle}>Suggested next assignment</h3>
              {suggested.application && suggested.recruiter ? (
                <p style={suggestionCopyStyle}>
                  Assign <strong>{suggested.application.name || "candidate"}</strong> to <strong>{suggested.recruiter.name}</strong>. {suggested.explanation}
                </p>
              ) : (
                <p style={suggestionCopyStyle}>{suggested.explanation}</p>
              )}
            </div>

            <div style={engineActionsStyle}>
              <form method="POST" action="/api/nata/recruiters/assign">
                <input type="hidden" name="mode" value="suggest" />
                <button type="submit" style={secondaryButtonStyle}>Refresh suggestion</button>
              </form>

              {suggested.application && suggested.recruiter ? (
                <form method="POST" action="/api/nata/recruiters/assign">
                  <input type="hidden" name="mode" value="manual" />
                  <input type="hidden" name="applicationId" value={suggested.application.id} />
                  <input type="hidden" name="recruiterId" value={suggested.recruiter.id} />
                  <button type="submit" style={primarySmallButtonStyle}>Confirm suggestion</button>
                </form>
              ) : null}

              <form method="POST" action="/api/nata/recruiters/assign">
                <input type="hidden" name="mode" value="auto_one" />
                <button type="submit" style={primarySmallButtonStyle}>Auto-assign one</button>
              </form>

              <form method="POST" action="/api/nata/recruiters/assign">
                <input type="hidden" name="mode" value="auto_all" />
                <button type="submit" style={primarySmallButtonStyle}>Auto-balance backlog</button>
              </form>

              <form method="POST" action="/api/nata/recruiters/assign">
                <input type="hidden" name="mode" value="rebalance_one" />
                <button type="submit" style={warningButtonStyle}>Rebalance one</button>
              </form>
            </div>
          </div>
        </section>

        <section style={matrixPanelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <div style={eyebrowStyle}>Recruiter load matrix</div>
              <h2 style={panelTitleStyle}>Capacity by operator</h2>
            </div>
            <span style={subtleNoteStyle}>Load = assigned candidates + active interviews × 3 - recent completions × 2</span>
          </div>

          {loadSnapshots.length ? (
            <div style={matrixTableStyle}>
              <div style={matrixHeaderStyle}>Recruiter</div>
              <div style={matrixHeaderStyle}>Role</div>
              <div style={matrixHeaderStyle}>Assigned</div>
              <div style={matrixHeaderStyle}>Interviews</div>
              <div style={matrixHeaderStyle}>Recent done</div>
              <div style={matrixHeaderStyle}>Load</div>
              <div style={matrixHeaderStyle}>Status</div>
              {loadSnapshots.map((snapshot) => (
                <LoadRow key={snapshot.recruiter.id} snapshot={snapshot} />
              ))}
            </div>
          ) : (
            <div style={emptyStateStyle}>No active interview-capable recruiters found.</div>
          )}
        </section>

        <section style={mainGridStyle}>
          <section style={panelStyle}>
            <div style={eyebrowStyle}>Add operator</div>
            <h2 style={panelTitleStyle}>Invite recruiter / agent</h2>

            <form method="POST" action="/api/nata/recruiters/invite" style={formStyle}>
              <div style={formGridStyle}>
                <Label text="Name" name="name" required />
                <Label text="Slug" name="slug" placeholder="auto if blank" />
                <Label text="Email" name="email" type="email" required />
                <Label text="Phone" name="phone" placeholder="+1..." />
                <Label text="Title" name="title" placeholder="Recruiter, Agent, Lead" />
                <label style={labelStyle}>
                  Role
                  <select name="role" defaultValue="recruiter" style={inputStyle}>
                    <option value="admin">Admin</option>
                    <option value="recruiter">Recruiter</option>
                    <option value="agent">Agent</option>
                  </select>
                </label>
              </div>

              <label style={labelStyle}>
                Manager / Lead
                <select name="manager_recruiter_id" style={inputStyle} defaultValue="">
                  <option value="">No manager</option>
                  {activeRecruiters.map((recruiter) => (
                    <option key={recruiter.id} value={recruiter.id}>{recruiter.name}</option>
                  ))}
                </select>
              </label>

              <label style={labelStyle}>
                Notes
                <textarea name="notes" style={textAreaStyle} placeholder="Coverage, region, dealership group, capacity notes..." />
              </label>

              <fieldset style={permissionFieldsetStyle}>
                <legend style={permissionLegendStyle}>Permissions</legend>
                <Check name="can_assign" label="Can assign candidates" />
                <Check name="can_interview" label="Can conduct interviews" />
                <Check name="can_approve" label="Can approve / pass candidates" />
                <Check name="can_view_all" label="Can view full pipeline" />
              </fieldset>

              <div style={noticeStyle}>
                Status is system-controlled. New operators enter as invited and become active only after secure invite activation.
              </div>

              <button type="submit" style={primaryButtonStyle}>Send invite</button>
            </form>
          </section>

          <section style={panelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <div style={eyebrowStyle}>Team state</div>
                <h2 style={panelTitleStyle}>Recruiter / agent roster</h2>
              </div>
            </div>

            <RosterGroup title="Admins" recruiters={admins} loadSnapshots={loadSnapshots} />
            <RosterGroup title="Recruiters" recruiters={workingRecruiters} loadSnapshots={loadSnapshots} />
            <RosterGroup title="Agents" recruiters={agents} loadSnapshots={loadSnapshots} />
          </section>
        </section>

        <section style={panelStyleWithMargin}>
          <div style={panelHeaderStyle}>
            <div>
              <div style={eyebrowStyle}>Candidate ownership</div>
              <h2 style={panelTitleStyle}>Assignment queue</h2>
            </div>
            <span style={subtleNoteStyle}>Dealer and manual assignment remain primary.</span>
          </div>

          {applications.length === 0 ? (
            <div style={emptyStateStyle}>No candidates found yet.</div>
          ) : (
            <div style={assignmentListStyle}>
              {applications.slice(0, 40).map((application) => {
                const assigned = recruiters.find((recruiter) => recruiter.id === application.recruiter_id);
                const dealerDefault = application.dealer_assigned_recruiter_id
                  ? recruiters.find((recruiter) => recruiter.id === application.dealer_assigned_recruiter_id)
                  : null;
                const jobTitle = application.jobs?.title || "Open role";
                const dealerName = application.dealer_name || application.jobs?.public_dealer_name || application.jobs?.dealer_slug || "Dealer pending";
                const backlog = isInterviewBacklog(application);

                return (
                  <article key={application.id} style={assignmentCardStyle}>
                    <div>
                      <h3 style={candidateNameStyle}>{application.name || "Unnamed candidate"}</h3>
                      <p style={candidateMetaStyle}>
                        {jobTitle} · {dealerName} · Fit {application.fit_score ?? "—"}
                      </p>
                      <div style={pillRowStyle}>
                        <span style={statusPillStyle}>{application.status || "new"}</span>
                        <span style={statusPillStyle}>{application.screening_status || "screening pending"}</span>
                        <span style={backlog ? warningPillStyle : statusPillStyle}>{backlog ? "Backlog eligible" : "Not backlog"}</span>
                        <span style={assigned ? assignedPillStyle : warningPillStyle}>
                          {assigned ? `Assigned to ${assigned.name}` : "Unassigned"}
                        </span>
                        {dealerDefault ? <span style={dealerPillStyle}>Dealer default: {dealerDefault.name}</span> : null}
                      </div>
                    </div>

                    <div style={assignmentActionsStyle}>
                      <form method="POST" action="/api/nata/recruiters/assign" style={assignmentFormStyle}>
                        <input type="hidden" name="mode" value="manual" />
                        <input type="hidden" name="applicationId" value={application.id} />
                        <select name="recruiterId" defaultValue={application.recruiter_id || ""} style={compactSelectStyle}>
                          <option value="">Unassigned</option>
                          {assignableRecruiters.map((recruiter) => (
                            <option key={recruiter.id} value={recruiter.id}>{recruiter.name}</option>
                          ))}
                        </select>
                        <button type="submit" style={secondaryButtonStyle}>Save</button>
                      </form>

                      {!application.recruiter_id && backlog ? (
                        <form method="POST" action="/api/nata/recruiters/assign" style={assignmentFormStyle}>
                          <input type="hidden" name="mode" value="auto_one" />
                          <input type="hidden" name="applicationId" value={application.id} />
                          <button type="submit" style={primarySmallButtonStyle}>Use engine</button>
                        </form>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, tone = "normal" }: { label: string; value: number | string; tone?: "normal" | "warn" }) {
  return (
    <div style={tone === "warn" ? metricCardWarnStyle : metricCardStyle}>
      <div style={metricValueStyle}>{value}</div>
      <div style={metricLabelStyle}>{label}</div>
    </div>
  );
}

function StatusCard({ title, value, copy, tone }: { title: string; value: string; copy: string; tone: "stable" | "watch" | "critical" }) {
  const style = tone === "critical" ? statusCardCriticalStyle : tone === "watch" ? statusCardWatchStyle : statusCardStableStyle;
  return (
    <div style={style}>
      <div style={statusCardTitleStyle}>{title}</div>
      <div style={statusCardValueStyle}>{value}</div>
      <p style={statusCardCopyStyle}>{copy}</p>
    </div>
  );
}

function LoadRow({ snapshot }: { snapshot: LoadSnapshot }) {
  const statusStyle = snapshot.capacityStatus === "critical" ? criticalPillStyle : snapshot.capacityStatus === "watch" ? warningPillStyle : assignedPillStyle;
  return (
    <>
      <div style={matrixCellStrongStyle}>{snapshot.recruiter.name}</div>
      <div style={matrixCellStyle}>{ROLE_LABELS[normalizeRole(snapshot.recruiter.role)] || snapshot.recruiter.role}</div>
      <div style={matrixCellStyle}>{snapshot.assignedCount}</div>
      <div style={matrixCellStyle}>{snapshot.interviewCount}</div>
      <div style={matrixCellStyle}>{snapshot.completedRecentCount}</div>
      <div style={matrixCellStrongStyle}>{snapshot.loadScore}</div>
      <div style={matrixCellStyle}><span style={statusStyle}>{snapshot.capacityStatus}</span></div>
    </>
  );
}

function Label({ text, name, type = "text", placeholder, required = false }: { text: string; name: string; type?: string; placeholder?: string; required?: boolean }) {
  return (
    <label style={labelStyle}>
      {text}
      <input name={name} type={type} placeholder={placeholder} required={required} style={inputStyle} />
    </label>
  );
}

function Check({ name, label }: { name: keyof PermissionSet; label: string }) {
  return (
    <label style={checkStyle}>
      <input type="checkbox" name={name} />
      {label}
    </label>
  );
}

function RosterGroup({ title, recruiters, loadSnapshots }: { title: string; recruiters: Recruiter[]; loadSnapshots: LoadSnapshot[] }) {
  return (
    <div style={rosterGroupStyle}>
      <h3 style={rosterGroupTitleStyle}>{title}</h3>
      {recruiters.length === 0 ? <div style={emptyRosterStyle}>No {title.toLowerCase()} yet.</div> : null}
      {recruiters.map((recruiter) => {
        const role = normalizeRole(recruiter.role);
        const status = normalizeStatus(recruiter.status, recruiter.is_active);
        const permissions = mergePermissions(role, recruiter.permissions);
        const load = getLoad(loadSnapshots, recruiter.id);

        return (
          <article key={recruiter.id} style={rosterCardStyle}>
            <div style={avatarStyle}>{initials(recruiter.name)}</div>
            <div>
              <h4 style={rosterNameStyle}>{recruiter.name}</h4>
              <p style={rosterMetaStyle}>{ROLE_LABELS[role] || role}{recruiter.title ? ` · ${recruiter.title}` : ""}</p>
              <p style={rosterMetaStyle}>{recruiter.email || "No email"}{recruiter.phone ? ` · ${recruiter.phone}` : ""}</p>
              <div style={permissionPillRowStyle}>
                {permissions.can_manage_team ? <span style={permissionPillStyle}>Manage</span> : null}
                {permissions.can_view_all ? <span style={permissionPillStyle}>View all</span> : null}
                {permissions.can_assign ? <span style={permissionPillStyle}>Assign</span> : null}
                {permissions.can_approve ? <span style={permissionPillStyle}>Approve</span> : null}
                {permissions.can_interview ? <span style={permissionPillStyle}>Interview</span> : null}
              </div>
            </div>
            <div style={rosterRightStyle}>
              <span style={status === "active" ? activePillStyle : invitedPillStyle}>{STATUS_LABELS[status] || status}</span>
              <span style={workloadStyle}>{load.assignedCount} assigned</span>
              <span style={workloadStyle}>{load.interviewCount} interviews</span>
              <span style={workloadStyle}>Load {load.loadScore}</span>
              {status === "active" ? <Link href={`/recruiter/${recruiter.slug}/dashboard`} style={workspaceLinkStyle}>View workspace</Link> : <span style={pendingLinkStyle}>Activation pending</span>}
            </div>
          </article>
        );
      })}
    </div>
  );
}

const pageStyle: CSSProperties = { minHeight: "100vh", background: "radial-gradient(circle at 20% 0%, rgba(20,115,255,0.2), transparent 34%), #07111f", color: "#fff", padding: "38px 0 80px" };
const wrapStyle: CSSProperties = { width: "min(1380px, calc(100% - 40px))", margin: "0 auto" };
const topBarStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" };
const backLinkStyle: CSSProperties = { color: "#93c5fd", textDecoration: "none", fontWeight: 900 };
const heroGridStyle: CSSProperties = { marginTop: 28, display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 390px)", gap: 24, alignItems: "end" };
const eyebrowStyle: CSSProperties = { color: "#facc15", fontWeight: 950, letterSpacing: "0.16em", textTransform: "uppercase", fontSize: 12 };
const titleStyle: CSSProperties = { margin: "10px 0 0", fontSize: "clamp(54px, 8vw, 108px)", lineHeight: 0.88, letterSpacing: "-0.06em" };
const ledeStyle: CSSProperties = { color: "#bfd6f5", maxWidth: 830, fontSize: 18, lineHeight: 1.6 };
const principleCardStyle: CSSProperties = { borderRadius: 24, padding: 20, background: "rgba(20,115,255,0.12)", border: "1px solid rgba(96,165,250,0.22)" };
const principleTitleStyle: CSSProperties = { fontWeight: 950, color: "#dbeafe", fontSize: 18 };
const principleTextStyle: CSSProperties = { margin: "8px 0 0", color: "#bfd6f5", lineHeight: 1.5 };
const statsGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 14, marginTop: 28 };
const metricCardStyle: CSSProperties = { borderRadius: 22, padding: 20, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" };
const metricCardWarnStyle: CSSProperties = { ...metricCardStyle, background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.22)" };
const metricValueStyle: CSSProperties = { fontSize: 34, fontWeight: 950 };
const metricLabelStyle: CSSProperties = { color: "#9fb4d6", marginTop: 4, fontWeight: 850 };
const controlPanelStyle: CSSProperties = { marginTop: 30, borderRadius: 30, padding: 24, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.13)", boxShadow: "0 24px 80px rgba(0,0,0,0.22)" };
const panelStyle: CSSProperties = { borderRadius: 28, padding: 22, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" };
const panelStyleWithMargin: CSSProperties = { ...panelStyle, marginTop: 24 };
const panelHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 18, alignItems: "end", flexWrap: "wrap" };
const panelTitleStyle: CSSProperties = { margin: "8px 0 18px", fontSize: 28, letterSpacing: "-0.035em" };
const systemGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginTop: 16 };
const statusCardStableStyle: CSSProperties = { borderRadius: 22, padding: 18, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" };
const statusCardWatchStyle: CSSProperties = { borderRadius: 22, padding: 18, background: "rgba(251,191,36,0.11)", border: "1px solid rgba(251,191,36,0.24)" };
const statusCardCriticalStyle: CSSProperties = { borderRadius: 22, padding: 18, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(248,113,113,0.25)" };
const statusCardTitleStyle: CSSProperties = { color: "#dbeafe", fontWeight: 950, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.1em" };
const statusCardValueStyle: CSSProperties = { marginTop: 10, fontSize: 26, fontWeight: 950, letterSpacing: "-0.03em" };
const statusCardCopyStyle: CSSProperties = { margin: "8px 0 0", color: "#bfd6f5", lineHeight: 1.45, fontSize: 14 };
const reasonBoxStyle: CSSProperties = { marginTop: 16, borderRadius: 22, padding: 18, background: "rgba(2,6,23,0.42)", border: "1px solid rgba(255,255,255,0.09)" };
const reasonTitleStyle: CSSProperties = { fontWeight: 950, color: "#dbeafe" };
const reasonListStyle: CSSProperties = { margin: "10px 0 0", color: "#bfd6f5", lineHeight: 1.6 };
const reasonTextStyle: CSSProperties = { margin: "10px 0 0", color: "#bfd6f5", lineHeight: 1.55 };
const suggestionCardStyle: CSSProperties = { marginTop: 16, display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 18, alignItems: "center", borderRadius: 24, padding: 18, background: "rgba(20,115,255,0.12)", border: "1px solid rgba(96,165,250,0.22)" };
const suggestionTitleStyle: CSSProperties = { margin: "8px 0 0", fontSize: 24, letterSpacing: "-0.035em" };
const suggestionCopyStyle: CSSProperties = { color: "#bfd6f5", lineHeight: 1.55, margin: "10px 0 0" };
const matrixPanelStyle: CSSProperties = { ...panelStyle, marginTop: 24 };
const matrixTableStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(180px, 1.7fr) repeat(6, minmax(92px, 1fr))", gap: 0, overflowX: "auto" };
const matrixHeaderStyle: CSSProperties = { padding: "12px 10px", color: "#facc15", fontSize: 12, fontWeight: 950, textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: "1px solid rgba(255,255,255,0.12)" };
const matrixCellStyle: CSSProperties = { padding: "13px 10px", color: "#bfd6f5", borderBottom: "1px solid rgba(255,255,255,0.08)", fontSize: 14 };
const matrixCellStrongStyle: CSSProperties = { ...matrixCellStyle, color: "#fff", fontWeight: 950 };
const mainGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(390px, 0.8fr) minmax(0, 1.2fr)", gap: 18, marginTop: 24, alignItems: "start" };
const formStyle: CSSProperties = { display: "grid", gap: 14 };
const formGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };
const labelStyle: CSSProperties = { display: "grid", gap: 7, color: "#dbeafe", fontSize: 13, fontWeight: 900 };
const inputStyle: CSSProperties = { minHeight: 44, padding: "0 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(3,7,18,0.82)", color: "#fff", outline: "none" };
const textAreaStyle: CSSProperties = { ...inputStyle, minHeight: 90, padding: 12, resize: "vertical" };
const permissionFieldsetStyle: CSSProperties = { border: "1px solid rgba(255,255,255,0.12)", borderRadius: 18, padding: 14, display: "grid", gap: 10 };
const permissionLegendStyle: CSSProperties = { color: "#facc15", fontWeight: 950, padding: "0 8px", letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 11 };
const checkStyle: CSSProperties = { display: "flex", gap: 9, alignItems: "center", color: "#dbeafe", fontSize: 13, fontWeight: 800 };
const noticeStyle: CSSProperties = { marginTop: 12, padding: 12, borderRadius: 14, background: "rgba(37,99,235,0.12)", border: "1px solid rgba(96,165,250,0.24)", color: "#dbeafe", fontSize: 13, lineHeight: 1.45 };
const primaryButtonStyle: CSSProperties = { minHeight: 48, borderRadius: 999, border: "none", background: "linear-gradient(135deg, #1473ff, #0757c9)", color: "#fff", fontWeight: 950, cursor: "pointer", fontSize: 15 };
const rosterGroupStyle: CSSProperties = { display: "grid", gap: 10, marginTop: 18 };
const rosterGroupTitleStyle: CSSProperties = { margin: 0, color: "#facc15", fontSize: 13, textTransform: "uppercase", letterSpacing: "0.12em" };
const rosterCardStyle: CSSProperties = { display: "grid", gridTemplateColumns: "54px minmax(0, 1fr) auto", gap: 14, alignItems: "center", padding: 14, borderRadius: 20, background: "rgba(2,6,23,0.36)", border: "1px solid rgba(255,255,255,0.08)" };
const avatarStyle: CSSProperties = { width: 54, height: 54, borderRadius: 16, display: "grid", placeItems: "center", background: "rgba(20,115,255,0.22)", border: "1px solid rgba(147,197,253,0.22)", color: "#dbeafe", fontWeight: 950 };
const rosterNameStyle: CSSProperties = { margin: 0, fontSize: 18 };
const rosterMetaStyle: CSSProperties = { margin: "4px 0 0", color: "#9fb4d6", fontSize: 13 };
const permissionPillRowStyle: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 };
const permissionPillStyle: CSSProperties = { padding: "5px 8px", borderRadius: 999, background: "rgba(147,197,253,0.12)", border: "1px solid rgba(147,197,253,0.18)", color: "#dbeafe", fontSize: 11, fontWeight: 900 };
const rosterRightStyle: CSSProperties = { display: "grid", justifyItems: "end", gap: 6 };
const activePillStyle: CSSProperties = { padding: "7px 10px", borderRadius: 999, background: "rgba(34,197,94,0.14)", border: "1px solid rgba(34,197,94,0.28)", color: "#86efac", fontSize: 12, fontWeight: 950 };
const invitedPillStyle: CSSProperties = { padding: "7px 10px", borderRadius: 999, background: "rgba(251,191,36,0.14)", border: "1px solid rgba(251,191,36,0.28)", color: "#fbbf24", fontSize: 12, fontWeight: 950 };
const workloadStyle: CSSProperties = { color: "#bfd6f5", fontSize: 12, fontWeight: 850 };
const workspaceLinkStyle: CSSProperties = { color: "#93c5fd", textDecoration: "none", fontWeight: 900, fontSize: 13 };
const pendingLinkStyle: CSSProperties = { color: "#fbbf24", fontWeight: 900, fontSize: 13 };
const emptyRosterStyle: CSSProperties = { padding: 14, borderRadius: 16, background: "rgba(2,6,23,0.36)", color: "#9fb4d6" };
const emptyStateStyle: CSSProperties = { padding: 18, borderRadius: 18, background: "rgba(2,6,23,0.36)", color: "#9fb4d6" };
const subtleNoteStyle: CSSProperties = { color: "#9fb4d6", fontSize: 13, fontWeight: 850 };
const assignmentListStyle: CSSProperties = { display: "grid", gap: 10, marginTop: 16 };
const assignmentCardStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 14, alignItems: "center", padding: 14, borderRadius: 18, background: "rgba(2,6,23,0.36)", border: "1px solid rgba(255,255,255,0.08)" };
const candidateNameStyle: CSSProperties = { margin: 0, fontSize: 18 };
const candidateMetaStyle: CSSProperties = { margin: "5px 0 0", color: "#9fb4d6", fontSize: 13 };
const pillRowStyle: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 7, marginTop: 9 };
const statusPillStyle: CSSProperties = { padding: "5px 8px", borderRadius: 999, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "#dbeafe", fontSize: 11, fontWeight: 900 };
const assignedPillStyle: CSSProperties = { ...statusPillStyle, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.22)", color: "#bbf7d0" };
const warningPillStyle: CSSProperties = { ...statusPillStyle, background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.22)", color: "#facc15" };
const criticalPillStyle: CSSProperties = { ...statusPillStyle, background: "rgba(239,68,68,0.14)", border: "1px solid rgba(248,113,113,0.24)", color: "#fecaca" };
const dealerPillStyle: CSSProperties = { ...statusPillStyle, background: "rgba(59,130,246,0.14)", border: "1px solid rgba(96,165,250,0.24)", color: "#bfdbfe" };
const assignmentActionsStyle: CSSProperties = { display: "grid", gap: 8, justifyItems: "end" };
const assignmentFormStyle: CSSProperties = { display: "flex", gap: 8, alignItems: "center" };
const compactSelectStyle: CSSProperties = { minHeight: 38, minWidth: 190, borderRadius: 12, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(3,7,18,0.82)", color: "#fff", padding: "0 10px" };
const secondaryButtonStyle: CSSProperties = { minHeight: 38, padding: "0 13px", borderRadius: 999, border: "1px solid rgba(147,197,253,0.22)", background: "rgba(147,197,253,0.12)", color: "#dbeafe", fontWeight: 950, cursor: "pointer" };
const engineActionsStyle: CSSProperties = { display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 10 };
const primarySmallButtonStyle: CSSProperties = { minHeight: 38, padding: "0 13px", borderRadius: 999, border: "none", background: "linear-gradient(135deg, #1473ff, #0757c9)", color: "#fff", fontWeight: 950, cursor: "pointer" };
const warningButtonStyle: CSSProperties = { minHeight: 38, padding: "0 13px", borderRadius: 999, border: "1px solid rgba(251,191,36,0.32)", background: "rgba(251,191,36,0.14)", color: "#fde68a", fontWeight: 950, cursor: "pointer" };
const pressurePillStyle: CSSProperties = { padding: "8px 12px", borderRadius: 999, background: "rgba(251,191,36,0.14)", border: "1px solid rgba(251,191,36,0.28)", color: "#fde68a", fontSize: 12, fontWeight: 950 };
const stablePillStyle: CSSProperties = { padding: "8px 12px", borderRadius: 999, background: "rgba(34,197,94,0.14)", border: "1px solid rgba(34,197,94,0.28)", color: "#86efac", fontSize: 12, fontWeight: 950 };
