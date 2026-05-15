import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RecruiterLoginPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

function safeNext(value: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/recruiter/dashboard";
  return value;
}

function messageFor(error: string, reason: string, status: string) {
  if (status === "logged_out") return "You have been signed out.";
  if (reason === "session_required") return "Your recruiter session is missing or expired. Sign in to continue.";
  if (error === "missing") return "Enter your email or slug and password.";
  if (error === "invalid") return "That login does not match an active recruiter account.";
  if (error === "server") return "Login failed because of a server error.";
  return "";
}

export default function RecruiterLoginPage({ searchParams }: RecruiterLoginPageProps) {
  const error = one(searchParams?.error);
  const reason = one(searchParams?.reason);
  const status = one(searchParams?.status);
  const next = safeNext(one(searchParams?.next));
  const notice = messageFor(error, reason, status);

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <div style={eyebrowStyle}>NATA Today Recruiter Access</div>
        <h1 style={titleStyle}>Sign in to your workspace.</h1>
        <p style={copyStyle}>
          Recruiter dashboards now require an active session instead of silently sending you back to careers.
        </p>

        {notice ? <div style={noticeStyle}>{notice}</div> : null}

        <form method="POST" action="/api/nata/recruiters/login" style={formStyle}>
          <input type="hidden" name="next" value={next} />

          <label style={labelStyle}>
            Email or recruiter slug
            <input
              name="identifier"
              autoComplete="username"
              placeholder="don or don@example.com"
              required
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              style={inputStyle}
            />
          </label>

          <button type="submit" style={primaryButtonStyle}>Open workspace</button>
        </form>

        <div style={footerStyle}>
          <Link href="/recruiter/password-reset" style={linkStyle}>Reset a recruiter password</Link>
          <span style={{ color: "rgba(226,232,240,0.36)" }}>•</span>
          <Link href="/careers" style={linkStyle}>Return to careers</Link>
        </div>
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  background: "radial-gradient(circle at 20% 0%, rgba(20,115,255,0.24), transparent 34%), #07111f",
  color: "#fff",
  padding: 24,
};

const cardStyle: React.CSSProperties = {
  width: "min(620px, 100%)",
  padding: 34,
  borderRadius: 30,
  background: "rgba(15,23,42,0.88)",
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
  fontSize: "clamp(38px, 6vw, 64px)",
  lineHeight: 0.95,
  letterSpacing: "-0.055em",
};

const copyStyle: React.CSSProperties = {
  marginTop: 18,
  color: "#cfe2ff",
  fontSize: 17,
  lineHeight: 1.6,
};

const noticeStyle: React.CSSProperties = {
  marginTop: 20,
  padding: "12px 14px",
  borderRadius: 16,
  background: "rgba(250,204,21,0.12)",
  border: "1px solid rgba(250,204,21,0.24)",
  color: "#fde68a",
  fontWeight: 800,
};

const formStyle: React.CSSProperties = {
  marginTop: 24,
  display: "grid",
  gap: 16,
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  color: "#dbeafe",
  fontWeight: 850,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 48,
  borderRadius: 16,
  border: "1px solid rgba(148,163,184,0.28)",
  background: "rgba(2,6,23,0.56)",
  color: "#fff",
  padding: "0 14px",
  fontSize: 16,
};

const primaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 50,
  padding: "0 20px",
  borderRadius: 999,
  border: "none",
  background: "linear-gradient(135deg, #1473ff, #0757c9)",
  color: "#fff",
  fontWeight: 950,
  cursor: "pointer",
};

const footerStyle: React.CSSProperties = {
  marginTop: 22,
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  alignItems: "center",
};

const linkStyle: React.CSSProperties = {
  color: "#bfdbfe",
  fontWeight: 850,
  textDecoration: "none",
};
