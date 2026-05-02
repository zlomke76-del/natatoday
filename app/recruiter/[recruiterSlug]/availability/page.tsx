import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import Nav from "../../../components/Nav";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import AvailabilityCalendarClient from "./AvailabilityCalendarClient";

type PageProps = {
  params: {
    recruiterSlug: string;
  };
  searchParams?: {
    week?: string;
    saved?: string;
  };
};

type AnyRow = Record<string, any>;

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const days = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
];

function getCurrentWeekStartSunday() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);

  return start.toISOString().slice(0, 10);
}

function getWeekStart(value: unknown) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return getCurrentWeekStartSunday();
}

function addDays(dateString: string, amount: number) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + amount);

  return date.toISOString().slice(0, 10);
}

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function loadRecruiter(slug: string) {
  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("recruiters")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("Failed to load recruiter:", error);
  }

  return data as AnyRow | null;
}

async function loadWeeklyAvailability(recruiterId: string, weekStart: string) {
  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("recruiter_weekly_availability")
    .select("*")
    .eq("recruiter_id", recruiterId)
    .eq("week_start", weekStart)
    .order("day_of_week", { ascending: true })
    .order("block_index", { ascending: true });

  if (error) {
    console.error("Failed to load weekly availability:", error);
  }

  return (data || []) as AnyRow[];
}

export default async function RecruiterAvailabilityPage({
  params,
  searchParams,
}: PageProps) {
  noStore();

  const recruiter = await loadRecruiter(params.recruiterSlug);
  const weekStart = getWeekStart(searchParams?.week);
  const previousWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);
  const saved = searchParams?.saved === "1";

  async function saveWeeklyAvailability(formData: FormData) {
    "use server";

    const recruiterId = clean(formData.get("recruiter_id"));
    const recruiterSlug = clean(formData.get("recruiter_slug"));
    const submittedWeekStart = clean(formData.get("week_start"));
    const submittedTimezone = clean(formData.get("timezone")) || "America/Chicago";
    const rawBlocks = clean(formData.get("availability_blocks"));

    if (!recruiterId || !recruiterSlug || !submittedWeekStart) {
      throw new Error("Missing recruiter availability context.");
    }

    let parsedBlocks: Array<{
      dayOfWeek: number;
      blockIndex: number;
      startTime: string;
      endTime: string;
      note: string;
      isAvailable: boolean;
    }> = [];

    try {
      parsedBlocks = rawBlocks ? JSON.parse(rawBlocks) : [];
    } catch (error) {
      console.error("Failed to parse availability blocks:", error);
      throw new Error("Availability blocks could not be read.");
    }

    const activeBlocks = parsedBlocks
      .filter((block) => {
        return (
          block.isAvailable === true &&
          Number.isInteger(block.dayOfWeek) &&
          Number.isInteger(block.blockIndex) &&
          typeof block.startTime === "string" &&
          typeof block.endTime === "string" &&
          /^\d{2}:\d{2}$/.test(block.startTime) &&
          /^\d{2}:\d{2}$/.test(block.endTime) &&
          block.startTime < block.endTime
        );
      })
      .map((block) => ({
        recruiter_id: recruiterId,
        week_start: submittedWeekStart,
        day_of_week: block.dayOfWeek,
        block_index: block.blockIndex,
        start_time: block.startTime,
        end_time: block.endTime,
        timezone: submittedTimezone,
        is_available: true,
        note: block.note?.trim() || null,
        updated_at: new Date().toISOString(),
      }));

    const activeDays = new Set(activeBlocks.map((block) => block.day_of_week));

    const closedDayRows = days
      .filter((day) => !activeDays.has(day.value))
      .map((day) => ({
        recruiter_id: recruiterId,
        week_start: submittedWeekStart,
        day_of_week: day.value,
        block_index: 0,
        start_time: null,
        end_time: null,
        timezone: submittedTimezone,
        is_available: false,
        note: null,
        updated_at: new Date().toISOString(),
      }));

    const payload = [...activeBlocks, ...closedDayRows];

    const { error: deleteError } = await supabaseAdmin
      .schema("nata")
      .from("recruiter_weekly_availability")
      .delete()
      .eq("recruiter_id", recruiterId)
      .eq("week_start", submittedWeekStart);

    if (deleteError) {
      console.error("Failed to clear recruiter weekly availability:", deleteError);
      throw new Error("Availability could not be saved.");
    }

    const { error: insertError } = await supabaseAdmin
      .schema("nata")
      .from("recruiter_weekly_availability")
      .insert(payload);

    if (insertError) {
      console.error("Failed to save recruiter weekly availability:", insertError);
      throw new Error("Availability could not be saved.");
    }

    redirect(
      `/recruiter/${recruiterSlug}/availability?week=${submittedWeekStart}&saved=1`
    );
  }

  if (!recruiter) {
    return (
      <main className="shell">
        <Nav />
        <section style={wrap}>
          <div className="eyebrow">Recruiter Availability</div>
          <h1>Recruiter not found.</h1>
          <p style={muted}>
            This recruiter workspace does not exist or is inactive.
          </p>
        </section>
      </main>
    );
  }

  const rows = await loadWeeklyAvailability(String(recruiter.id), weekStart);

  return (
    <main className="shell">
      <Nav />

      <AvailabilityCalendarClient
        recruiter={{
          id: String(recruiter.id),
          name: String(recruiter.name || "Recruiter"),
          slug: params.recruiterSlug,
          timezone: String(recruiter.timezone || "America/Chicago"),
        }}
        rows={rows}
        weekStart={weekStart}
        previousWeek={previousWeek}
        nextWeek={nextWeek}
        saved={saved}
        saveWeeklyAvailability={saveWeeklyAvailability}
      />
    </main>
  );
}

const wrap: React.CSSProperties = {
  width: "min(1320px, calc(100% - 40px))",
  margin: "0 auto",
  padding: "56px 0 92px",
};

const muted: React.CSSProperties = {
  color: "#cfe2ff",
  lineHeight: 1.6,
  maxWidth: 820,
};
