"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export default function Nav() {
  const [open, setOpen] = useState(false);

  const closeMenu = () => setOpen(false);

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link href="/" className="brand" aria-label="NATA Today home" onClick={closeMenu}>
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

        <button
          className="nav-menu-button"
          type="button"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={open}
          aria-controls="primary-navigation"
          onClick={() => setOpen((current) => !current)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav
          id="primary-navigation"
          className={open ? "nav-links nav-links-open" : "nav-links"}
          aria-label="Primary navigation"
        >
          <Link href="/#system" onClick={closeMenu}>
            System
          </Link>
          <Link href="/#outcomes" onClick={closeMenu}>
            Outcomes
          </Link>
          <Link href="/dealer-demo" onClick={closeMenu}>
            Dealer Demo
          </Link>
          <Link href="/careers" onClick={closeMenu}>
            Careers
          </Link>
          <Link className="nav-cta" href="/candidate-demo" onClick={closeMenu}>
            View Candidate
          </Link>
        </nav>
      </div>
    </header>
  );
}
