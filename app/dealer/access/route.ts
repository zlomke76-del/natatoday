import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { setDealerAccessCookie } from "../../../lib/dealerAccess";

export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

type Metadata = Record<string, string | undefined>;

function safeString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safeInt(value: unknown, fallback = 1) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, 99);
}

function slugify(...parts: string[]) {
  const base = parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return base || "dealer";
}

function stripeId(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    const possible = (value as { id?: unknown }).id;
    return typeof possible === "string" ? possible : "";
  }
  return "";
}

function appUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

async function getDonRecruiterId() {
  const { data } = await supabaseAdmin
    .schema("nata")
    .from("recruiters")
    .select("id")
    .eq("slug", "don")
    .eq("is_active", true)
    .maybeSingle();

  return data?.id || null;
}

async function makeUniqueDealerSlug(baseSlug: string) {
  const { data } = await supabaseAdmin
    .schema("nata")
    .from("dealers")
    .select("slug")
    .ilike("slug", `${baseSlug}%`);

  const existing = new Set((data || []).map((row) => row.slug));

  if (!existing.has(baseSlug)) {
    return baseSlug;
  }

  let counter = 2;
  let candidate = `${baseSlug}-${counter}`;

  while (existing.has(candidate)) {
    counter += 1;
    candidate = `${baseSlug}-${counter}`;
  }

  return candidate;
}

async function findDealerBySessionOrSubscription(sessionId: string, subscriptionId: string) {
  if (sessionId) {
    const { data } = await supabaseAdmin
      .schema("nata")
      .from("dealers")
      .select("*")
      .eq("stripe_checkout_session_id", sessionId)
      .maybeSingle();

    if (data) return data;
  }

  if (subscriptionId) {
    const { data } = await supabaseAdmin
      .schema("nata")
      .from("dealers")
      .select("*")
      .eq("stripe_subscription_id", subscriptionId)
      .maybeSingle();

    if (data) return data;
  }

  return null;
}

async function provisionDealerFallback(session: Stripe.Checkout.Session) {
  const metadata = (session.metadata || {}) as Metadata;
  const subscriptionId = stripeId(session.subscription);
  const customerId = stripeId(session.customer);

  const existing = await findDealerBySessionOrSubscription(session.id, subscriptionId);

  if (existing?.slug) {
    return existing;
  }

  const dealershipName = safeString(
    metadata.dealership_name || metadata.primary_rooftop_name || session.client_reference_id,
    "New dealership"
  );

  const city = safeString(metadata.city);
  const state = safeString(metadata.state);
  const baseSlug = slugify(dealershipName, city, state);
  const slug = await makeUniqueDealerSlug(baseSlug);
  const assignedRecruiterId = await getDonRecruiterId();

  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("dealers")
    .insert({
      slug,
      name: dealershipName,
      website: safeString(metadata.website),
      city,
      state,
      contact_name: safeString(metadata.primary_contact),
      contact_email: safeString(metadata.contact_email || session.customer_email),
      contact_phone: safeString(metadata.contact_phone),
      contact_role: safeString(metadata.dealer_role),
      billing_unit: "dealership_location",
      dealership_location_count: safeInt(metadata.dealership_location_count, 1),
      multi_store_group: safeString(metadata.multi_store_group),
      plan: safeString(metadata.plan, "active"),
      billing_status: session.payment_status === "paid" ? "active" : session.payment_status,
      pipeline_status: "active",
      setup_stage: safeString(metadata.setup_stage, "post_payment_hiring_setup_required"),
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      stripe_checkout_session_id: session.id,
      assigned_recruiter_id: assignedRecruiterId,
      notes: safeString(metadata.notes),
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function GET(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: "Missing STRIPE_SECRET_KEY" },
        { status: 500 }
      );
    }

    const sessionId = request.nextUrl.searchParams.get("session_id") || "";

    if (!sessionId) {
      return NextResponse.redirect(`${appUrl()}/pricing-page-intake-enrollmment?checkout=canceled`);
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "customer"],
    });

    if (session.mode !== "subscription") {
      return NextResponse.redirect(`${appUrl()}/pricing-page-intake-enrollmment?checkout=canceled`);
    }

    const isPaid =
      session.payment_status === "paid" ||
      session.status === "complete" ||
      Boolean(session.subscription);

    if (!isPaid) {
      return NextResponse.redirect(`${appUrl()}/pricing-page-intake-enrollmment?checkout=canceled`);
    }

    const dealer = await provisionDealerFallback(session);

    if (!dealer?.slug) {
      return NextResponse.redirect(`${appUrl()}/pricing-page-intake-enrollmment?checkout=canceled`);
    }

    const response = NextResponse.redirect(`${appUrl()}/dealer/${dealer.slug}/dashboard`);
    setDealerAccessCookie(response, dealer.slug);

    return response;
  } catch (error) {
    console.error("Dealer access grant failed:", error);

    return NextResponse.redirect(`${appUrl()}/pricing-page-intake-enrollmment?checkout=canceled`);
  }
}
