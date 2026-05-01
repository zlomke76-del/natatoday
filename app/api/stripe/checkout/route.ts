import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

type PlanKey = "starter" | "active" | "full";

const PLAN_PRICE_ENV: Record<PlanKey, string> = {
  starter: "STRIPE_STARTER_PRICE_ID",
  active: "STRIPE_ACTIVE_PRICE_ID",
  full: "STRIPE_FULL_PRICE_ID",
};

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizePlan(value: string): PlanKey {
  if (value === "starter" || value === "active" || value === "full") {
    return value;
  }

  return "active";
}

function normalizeQuantity(value: string) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return Math.min(parsed, 99);
}

function appUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}` ||
    "http://localhost:3000"
  );
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
    }

    const formData = await request.formData();

    const dealershipName = getString(formData, "dealershipName");
    const website = getString(formData, "website");
    const city = getString(formData, "city");
    const state = getString(formData, "state");
    const primaryContact = getString(formData, "primaryContact");
    const email = getString(formData, "email");
    const phone = getString(formData, "phone");
    const dealerRole = getString(formData, "dealerRole");
    const multiStoreGroup = getString(formData, "multiStoreGroup");
    const notes = getString(formData, "notes");
    const acknowledgment = getString(formData, "perLocationAcknowledgment");
    const plan = normalizePlan(getString(formData, "plan"));
    const dealershipLocationCount = normalizeQuantity(getString(formData, "dealershipLocationCount"));

    if (!dealershipName || !city || !state || !primaryContact || !email || !phone) {
      return NextResponse.json(
        { error: "Missing required enrollment fields" },
        { status: 400 }
      );
    }

    if (acknowledgment !== "accepted") {
      return NextResponse.json(
        { error: "Per-location billing acknowledgment is required" },
        { status: 400 }
      );
    }

    const priceId = process.env[PLAN_PRICE_ENV[plan]];

    if (!priceId) {
      return NextResponse.json(
        { error: `Missing ${PLAN_PRICE_ENV[plan]}` },
        { status: 500 }
      );
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20",
    });

    const baseUrl = appUrl();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      allow_promotion_codes: true,
      client_reference_id: dealershipName,
      line_items: [
        {
          price: priceId,
          quantity: dealershipLocationCount,
        },
      ],
      success_url: `${baseUrl}/pricing-page-intake-enrollmment?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing-page-intake-enrollmment?checkout=canceled`,
      subscription_data: {
        metadata: {
          billing_unit: "dealership_location",
          plan,
          dealership_location_count: String(dealershipLocationCount),
          dealership_name: dealershipName.slice(0, 120),
          primary_rooftop_name: dealershipName.slice(0, 120),
          city: city.slice(0, 80),
          state: state.slice(0, 30),
          website: website.slice(0, 180),
          primary_contact: primaryContact.slice(0, 120),
          contact_email: email.slice(0, 180),
          contact_phone: phone.slice(0, 60),
          dealer_role: dealerRole.slice(0, 80),
          multi_store_group: multiStoreGroup.slice(0, 80),
          per_location_acknowledgment: acknowledgment,
          setup_stage: "post_payment_hiring_setup_required",
          notes: notes.slice(0, 450),
        },
      },
      metadata: {
        billing_unit: "dealership_location",
        plan,
        dealership_location_count: String(dealershipLocationCount),
        dealership_name: dealershipName.slice(0, 120),
        primary_rooftop_name: dealershipName.slice(0, 120),
        city: city.slice(0, 80),
        state: state.slice(0, 30),
        website: website.slice(0, 180),
        primary_contact: primaryContact.slice(0, 120),
        contact_email: email.slice(0, 180),
        contact_phone: phone.slice(0, 60),
        dealer_role: dealerRole.slice(0, 80),
        multi_store_group: multiStoreGroup.slice(0, 80),
        per_location_acknowledgment: acknowledgment,
        setup_stage: "post_payment_hiring_setup_required",
        notes: notes.slice(0, 450),
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe checkout session did not return a URL" },
        { status: 500 }
      );
    }

    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    console.error("Failed to create Stripe checkout session:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create Stripe checkout session",
      },
      { status: 500 }
    );
  }
}
