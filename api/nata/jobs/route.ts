import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .schema("nata")
      .from("jobs")
      .select(
        "id,title,slug,location,type,salary,description,requirements,dealer_slug,created_at,publish_mode,public_dealer_name,public_location,confidential_note,published_by,publish_status"
      )
      .eq("is_active", true)
      .eq("publish_status", "published")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Jobs fetch error:", error);
      return NextResponse.json({ jobs: [] }, { status: 500 });
    }

    return NextResponse.json({ jobs: data || [] });
  } catch (err) {
    console.error("Jobs route error:", err);
    return NextResponse.json({ jobs: [] }, { status: 500 });
  }
}
