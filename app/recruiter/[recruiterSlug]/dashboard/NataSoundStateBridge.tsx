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
  const prev = useRef<Props | null>(null);

  useEffect(() => {
    if (!prev.current) {
      prev.current = props;
      return;
    }

    const previous = prev.current;

    if (props.candidateQueue > previous.candidateQueue) {
      playSound("candidate_new");
    }

    if (props.interviewQueue > previous.interviewQueue) {
      playSound("interview_scheduled");
    }

    if (props.waitingOnCandidate > previous.waitingOnCandidate) {
      playSound("interview_reminder");
    }

    if (props.reviewRequired > previous.reviewRequired) {
      playSound("dealer_action_required");
    }

    if (props.dealerScheduled > previous.dealerScheduled) {
      playSound("candidate_ready");
    }

    if (props.blocked > previous.blocked) {
      playSound("candidate_not_fit");
    }

    prev.current = props;
  }, [props]);

  return null;
}
