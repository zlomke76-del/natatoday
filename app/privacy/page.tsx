import Nav from "../components/Nav";

export const metadata = {
  title: "Privacy Policy | NATA Today",
  description:
    "NATA Today privacy policy for candidate applications, hiring communications, and interview scheduling.",
};

export default function PrivacyPage() {
  return (
    <main className="shell">
      <Nav />

      <section style={pageStyle}>
        <div className="eyebrow">NATA Today Privacy Policy</div>

        <h1 style={titleStyle}>Privacy Policy</h1>

        <p style={ledeStyle}>
          NATA Today helps candidates apply for dealership roles and helps
          participating dealerships manage hiring requests, candidate review,
          interview scheduling, and interview handoff packets.
        </p>

        <div style={cardStyle}>
          <PolicySection title="Information we collect">
            <p>
              We may collect information you provide directly through NATA Today,
              including your name, email address, phone number, location or ZIP
              code, LinkedIn profile, resume, profile photo, work history,
              availability, compensation expectations, interview responses, and
              other information related to employment consideration.
            </p>
          </PolicySection>

          <PolicySection title="How we use information">
            <p>We use candidate and employer information to:</p>
            <ul style={listStyle}>
              <li>Review candidates for dealership roles.</li>
              <li>Match candidates to relevant openings.</li>
              <li>Schedule and confirm virtual or manager interviews.</li>
              <li>Send application, interview, and hiring-process updates.</li>
              <li>Prepare recruiter and manager interview packets.</li>
              <li>Improve hiring workflow quality and operational reliability.</li>
            </ul>
          </PolicySection>

          <PolicySection title="SMS and email communications">
            <p>
              By submitting your phone number or email address through NATA
              Today, you consent to receive communications related to your
              application, interview scheduling, interview reminders, and hiring
              process updates. Message and data rates may apply for SMS messages.
            </p>
            <p>
              You may opt out of SMS messages at any time by replying{" "}
              <strong>STOP</strong>. For help, reply <strong>HELP</strong> or
              contact us using the information below.
            </p>
          </PolicySection>

          <PolicySection title="How we share information">
            <p>
              NATA Today does not sell candidate personal information. Candidate
              information may be shared with participating dealerships only when
              the candidate is being considered for a relevant role or when an
              interview handoff packet is prepared for manager review.
            </p>
            <p>
              We may also share information with service providers that help us
              operate the platform, including hosting, database, email, SMS,
              scheduling, storage, and communication providers.
            </p>
          </PolicySection>

          <PolicySection title="Candidate photos and resumes">
            <p>
              Candidate resumes and optional profile photos are used for
              recruiter review, candidate matching, and manager interview
              packets. These materials are not used for unrelated marketing
              purposes.
            </p>
          </PolicySection>

          <PolicySection title="Data retention">
            <p>
              We may retain candidate information for ongoing employment
              matching, auditability, operational records, and hiring workflow
              continuity unless deletion is requested or retention is no longer
              necessary for the hiring process.
            </p>
          </PolicySection>

          <PolicySection title="Your choices">
            <p>
              You may request correction or deletion of your candidate
              information by contacting NATA Today. You may also opt out of SMS
              messages by replying <strong>STOP</strong>.
            </p>
          </PolicySection>

          <PolicySection title="Security">
            <p>
              We use reasonable administrative, technical, and operational
              safeguards to protect information submitted through the platform.
              No system can guarantee absolute security, but we work to protect
              candidate and employer data from unauthorized access and misuse.
            </p>
          </PolicySection>

          <PolicySection title="Children">
            <p>
              NATA Today is intended for employment-related use and is not
              directed to children under 13.
            </p>
          </PolicySection>

          <PolicySection title="Changes to this policy">
            <p>
              We may update this Privacy Policy as our services change. Updates
              will be posted on this page with the updated effective date.
            </p>
          </PolicySection>

          <PolicySection title="Contact">
            <p>
              Questions or requests may be sent to{" "}
              <a href="mailto:support@natatoday.ai" style={linkStyle}>
                support@natatoday.ai
              </a>
              .
            </p>
          </PolicySection>

          <p style={effectiveStyle}>Effective date: May 1, 2026</p>
        </div>
      </section>
    </main>
  );
}

function PolicySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={sectionStyle}>
      <h2 style={sectionTitleStyle}>{title}</h2>
      <div style={bodyStyle}>{children}</div>
    </section>
  );
}

const pageStyle: React.CSSProperties = {
  width: "min(980px, calc(100% - 40px))",
  margin: "0 auto",
  padding: "72px 0 96px",
};

const titleStyle: React.CSSProperties = {
  margin: "12px 0 0",
  fontSize: "clamp(44px, 7vw, 76px)",
  lineHeight: 0.95,
  letterSpacing: "-0.055em",
};

const ledeStyle: React.CSSProperties = {
  maxWidth: 760,
  color: "#cfe2ff",
  fontSize: 18,
  lineHeight: 1.65,
  marginTop: 20,
};

const cardStyle: React.CSSProperties = {
  marginTop: 34,
  borderRadius: 30,
  padding: 30,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
};

const sectionStyle: React.CSSProperties = {
  padding: "22px 0",
  borderBottom: "1px solid rgba(255,255,255,0.1)",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 24,
  letterSpacing: "-0.025em",
};

const bodyStyle: React.CSSProperties = {
  color: "#bfd6f5",
  lineHeight: 1.65,
  marginTop: 10,
};

const listStyle: React.CSSProperties = {
  margin: "10px 0 0",
  paddingLeft: 22,
};

const linkStyle: React.CSSProperties = {
  color: "#93c5fd",
  fontWeight: 900,
};

const effectiveStyle: React.CSSProperties = {
  margin: "24px 0 0",
  color: "#9fb4d6",
  fontSize: 13,
};
