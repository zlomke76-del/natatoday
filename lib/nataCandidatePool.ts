import { supabaseAdmin } from "./supabaseAdmin";

type AnyRow = Record<string, any>;

type RoleProfile = {
  key: string;
  aliases: string[];
  coreSignals: string[];
  proofSignals: string[];
  advancedSignals: string[];
  riskSignals: string[];
  verificationItems: string[];
  autoRecommendSignals?: string[];
};

const MIN_ELIGIBLE_SCORE = 78;
const MIN_REVIEW_SCORE = 62;
const MIN_MORE_STATE_SCORE = 45;
const MAX_MATCH_DISTANCE_MILES = 100;
const DEFAULT_COOLDOWN_DAYS = 30;
const NO_SHOW_COOLDOWN_DAYS = 45;

const POOL_RETURN_STATUSES = [
  "not_fit",
  "passed",
  "pass",
  "rejected",
  "dealer_rejected",
  "not_selected",
  "interview_not_selected",
  "not_hired",
  "withdrawn",
  "no_show",
];

const PLACED_STATUSES = [
  "placed",
  "hired",
  "dealer_hired",
  "placement_complete",
  "completed_placement",
];

export type CandidatePoolReturnSource =
  | "recruiter_rejected"
  | "dealer_rejected"
  | "not_hired"
  | "withdrawn"
  | "system";

function normalize(value: unknown) {
  return String(value || "").toLowerCase().trim();
}

