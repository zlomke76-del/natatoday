import Link from "next/link";
import Nav from "../../components/Nav";

export default function CareersThankYouPage() {
  return (
    <main className="shell">
      <Nav />
      <section style={{ width: "min(860px, calc(100% - 40px))", margin: "0 auto", padding: "90px 0" }}>
        <div className="eyebrow">Candidate Pool</div>
        <h1>You’re in the pool.</h1>
        <p style={{ color: "#cfe2ff", fontSize: 18, lineHeight: 1.6 }}>
          Your profile has been received. NATA Today will review your resume against future dealership opportunities within your area.
        </p>
        <Link href="/careers" className="btn btn-primary">
          Back to careers
        </Link>
      </section>
    </main>
  );
}
