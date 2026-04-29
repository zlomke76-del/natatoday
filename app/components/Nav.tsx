import Link from "next/link";

export default function Nav() {
  return (
    <nav className="nav">
      <Link href="/" className="brand" aria-label="NATA Today home">
        <span className="logo">N</span>
        <span>NATA Today</span>
      </Link>
      <div className="navlinks">
        <a href="/#system">System</a>
        <a href="/#outcomes">Outcomes</a>
        <Link href="/dealer-demo">Dealer Demo</Link>
        <Link href="/candidate-demo" className="btn btn-secondary">
          View Candidate
        </Link>
      </div>
    </nav>
  );
}
