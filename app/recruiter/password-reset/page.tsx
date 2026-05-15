import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PasswordResetPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

function statusMessage(error: string, status: string, recruiter: string) {
  if (status === "updated") return `Password updated${recruiter ? ` for ${recruiter}` : ""}.`;
  if (error === "unauthorized") return "Reset denied. Enter the admin reset secret configured in Vercel.";
  if (error === "weak") return "Use an identifier and a password of at least 10 characters.";
  if (error === "mismatch") return "The password fields do not match.";
  if (error === "not_found") return "No recruiter was found for that email or slug.";
  if (error === "server") return "Password reset failed because of a server error.";
  return "";
}

export default function RecruiterPasswordResetPage({ searchParams }: PasswordResetPageProps) {
  const error = one(searchParams?.error);
  const status = one(searchParams?.status);
  const recruiter = one(searchParams?.recruiter);
  const message = statusMessage(error, status, recruiter);
  const good = status === "updated";

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <div style={eyebrowStyle}>NATA Today Admin Recovery</div>
        <h1 style={titleStyle}>Reset recruiter password.</h1>
        <p style={copyStyle}>
          Use this when a recruiter session has expired or a recruiter needs a fresh password. This activates the recruiter and can optionally sign you in immediately.
        </p>

        {message ? <div style={good ? successStyle : noticeStyle}>{message}</div> : null}

        <form method="POST" action="/api/nata/recruiters/password-reset" style={formStyle}>
          <label style={labelStyle}>
            Admin reset secret
            <input
              name="admin_secret"
              type="password"
              autoComplete="off"
              placeholder="NATA_ADMIN_RESET_SECRET"
              required
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Recruiter email or slug
            <input
              name="identifier"
              autoComplete="username"
              placeholder="don or don@example.com"
              required
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            New password
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Confirm new password
            <input
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
              style={inputStyle}
            />
          </label>

          <label style={checkboxStyle}>
            <input name="sign_in_after_reset" type="checkbox" defaultChecked />
            Sign in as this recruiter after reset
          </label>

          <button type="submit" style={primaryButtonStyle}>Reset password</button>
        </form>

        <div style={footerStyle}>
          <Link href="/recruiter/login" style={linkStyle}>Back to recruiter login</Link>
          <span style={{ color: "rgba(226,232,240,0.36)" }}>•</span>
          <Link href="/recruiter/admin" style={linkStyle}>Recruiter admin</Link>
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
  width: "min(680px, 100%)",
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
  background: "rgba(248,113,113,0.12)",
  border: "1px solid rgba(248,113,113,0.25)",
  color: "#fecaca",
  fontWeight: 850,
};

const successStyle: React.CSSProperties = {
  ...noticeStyle,
  background: "rgba(34,197,94,0.12)",
  border: "1px solid rgba(34,197,94,0.25)",
  color: "#bbf7d0",
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

const checkboxStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
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
