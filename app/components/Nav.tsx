import Image from "next/image";
import Link from "next/link";

export default function Nav() {
  return (
    <header className="nav">
      <div className="nav-inner">
        <Link href="/" className="brand" aria-label="NATA Today home">
          <span className="brand-logo-wrap" aria-hidden="true">
            <Image
              src="/images/nata_logo_01.png"
              alt=""
              width={132}
              height={54}
              priority
              className="brand-logo"
            />
          </span>
          <span className="brand-text">NATA Today</span>
        </Link>

        <nav className="nav-links" aria-label="Primary navigation">
          <Link href="/#system">System</Link>
          <Link href="/#outcomes">Outcomes</Link>
          <Link href="/dealer-demo">Dealer Demo</Link>
          <Link className="nav-cta" href="/candidate-demo">
            View Candidate
          </Link>
        </nav>
      </div>
    </header>
  );
}
