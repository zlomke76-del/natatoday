import type { CSSProperties } from "react";
import { createHash } from "crypto";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type InvitePageProps = {
  params: { token: string };
  searchParams?: { status?: string };
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function getInvite(token: string) {
  const tokenHash = sha256(token);

  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("recruiter_invites")
    .select("id,status,expires_at,recruiters(name,email,phone,role,title)")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    console.error("Invite page lookup failed:", error);
    return null;
  }

  return data as any;
}

export default async function RecruiterInvitePage({ params, searchParams }: InvitePageProps) {
  const token = params.token;
  const invite = await getInvite(token);
  const status = searchParams?.status;
  const expired = invite?.expires_at ? new Date(invite.expires_at).getTime() < Date.now() : false;
  const pending = invite?.status === "pending" && !expired;
  const recruiter = invite?.recruiters;

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <div style={eyebrowStyle}>NATA Today Recruiter Invite</div>

        {!invite ? (
          <>
            <h1 style={titleStyle}>Invite unavailable.</h1>
            <p style={copyStyle}>This invite link is invalid or no longer exists.</p>
          </>
        ) : !pending ? (
          <>
            <h1 style={titleStyle}>{expired ? "Invite expired." : "Invite already used."}</h1>
            <p style={copyStyle}>Ask Don to send a fresh invite from the recruiter admin console.</p>
          </>
        ) : (
          <>
            <h1 style={titleStyle}>Accept your workspace invite.</h1>
            <p style={copyStyle}>
              {recruiter?.name || "You"} have been invited to NATA Today as {recruiter?.role || "a recruiter"}.
            </p>

            {status === "error" ? <div style={errorStyle}>Something went wrong. Try again or ask for a new invite.</div> : null}

            <div style={detailBoxStyle}>
              <strong>{recruiter?.name || "Recruiter"}</strong>
              <span>{recruiter?.title || recruiter?.role || "NATA Today team member"}</span>
              <span>{recruiter?.email || "No email recorded"}</span>
            </div>

            <form method="POST" action="/api/nata/recruiters/accept-invite" style={{ marginTop: 22 }}>
              <input type="hidden" name="token" value={token} />
              <button type="submit" style={buttonStyle}>Accept invite</button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}

const pageStyle: CSSProperties = { minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "radial-gradient(circle at 20% 0%, rgba(20,115,255,0.22), transparent 34%), #07111f", color: "#fff" };
const cardStyle: CSSProperties = { width: "min(720px, 100%)", borderRadius: 30, padding: 32, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", boxShadow: "0 30px 90px rgba(0,0,0,0.35)" };
const eyebrowStyle: CSSProperties = { color: "#facc15", fontWeight: 950, letterSpacing: "0.16em", textTransform: "uppercase", fontSize: 12 };
const titleStyle: CSSProperties = { margin: "14px 0 0", fontSize: "clamp(42px, 7vw, 74px)", lineHeight: 0.9, letterSpacing: "-0.055em" };
const copyStyle: CSSProperties = { color: "#bfd6f5", fontSize: 18, lineHeight: 1.55, marginTop: 18 };
const detailBoxStyle: CSSProperties = { display: "grid", gap: 6, marginTop: 20, padding: 16, borderRadius: 18, background: "rgba(2,6,23,0.42)", border: "1px solid rgba(255,255,255,0.1)", color: "#dbeafe" };
const buttonStyle: CSSProperties = { minHeight: 52, width: "100%", borderRadius: 999, border: "none", background: "linear-gradient(135deg, #1473ff, #0757c9)", color: "#fff", fontWeight: 950, cursor: "pointer", fontSize: 16 };
const errorStyle: CSSProperties = { marginTop: 18, padding: 14, borderRadius: 16, background: "rgba(239,68,68,0.14)", border: "1px solid rgba(248,113,113,0.26)", color: "#fecaca", fontWeight: 850 };
