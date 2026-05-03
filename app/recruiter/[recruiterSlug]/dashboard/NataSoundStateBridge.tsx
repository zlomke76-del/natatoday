"use client";

import { useEffect, useRef } from "react";
import { playSound } from "../../../../lib/soundEngine";

type Props = {
  candidateQueue: number;
  interviewQueue: number;
  waitingOnCandidate: number;
  reviewRequired: number;
  dealerScheduled: number;
  blocked: number;
};

export default function NataSystemSoundBridge(props: Props) {
  const prev = useRef(props);

  useEffect(() => {
    const p = prev.current;

    // 🟢 NEW CANDIDATE NEEDS ACTION
    if (props.candidateQueue > p.candidateQueue) {
      playSound("candidate_new");
    }

    // 🔵 INTERVIEW SCHEDULED / READY
    if (props.interviewQueue > p.interviewQueue) {
      playSound("interview_scheduled");
    }

    // ⏳ WAITING ON CANDIDATE
    if (props.waitingOnCandidate > p.waitingOnCandidate) {
      playSound("interview_reminder");
    }

    // 🟡 REVIEW REQUIRED
    if (props.reviewRequired > p.reviewRequired) {
      playSound("dealer_action_required");
    }

    // 🟢 READY FOR DEALER
    if (props.dealerScheduled > p.dealerScheduled) {
      playSound("candidate_ready");
    }

    // 🔴 BLOCKED / PASSED
    if (props.blocked > p.blocked) {
      playSound("candidate_not_fit");
    }

    prev.current = props;
  }, [props]);

  return null;
}
