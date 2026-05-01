import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

const PRICE_BY_PLAN: Record<string, string | undefined> = {
  starter: process.env.STRIPE_STARTER_PRICE_ID,
  active: process.env.STRIPE_ACTIVE_PRICE_ID || process.env.STRIPE_MONTHLY_PRICE_ID,
  full: process.env.STRIPE_FULL_PRICE_ID,
};

const LABEL_BY_PLAN: Record<string, string> = {
  starter: "Starter Pipeline",
  active: "Active Pipeline",
  full: "Full Pipeline Coverage",
};

function getBaseUrl(request: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const origin = request.headers.get("origin");
  if (origin) return origin.replace(/\/$/, "");

  return "https://www.natatoday.ai";
}

function clean(value: FormDataEntryValue | null, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function cleanList(value: FormDataEntryValue | null) {
  const text = clean(value);
  return text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .join(", ");
}

async function readCheckoutInput(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await request.json();
    const roles = Array.isArray(body.rolesNeeded)
      ? body.rolesNeeded.join(", ")
      : typeof body.rolesNeeded === "string"
        ? body.rolesNeeded
        : "";

    const certifications = Array.isArray(body.certificationNeeds)
      ? body.certificationNeeds.join(", ")
      : typeof body.certificationNeeds === "string"
        ? body.certificationNeeds
        : "";

    return {
      plan: typeof body.plan === "string" ? body.plan.trim() : "active",
      dealershipName: typeof body.dealershipName === "string" ? body.dealershipName.trim() : "",
      website: typeof body.website === "string" ? body.website.trim() : "",
      city: typeof body.city === "string" ? body.city.trim() : "",
      state: typeof body.state === "string" ? body.state.trim() : "",
      primaryContact: typeof body.primaryContact === "string" ? body.primaryContact.trim() : "",
      email: typeof body.email === "string" ? body.email.trim() : "",
      phone: typeof body.phone === "string" ? body.phone.trim() : "",
      dealerRole: typeof body.dealerRole === "string" ? body.dealerRole.trim() : "",
      dealerGroupSize: typeof body.dealerGroupSize === "string" ? body.dealerGroupSize.trim() : "",
      monthlyHiringTarget: typeof body.monthlyHiringTarget === "string" ? body.monthlyHiringTarget.trim() : "",
      urgency: typeof body.urgency === "string" ? body.urgency.trim() : "standard",
      rolesNeeded: roles,
      certificationNeeds: certifications,
      notes: typeof body.notes === "string" ? body.notes.trim() : "",
    };
  }

  const form = await request.formData();

  return {
    plan: clean(form.get("plan"), "active"),
    dealershipName: clean(form.get("dealershipName")),
    website: clean(form.get("website")),
    city: clean(form.get("city")),
    state: clean(form.get("state")),
    primaryContact: clean(form.get("primaryContact")),
    email: clean(form.get("email")),
    phone: clean(form.get("phone")),
    dealerRole: clean(form.get("dealerRole")),
    dealerGroupSize: clean(form.get("dealerGroupSize")),
    monthlyHiringTarget: clean(form.get("monthlyHiringTarget")),
    urgency: clean(form.get("urgency"), "standard"),
    rolesNeeded: cleanList(form.get("rolesNeeded")),
    certificationNeeds: cleanList(form.get("certificationNeeds")),
    notes: clean(form.get("notes")),
  };
}

export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json({ error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
    }

    const input = await readCheckoutInput(request);
    const plan = PRICE_BY_PLAN[input.plan] ? input.plan : "active";
    const priceId = PRICE_BY_PLAN[plan];

    if (!priceId) {
      return NextResponse.json({ error: `Missing Stripe price ID for plan: ${plan}` }, { status: 500 });
    }

    if (!input.dealershipName || !input.email) {
      return NextResponse.json({ error: "Dealership name and email are required" }, { status: 400 });
    }

    const baseUrl = getBaseUrl(request);
    const intakeSummary = [
      `Dealer: ${input.dealershipName}`,
      `Contact: ${input.primaryContact}`,
      `Location: ${input.city}, ${input.state}`,
      `Roles: ${input.rolesNeeded}`,
      `Certifications: ${input.certificationNeeds}`,
      `Volume: ${input.monthlyHiringTarget}`,
      `Urgency: ${input.urgency}`,
      `Notes: ${input.notes}`,
    ]
      .filter((line) => !line.endsWith(": "))
      .join(" | ")
      .slice(0, 495);

    const metadata = {
      product: "nata_today_dealer_pipeline",
      plan,
      plan_name: LABEL_BY_PLAN[plan] || plan,
      dealer_name: input.dealershipName.slice(0, 120),
      website: input.website.slice(0, 120),
      city: input.city.slice(0, 80),
      state: input.state.slice(0, 40),
      contact_name: input.primaryContact.slice(0, 120),
      contact_email: input.email.slice(0, 120),
      contact_phone: input.phone.slice(0, 60),
      dealer_role: input.dealerRole.slice(0, 80),
      group_size: input.dealerGroupSize.slice(0, 80),
      monthly_hiring_target: input.monthlyHiringTarget.slice(0, 80),
      urgency: input.urgency.slice(0, 40),
      roles_needed: input.rolesNeeded.slice(0, 450),
      certification_needs: input.certificationNeeds.slice(0, 450),
      intake_summary: intakeSummary,
    };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: input.email || undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      phone_number_collection: { enabled: true },
      metadata,
      subscription_data: { metadata },
      success_url: `${baseUrl}/pricing-page-intake-enrollmment?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing-page-intake-enrollmment?checkout=canceled`,
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe checkout session did not return a URL" }, { status: 500 });
    }

    return NextResponse.redirect(session.url, { status: 303 });
  } catch (error) {
    console.error("Stripe checkout failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Stripe checkout failed" },
      { status: 500 }
    );
  }
}
