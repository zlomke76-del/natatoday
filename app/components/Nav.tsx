import Image from "next/image";
import Link from "next/link";

export default function Nav() {
  return (
    <header className="nav">
      <div className="nav-inner">
        <Link href="/" className="brand">
          <Image
            src="/images/nata_logo_01.png"
            alt="NATA Today"
            width={120}
            height={40}
            priority
          />
          <span className="brand-text">NATA Today</span>
        </Link>

        <nav className="nav-links">
          <Link href="#system">System</Link>
          <Link href="#outcomes">Outcomes</Link>
          <Link href="/dealer-demo">Dealer Demo</Link>
          <Link className="btn btn-secondary" href="/candidate-demo">
            View Candidate
          </Link>
        </nav>
      </div>
    </header>
  );
}
