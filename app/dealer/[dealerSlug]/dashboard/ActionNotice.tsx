"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type ActionNoticeProps = {
  show: boolean;
  title: string;
  copy: string;
};

export default function ActionNotice({ show, title, copy }: ActionNoticeProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [visible, setVisible] = useState(show);

  useEffect(() => {
    setVisible(show);

    if (!show) {
      return;
    }

    const hideTimer = window.setTimeout(() => {
      setVisible(false);
    }, 3200);

    const cleanTimer = window.setTimeout(() => {
      router.replace(pathname, { scroll: false });
    }, 3800);

    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(cleanTimer);
    };
  }, [show, pathname, router]);

  if (!visible) {
    return null;
  }

  return (
    <div
      style={{
        marginTop: 24,
        padding: 18,
        borderRadius: 22,
        background: "rgba(34,197,94,0.1)",
        border: "1px solid rgba(34,197,94,0.24)",
        color: "#d1fae5",
        display: "grid",
        gap: 6,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-6px)",
        transition: "opacity 220ms ease, transform 220ms ease",
      }}
      role="status"
      aria-live="polite"
    >
      <strong style={{ color: "#fff" }}>{title}</strong>
      <span>{copy}</span>
    </div>
  );
}
