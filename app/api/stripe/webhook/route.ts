import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
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

async function findExistingDealer(sessionId: string, subscriptionId: string) {
  if (subscriptionId) {
    const { data } = await supabaseAdmin
      .schema("nata")
      .from("dealers")
      .select("*")
      .eq("stripe_subscription_id", subscriptionId)
      .maybeSingle();

    if (data) return data;
  }

  if (sessionId) {
    const { data } = await supabaseAdmin
      .schema("nata")
      .from("dealers")
      .select("*")
      .eq("stripe_checkout_session_id", sessionId)
      .maybeSingle();

    if (data) return data;
  }

  return null;
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

function getPriceId(subscription: Stripe.Subscription | null) {
  const item = subscription?.items?.data?.[0];
  return item?.price?.id || "";
}

function getSubscriptionStatus(subscription: Stripe.Subscription | null, session: Stripe.Checkout.Session) {
  return subscription?.status || session.payment_status || "active";
}

async function provisionDealerFromSession(session: Stripe.Checkout.Session) {
  if (!stripe) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  const metadata = (session.metadata || {}) as Metadata;
  const subscriptionId = stripeId(session.subscription);
  const customerId = stripeId(session.customer);

  let subscription: Stripe.Subscription | null = null;

  if (subscriptionId) {
    subscription = await stripe.subscriptions.retrieve(subscriptionId);
  }

  const mergedMetadata = {
    ...(subscription?.metadata || {}),
    ...metadata,
  } as Metadata;

  const dealershipName = safeString(
    mergedMetadata.dealership_name || mergedMetadata.primary_rooftop_name || session.client_reference_id,
    "New dealership"
  );
  const city = safeString(mergedMetadata.city);
  const state = safeString(mergedMetadata.state);
  const dealershipLocationCount = safeInt(mergedMetadata.dealership_location_count, 1);
  const plan = safeString(mergedMetadata.plan, "active");
  const setupStage = safeString(mergedMetadata.setup_stage, "post_payment_hiring_setup_required");
  const billingStatus = getSubscriptionStatus(subscription, session);
  const priceId = getPriceId(subscription);

  const existingDealer = await findExistingDealer(session.id, subscriptionId);
  const assignedRecruiterId = await getDonRecruiterId();

  const dealerPayload = {
    name: dealershipName,
    website: safeString(mergedMetadata.website),
    city,
    state,
    contact_name: safeString(mergedMetadata.primary_contact),
    contact_email: safeString(mergedMetadata.contact_email || session.customer_email),
    contact_phone: safeString(mergedMetadata.contact_phone),
    contact_role: safeString(mergedMetadata.dealer_role),
    billing_unit: "dealership_location",
    dealership_location_count: dealershipLocationCount,
    multi_store_group: safeString(mergedMetadata.multi_store_group),
    plan,
    billing_status: billingStatus,
    pipeline_status: "active",
    setup_stage: setupStage,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    stripe_checkout_session_id: session.id,
    stripe_price_id: priceId,
    assigned_recruiter_id: assignedRecruiterId,
    notes: safeString(mergedMetadata.notes),
    updated_at: new Date().toISOString(),
  };

  if (existingDealer?.id) {
    const { data, error } = await supabaseAdmin
      .schema("nata")
      .from("dealers")
      .update(dealerPayload)
      .eq("id", existingDealer.id)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  const baseSlug = slugify(dealershipName, city, state);
  const slug = await makeUniqueDealerSlug(baseSlug);

  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("dealers")
    .insert({
      ...dealerPayload,
      slug,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

async function updateDealerSubscription(subscription: Stripe.Subscription, eventType: string) {
  const subscriptionId = subscription.id;
  const status = subscription.status;
  const customerId = stripeId(subscription.customer);
  const priceId = getPriceId(subscription);

  const updates: Record<string, unknown> = {
    billing_status: status,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    stripe_price_id: priceId,
    updated_at: new Date().toISOString(),
  };

  if (eventType === "customer.subscription.deleted") {
    updates.pipeline_status = "inactive";
  }

  const { error } = await supabaseAdmin
    .schema("nata")
    .from("dealers")
    .update(updates)
    .eq("stripe_subscription_id", subscriptionId);

  if (error) throw error;
}

async function updateDealerInvoice(invoice: Stripe.Invoice, status: "paid" | "failed") {
  const invoiceAny = invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null };
  const subscriptionId = stripeId(invoiceAny.subscription);

  if (!subscriptionId) {
    return;
  }

  const { error } = await supabaseAdmin
    .schema("nata")
    .from("dealers")
    .update({
      billing_status: status === "paid" ? "active" : "payment_failed",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscriptionId);

  if (error) throw error;
}

export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: "Missing STRIPE_SECRET_KEY" },
        { status: 500 }
      );
    }

    if (!webhookSecret) {
      return NextResponse.json(
        { error: "Missing STRIPE_WEBHOOK_SECRET" },
        { status: 500 }
      );
    }

    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing Stripe signature" },
        { status: 400 }
      );
    }

    const rawBody = await request.text();
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        const dealer = await provisionDealerFromSession(session);

        console.log("NATA dealer provisioned from Stripe checkout", {
          eventType: event.type,
          dealerId: dealer.id,
          dealerSlug: dealer.slug,
          subscription: session.subscription,
        });

        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;

        console.log("NATA Stripe checkout expired", {
          sessionId: session.id,
          customerEmail: session.customer_email,
          metadata: session.metadata,
        });

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await updateDealerSubscription(subscription, event.type);

        console.log("NATA Stripe subscription synced", {
          type: event.type,
          subscriptionId: subscription.id,
          status: subscription.status,
        });

        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await updateDealerInvoice(invoice, "paid");
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await updateDealerInvoice(invoice, "failed");
        break;
      }

      default:
        console.log(`Unhandled Stripe event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Stripe webhook failed",
      },
      { status: 400 }
    );
  }
}
