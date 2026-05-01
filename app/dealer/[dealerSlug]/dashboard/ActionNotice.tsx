"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

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
    const timer = setTimeout(() => {
      setVisible(false);

      // clean URL (removes ?request=... etc)
      router.replace(pathname);
    }, 3000);

    return () => clearTimeout(timer);
  }, [router, pathname]);

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
        transition: "opacity 0.3s ease",
      }}
    >
      <strong style={{ color: "#fff" }}>{title}</strong>
      <span>{copy}</span>
    </div>
  );
}
