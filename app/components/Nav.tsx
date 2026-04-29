import Link from "next/link";

export default function Nav() {
  return (
    <nav className="nav">
      <Link className="brand" href="/">
        <span className="logo">N</span>
        <span>NATA Today</span>
      </Link>
      <div className="navlinks">
        <Link href="/#system">System</Link>
        <Link href="/#outcomes">Outcomes</Link>
        <Link href="/dealer-demo">Dealer Demo</Link>
        <Link className="btn btn-primary" href="/candidate-demo">View Candidate</Link>
      </div>
    </nav>
  );
}
