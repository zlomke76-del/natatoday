import { redirect } from "next/navigation";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function RecruiterRoot() {
  const recruiterSlug = "don";

  const { data } = await supabaseAdmin
    .schema("nata")
    .from("recruiters")
    .select("slug, role")
    .eq("slug", recruiterSlug)
    .single();

  if (!data) {
    redirect("/");
  }

  if (data.role === "admin") {
    redirect(`/recruiter/admin`);
  }

  redirect(`/recruiter/${data.slug}/dashboard`);
}
