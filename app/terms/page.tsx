import Nav from "../components/Nav";

export const metadata = {
  title: "Terms of Service | NATA Today",
  description:
    "NATA Today terms for candidate applications, interview scheduling, and dealership hiring workflows.",
};

export default function TermsPage() {
  return (
    <main className="shell">
      <Nav />

      <section style={pageStyle}>
        <div className="eyebrow">NATA Today Terms</div>

        <h1 style={titleStyle}>Terms of Service</h1>

        <p style={ledeStyle}>
          These Terms govern use of NATA Today for dealership hiring requests,
          candidate applications, candidate review, interview scheduling, and
          hiring workflow support.
        </p>

        <div style={cardStyle}>
          <TermsSection title="Use of NATA Today">
            <p>
              NATA Today provides hiring workflow tools and services for
              dealership roles, including job publishing, candidate intake,
              candidate matching, recruiter review, interview scheduling,
              communication, and manager handoff packets.
            </p>
          </TermsSection>

          <TermsSection title="No guarantee of employment or placement">
            <p>
              Submitting an application, joining the candidate pool, scheduling
              an interview, or receiving communications from NATA Today does not
              guarantee employment, interview selection, placement, compensation,
              or any hiring outcome.
            </p>
          </TermsSection>

          <TermsSection title="Candidate responsibilities">
            <p>
              Candidates are responsible for providing accurate, current, and
              truthful information, including contact information, resume
              details, availability, location, work history, and any other
              information submitted through the platform.
            </p>
          </TermsSection>

          <TermsSection title="Consent to communications">
            <p>
              By submitting your phone number or email address through NATA
              Today, you consent to receive application-related and
              interview-related communications by SMS and email. These messages
              may include application updates, interview scheduling links,
              interview confirmations, interview reminders, and hiring process
              notifications.
            </p>
            <p>
              Message and data rates may apply. You may opt out of SMS messages
              by replying <strong>STOP</strong>. For help, reply{" "}
              <strong>HELP</strong> or contact{" "}
              <a href="mailto:support@natatoday.ai" style={linkStyle}>
                support@natatoday.ai
              </a>
              .
            </p>
          </TermsSection>

          <TermsSection title="Dealer and employer decisions">
            <p>
              Participating dealerships and employers remain responsible for
              their hiring decisions. NATA Today may provide candidate
              organization, screening support, matching, interview packets, and
              workflow tools, but final employment decisions belong to the
              participating employer.
            </p>
          </TermsSection>

          <TermsSection title="Candidate pool and future matching">
            <p>
              Candidates may be considered for current or future roles based on
              submitted information, location, resume details, role fit, and
              hiring needs. NATA Today may retain candidate information for
              future matching unless deletion is requested or the candidate is no
              longer eligible for consideration.
            </p>
          </TermsSection>

          <TermsSection title="Platform communications">
            <p>
              Communications sent by NATA Today are intended for transactional
              hiring workflow purposes, including application and interview
              updates. NATA Today does not permit use of the platform for
              unlawful, misleading, harassing, or unsolicited messaging.
            </p>
          </TermsSection>

          <TermsSection title="Acceptable use">
            <p>You agree not to:</p>
            <ul style={listStyle}>
              <li>Submit false or misleading candidate information.</li>
              <li>Use the platform for unlawful or discriminatory purposes.</li>
              <li>Attempt to access information you are not authorized to view.</li>
              <li>Interfere with the platform’s operation or security.</li>
            </ul>
          </TermsSection>

          <TermsSection title="Privacy">
            <p>
              Use of NATA Today is also governed by our{" "}
              <a href="/privacy" style={linkStyle}>
                Privacy Policy
              </a>
              , which explains how candidate and employer information is
              collected, used, retained, and shared.
            </p>
          </TermsSection>

          <TermsSection title="Service availability">
            <p>
              NATA Today may update, modify, suspend, or discontinue parts of
              the service at any time. We are not responsible for delays,
              interruptions, third-party service failures, or delivery failures
              caused by incorrect contact information, carrier filtering, email
              bounce, or other external systems.
            </p>
          </TermsSection>

          <TermsSection title="Limitation of liability">
            <p>
              To the fullest extent permitted by law, NATA Today is not liable
              for indirect, incidental, consequential, special, or punitive
              damages arising from use of the platform or hiring outcomes.
            </p>
          </TermsSection>

          <TermsSection title="Changes to these terms">
            <p>
              We may update these Terms as the platform evolves. Updates will be
              posted on this page with the updated effective date.
            </p>
          </TermsSection>

          <TermsSection title="Contact">
            <p>
              Questions about these Terms may be sent to{" "}
              <a href="mailto:support@natatoday.ai" style={linkStyle}>
                support@natatoday.ai
              </a>
              .
            </p>
          </TermsSection>

          <p style={effectiveStyle}>Effective date: May 1, 2026</p>
        </div>
      </section>
    </main>
  );
}

function TermsSection({
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
