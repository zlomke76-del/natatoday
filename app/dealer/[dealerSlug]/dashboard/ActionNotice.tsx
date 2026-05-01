"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function ActionNotice({
  title,
  copy,
}: {
  title: string;
  copy: string;
}) {
  const [visible, setVisible] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(false);
      router.replace(pathname, { scroll: false });
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [pathname, router]);

  if (!visible) return null;

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
      }}
    >
      <strong style={{ color: "#fff" }}>{title}</strong>
      <span>{copy}</span>
    </div>
  );
}
