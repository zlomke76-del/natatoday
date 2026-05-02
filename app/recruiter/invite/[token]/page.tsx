import Link from "next/link";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type InvitePageProps = {
  params: {
    token: string;
  };
};

export default async function RecruiterInvitePage({ params }: InvitePageProps) {
  const token = params.token;

  const { data: invite, error } = await supabaseAdmin
    .schema("nata")
    .from("recruiter_invites")
    .select(
      `
      id,
      token,
      status,
      expires_at,
      accepted_at,
      recruiters (
        id,
        name,
        slug,
        email,
        phone,
        title,
        role,
        status,
        activated_at
      )
    `
    )
    .eq("token", token)
    .maybeSingle();

  const recruiter = Array.isArray(invite?.recruiters)
    ? invite?.recruiters[0]
    : invite?.recruiters;

  const invalid = error || !invite || !recruiter;
  const expired =
    invite?.expires_at && new Date(invite.expires_at).getTime() < Date.now();
  const alreadyAccepted = invite?.status === "accepted" || invite?.accepted_at;
  const alreadyActive =
    recruiter?.status === "active" || recruiter?.activated_at;

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <div style={eyebrowStyle}>NATA Today Recruiter Access</div>

        {invalid ? (
          <>
            <h1 style={titleStyle}>Invite not found.</h1>
            <p style={copyStyle}>
              This recruiter invite is invalid, expired, or has been replaced.
              Contact Don for a fresh invite.
            </p>
            <Link href="/careers" style={secondaryButtonStyle}>
              Return to NATA Today
            </Link>
          </>
        ) : expired ? (
          <>
            <h1 style={titleStyle}>Invite expired.</h1>
            <p style={copyStyle}>
              This invite is no longer active. Contact Don for a fresh recruiter
              invite.
            </p>
            <Link href="/careers" style={secondaryButtonStyle}>
              Return to NATA Today
            </Link>
          </>
        ) : alreadyAccepted || alreadyActive ? (
          <>
            <h1 style={titleStyle}>Workspace already active.</h1>
            <p style={copyStyle}>
              {recruiter.name}, your recruiter workspace is already active.
            </p>
            <Link
              href={`/recruiter/${recruiter.slug}/dashboard`}
              style={primaryButtonStyle}
            >
              Open workspace
            </Link>
          </>
        ) : (
          <>
            <h1 style={titleStyle}>Activate your recruiter workspace.</h1>
            <p style={copyStyle}>
              Don invited you to join NATA Today as{" "}
              <strong>{recruiter.role}</strong>
              {recruiter.title ? ` (${recruiter.title})` : ""}.
            </p>

            <div style={profileBoxStyle}>
              <div>
                <strong>Name:</strong> {recruiter.name}
              </div>
              <div>
                <strong>Email:</strong> {recruiter.email || "Not provided"}
              </div>
              <div>
                <strong>Phone:</strong> {recruiter.phone || "Not provided"}
              </div>
              <div>
                <strong>Access:</strong> Assigned work only unless Don grants
                admin permissions.
              </div>
            </div>

            <form
              method="POST"
              action="/api/nata/recruiters/accept-invite"
              style={{ marginTop: 20 }}
            >
              <input type="hidden" name="token" value={token} />
              <button type="submit" style={primaryButtonStyle}>
                Activate workspace
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  background:
    "radial-gradient(circle at 20% 0%, rgba(20,115,255,0.24), transparent 34%), #07111f",
  color: "#fff",
  padding: 24,
};

const cardStyle: React.CSSProperties = {
  width: "min(720px, 100%)",
  padding: 34,
  borderRadius: 30,
  background: "rgba(15,23,42,0.84)",
  border: "1px solid rgba(255,255,255,0.12)",
  boxShadow: "0 32px 90px rgba(0,0,0,0.34)",
};

const eyebrowStyle: React.CSSProperties = {
  color: "#facc15",
  fontWeight: 950,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  fontSize: 12,
};

const titleStyle: React.CSSProperties = {
  margin: "12px 0 0",
  fontSize: "clamp(38px, 6vw, 70px)",
  lineHeight: 0.95,
  letterSpacing: "-0.055em",
};

const copyStyle: React.CSSProperties = {
  marginTop: 18,
  color: "#cfe2ff",
  fontSize: 17,
  lineHeight: 1.6,
};

const profileBoxStyle: React.CSSProperties = {
  marginTop: 22,
  padding: 18,
  borderRadius: 18,
  background: "rgba(2,6,23,0.48)",
  border: "1px solid rgba(255,255,255,0.1)",
  display: "grid",
  gap: 8,
  color: "#dbeafe",
};

const primaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 48,
  padding: "0 20px",
  borderRadius: 999,
  border: "none",
  background: "linear-gradient(135deg, #1473ff, #0757c9)",
  color: "#fff",
  fontWeight: 950,
  textDecoration: "none",
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  background: "rgba(147,197,253,0.14)",
  border: "1px solid rgba(147,197,253,0.24)",
  color: "#dbeafe",
};
