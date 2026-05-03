"use client";

import { useEffect, useRef } from "react";
import { playSound } from "../../../../lib/soundEngine";

type Props = {
  inboxCount: number;
  sentCount: number;
};

export default function NataSoundStateBridge({ inboxCount, sentCount }: Props) {
  const prev = useRef({
    inbox: inboxCount,
    sent: sentCount,
  });

  useEffect(() => {
    const prevInbox = prev.current.inbox;
    const prevSent = prev.current.sent;

    // 📩 NEW MESSAGE RECEIVED
    if (inboxCount > prevInbox) {
      playSound("message_received");
    }

    // 📤 MESSAGE SENT
    if (sentCount > prevSent) {
      playSound("message_sent");
    }

    prev.current = {
      inbox: inboxCount,
      sent: sentCount,
    };
  }, [inboxCount, sentCount]);

  return null;
}
