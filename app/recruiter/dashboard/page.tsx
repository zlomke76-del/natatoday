import { redirect } from "next/navigation";

export default function RecruiterRootRedirect() {
  // for now → always Don
  redirect("/recruiter/don/dashboard");
}