function label(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function toNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function getCooldownDays(status: string) {
  return normalize(status) === "no_show" ? NO_SHOW_COOLDOWN_DAYS : DEFAULT_COOLDOWN_DAYS;
}

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radius = 3958.8;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const ROLE_PROFILES: RoleProfile[] = [
  {
    key: "sales consultant",
    aliases: ["sales consultant", "sales associate", "automotive sales", "car sales", "salesperson", "floor sales"],
    coreSignals: ["sales", "closing", "closer", "objection handling", "appointment", "follow up", "follow-up", "crm"],
    proofSignals: ["units", "unit volume", "closing ratio", "close rate", "gross", "front gross", "back gross", "vinsolutions", "dealersocket", "elead"],
    advancedSignals: ["top performer", "presidents club", "internet leads", "trade appraisal", "finance handoff"],
    riskSignals: ["short tenure", "limited tenure", "unverified", "claimed", "no metrics"],
    verificationItems: [
      "Verify monthly unit volume, close rate, and store size.",
      "Confirm CRM usage depth and follow-up discipline.",
      "Ask for examples of objection handling and appointment conversion.",
      "Confirm comfort with commission pressure and weekend schedule.",
    ],
  },
  {
    key: "senior sales consultant",
    aliases: ["senior sales consultant", "sales lead", "floor lead", "fleet sales", "commercial sales"],
    coreSignals: ["sales", "closing", "customer retention", "repeat business", "referrals"],
    proofSignals: ["units", "gross", "fleet", "commercial accounts", "repeat customers", "referral rate"],
    advancedSignals: ["mentor", "trained new salespeople", "top ranked", "volume leader"],
    riskSignals: ["title inflation", "unclear leadership", "unverified"],
    verificationItems: [
      "Verify sustained production over multiple months.",
      "Confirm whether leadership duties were formal or informal.",
      "Ask for proof of repeat/referral business.",
    ],
  },
  {
    key: "bdc representative",
    aliases: ["bdc", "bdc representative", "internet sales", "internet sales consultant", "appointment coordinator", "customer care representative"],
    coreSignals: ["bdc", "calls", "appointment", "crm", "lead response", "internet leads", "phone"],
    proofSignals: ["call volume", "appointment set", "show rate", "answer rate", "response time", "email follow", "sms", "text follow"],
    advancedSignals: ["lead management", "campaign", "equity mining", "service bdc", "sales bdc"],
    riskSignals: ["low show rate", "unverified metrics", "no crm"],
    verificationItems: [
      "Verify call volume, appointment-set rate, and show rate.",
      "Confirm CRM note quality and lead-response standards.",
      "Ask about phone, SMS, email, and long-term follow-up workflow.",
    ],
  },
  {
    key: "sales manager",
    aliases: ["sales manager", "new car manager", "desk manager", "closer", "gsm", "general sales manager"],
    coreSignals: ["sales manager", "desk", "desking", "closer", "manager", "team", "gross", "inventory"],
    proofSignals: ["gross profit", "team volume", "closing deals", "desking", "vauto", "elead", "dealertrack", "routeone"],
    advancedSignals: ["trained salespeople", "inventory turn", "forecasting", "trade appraisal", "pencil", "deal structure"],
    riskSignals: ["title inflation", "short management tenure", "unclear authority"],
    verificationItems: [
      "Verify actual desking authority and team size.",
      "Confirm gross, volume, inventory, and trade appraisal responsibility.",
      "Ask how they coach salespeople and structure difficult deals.",
    ],
  },
  {
    key: "finance manager",
    aliases: ["finance manager", "f&i", "f&i manager", "business manager", "finance director"],
    coreSignals: ["finance", "f&i", "lender", "menu", "products", "warranty", "gap"],
    proofSignals: ["penetration", "pvr", "csi", "compliance", "lender approvals", "dealertrack", "routeone"],
    advancedSignals: ["chargebacks", "funding", "contracts in transit", "reinsurance", "vsc"],
    riskSignals: ["compliance issue", "chargeback", "unverified pvr"],
    verificationItems: [
      "Verify PVR, product penetration, lender mix, and funding speed.",
      "Confirm compliance habits and menu presentation process.",
      "Ask about chargebacks, CIT cleanup, and lender relationships.",
    ],
  },
  {
    key: "service advisor",
    aliases: ["service advisor", "service writer", "advisor", "service consultant"],
    coreSignals: ["service advisor", "service writer", "repair order", "ro", "service lane", "customer pay"],
    proofSignals: ["ro count", "hours per ro", "elr", "csi", "warranty", "upsell", "mpi"],
    advancedSignals: ["dispatch", "technician communication", "declined services", "retention", "xtime"],
    riskSignals: ["low csi", "no ro volume", "unclear service lane"],
    verificationItems: [
      "Verify RO count, hours per RO, CSI, and customer-pay performance.",
      "Confirm service-lane pressure and technician communication ability.",
      "Ask how they handle declined services and upset customers.",
    ],
  },
  {
    key: "service manager",
    aliases: ["service manager", "service director", "fixed ops service manager", "assistant service manager"],
    coreSignals: ["service manager", "service department", "shop", "advisors", "technicians", "fixed ops"],
    proofSignals: ["gross profit", "elr", "hours per ro", "csi", "shop productivity", "comeback rate"],
    advancedSignals: ["capacity planning", "dispatch", "warranty receivables", "technician retention", "scheduler"],
    riskSignals: ["high turnover", "low csi", "unverified department metrics"],
    verificationItems: [
      "Verify department size, ELR, CSI, productivity, and gross performance.",
      "Confirm advisor and technician management experience.",
      "Ask about comebacks, retention, scheduling, and capacity planning.",
    ],
  },
  {
    key: "lube technician",
    aliases: ["lube technician", "lube tech", "express tech", "quick lane", "maintenance technician"],
    coreSignals: ["oil change", "tires", "rotation", "inspection", "maintenance", "lube"],
    proofSignals: ["multipoint", "mpi", "torque", "shop safety", "tools"],
    advancedSignals: ["apprentice", "entry level tech", "used car recon"],
    riskSignals: ["no tools", "no shop experience", "safety concern"],
    verificationItems: [
      "Verify shop experience, safety habits, and basic tool ownership.",
      "Confirm ability to follow inspection and torque procedures.",
      "Ask whether they are seeking apprentice or flat-rate path.",
    ],
  },
  {
    key: "service technician",
    aliases: ["service technician", "technician", "line tech", "auto tech", "automotive technician", "mechanic"],
    coreSignals: ["technician", "diagnostic", "repair", "electrical", "engine", "transmission", "brakes"],
    proofSignals: ["ase", "certified", "factory trained", "flat rate", "flag hours", "scan tool", "diagnostics"],
    advancedSignals: ["ev", "hybrid", "adas", "diesel", "drivability", "electrical diagnosis"],
    riskSignals: ["no tools", "comeback", "limited diagnostics", "no certifications"],
    verificationItems: [
      "Verify certifications, diagnostic ability, tool ownership, and flat-rate history.",
      "Confirm repair categories handled independently.",
      "Ask about comebacks, electrical diagnosis, and scan-tool comfort.",
    ],
  },
  {
    key: "master technician",
    aliases: ["master technician", "master tech", "master certified", "ase master", "oem master", "factory master"],
    coreSignals: ["master technician", "master tech", "master certified", "ase master", "diagnostic", "electrical"],
    proofSignals: ["ase master", "oem master", "factory certified", "hybrid", "ev", "adas", "drivability", "diesel"],
    advancedSignals: ["shop foreman", "team lead", "difficult diagnostics", "mentor", "comeback reduction"],
    riskSignals: ["expired certification", "no recent shop experience", "relocation unclear"],
    autoRecommendSignals: ["master technician", "master tech", "master certified", "ase master", "oem master", "factory master"],
    verificationItems: [
      "Confirm Master Certification type, OEM/ASE source, and current status.",
      "Verify recent shop experience, diagnostic categories, and tool ownership.",
      "Fast-track recruiter review unless location, resume, or certification status is missing.",
    ],
  },
  {
    key: "shop foreman",
    aliases: ["shop foreman", "foreman", "team lead technician", "lead technician", "diagnostic lead"],
    coreSignals: ["foreman", "lead technician", "diagnostic", "mentor", "dispatch", "comeback"],
    proofSignals: ["master certified", "ase", "diagnostic", "shop productivity", "quality control"],
    advancedSignals: ["dispatch", "technician mentoring", "comeback review", "training"],
    riskSignals: ["unclear authority", "no leadership proof"],
    verificationItems: [
      "Verify diagnostic leadership, dispatch authority, and comeback review process.",
      "Confirm ability to mentor technicians without slowing production.",
    ],
  },
  {
    key: "parts advisor",
    aliases: ["parts advisor", "parts counter", "parts counterperson", "parts specialist"],
    coreSignals: ["parts", "counter", "catalog", "inventory", "wholesale", "back counter"],
    proofSignals: ["oem parts", "dealertrack", "cdk", "reynolds", "special order", "fill rate"],
    advancedSignals: ["wholesale accounts", "inventory control", "cycle count", "service parts"],
    riskSignals: ["no catalog", "inventory mismatch", "unverified oem"],
    verificationItems: [
      "Verify catalog lookup, OEM experience, inventory, and counter workflow.",
      "Ask about wholesale, back counter, special orders, and fill-rate handling.",
    ],
  },
  {
    key: "parts manager",
    aliases: ["parts manager", "parts director", "parts department manager"],
    coreSignals: ["parts manager", "inventory", "gross", "wholesale", "counter", "department"],
    proofSignals: ["inventory turn", "obsolescence", "gross profit", "fill rate", "wholesale growth"],
    advancedSignals: ["cycle counts", "vendor management", "special orders", "service absorption"],
    riskSignals: ["obsolete inventory", "unverified gross", "shrink"],
    verificationItems: [
      "Verify inventory turn, gross profit, obsolescence, and fill rate.",
      "Confirm team size, wholesale exposure, and service department coordination.",
    ],
  },
  {
    key: "warranty administrator",
    aliases: ["warranty admin", "warranty administrator", "warranty clerk", "claims administrator"],
    coreSignals: ["warranty", "claims", "op codes", "labor operation", "policy", "manufacturer"],
    proofSignals: ["claim submission", "chargeback", "audit", "warranty receivables", "oem portal"],
    advancedSignals: ["policy adjustment", "goodwill", "warranty schedule", "compliance"],
    riskSignals: ["chargeback", "audit issue", "unverified oem"],
    verificationItems: [
      "Verify OEM warranty system experience and claim accuracy.",
      "Ask about chargebacks, audits, receivables, and policy adjustments.",
    ],
  },
  {
    key: "title clerk",
    aliases: ["title clerk", "billing clerk", "dmv clerk", "contracts clerk", "tag and title"],
    coreSignals: ["title", "dmv", "registration", "contracts", "billing", "funding"],
    proofSignals: ["title work", "payoff", "lien", "registration", "dealertrack", "cdk", "reynolds"],
    advancedSignals: ["out of state title", "auction title", "wholesale title", "compliance"],
    riskSignals: ["title delay", "funding delay", "compliance issue"],
    verificationItems: [
      "Verify title, DMV, payoff, lien, and registration workflow experience.",
      "Ask about out-of-state deals, funding delays, and title exception handling.",
    ],
  },
  {
    key: "accounting",
    aliases: ["accounting", "accounting clerk", "office clerk", "dealership accounting", "accounts payable", "accounts receivable", "controller"],
    coreSignals: ["accounting", "payables", "receivables", "schedule", "reconcile", "posting"],
    proofSignals: ["schedule cleanup", "bank rec", "floorplan", "payables", "receivables", "journal entries"],
    advancedSignals: ["month end", "controller", "financial statement", "factory statement"],
    riskSignals: ["schedule aging", "unverified month end"],
    verificationItems: [
      "Verify dealership accounting system exposure and schedule responsibility.",
      "Ask about month-end, bank recs, floorplan, AP/AR, and statement support.",
    ],
  },
  {
    key: "receptionist",
    aliases: ["receptionist", "cashier", "front desk", "greeter", "operator"],
    coreSignals: ["reception", "cashier", "phones", "front desk", "greeting", "customer service"],
    proofSignals: ["cash handling", "multi-line phone", "customer service", "appointment routing"],
    advancedSignals: ["service cashier", "loaner support", "administrative support"],
    riskSignals: ["attendance issue", "cash handling concern"],
    verificationItems: [
      "Verify phone etiquette, schedule reliability, and customer handling.",
      "Confirm cash handling or service cashier experience if required.",
    ],
  },
  {
    key: "hr training",
    aliases: ["hr", "human resources", "training", "trainer", "recruiter", "talent", "onboarding"],
    coreSignals: ["training", "onboarding", "recruiting", "hr", "coaching", "development"],
    proofSignals: ["curriculum", "new hire", "compliance training", "employee relations", "retention"],
    advancedSignals: ["sales training", "service training", "lms", "performance management"],
    riskSignals: ["unclear dealership exposure", "unverified training outcomes"],
    verificationItems: [
      "Verify dealership training scope, curriculum ownership, and outcomes.",
      "Ask about onboarding, compliance, retention, and manager coordination.",
    ],
  },
  {
    key: "fixed ops director",
    aliases: ["fixed ops director", "fixed operations director", "fixed ops", "service and parts director"],
    coreSignals: ["fixed ops", "service", "parts", "director", "absorption", "gross", "productivity"],
    proofSignals: ["service absorption", "elr", "hours per ro", "parts gross", "csi", "retention"],
    advancedSignals: ["multi-rooftop", "capacity planning", "technician retention", "warranty receivables"],
    riskSignals: ["unverified department metrics", "high turnover", "low csi"],
    verificationItems: [
      "Verify service absorption, ELR, parts gross, CSI, and retention metrics.",
      "Confirm number of rooftops, team size, and fixed-ops scope.",
    ],
  },
  {
    key: "used car manager",
    aliases: ["used car manager", "pre-owned manager", "ucm", "inventory manager"],
    coreSignals: ["used car", "pre-owned", "inventory", "appraisal", "auction", "recon"],
    proofSignals: ["inventory turn", "vauto", "acv", "mmr", "auction", "gross", "recon time"],
    advancedSignals: ["pricing", "wholesale", "trade appraisal", "aged inventory", "market days supply"],
    riskSignals: ["aged inventory", "unverified gross", "recon delay"],
    verificationItems: [
      "Verify inventory turn, gross, appraisal tools, and recon cycle.",
      "Ask about aged inventory, auction buying, pricing, and trade appraisal process.",
    ],
  },
  {
    key: "general manager",
    aliases: ["general manager", "gm", "operator", "platform manager", "managing partner"],
    coreSignals: ["general manager", "operator", "p&l", "department heads", "gross", "net profit"],
    proofSignals: ["p&l", "net profit", "volume", "csi", "employee retention", "market share"],
    advancedSignals: ["multi-rooftop", "turnaround", "manufacturer relations", "floorplan", "compliance"],
    riskSignals: ["unverified p&l", "title inflation", "short tenure"],
    verificationItems: [
      "Verify full P&L authority, store size, net profit, CSI, and department performance.",
      "Ask about manufacturer relations, compliance, retention, and turnaround experience.",
    ],
  },
];

function normalizeTextList(items: string[]) {
  return items.map((item) => normalize(item)).filter(Boolean);
}

function includesAny(text: string, terms: string[]) {
  return normalizeTextList(terms).some((term) => text.includes(term));
}

function uniqueList(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function splitList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(/\n|;|\|/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function getCandidateSearchText(candidate: AnyRow) {
  return [
    candidate.name,
    candidate.email,
    candidate.phone,
    candidate.location_text,
    candidate.linkedin,
    candidate.experience_summary,
    candidate.search_text,
    ...(Array.isArray(candidate.target_roles) ? candidate.target_roles : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getDistanceMiles(candidate: AnyRow, job: AnyRow) {
  const candidateLat = toNumber(candidate.latitude);
  const candidateLon = toNumber(candidate.longitude);
  const jobLat = toNumber(job.latitude);
  const jobLon = toNumber(job.longitude);

  if (
    candidateLat === null ||
    candidateLon === null ||
    jobLat === null ||
    jobLon === null
  ) {
    return null;
  }

  return haversineMiles(candidateLat, candidateLon, jobLat, jobLon);
}

function getRoleKey(roleTitle: string) {
  const normalized = normalize(roleTitle);

  for (const profile of ROLE_PROFILES) {
    if (
      profile.key === normalized ||
      profile.aliases.some((alias) => normalized.includes(alias))
    ) {
      return profile.key;
    }
  }

  if (normalized.includes("sales")) return "sales consultant";
  if (normalized.includes("service") && normalized.includes("advisor")) return "service advisor";
  if (normalized.includes("technician") || normalized.includes("tech")) return "service technician";
  if (normalized.includes("bdc") || normalized.includes("internet")) return "bdc representative";
  if (normalized.includes("parts")) return "parts advisor";
  if (normalized.includes("finance") || normalized.includes("f&i")) return "finance manager";
  if (normalized.includes("title")) return "title clerk";
  if (normalized.includes("warranty")) return "warranty administrator";
  if (normalized.includes("accounting") || normalized.includes("controller")) return "accounting";
  if (normalized.includes("reception") || normalized.includes("cashier")) return "receptionist";
  if (normalized.includes("manager")) return "sales manager";

  return "general";
}

function getJobRoleKey(job: AnyRow) {
  return getRoleKey(String(job.title || ""));
}

function getTargetRoles(candidate: AnyRow) {
  if (Array.isArray(candidate.target_roles)) {
    return candidate.target_roles.map((role) => normalize(role)).filter(Boolean);
  }

  return [];
}

function getRoleProfile(roleKey: string) {
  return ROLE_PROFILES.find((profile) => profile.key === roleKey) || null;
}

function inferCandidatePrimaryRole(candidate: AnyRow, job: AnyRow) {
  const jobRoleKey = getJobRoleKey(job);
  if (jobRoleKey !== "general") return jobRoleKey;

  const text = getCandidateSearchText(candidate);
  const targetRoles = getTargetRoles(candidate);

  for (const role of targetRoles) {
    const key = getRoleKey(role);
    if (key !== "general") return key;
  }

  let bestProfile: RoleProfile | null = null;
  let bestScore = 0;

  for (const profile of ROLE_PROFILES) {
    let score = 0;
    if (includesAny(text, profile.aliases)) score += 12;
    if (includesAny(text, profile.coreSignals)) score += 8;
    if (includesAny(text, profile.proofSignals)) score += 5;

    if (score > bestScore) {
      bestScore = score;
      bestProfile = profile;
    }
  }

  return bestProfile?.key || "general";
}

function hasAutoRecommendSignal(candidate: AnyRow, profile: RoleProfile | null) {
  if (!profile?.autoRecommendSignals?.length) return false;
  const text = getCandidateSearchText(candidate);
  return includesAny(text, profile.autoRecommendSignals);
}

function scoreRoleFit(candidate: AnyRow, job: AnyRow) {
  const roleKey = inferCandidatePrimaryRole(candidate, job);
  const profile = getRoleProfile(roleKey);
  const text = getCandidateSearchText(candidate);
  const targetRoles = getTargetRoles(candidate);
  const reasons: string[] = [];
  const verificationItems: string[] = [];

  let score = 0;

  if (!profile) {
    reasons.push("No specific role profile matched this job or candidate.");
    verificationItems.push("Confirm intended role before advancing.");
    return {
      roleKey,
      score: 0,
      reasons,
      verificationItems,
      autoRecommend: false,
    };
  }

  if (
    targetRoles.some((role) => {
      const normalizedRole = normalize(role);
      return (
        normalizedRole.includes(profile.key) ||
        profile.key.includes(normalizedRole) ||
        profile.aliases.some((alias) => normalizedRole.includes(alias))
      );
    })
  ) {
    score += 18;
    reasons.push(`Target role aligns with ${profile.key}.`);
  }

  if (includesAny(text, profile.aliases)) {
    score += 12;
    reasons.push(`Candidate has direct ${profile.key} title or alias signal.`);
  }

  const coreMatches = profile.coreSignals.filter((signal) => text.includes(normalize(signal)));
  const proofMatches = profile.proofSignals.filter((signal) => text.includes(normalize(signal)));
  const advancedMatches = profile.advancedSignals.filter((signal) => text.includes(normalize(signal)));

  score += Math.min(coreMatches.length * 4, 16);
  score += Math.min(proofMatches.length * 3, 12);
  score += Math.min(advancedMatches.length * 2, 7);

  if (coreMatches.length) reasons.push(`Role signals found: ${coreMatches.slice(0, 5).join(", ")}.`);
  if (proofMatches.length) reasons.push(`Proof signals found: ${proofMatches.slice(0, 5).join(", ")}.`);

  verificationItems.push(...profile.verificationItems);

  const autoRecommend = hasAutoRecommendSignal(candidate, profile);

  if (autoRecommend) {
    score = Math.max(score, 43);
    reasons.push("Automatic recommend signal detected for this role profile.");
  }

  return {
    roleKey,
    score: Math.max(0, Math.min(score, 45)),
    reasons,
    verificationItems,
    autoRecommend,
  };
}

function scoreProofQuality(candidate: AnyRow, profile: RoleProfile | null) {
  const text = getCandidateSearchText(candidate);
  const reasons: string[] = [];
  const verificationItems: string[] = [];
  let score = 0;

  if (candidate.resume_url) {
    score += 10;
    reasons.push("Resume is available.");
  } else {
    reasons.push("Resume is missing.");
    verificationItems.push("Request resume before advancing.");
  }

  if (candidate.profile_photo_url) score += 2;

  if (candidate.linkedin) {
    score += 4;
    reasons.push("LinkedIn profile is available.");
  }

  if (profile && includesAny(text, profile.proofSignals)) {
    score += 6;
    reasons.push(`Role-specific proof exists for ${profile.key}.`);
  }

  if (profile && includesAny(text, profile.advancedSignals)) {
    score += 4;
    reasons.push(`Advanced role signal exists for ${profile.key}.`);
  }

  if (
    includesAny(text, [
      "units",
      "unit volume",
      "close rate",
      "closing ratio",
      "gross",
      "pvr",
      "penetration",
      "elr",
      "hours per ro",
      "csi",
      "ase",
      "certified",
      "master certified",
      "oem certified",
      "factory certified",
      "inventory turn",
      "service absorption",
      "net profit",
      "p&l",
    ])
  ) {
    score += 5;
    reasons.push("Measurable or credentialed proof signal is present.");
    verificationItems.push("Verify the measurable or credentialed claim before dealer exposure.");
  }

  if (
    includesAny(text, [
      "vinsolutions",
      "dealersocket",
      "elead",
      "tekion",
      "dealertrack",
      "routeone",
      "cdk",
      "reynolds",
      "xtime",
      "vauto",
      "acv",
    ])
  ) {
    score += 4;
    reasons.push("Specific dealership system experience is present.");
  } else if (text.includes("crm")) {
    score += 2;
    reasons.push("Generic CRM experience is present.");
    verificationItems.push("Confirm which CRM and actual usage depth.");
  }

  if (
    includesAny(text, [
      "top performer",
      "top ranked",
      "ranked",
      "award",
      "president",
      "leader",
      "number one",
      "#1",
    ])
  ) {
    score += 2;
    reasons.push("Recognition claim is present.");
    verificationItems.push("Clarify store size and ranking context for performance claims.");
  }

  if (!candidate.experience_summary || normalize(candidate.experience_summary).length < 80) {
    score -= 5;
    reasons.push("Experience summary is thin.");
    verificationItems.push("Collect a stronger experience summary before dealer exposure.");
  }

  return {
    score: Math.max(0, Math.min(score, 25)),
    reasons,
    verificationItems,
  };
}

function scoreLocationFit(candidate: AnyRow, job: AnyRow) {
  const text = getCandidateSearchText(candidate);
  const distance = getDistanceMiles(candidate, job);
  const reasons: string[] = [];
  const verificationItems: string[] = [];
  const riskFlags: string[] = [];
  let score = 0;

  if (distance !== null) {
    if (distance <= 25) {
      score += 15;
      reasons.push(`Candidate is within ${Math.round(distance)} miles.`);
    } else if (distance <= MAX_MATCH_DISTANCE_MILES) {
      score += 10;
      reasons.push(`Candidate is within ${Math.round(distance)} miles.`);
    } else {
      score -= 18;
      reasons.push(`Candidate is ${Math.round(distance)} miles away, outside preferred radius.`);
      riskFlags.push("outside_preferred_radius");
      verificationItems.push("Confirm relocation or commute plan before advancing.");
    }
  } else if (candidate.location_text) {
    const locationText = normalize(candidate.location_text);

    if (includesAny(locationText, ["open to relocation", "relocate", "relocation", "willing to move"])) {
      score += 4;
      reasons.push("Candidate states relocation openness.");
      riskFlags.push("relocation_not_verified");
      verificationItems.push("Confirm relocation timing, target market, and compensation needs.");
    } else {
      score += 6;
      reasons.push("Candidate provided a location, but distance was not computed.");
      verificationItems.push("Confirm commute or relocation fit.");
    }
  } else {
    score -= 8;
    reasons.push("Candidate location is missing.");
    riskFlags.push("location_missing");
    verificationItems.push("Collect candidate location before matching.");
  }

  if (includesAny(text, ["open to relocation", "relocate", "relocation", "willing to move"])) {
    verificationItems.push("Confirm relocation commitment before dealer exposure.");
  }

  return {
    score: Math.max(-20, Math.min(score, 15)),
    distance,
    reasons,
    verificationItems,
    riskFlags,
  };
}

function scoreRisk(candidate: AnyRow, profile: RoleProfile | null, autoRecommend: boolean) {
  const text = getCandidateSearchText(candidate);
  const reasons: string[] = [];
  const riskFlags: string[] = [];
  const verificationItems: string[] = [];
  let deduction = 0;

  if (candidate.cooldown_until && new Date(candidate.cooldown_until).getTime() > Date.now()) {
    deduction += 18;
    reasons.push("Candidate is inside a post-decision cooldown window.");
    riskFlags.push("cooldown_active");
  }

  if (profile && includesAny(text, profile.riskSignals)) {
    deduction += autoRecommend ? 3 : 7;
    reasons.push(`Role-specific risk signal detected for ${profile.key}.`);
    riskFlags.push("role_specific_risk");
    verificationItems.push("Resolve role-specific risk signals during recruiter review.");
  }

  if (includesAny(text, ["short tenure", "limited tenure", "8 months", "less than a year", "job hopping"])) {
    deduction += autoRecommend ? 3 : 8;
    reasons.push("Short-tenure signal requires recruiter review.");
    riskFlags.push("limited_tenure");
    verificationItems.push("Clarify reason for short tenure and prior role transitions.");
  }

  if (
    includesAny(text, [
      "claimed",
      "unverified",
      "unclear",
      "unknown",
      "inconsistent",
      "no metrics",
      "not verified",
    ])
  ) {
    deduction += autoRecommend ? 3 : 7;
    reasons.push("Candidate record contains unverified or ambiguous claims.");
    riskFlags.push("unverified_claims");
    verificationItems.push("Resolve ambiguous claims before dealer exposure.");
  }

  if (includesAny(text, ["career pivot", "transitioned from", "fitness", "restaurant", "retail"])) {
    deduction += 4;
    reasons.push("Career pivot may be valid but needs context.");
    riskFlags.push("career_pivot");
    verificationItems.push("Ask why the candidate moved into automotive and what has kept them there.");
  }

  if (!candidate.resume_url) {
    deduction += 12;
    riskFlags.push("resume_missing");
  }

  if (!candidate.phone) {
    deduction += 6;
    riskFlags.push("phone_missing");
    verificationItems.push("Collect candidate phone number.");
  }

  if (autoRecommend && includesAny(text, ["expired certification", "no recent shop experience", "no tools"])) {
    deduction += 12;
    riskFlags.push("auto_recommend_blocked_by_material_risk");
    verificationItems.push("Master-level signal requires confirmation because a blocking risk is present.");
  }

  return {
    score: Math.max(0, Math.min(deduction, 35)),
    reasons,
    riskFlags,
    verificationItems,
  };
}

function determineMatchStatus(input: {
  fitScore: number;
  riskFlags: string[];
  roleScore: number;
  proofScore: number;
  autoRecommend: boolean;
}) {
  if (input.riskFlags.includes("cooldown_active")) return "cooldown";

  if (input.riskFlags.includes("resume_missing") || input.riskFlags.includes("location_missing")) {
    return "more_state_required";
  }

  if (input.autoRecommend && !input.riskFlags.includes("auto_recommend_blocked_by_material_risk")) {
    return "eligible";
  }

  if (input.roleScore < 12) return "below_threshold";

  if (
    input.riskFlags.includes("relocation_not_verified") ||
    input.riskFlags.includes("limited_tenure") ||
    input.riskFlags.includes("unverified_claims") ||
    input.riskFlags.includes("role_specific_risk")
  ) {
    return input.fitScore >= MIN_REVIEW_SCORE ? "recruiter_review" : "more_state_required";
  }

  if (input.fitScore >= MIN_ELIGIBLE_SCORE && input.proofScore >= 12) return "eligible";
  if (input.fitScore >= MIN_REVIEW_SCORE) return "recruiter_review";
  if (input.fitScore >= MIN_MORE_STATE_SCORE) return "more_state_required";

  return "below_threshold";
}

function computeMatch(candidate: AnyRow, job: AnyRow) {
  const roleFit = scoreRoleFit(candidate, job);
  const profile = getRoleProfile(roleFit.roleKey);
  const proof = scoreProofQuality(candidate, profile);
  const location = scoreLocationFit(candidate, job);
  const risk = scoreRisk(candidate, profile, roleFit.autoRecommend);

  const baseScore = 25;
  const jobStatusScore =
    job.publish_status === "published" && job.is_active !== false && !job.filled_at ? 5 : 0;

  const rawScore = baseScore + roleFit.score + proof.score + location.score + jobStatusScore - risk.score;

  const fitScore = roleFit.autoRecommend
    ? Math.max(86, Math.min(100, Math.round(rawScore)))
    : Math.max(0, Math.min(100, Math.round(rawScore)));

  const riskFlags = uniqueList([...location.riskFlags, ...risk.riskFlags]);
  const verificationItems = uniqueList([
    ...roleFit.verificationItems,
    ...proof.verificationItems,
    ...location.verificationItems,
    ...risk.verificationItems,
  ]);

  const matchStatus = determineMatchStatus({
    fitScore,
    riskFlags,
    roleScore: roleFit.score,
    proofScore: proof.score,
    autoRecommend: roleFit.autoRecommend,
  });

  const reasons = uniqueList([
    ...roleFit.reasons,
    ...proof.reasons,
    ...location.reasons,
    ...risk.reasons,
    roleFit.autoRecommend ? "Automatic recommendation rule applied for master-level technician credential." : "",
    `Role score: ${roleFit.score}/45.`,
    `Proof score: ${proof.score}/25.`,
    `Location score: ${location.score}/15.`,
    `Risk deduction: ${risk.score}/35.`,
    `Decision status: ${matchStatus}.`,
  ]);

  return {
    distance_miles: location.distance === null ? null : Math.round(location.distance * 10) / 10,
    fit_score: fitScore,
    role_score: roleFit.score,
    proof_score: proof.score,
    location_score: location.score,
    risk_score: risk.score,
    risk_flags: riskFlags,
    verification_items: verificationItems.slice(0, 8),
    match_status: matchStatus,
    match_reason: reasons.join(" "),
  };
}

function inferTargetRolesFromApplication(application: AnyRow, job: AnyRow | null) {
  const explicit = splitList(application.target_roles);
  if (explicit.length) return explicit.map((item) => item.toLowerCase());

  const roleTitle = label(application.role || application.job_title || job?.title, "");
  const roleKey = roleTitle ? getRoleKey(roleTitle) : "";

  return roleKey && roleKey !== "general" ? [roleKey] : [];
}

function buildExperienceSummary(application: AnyRow, job: AnyRow | null, reason: string) {
  return label(
    application.experience_summary ||
      application.screening_summary ||
      application.cover_note ||
      reason ||
      application.decision_reason,
    `Candidate previously applied for ${label(job?.title || application.role, "a dealership role")}.`,
  );
}

async function upsertCandidateMatch(row: AnyRow) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .schema("nata")
    .from("candidate_matches")
    .select("id")
    .eq("candidate_id", row.candidate_id)
    .eq("job_id", row.job_id)
    .maybeSingle();

  if (existingError) {
    console.error("Failed to check existing candidate match:", existingError);
    return;
  }

  if (existing?.id) {
    const { error } = await supabaseAdmin
      .schema("nata")
      .from("candidate_matches")
      .update(row)
      .eq("id", existing.id);

    if (error) console.error("Failed to update candidate match:", error);
    return;
  }

  const { error } = await supabaseAdmin.schema("nata").from("candidate_matches").insert(row);
  if (error) console.error("Failed to insert candidate match:", error);
}

export async function syncCandidateMatches(candidate: AnyRow) {
  if (!candidate?.id) {
    console.error("Cannot sync candidate matches without candidate id.");
    return;
  }

  const { data: jobs, error } = await supabaseAdmin
    .schema("nata")
    .from("jobs")
    .select(
      "id,title,location,public_location,public_dealer_name,dealer_slug,is_active,publish_status,publish_mode,filled_at,latitude,longitude",
    )
    .eq("is_active", true)
    .eq("publish_status", "published")
    .is("filled_at", null);

  if (error) {
    console.error("Failed to load jobs for candidate matching:", error);
    return;
  }

  for (const job of (jobs || []) as AnyRow[]) {
    const match = computeMatch(candidate, job);

    await upsertCandidateMatch({
      candidate_id: candidate.id,
      job_id: job.id,
      distance_miles: match.distance_miles,
      fit_score: match.fit_score,
      role_score: match.role_score,
      proof_score: match.proof_score,
      location_score: match.location_score,
      risk_score: match.risk_score,
      risk_flags: match.risk_flags,
      verification_items: match.verification_items,
      match_status: match.match_status,
      match_reason: match.match_reason,
      updated_at: new Date().toISOString(),
    });
  }
}

export async function markCandidatePlacedFromApplication(applicationId: string) {
  const { data: application, error } = await supabaseAdmin
    .schema("nata")
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle();

  if (error || !application) {
    console.error("Failed to load application for placed candidate protection:", error);
    return;
  }

  const email = normalize(application.email || application.candidate_email);
  if (!email) return;

  const now = new Date().toISOString();

  const { data: existing, error: existingError } = await supabaseAdmin
    .schema("nata")
    .from("candidates")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingError) {
    console.error("Failed to check placed candidate record:", existingError);
    return;
  }

  const payload = {
    name: label(application.name || application.candidate_name || application.email, "Candidate"),
    email,
    phone: label(application.phone || application.candidate_phone, ""),
    status: "placed",
    availability_status: "working_at_client",
    cooldown_until: null,
    updated_at: now,
  };

  if (existing?.id) {
    const { error: updateError } = await supabaseAdmin
      .schema("nata")
      .from("candidates")
      .update(payload)
      .eq("id", existing.id);

    if (updateError) console.error("Failed to protect placed candidate:", updateError);
    return;
  }

  const { error: insertError } = await supabaseAdmin.schema("nata").from("candidates").insert(payload);
  if (insertError) console.error("Failed to insert placed candidate protection record:", insertError);
}

export async function returnApplicationToCandidatePool(input: {
  applicationId: string;
  source: CandidatePoolReturnSource;
  reason: string;
}) {
  const { applicationId, source, reason } = input;

  const { data: application, error: applicationError } = await supabaseAdmin
    .schema("nata")
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle();

  if (applicationError || !application) {
    console.error("Failed to load application for candidate pool return:", applicationError);
    return null;
  }

  const status = normalize(application.status);

  if (PLACED_STATUSES.includes(status)) {
    await markCandidatePlacedFromApplication(applicationId);
    return null;
  }

  if (!POOL_RETURN_STATUSES.includes(status)) return null;

  const email = normalize(application.email || application.candidate_email);
  if (!email) return null;

  const { data: job } = await supabaseAdmin
    .schema("nata")
    .from("jobs")
    .select("*")
    .eq("id", application.job_id)
    .maybeSingle();

  const now = new Date().toISOString();
  const targetRoles = inferTargetRolesFromApplication(application, job);
  const experienceSummary = buildExperienceSummary(application, job, reason);

  const { data: existingCandidate, error: existingCandidateError } = await supabaseAdmin
    .schema("nata")
    .from("candidates")
    .select("id,contact_count,rejection_count")
    .eq("email", email)
    .maybeSingle();

  if (existingCandidateError) {
    console.error("Failed to check existing candidate before pool return:", existingCandidateError);
    return null;
  }

  const payload = {
    name: label(application.name || application.candidate_name || application.email, "Candidate"),
    email,
    phone: label(application.phone || application.candidate_phone, ""),
    linkedin: application.linkedin || null,
    location_text:
      application.location_text ||
      application.location ||
      application.city ||
      application.market ||
      null,
    resume_url:
      application.resume_url ||
      application.resume_public_url ||
      application.resume_path ||
      null,
    profile_photo_url:
      application.profile_photo_url ||
      application.photo_url ||
      application.candidate_photo_url ||
      null,
    target_roles: targetRoles,
    experience_summary: experienceSummary,
    status: "active",
    availability_status: status === "no_show" ? "cooldown" : "available",
    last_rejected_at: now,
    cooldown_until: addDays(getCooldownDays(status)),
    rejection_count: Number(existingCandidate?.rejection_count || 0) + 1,
    search_text: [
      application.name,
      application.email,
      application.phone,
      application.linkedin,
      application.location_text,
      targetRoles.join(" "),
      experienceSummary,
      reason,
      source,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
    updated_at: now,
  };

  let candidate: AnyRow | null = null;

  if (existingCandidate?.id) {
    const { data: updatedCandidate, error: updateError } = await supabaseAdmin
      .schema("nata")
      .from("candidates")
      .update(payload)
      .eq("id", existingCandidate.id)
      .select("*")
      .single();

    if (updateError || !updatedCandidate) {
      console.error("Failed to update candidate pool record:", updateError);
      return null;
    }

    candidate = updatedCandidate as AnyRow;
  } else {
    const { data: insertedCandidate, error: insertError } = await supabaseAdmin
      .schema("nata")
      .from("candidates")
      .insert(payload)
      .select("*")
      .single();

    if (insertError || !insertedCandidate) {
      console.error("Failed to insert candidate pool record:", insertError);
      return null;
    }

    candidate = insertedCandidate as AnyRow;
  }

  await syncCandidateMatches(candidate);

  const existingReason = label(application.decision_reason, "");
  const poolNote = `[Pool return: ${source}] ${reason}`;

  const { error: noteError } = await supabaseAdmin
    .schema("nata")
    .from("applications")
    .update({
      decision_reason: existingReason ? `${existingReason}\n${poolNote}` : poolNote,
    })
    .eq("id", applicationId);

  if (noteError) console.error("Failed to append candidate pool return note:", noteError);

  return candidate;
}

export async function incrementCandidateContactByEmail(emailValue: string) {
  const email = normalize(emailValue);
  if (!email) return;

  const { data: existing } = await supabaseAdmin
    .schema("nata")
    .from("candidates")
    .select("id,contact_count")
    .eq("email", email)
    .maybeSingle();

  if (!existing?.id) return;

  const nextContactCount = Number(existing.contact_count || 0) + 1;

  const { error } = await supabaseAdmin
    .schema("nata")
    .from("candidates")
    .update({
      last_contacted_at: new Date().toISOString(),
      contact_count: nextContactCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);

  if (error) console.error("Failed to increment candidate contact count:", error);
}
