import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

const MATCH_THRESHOLD = 70;
const OUTREACH_COOLDOWN_DAYS = 7;
const MIN_DISTRIBUTION_SCORE = 85;

const NOT_ELIGIBLE_STATUSES = [
  "hired",
  "placed",
  "withdrawn",
  "do_not_contact",
  "disqualified",
];

const APPLY_PROCESS_NOTE =
  "Apply directly through NATA Today. Applications are reviewed before dealership handoff so qualified candidates move forward with context.";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function clean(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function expandCompensationNumber(value: string) {
  const cleaned = value.toLowerCase().replace(/[$,\s]/g, "").trim();
  if (!cleaned) return 0;

  const isK = cleaned.endsWith("k");
  const numeric = Number(cleaned.replace(/k$/, ""));

  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.round(isK ? numeric * 1000 : numeric);
}

function normalizeSalary(input: string) {
  if (!input) return "";

  const raw = input
    .trim()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ");

  const lower = raw.toLowerCase();
  const compact = lower.replace(/\s+/g, "");

  const hasHourlySignal =
    /\b(hr|hour|hourly)\b/.test(lower) || /\/\s*h(r|our)?\b/.test(lower);
  const hasYearlySignal =
    /\b(yr|year|annual|annually|salary)\b/.test(lower) ||
    /\/\s*y(r|ear)?\b/.test(lower);

  const hourlyRange = compact.match(
    /^\$?(\d+(?:\.\d+)?)\s*-\s*\$?(\d+(?:\.\d+)?)(?:\/)?(?:hr|hour|hourly)$/
  );
  if (hourlyRange) {
    return `${normalizeMoney(Number(hourlyRange[1]))} - ${normalizeMoney(
      Number(hourlyRange[2])
    )} per hour`;
  }

  const hourlySingle = compact.match(
    /^\$?(\d+(?:\.\d+)?)(?:\/)?(?:hr|hour|hourly)$/
  );
  if (hourlySingle) {
    return `${normalizeMoney(Number(hourlySingle[1]))} per hour`;
  }

  const yearlyRangeK = compact.match(
    /^\$?(\d+(?:\.\d+)?)k\s*-\s*\$?(\d+(?:\.\d+)?)k(?:\/)?(?:yr|year|annual|annually)?$/
  );
  if (yearlyRangeK) {
    return `${normalizeMoney(Number(yearlyRangeK[1]) * 1000)} - ${normalizeMoney(
      Number(yearlyRangeK[2]) * 1000
    )} per year`;
  }

  const yearlySingleK = compact.match(
    /^\$?(\d+(?:\.\d+)?)k(?:\/)?(?:yr|year|annual|annually)?$/
  );
  if (yearlySingleK) {
    return `${normalizeMoney(Number(yearlySingleK[1]) * 1000)} per year`;
  }

  const rawRange = raw.match(/^\$?([\d,]+(?:\.\d+)?)\s*-\s*\$?([\d,]+(?:\.\d+)?)(.*)$/i);
  if (rawRange) {
    const first = Number(rawRange[1].replace(/,/g, ""));
    const second = Number(rawRange[2].replace(/,/g, ""));
    const suffix = rawRange[3]?.toLowerCase() || "";

    if (Number.isFinite(first) && Number.isFinite(second)) {
      if (hasHourlySignal || suffix.includes("hr") || suffix.includes("hour")) {
        return `${normalizeMoney(first)} - ${normalizeMoney(second)} per hour`;
      }

      if (hasYearlySignal || first >= 1000 || second >= 1000) {
        return `${normalizeMoney(first)} - ${normalizeMoney(second)} per year`;
      }
    }
  }

  const rawSingle = raw.match(/^\$?([\d,]+(?:\.\d+)?)(.*)$/i);
  if (rawSingle) {
    const amount = Number(rawSingle[1].replace(/,/g, ""));
    const suffix = rawSingle[2]?.toLowerCase() || "";

    if (Number.isFinite(amount)) {
      if (hasHourlySignal || suffix.includes("hr") || suffix.includes("hour")) {
        return `${normalizeMoney(amount)} per hour`;
      }

      if (hasYearlySignal || amount >= 1000) {
        return `${normalizeMoney(amount)} per year`;
      }
    }
  }

  const fallbackRange = lower.match(/(\d+(?:\.\d+)?k?)\s*-\s*(\d+(?:\.\d+)?k?)/i);
  if (fallbackRange) {
    const low = expandCompensationNumber(fallbackRange[1]);
    const high = expandCompensationNumber(fallbackRange[2]);

    if (low && high) {
      if (low < 1000 && high < 1000) {
        return `${normalizeMoney(low)} - ${normalizeMoney(high)} per hour`;
      }

      return `${normalizeMoney(low)} - ${normalizeMoney(high)} per year`;
    }
  }

  const fallbackSingle = lower.match(/(\d+(?:\.\d+)?k?)/i);
  if (fallbackSingle) {
    const amount = expandCompensationNumber(fallbackSingle[1]);

    if (amount) {
      if (amount < 1000) return `${normalizeMoney(amount)} per hour`;
      return `${normalizeMoney(amount)} per year`;
    }
  }

  return raw
    .replace(/\$?([0-9]+(?:\.[0-9]+)?)\s*\/\s*hr\b/gi, "$$$1 per hour")
    .replace(/\bhr\b/gi, "hour")
    .replace(/\s*\/\s*hour\b/gi, " per hour")
    .replace(/\s*\/\s*yr\b/gi, " per year")
    .replace(/\s*\/\s*year\b/gi, " per year")
    .replace(/\byr\b/gi, "year")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeSentence(value: string) {
  return stripHtml(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanGeneratedText(value: string) {
  return value
    .replace(/\bApply through Solace\./gi, "Apply directly through NATA Today.")
    .replace(/\s*\/\s*hour\b/gi, " per hour")
    .replace(/\s*\/\s*year\b/gi, " per year")
    .replace(/\b20\/hr\b/gi, "$20 per hour")
    .replace(/Compensation is structured within\s+/gi, "Compensation is ")
    .replace(/depending on experience, consistency, and fit/gi, "depending on experience and fit")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeJob(job: any) {
  const isConfidential = job.publish_mode === "confidential";

  return {
    ...job,
    display_dealer: isConfidential
      ? "Confidential Dealership"
      : job.public_dealer_name || "Jersey Village Chrysler Jeep Dodge Ram",
    display_location: isConfidential
      ? job.public_location || "Houston, TX Market"
      : job.public_location || job.location,
    is_confidential: isConfidential,
  };
}

type JobContentInput = {
  title: string;
  dealerName: string;
  location: string;
  salary: string;
  notes: string;
  publishMode: string;
  priority: string;
};

function compensationLine(salary: string) {
  return salary
    ? `Compensation is ${salary}, depending on experience and fit.`
    : "Compensation details will be discussed with qualified candidates during the review process.";
}

function urgencyLine(priority: string) {
  return priority.toLowerCase().includes("urgent") ||
    priority.toLowerCase().includes("immediate")
    ? "This role is actively being filled. Qualified candidates are reviewed quickly."
    : "Qualified candidates are reviewed before dealership handoff so the first conversation starts with useful context.";
}

function optionalNoteLine(notes: string) {
  return notes ? ` The dealership also noted: ${notes}` : "";
}

function buildJobContent(input: JobContentInput) {
  const title = input.title;
  const dealer =
    input.publishMode === "confidential"
      ? "A dealership in the market"
      : input.dealerName;
  const location = input.location || "the local market";
  const salary = normalizeSalary(input.salary);
  const notes = cleanGeneratedText(input.notes);
  const priority = input.priority;
  const lower = title.toLowerCase();
  const pay = compensationLine(salary);
  const urgency = urgencyLine(priority);
  const noteLine = optionalNoteLine(notes);

  const process_note = APPLY_PROCESS_NOTE;

  if (lower.includes("technician")) {
    return {
      description: `${dealer} is hiring an experienced ${title} for a busy service department in ${location}. This role is built for someone who takes pride in accurate diagnostics, steady workflow, and quality repairs. ${pay} ${urgency}${noteLine}`,
      requirements:
        "ASE or OEM certification preferred. Strong diagnostic ability, dealership experience, consistent availability, and clear communication are strong advantages.",
      role_hook: `${dealer} needs a ${title} who can help keep vehicles moving through the shop with quality, consistency, and clear communication.`,
      responsibilities: [
        "Diagnose and repair customer vehicles",
        "Perform maintenance, inspections, and service repairs",
        "Communicate findings clearly with advisors and the service team",
        "Support a steady workflow with quality and consistency",
      ],
      fit_signals: [
        "ASE or OEM certification preferred",
        "Diagnostic ability and dealership experience are strong advantages",
        "Consistent availability and good communication",
        "Truck, SUV, CDJR, or high-volume service experience helpful",
      ],
      process_note,
    };
  }

  if (lower.includes("advisor")) {
    return {
      description: `${dealer} is hiring a ${title} for a busy service lane in ${location}. This role is built for someone who can manage volume, communicate clearly, and help customers move through the repair process with confidence. ${pay} ${urgency}${noteLine}`,
      requirements:
        "Service lane experience preferred. Strong customer communication, follow-up discipline, and dealership process familiarity are important.",
      role_hook: `${dealer} needs a ${title} who can bring organization, communication, and follow-through to a fast-moving service lane.`,
      responsibilities: [
        "Greet service customers and understand repair or maintenance needs",
        "Communicate clearly between customers, technicians, and management",
        "Help protect follow-up, CSI, and service lane organization",
        "Support a fast-moving service department",
      ],
      fit_signals: [
        "Service advisor or customer-facing automotive experience preferred",
        "Strong communication and follow-up discipline",
        "Comfort working with volume and multiple priorities",
        "Dealership process or DMS familiarity helpful",
      ],
      process_note,
    };
  }

  if (lower.includes("sales")) {
    return {
      description: `${dealer} is hiring a ${title} for a real dealership sales floor in ${location}. This role is built for someone who can create customer confidence, follow up consistently, and turn conversations into opportunities. ${pay} ${urgency}${noteLine}`,
      requirements:
        "Automotive sales experience preferred but not required. Strong communication, availability, consistency, and customer follow-up are important.",
      role_hook: `${dealer} is looking for a ${title} who can help customers move confidently through the buying process.`,
      responsibilities: [
        "Work with customers through the vehicle shopping and sales process",
        "Follow up consistently with leads, appointments, and opportunities",
        "Build product confidence around new and used inventory",
        "Operate within a structured dealership sales workflow",
      ],
      fit_signals: [
        "Automotive sales experience preferred but not required",
        "Strong communication and customer follow-up",
        "Availability and consistency matter",
        "Truck, SUV, retail, or dealership sales experience helpful",
      ],
      process_note,
    };
  }

  if (lower.includes("bdc")) {
    return {
      description: `${dealer} is hiring a ${title} for customer follow-up, appointment setting, and lead communication in ${location}. This role is built for someone who can keep opportunities moving and maintain consistent contact with customers. ${pay} ${urgency}${noteLine}`,
      requirements:
        "Strong phone skills, follow-up discipline, schedule consistency, and customer communication experience are important.",
      role_hook: `${dealer} needs a ${title} who can keep opportunities moving, communicate clearly, and help turn customer interest into scheduled conversations.`,
      responsibilities: [
        "Respond to customer inquiries and follow-up opportunities",
        "Set appointments and support communication between customers and the store",
        "Maintain consistent follow-up and accurate notes",
        "Help keep the dealership pipeline organized and moving",
      ],
      fit_signals: [
        "Strong phone and written communication",
        "Appointment-setting or customer service experience helpful",
        "Consistency and follow-up discipline",
        "Automotive or dealership experience helpful but not required",
      ],
      process_note,
    };
  }

  if (lower.includes("parts")) {
    return {
      description: `${dealer} is hiring a ${title} to support parts counter activity, internal service needs, and customer requests in ${location}. This role is built for someone who values accuracy, organization, and follow-through. ${pay} ${urgency}${noteLine}`,
      requirements:
        "Parts counter experience, dealership familiarity, organization, communication, and follow-through are strong advantages.",
      role_hook: `${dealer} needs a ${title} who can support technicians, customers, and internal workflow with accuracy and consistency.`,
      responsibilities: [
        "Support parts counter and internal service department needs",
        "Help identify, locate, and organize parts requests",
        "Communicate clearly with service, technicians, and customers",
        "Maintain accurate workflow and follow-through",
      ],
      fit_signals: [
        "Parts counter or dealership parts experience preferred",
        "Strong organization and attention to detail",
        "Comfort supporting technicians and service workflow",
        "Consistent availability and communication",
      ],
      process_note,
    };
  }

  if (lower.includes("finance") || lower.includes("f&i")) {
    return {
      description: `${dealer} is hiring a ${title} to support a structured dealership finance workflow in ${location}. This role is built for someone who can communicate clearly, maintain compliance discipline, and help customers complete the purchase process with confidence. ${pay} ${urgency}${noteLine}`,
      requirements:
        "Automotive finance, F&I, sales management, or dealership sales experience preferred. Strong communication and process discipline are important.",
      role_hook: `${dealer} needs a ${title} who can support the sales desk, finance process, and customer experience with accuracy and professionalism.`,
      responsibilities: [
        "Support customers through finance and purchase documentation steps",
        "Communicate clearly with sales managers, lenders, and customers",
        "Maintain process discipline and accurate deal flow",
        "Help protect customer experience and dealership workflow",
      ],
      fit_signals: [
        "Automotive finance or dealership sales experience preferred",
        "Strong communication and process discipline",
        "Comfort with documentation and follow-through",
        "Customer-facing professionalism and consistency",
      ],
      process_note,
    };
  }

  return {
    description: `${dealer} is hiring for a ${title} role in ${location}. This position is part of an active dealership hiring request managed through NATA Today. ${pay} ${urgency}${noteLine}`,
    requirements:
      "Relevant experience, strong communication, consistent availability, and dealership or customer-facing experience are helpful.",
    role_hook: `${dealer} is looking for a ${title} who can step into a real operating environment and contribute with consistency, communication, and follow-through.`,
    responsibilities: [
      "Support day-to-day dealership operations within the role",
      "Communicate clearly with customers, managers, and team members",
      "Follow process and maintain consistent availability",
      "Contribute to a professional, performance-driven environment",
    ],
    fit_signals: [
      "Relevant experience preferred",
      "Strong communication and reliability",
      "Comfort working in a fast-moving dealership environment",
      "Consistent availability and follow-through",
    ],
    process_note,
  };
}

function hasMeaningfulArray(value: unknown) {
  return Array.isArray(value) && value.filter((item) => clean(item)).length >= 3;
}

function calculateDistributionQuality(job: {
  title: string;
  salary: string;
  location: string;
  description: string;
  requirements: string;
  role_hook: string;
  responsibilities: string[];
  fit_signals: string[];
  process_note: string;
  publish_mode: string;
  publish_status: string;
  public_dealer_name: string | null;
}) {
  const issues: string[] = [];
  let score = 100;

  const descriptionText = normalizeSentence(job.description);
  const roleHookText = normalizeSentence(job.role_hook);
  const processText = normalizeSentence(job.process_note);

  if (!job.title) {
    score -= 20;
    issues.push("Missing title");
  }

  if (!job.location) {
    score -= 15;
    issues.push("Missing location");
  }

  if (!job.salary) {
    score -= 12;
    issues.push("Missing compensation range");
  }

  if (/\b(hr|yr)\b|\/\s*(hour|year|hr|yr)/i.test(job.salary)) {
    score -= 10;
    issues.push("Compensation uses shorthand or slash formatting");
  }

  if (!job.description || stripHtml(job.description).length < 180) {
    score -= 15;
    issues.push("Description is too short");
  }

  if (roleHookText && descriptionText && descriptionText === roleHookText) {
    score -= 10;
    issues.push("Role hook duplicates description");
  }

  if (!hasMeaningfulArray(job.responsibilities)) {
    score -= 10;
    issues.push("Responsibilities need at least three useful items");
  }

  if (!hasMeaningfulArray(job.fit_signals)) {
    score -= 10;
    issues.push("Fit signals need at least three useful items");
  }

  if (!processText.includes("nata today")) {
    score -= 8;
    issues.push("Process note must clearly direct candidates through NATA Today");
  }

  if (job.publish_mode === "public" && !job.public_dealer_name) {
    score -= 8;
    issues.push("Public posting needs a public dealer name");
  }

  if (job.publish_mode !== "public") {
    score -= 50;
    issues.push("Confidential roles are not distributed externally");
  }

  if (job.publish_status !== "published") {
    score -= 50;
    issues.push("Only published jobs can be distributed");
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    approved: score >= MIN_DISTRIBUTION_SCORE && issues.length === 0,
  };
}

function tokenize(value: unknown) {
  if (typeof value !== "string") return [] as string[];

  return Array.from(
    new Set(
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((token) => token.length >= 4)
        .filter(
          (token) =>
            ![
              "this",
              "that",
              "with",
              "from",
              "role",
              "candidate",
              "dealership",
              "experience",
              "review",
            ].includes(token)
        )
    )
  );
}

function scoreOverlap(candidateText: string, jobText: string) {
  const candidateTokens = tokenize(candidateText);
  const jobTokens = tokenize(jobText);

  if (!candidateTokens.length || !jobTokens.length) return 0;

  const candidateSet = new Set(candidateTokens);
  const overlap = jobTokens.filter((token) => candidateSet.has(token));

  return Math.min(30, Math.round((overlap.length / Math.max(jobTokens.length, 1)) * 60));
}

function calculateCandidateMatch(application: any, job: any) {
  const jobTitle = clean(job.title).toLowerCase();
  const priorRole = clean(application.role || application.applied_role || application.job_title).toLowerCase();
  const priorStatus = clean(application.screening_status || application.status).toLowerCase();
  const priorFitScore = Number(application.fit_score || 0);

  const candidateText = [
    application.screening_summary,
    application.decision_reason,
    application.cover_note,
    application.notes,
    application.resume_text,
    application.resume_summary,
  ]
    .filter(Boolean)
    .join(" ");

  const jobText = [
    job.title,
    job.description,
    job.requirements,
    job.role_hook,
    Array.isArray(job.responsibilities) ? job.responsibilities.join(" ") : "",
    Array.isArray(job.fit_signals) ? job.fit_signals.join(" ") : "",
  ]
    .filter(Boolean)
    .join(" ");

  let score = 35;

  if (priorFitScore > 0) score += Math.min(25, Math.round(priorFitScore * 0.25));
  if (priorRole && jobTitle && (jobTitle.includes(priorRole) || priorRole.includes(jobTitle))) score += 20;
  if (priorStatus.includes("virtual") || priorStatus.includes("dealer") || priorStatus.includes("review")) score += 8;
  if (priorStatus.includes("keep_warm") || priorStatus.includes("needs_followup")) score += 8;

  score += scoreOverlap(candidateText, jobText);
  score = Math.max(0, Math.min(100, score));

  const reasons = [];
  if (priorFitScore) reasons.push(`Prior fit score: ${priorFitScore}`);
  if (priorRole && jobTitle && (jobTitle.includes(priorRole) || priorRole.includes(jobTitle))) {
    reasons.push("Prior role context is similar to this opening");
  }
  if (candidateText) reasons.push("Existing candidate notes/resume context overlap with this role");
  if (priorStatus) reasons.push(`Current pool status: ${priorStatus}`);

  return {
    match_score: score,
    match_reason:
      reasons.join(". ") ||
      "Candidate remains eligible in the talent pool and may be relevant for this newly opened role.",
    recommended_next_step:
      score >= 85
        ? "Review immediately and consider direct virtual interview scheduling."
        : "Review prior notes before approving targeted re-engagement.",
  };
}

function getCandidateName(application: any) {
  return clean(
    application.candidate_name ||
      application.name ||
      application.full_name ||
      application.applicant_name,
    "Candidate"
  );
}

function getCandidateEmail(application: any) {
  return clean(application.candidate_email || application.email || application.applicant_email);
}

function buildOutreachMessage(
  application: any,
  job: any,
  match: ReturnType<typeof calculateCandidateMatch>
) {
  const candidateName = getCandidateName(application);
  const jobTitle = clean(job.title, "new opportunity");

  return {
    message_subject: "A new role may be a stronger fit",
    message_body: `Hi ${candidateName},\n\nWe reviewed your profile again while preparing a new ${jobTitle} opportunity.\n\nBased on your background and prior notes, this role may be a stronger fit than the position you previously considered.\n\nIf you're still open to opportunities, our team can move you forward without asking you to restart the full process.\n\nNext step: ${match.recommended_next_step}\n\n– NATA Recruiting Team`,
  };
}

async function createCandidateOutreachForJob(job: any) {
  const since = new Date(
    Date.now() - OUTREACH_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: applications, error: applicationsError } = await supabaseAdmin
    .schema("nata")
    .from("applications")
    .select(
      "id,name,full_name,candidate_name,email,candidate_email,applicant_email,phone,role,applied_role,job_title,screening_status,status,screening_summary,fit_score,decision_reason,cover_note,notes,resume_text,resume_summary,resume_url,created_at"
    )
    .not("screening_status", "in", `(${NOT_ELIGIBLE_STATUSES.join(",")})`)
    .order("created_at", { ascending: false })
    .limit(250);

  if (applicationsError) {
    console.error("Candidate outreach scan failed:", applicationsError.message);
    return { created: 0, skipped: 0, error: applicationsError.message };
  }

  const outreachRows: any[] = [];
  let skipped = 0;

  for (const application of applications || []) {
    const candidateEmail = getCandidateEmail(application);
    if (!candidateEmail) {
      skipped += 1;
      continue;
    }

    const status = clean(application.screening_status || application.status).toLowerCase();
    if (NOT_ELIGIBLE_STATUSES.includes(status)) {
      skipped += 1;
      continue;
    }

    const { data: recentOutreach, error: recentError } = await supabaseAdmin
      .schema("nata")
      .from("candidate_outreach")
      .select("id")
      .eq("candidate_email", candidateEmail)
      .gte("created_at", since)
      .limit(1);

    if (recentError) {
      console.error("Candidate outreach cooldown check failed:", recentError.message);
      skipped += 1;
      continue;
    }

    if (recentOutreach && recentOutreach.length > 0) {
      skipped += 1;
      continue;
    }

    const match = calculateCandidateMatch(application, job);
    if (match.match_score < MATCH_THRESHOLD) {
      skipped += 1;
      continue;
    }

    const message = buildOutreachMessage(application, job, match);

    outreachRows.push({
      application_id: application.id,
      candidate_email: candidateEmail,
      candidate_name: getCandidateName(application),
      job_id: job.id,
      match_score: match.match_score,
      match_reason: match.match_reason,
      recommended_next_step: match.recommended_next_step,
      outreach_status: "pending",
      message_subject: message.message_subject,
      message_body: message.message_body,
    });
  }

  if (!outreachRows.length) {
    return { created: 0, skipped, error: null };
  }

  const { error: insertError } = await supabaseAdmin
    .schema("nata")
    .from("candidate_outreach")
    .insert(outreachRows);

  if (insertError) {
    console.error("Candidate outreach insert failed:", insertError.message);
    return { created: 0, skipped, error: insertError.message };
  }

  return { created: outreachRows.length, skipped, error: null };
}


async function triggerMatchRunner(origin: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || origin;
  const secret = process.env.NATA_MATCH_RUNNER_SECRET;

  try {
    const response = await fetch(`${appUrl}/api/nata/run-matching`, {
      method: "POST",
      headers: secret ? { Authorization: `Bearer ${secret}` } : undefined,
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("Match runner trigger failed:", detail);
      return { triggered: false, error: detail };
    }

    return { triggered: true, result: await response.json() };
  } catch (error) {
    console.error("Match runner trigger error:", error);
    return {
      triggered: false,
      error: error instanceof Error ? error.message : "Match runner trigger failed",
    };
  }
}


function numberParam(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
}

function normalizedSearchText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getRoleCategory(job: any) {
  const text = normalizedSearchText(`${job.title || ""} ${job.description || ""}`);

  if (text.includes("technician") || text.includes("mechanic") || text.includes("diagnostic")) return "technician";
  if (text.includes("service advisor") || text.includes("service writer")) return "service-advisor";
  if (text.includes("sales")) return "sales";
  if (text.includes("bdc") || text.includes("business development")) return "bdc";
  if (text.includes("parts")) return "parts";
  if (text.includes("finance") || text.includes("f&i")) return "finance";

  return "other";
}

function matchesJobFilters(job: any, filters: {
  q: string;
  location: string;
  role: string;
  type: string;
  publishMode: string;
}) {
  const normalizedJob = normalizeJob(job);
  const searchText = normalizedSearchText([
    job.title,
    job.description,
    job.requirements,
    job.role_hook,
    Array.isArray(job.responsibilities) ? job.responsibilities.join(" ") : "",
    Array.isArray(job.fit_signals) ? job.fit_signals.join(" ") : "",
    job.location,
    job.public_location,
    job.public_dealer_name,
    job.dealer_slug,
    job.type,
    job.salary,
  ].filter(Boolean).join(" "));

  if (filters.q && !searchText.includes(normalizedSearchText(filters.q))) {
    return false;
  }

  if (filters.location) {
    const locationText = normalizedSearchText([
      job.location,
      job.public_location,
      normalizedJob.display_location,
      job.dealer_slug,
      job.public_dealer_name,
    ].filter(Boolean).join(" "));

    if (!locationText.includes(normalizedSearchText(filters.location))) {
      return false;
    }
  }

  if (filters.role && filters.role !== "all" && getRoleCategory(job) !== filters.role) {
    return false;
  }

  if (filters.type && filters.type !== "all") {
    const typeText = normalizedSearchText(job.type || "");
    if (!typeText.includes(normalizedSearchText(filters.type))) {
      return false;
    }
  }

  if (filters.publishMode && filters.publishMode !== "all") {
    const isConfidential = job.publish_mode === "confidential";
    if (filters.publishMode === "confidential" && !isConfidential) return false;
    if (filters.publishMode === "public" && isConfidential) return false;
  }

  return true;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  if (slug) {
    const { data, error } = await supabaseAdmin
      .schema("nata")
      .from("jobs")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .eq("publish_status", "published")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({ job: normalizeJob(data) });
  }

  const q = clean(searchParams.get("q"));
  const location = clean(searchParams.get("location"));
  const role = clean(searchParams.get("role"), "all");
  const type = clean(searchParams.get("type"), "all");
  const publishMode = clean(searchParams.get("publishMode"), "all");
  const requestedLimit = numberParam(searchParams.get("limit"), 25);
  const limit = Math.min(Math.max(requestedLimit, 1), 100);
  const offset = numberParam(searchParams.get("offset"), 0);

  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("jobs")
    .select("*")
    .eq("is_active", true)
    .eq("publish_status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const filtered = (data || []).filter((job) =>
    matchesJobFilters(job, { q, location, role, type, publishMode })
  );

  const total = filtered.length;
  const paged = filtered.slice(offset, offset + limit).map(normalizeJob);

  return NextResponse.json({
    jobs: paged,
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
    filters: { q, location, role, type, publishMode },
  });
}

export async function POST(request: NextRequest) {
  const adminKey = request.headers.get("x-nata-admin-key");

  if (!adminKey || adminKey !== process.env.NATA_ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const title = clean(body.title || body.role);
  if (!title) {
    return NextResponse.json({ error: "Job title is required" }, { status: 400 });
  }

  const dealerSlug = clean(body.dealer_slug, "jersey-village-cdjr");
  const dealerName = clean(
    body.public_dealer_name,
    "Jersey Village Chrysler Jeep Dodge Ram"
  );
  const location = clean(body.location || body.public_location, "Jersey Village, TX");
  const rawSalary = clean(body.salary || body.payRange || body.pay_range);
  const salary = normalizeSalary(rawSalary);
  const type = clean(body.type, "Full-time");
  const notes = clean(body.notes || body.request_notes);
  const priority = clean(body.priority, "Standard");
  const publishMode = clean(body.publish_mode, "public");
  const publishStatus = clean(body.publish_status, "published");

  const slugBase = slugify(`${dealerSlug}-${title}`);
  const baseSlug = body.slug
    ? slugify(String(body.slug))
    : `${slugBase}-${Date.now()}`;

  const generated = buildJobContent({
    title,
    dealerName,
    location,
    salary,
    notes,
    publishMode,
    priority,
  });

  const description = cleanGeneratedText(clean(body.description, generated.description));
  const requirements = cleanGeneratedText(clean(body.requirements, generated.requirements));
  const role_hook = cleanGeneratedText(clean(body.role_hook, generated.role_hook));
  const responsibilities =
    Array.isArray(body.responsibilities) && body.responsibilities.length > 0
      ? body.responsibilities.map((item: unknown) => cleanGeneratedText(clean(item))).filter(Boolean)
      : generated.responsibilities;
  const fit_signals =
    Array.isArray(body.fit_signals) && body.fit_signals.length > 0
      ? body.fit_signals.map((item: unknown) => cleanGeneratedText(clean(item))).filter(Boolean)
      : generated.fit_signals;
  const process_note = cleanGeneratedText(clean(body.process_note, generated.process_note));

  const quality = calculateDistributionQuality({
    title,
    salary,
    location,
    description,
    requirements,
    role_hook,
    responsibilities,
    fit_signals,
    process_note,
    publish_mode: publishMode,
    publish_status: publishStatus,
    public_dealer_name: publishMode === "confidential" ? null : dealerName,
  });

  const requestedDistributionStatus = clean(body.distribution_status);
  const distributionStatus =
    publishMode !== "public" || publishStatus !== "published"
      ? "off"
      : requestedDistributionStatus === "off"
        ? "off"
        : quality.approved
          ? "approved"
          : "pending";

  const jobPayload = {
    title,
    slug: baseSlug,
    dealer_id: body.dealer_id || null,
    dealer_slug: dealerSlug,
    location,
    type,
    salary,
    description,
    requirements,
    role_hook,
    responsibilities,
    fit_signals,
    process_note,
    is_active: body.is_active ?? true,
    publish_mode: publishMode,
    public_dealer_name: publishMode === "confidential" ? null : dealerName,
    public_location: clean(body.public_location, location),
    confidential_note:
      publishMode === "confidential"
        ? clean(
            body.confidential_note,
            "This role is being handled confidentially on behalf of a dealership. Candidate information is reviewed before any dealership handoff."
          )
        : null,
    published_by: "Solace",
    publish_status: publishStatus,
    distribution_status: distributionStatus,
  };

  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("jobs")
    .insert(jobPayload)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const matching = await triggerMatchRunner(request.nextUrl.origin);

  return NextResponse.json({
    job: normalizeJob(data),
    matching,
    outreach: {
      created: 0,
      skipped: 0,
      status: "disabled_recruiter_review_required",
      note: "No candidate outreach, interview invitation, email, or SMS is sent automatically from job creation.",
    },
    distribution: {
      status: distributionStatus,
      quality_score: quality.score,
      quality_issues: quality.issues,
    },
  });
}
