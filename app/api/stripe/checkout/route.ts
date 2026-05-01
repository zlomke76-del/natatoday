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

async function readCheckoutInput(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await request.json();
    return {
      plan: typeof body.plan === "string" ? body.plan.trim() : "active",
      dealerName: typeof body.dealershipName === "string" ? body.dealershipName.trim() : "",
      email: typeof body.email === "string" ? body.email.trim() : "",
      contact: typeof body.contact === "string" ? body.contact.trim() : "",
      phone: typeof body.phone === "string" ? body.phone.trim() : "",
      notes: typeof body.notes === "string" ? body.notes.trim() : "",
    };
  }

  const form = await request.formData();
  return {
    plan: String(form.get("plan") || "active").trim(),
    dealerName: String(form.get("dealershipName") || "").trim(),
    email: String(form.get("email") || "").trim(),
    contact: String(form.get("contact") || form.get("primaryContact") || "").trim(),
    phone: String(form.get("phone") || "").trim(),
    notes: String(form.get("notes") || "").trim(),
  };
}

export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: "Missing STRIPE_SECRET_KEY" },
        { status: 500 }
      );
    }

    const input = await readCheckoutInput(request);
    const plan = PRICE_BY_PLAN[input.plan] ? input.plan : "active";
    const priceId = PRICE_BY_PLAN[plan];

    if (!priceId) {
      return NextResponse.json(
        { error: `Missing Stripe price ID for plan: ${plan}` },
        { status: 500 }
      );
    }

    const baseUrl = getBaseUrl(request);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: input.email || undefined,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      phone_number_collection: {
        enabled: true,
      },
      metadata: {
        product: "nata_today_dealer_pipeline",
        plan,
        plan_name: LABEL_BY_PLAN[plan] || plan,
        dealer_name: input.dealerName,
        contact_name: input.contact,
        contact_phone: input.phone,
        notes: input.notes.slice(0, 450),
      },
      subscription_data: {
        metadata: {
          product: "nata_today_dealer_pipeline",
          plan,
          plan_name: LABEL_BY_PLAN[plan] || plan,
          dealer_name: input.dealerName,
          contact_name: input.contact,
          contact_phone: input.phone,
        },
      },
      success_url: `${baseUrl}/pricing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing?checkout=canceled`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe checkout session did not return a URL" },
        { status: 500 }
      );
    }

    return NextResponse.redirect(session.url, { status: 303 });
  } catch (error) {
    console.error("Stripe checkout failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Stripe checkout failed",
      },
      { status: 500 }
    );
  }
}
