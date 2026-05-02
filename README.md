# NATA Today — Hiring Operating System

## Overview

NATA Today is a **dealer-first hiring operating system** that replaces fragmented dealership recruiting with a structured, controlled, end-to-end pipeline:

```txt
Dealer enrollment
→ Secure dealer workspace
→ Dealer hiring request
→ Job generated
→ Candidate applies
→ Solace screening
→ Recruiter review
→ Controlled assignment
→ Interview invite
→ Candidate books 15-minute virtual interview
→ Virtual interview
→ Packet generation
→ Dealer interview
→ Dealer decision
→ Placement / closeout
```

The system is built to:

- Reduce dealer workload
- Improve candidate quality
- Control hiring flow from request to placement
- Give recruiters a true operating cockpit
- Support internal email + SMS candidate communication
- Support portable recruiter availability and scheduling
- Protect Don / lead recruiters from becoming unmanaged bottlenecks
- Keep dealers focused only on candidates ready for action

---

## Core Architecture

### 1. Dealer Layer

The dealer dashboard is a protected operating surface for each dealership.

Dealers can:

- Submit new hiring requests
- View open requests
- Remove / close requests manually when filled internally or no longer needed
- View filled / closed requests
- Review only manager-ready candidates
- Document interview outcomes

Dealer visibility rule:

```txt
Candidate appears on dealer board only when:
status = dealer_interview_scheduled OR dealer_review
AND dealer_interview_at IS NOT NULL
AND interview_packet_ready = true
```

Dealers should not see raw applicants, unreviewed applicants, candidates still in screening, or candidates without a prepared interview packet.

---

### 2. Secure Dealer Access

Dealer dashboards are protected.

Current access model:

```txt
Stripe checkout success
→ /dealer/access?session_id=...
→ session verified server-side
→ secure dealer cookie issued
→ redirect to /dealer/[dealerSlug]/dashboard
```

Direct slug access without a valid secure cookie shows an access-required screen.

JV override exception:

```txt
/dealer/jersey-village-cdjr/override?key=...
```

This override is only for the JV demo dealer and is protected by:

```env
NATA_JV_OVERRIDE_KEY=
```

All other dealer access must use secure session / access flow.

---

### 3. Recruiter / Don Control Center

The recruiter dashboard is the daily command center.

Recruiters can see:

- Active clients
- Open jobs
- Assigned candidates
- Review-required candidates
- Interview-ready candidates
- Passed / blocked candidates
- Candidate profile photo
- Resume link
- Email and phone
- Solace fit score
- Role-specific score threshold
- Why the score was assigned
- Recruiter verification checklist
- Candidate support / coaching notes
- Approve / Hold / Pass actions

Recruiter dashboard route:

```txt
/recruiter/[recruiterSlug]/dashboard
```

Don’s dashboard:

```txt
/recruiter/don/dashboard
```

---

### 4. Recruiter Admin Platform

Admin route:

```txt
/recruiter/admin
```

The recruiter admin platform supports:

- Add recruiters / agents
- Define role and permission profile
- Send secure recruiter invites
- Activate recruiters through invite flow
- Assign candidates manually
- View workforce load
- Monitor backlog
- Trigger controlled auto-assignment / balancing

Admin authority is explicit. Don / admin users operate with full visibility. Recruiters and agents should only see work within their assigned scope unless permissions grant broader access.

---

## Recruiter Invite + Activation System

Recruiter onboarding is controlled through invite state, not open account creation.

Flow:

```txt
Admin submits recruiter invite
→ POST /api/nata/recruiters/invite
→ recruiter created / updated as invited
→ raw token generated
→ token_hash stored in nata.recruiter_invites
→ email + SMS sent with raw token URL
→ recruiter opens /recruiter/invite/[token]
→ token is hashed server-side
→ token_hash lookup validates invite
→ recruiter activates workspace
→ recruiter.status = active
→ recruiter session cookie issued
→ redirect to recruiter dashboard
```

Important security rule:

```txt
Raw token is sent only in the URL.
Only token_hash is stored in the database.
```

Relevant routes:

```txt
/api/nata/recruiters/invite
/api/nata/recruiters/accept-invite
/recruiter/invite/[token]
```

Recruiter invite states:

```txt
pending
accepted
expired
revoked
```

Recruiter account states:

```txt
invited
active
suspended
```

---

## Recruiter Access Control

Recruiter routes are protected by a recruiter session bridge.

Current minimum access model:

```txt
Invite accepted
→ secure recruiter cookies issued:
   nata_recruiter_id
   nata_recruiter_slug
   nata_recruiter_role
→ /recruiter/[slug]/dashboard allowed only for matching recruiter
→ admin can access broader recruiter routes
```

Public recruiter paths:

```txt
/recruiter/invite/[token]
/recruiter/admin
/api/nata/recruiters/invite
/api/nata/recruiters/accept-invite
```

System rule:

```txt
No active recruiter session → no recruiter workspace access.
Wrong recruiter slug → redirect to authenticated recruiter's dashboard unless admin.
```

Future hardening:

- Replace simple cookie bridge with full authenticated recruiter account model
- Server-validate recruiter status on each protected request
- Enforce API-level role permissions for all recruiter actions

---

## Assignment + Auto-Balancing System

NATA now has a controlled assignment engine.

It is not a generic auto-router. It is a throughput protection layer.

Assignment priority:

```txt
1. Dealer / dealer-group assignment
2. Manual admin assignment
3. Existing assigned recruiter
4. Controlled assist / auto assignment only under imbalance
```

Core principle:

```txt
Manual assignment stays primary.
Dealer intent wins.
Auto-assignment only protects flow when workload imbalance becomes significant.
```

### Assignment Modes

```txt
manual
suggest
auto_one
auto_balance
rebalance_one
no_auto
```

### Manual Assignment

Manual assignment always wins.

Used when:

- Don assigns a candidate directly
- A dealer / group has an assigned recruiter
- Admin wants a specific recruiter to own the file

Manual assignment should not be overwritten by the auto engine unless explicitly rebalanced by admin.

---

### Dealer / Group-Based Assignment

Most candidates should route according to dealer or dealer group.

Preferred behavior:

```txt
application.job_id
→ job.dealer_id
→ dealer.assigned_recruiter_id
→ application.recruiter_id
```

If a dealer has a default recruiter, that recruiter should receive the candidate unless an admin overrides it.

This preserves dealer continuity and prevents recruiters from becoming interchangeable when relationship context matters.

---

### Controlled Auto Assignment

Auto-assignment is a pressure valve.

It should activate only when operational flow is at risk:

```txt
unassigned eligible backlog exceeds threshold
OR recruiter load variance exceeds threshold
OR Don / lead recruiter load exceeds threshold
```

The system should prefer assistive routing first:

```txt
Suggest assignment
→ show who should receive overflow
→ allow admin to confirm
```

Auto-routing should be reserved for clear backlog or imbalance conditions.

---

### Load Scoring

Recruiter load should include both assigned candidates and interview obligations.

Baseline load score:

```txt
load_score =
  assigned_candidate_count
+ active_interview_count * 3
```

Interview bookings matter more because interviews are the bottleneck.

Important bottleneck reality:

```txt
Don currently performs most or all virtual interviews.
Future recruiters / agents may assist with virtual interviews.
```

Therefore, the engine should protect Don from overload while keeping candidate flow moving.

---

### Eligible Candidates for Auto Assignment

A candidate is eligible for controlled assignment when:

```txt
application.recruiter_id IS NULL
AND application is not rejected / not_fit
AND candidate is still active in the recruiter-side pipeline
```

Typical eligible states:

```txt
needs_review
review
ready
virtual_invited
virtual_scheduled
```

Candidates should not be auto-assigned after dealer handoff unless explicitly rebalanced by admin.

---

### What Auto Assignment Must Not Do

The engine must not:

- Override dealer-assigned recruiter silently
- Override manual admin assignment silently
- Send raw applicants directly to dealers
- Treat all recruiters as interchangeable when dealer continuity matters
- Route candidates to inactive recruiters
- Route interview work to recruiters without interview permission / availability
- Hide the reason an assignment happened

Every automated assignment should be explainable.

Example explanation:

```txt
Assigned to Sarah because Don exceeded interview load threshold and Sarah had the lowest active load score.
```

---

## Candidate Lifecycle

Primary lifecycle:

```txt
new
→ screening
→ needs_review
→ virtual_invited
→ virtual_scheduled
→ virtual_completed
→ packet_ready
→ dealer_interview_scheduled
→ dealer_review
→ placed | not_hired | keep_warm | no_show | needs_followup
```

Additional states currently in use:

```txt
not_fit
review
ready
dealer_interview_scheduled
virtual_completed
```

Preferred future cleanup:

```txt
Standardize status values and reduce duplicate meanings between:
status
screening_status
virtual_interview_status
```

---

## Solace Screening + Fit Score

Solace screening is role-gated, not generic.

Fit score is interpreted against the role applied for.

### Role Thresholds

```txt
Sales Consultant
80–100 = Interview ready
60–79  = Recruiter review
0–59   = Do not advance automatically

Service Advisor
82–100 = Interview ready
65–81  = Recruiter review
0–64   = Do not advance automatically

Service Technician
78–100 = Interview ready
60–77  = Recruiter review
0–59   = Do not advance automatically

BDC Representative
76–100 = Interview ready
58–75  = Recruiter review
0–57   = Do not advance automatically

Parts Advisor
75–100 = Interview ready
58–74  = Recruiter review
0–57   = Do not advance automatically

Finance Manager
85–100 = Interview ready
70–84  = Recruiter review
0–69   = Do not advance automatically
```

### Recruiter Gating Rule

A candidate below the interview-ready threshold should not automatically enter the interview studio.

Correct flow:

```txt
Solace score + role threshold
→ recruiter review required if below interview-ready
→ recruiter approves, holds, or passes
→ only approved candidates receive interview invite
```

---

## Candidate Support Tools

The system should support candidates, not merely reject them.

Recruiter cards surface:

- Why the score was assigned
- Missing proof
- Verification checklist
- Candidate coaching notes

Examples:

```txt
Add measurable sales outcomes such as rank, revenue, close rate, or units sold.
Add automotive / high-ticket sales proof if available.
Add examples of objection handling, follow-up discipline, and appointment setting.
```

This creates a candidate-development layer, not just a screening layer.

---

## Interview Invitation Flow

When a recruiter approves a candidate:

```txt
Approve + send invite
→ application.status = virtual_invited
→ application.screening_status = virtual_invited
→ application.virtual_interview_status = invited
→ internal scheduling link generated
→ email sent via Resend
→ SMS sent via Twilio
```

Scheduling link format:

```txt
/candidate/schedule/[applicationId]
```

The invite is internal and portable across recruiters.

---

## Recruiter Availability System

Recruiters control their availability week by week.

Route:

```txt
/recruiter/[recruiterSlug]/availability
```

Supports:

- Sunday through Saturday availability
- Start / end time per day
- Recruiter timezone
- Notes per day
- Previous / next week navigation
- Weekly schedule updates

Availability convention:

```txt
0 = Sunday
1 = Monday
2 = Tuesday
3 = Wednesday
4 = Thursday
5 = Friday
6 = Saturday
```

Availability is stored in the recruiter’s timezone.

Bookings are stored as `timestamptz` so the system can safely handle conversion later.

---

## Candidate Scheduling

Candidate scheduling route:

```txt
/candidate/schedule/[applicationId]
```

Candidate sees:

- Candidate name
- Role
- Dealer
- Recruiter
- Recruiter timezone
- Available 15-minute interview slots

Booking engine:

```txt
Recruiter weekly availability
→ remove existing bookings
→ remove recruiter blackouts
→ return valid 15-minute slots
```

When candidate books:

```txt
nata.interview_bookings insert
→ application.virtual_interview_at set
→ application.virtual_interview_status = scheduled
→ application.screening_status = virtual_scheduled
→ virtual meeting room/link created
→ confirmation email sent
→ confirmation SMS sent
```

---

## Virtual Meeting Link

The confirmation message must send the candidate to the **specific virtual meeting link**, not just the scheduling page.

Stored fields:

```txt
applications.virtual_interview_room_url
applications.virtual_interview_room_name
applications.virtual_interview_url
interview_bookings.meeting_url
interview_bookings.meeting_room_name
```

Preferred room creation:

```txt
DAILY_API_KEY present
→ create Daily room
→ store Daily room URL
→ email/SMS include Join virtual interview link
```

Fallback:

```txt
NATA_VIRTUAL_MEETING_BASE_URL or NEXT_PUBLIC_DAILY_BASE_URL
→ generate internal room-style URL
```

---

## Interview Studio

Daily powers virtual interviews inside the NATA system.

Current intended flow:

```txt
Candidate books
→ Daily room created/stored
→ candidate receives meeting link
→ recruiter opens interview studio
→ notes captured
→ interview completed
→ packet generated
```

Relevant fields:

```txt
virtual_interview_room_url
virtual_interview_room_name
virtual_interview_notes
virtual_interview_completed_at
virtual_interview_status
```

---

## Interview Packet System

Generated after the virtual interview.

Stored in:

```txt
nata.interview_packets
```

Includes:

- NATA / Solace notes
- Resume link
- Interview questions
- Verification items
- Recruiter packet notes

Packet readiness field:

```txt
applications.interview_packet_ready
```

Dealer handoff requires packet readiness.

---

## Dealer Interview Handoff

Correct handoff:

```txt
virtual_completed
→ packet generated
→ interview_packet_ready = true
→ dealer_interview_at scheduled
→ status = dealer_interview_scheduled
→ candidate appears on dealer dashboard
```

Dealer decision options:

```txt
hired
not_hired
keep_warm
no_show
needs_followup
```

If hired:

```txt
job.publish_status = filled
job.is_active = false
job.filled_at set
job.filled_by_application_id set
```

---

## Manual Dealer Request Closeout

Dealers can remove an open hiring request when:

- Filled by walk-in candidate
- Filled internally
- Role paused
- No longer needed

This updates:

```txt
publish_status = filled
is_active = false
filled_at = now()
filled_note = dealer note
closed_reason = selected reason
```

The request leaves Open Requests and appears in closed / filled history.

---

## Job Distribution

Jobs are generated and normalized by the system, not written directly by dealers.

Current distribution endpoint:

```txt
/api/nata/jobs/feed.xml
```

Jobs should be Indeed-safe and distribution-ready.

Distribution fields in use:

```txt
publish_mode
publish_status
distribution_status
distribution_approved_at
distribution_notes
```

---

## Stripe Billing

NATA uses Stripe for dealer subscription checkout.

Pricing is per dealership location / rooftop.

Plan mapping:

```txt
Starter Pipeline       $995 / month / dealership location
Active Pipeline        $1,295 / month / dealership location
Full Pipeline Coverage $1,595 / month / dealership location
```

Stripe price IDs:

```env
STRIPE_STARTER_PRICE_ID=
STRIPE_ACTIVE_PRICE_ID=
STRIPE_FULL_PRICE_ID=
```

Checkout flow:

```txt
/pricing
→ redirect/stub
→ /pricing-page-intake-enrollmment
→ Stripe checkout
→ webhook
→ dealer provisioning
```

Webhook events:

```txt
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.expired
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.payment_succeeded
invoice.payment_failed
```

Webhook route:

```txt
/api/stripe/webhook
```

Webhook responsibilities:

```txt
Create/update dealer
Store plan
Store rooftop quantity
Store Stripe customer/subscription/session
Assign recruiter
Set pipeline active
```

---

## Email + SMS Notifications

### Email

Provider:

```txt
Resend
```

Used for:

- Recruiter invite
- Interview invitation
- Booking confirmation
- Future reminders

### SMS

Provider:

```txt
Twilio
```

Used for:

- Recruiter invite
- Interview invitation
- Booking confirmation
- Future reminders

SMS should be treated as a notification channel, not the scheduling engine.

Required communication guardrail:

```txt
Only text candidates for application/interview-related communication.
Only text recruiters for access, assignment, or operational notices.
```

---

## Environment Variables

```env
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

NATA_ADMIN_KEY=
NEXT_PUBLIC_NATA_ADMIN_KEY=

RESEND_API_KEY=
NATA_EMAIL_FROM=

DAILY_API_KEY=
NATA_VIRTUAL_MEETING_BASE_URL=
NEXT_PUBLIC_DAILY_BASE_URL=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_STARTER_PRICE_ID=
STRIPE_ACTIVE_PRICE_ID=
STRIPE_FULL_PRICE_ID=

DEALER_ACCESS_SECRET=
NATA_JV_OVERRIDE_KEY=

TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_WEBHOOK_BASE_URL=
```

Example Twilio number format:

```txt
TWILIO_PHONE_NUMBER=+12819381180
```

---

## Database Tables

Core existing:

```txt
nata.jobs
nata.applications
nata.interview_packets
nata.decision_records
nata.recruiters
nata.recruiter_invites
nata.dealers
```

Scheduling:

```txt
nata.recruiter_weekly_availability
nata.recruiter_blackouts
nata.interview_bookings
```

Future notification logging:

```txt
nata.notifications
```

Potential future agent layer:

```txt
nata.agent_assignments
```

---

## Key Tables — Important Fields

### nata.applications

Important fields:

```txt
id
job_id
name
email
phone
resume_url
profile_photo_url
status
screening_status
screening_summary
fit_score
decision_reason
virtual_interview_url
virtual_interview_at
virtual_interview_status
virtual_interview_room_url
virtual_interview_room_name
virtual_interview_notes
virtual_interview_completed_at
interview_packet_ready
interview_questions
verification_items
interview_packet_id
assigned_recruiter
recruiter_id
```

### nata.jobs

Important fields:

```txt
id
dealer_id
dealer_slug
title
slug
location
salary
description
requirements
is_active
publish_mode
public_dealer_name
public_location
publish_status
filled_at
filled_by_application_id
filled_note
closed_reason
distribution_status
```

### nata.dealers

Important fields:

```txt
id
slug
name
city
state
pipeline_status
billing_status
assigned_recruiter_id
multi_store_group
dealership_location_count
plan
stripe_customer_id
stripe_subscription_id
```

### nata.recruiters

Important fields:

```txt
id
name
slug
role
status
is_active
email
phone
title
manager_recruiter_id
permissions
owner_id
invited_at
activated_at
```

### nata.recruiter_invites

Important fields:

```txt
id
recruiter_id
token_hash
status
sent_to_email
sent_to_phone
expires_at
accepted_at
revoked_at
created_at
updated_at
```

### nata.recruiter_weekly_availability

```txt
id
recruiter_id
week_start
day_of_week
start_time
end_time
timezone
is_available
note
created_at
updated_at
```

### nata.interview_bookings

```txt
id
application_id
recruiter_id
starts_at
ends_at
timezone
status
meeting_url
meeting_room_name
booking_token
candidate_email
candidate_phone
created_at
updated_at
```

---

## System Rules

### State-Driven Operation

No candidate should move because of a hardcoded UI assumption.

Everything should be based on state:

```txt
status
screening_status
fit_score
role threshold
recruiter assignment
interview readiness
packet readiness
dealer interview time
```

---

### Dealer Protection

Dealer dashboard should not become a raw applicant feed.

Dealer sees:

```txt
ready candidate
scheduled manager interview
packet prepared
decision required
```

Dealer does not see:

```txt
raw applicant
unreviewed candidate
candidate still being screened
candidate without packet
```

---

### Recruiter Control

Recruiter controls:

```txt
candidate approval
hold/pass decisions
weekly availability
interview flow
packet preparation
candidate progression
```

---

### Assignment Governance

Assignment is governed by relationship, authority, and operational load.

Rules:

```txt
Dealer assignment wins.
Manual admin assignment wins.
Existing assignment is respected.
Auto assignment only applies to eligible unassigned candidates or explicit rebalance actions.
Inactive recruiters cannot receive assignments.
Don overload should trigger assist / overflow behavior, not silent uncontrolled routing.
```

---

### Candidate Support

Candidates should receive:

```txt
clear next step
scheduling link
meeting link
support guidance
confirmation
reminders
```

The system should help qualified-but-incomplete candidates improve their application rather than simply drop them without context.

---

## What’s Working

```txt
✔ Dealer request creation
✔ Dealer dashboard
✔ Secure dealer access
✔ Manual dealer closeout
✔ Stripe checkout
✔ Stripe webhook provisioning
✔ Recruiter dashboard
✔ Recruiter admin console
✔ Recruiter invite creation
✔ Secure recruiter invite activation
✔ Recruiter session bridge
✔ Assignment-based visibility model
✔ Controlled auto-assignment / load balancing layer
✔ Role-specific fit thresholds
✔ Candidate support/review panel
✔ Resume + photo visibility
✔ Recruiter approve / hold / pass actions
✔ Weekly recruiter availability
✔ Weekend availability
✔ Timezone-aware availability storage
✔ Candidate scheduling page
✔ 15-minute slot booking
✔ Email invite
✔ SMS invite
✔ Booking confirmation email/SMS
✔ Virtual meeting link storage
✔ XML job feed
```

---

## Next Priorities

```txt
1. Finish reminder system:
   - 24-hour reminder
   - 1-hour reminder
   - no-show handling

2. Complete recruiter interview studio integration with scheduled rooms:
   - recruiter sees upcoming bookings
   - join virtual room
   - notes capture
   - complete interview
   - packet generation after completion

3. Harden recruiter access:
   - server-side status validation
   - API-level role checks
   - admin / recruiter / agent permission enforcement

4. Refine auto-assignment:
   - dealer-group assignment preferences
   - visible assignment explanations
   - Don overload threshold tuning
   - recruiter capacity settings
   - suggest-first UI before full automation

5. Add candidate-facing support page:
   - improve resume
   - upload better proof
   - confirm availability
   - explain fit score

6. Add notification logging:
   - email sent
   - SMS sent
   - delivery status
   - failure tracking

7. Add recruiter blackouts UI:
   - block lunch
   - PTO
   - one-off unavailable periods

8. Expand job distribution:
   - Indeed API
   - ZipRecruiter
   - dealership careers embed

9. Add agent portal:
   - recruiter assignment
   - agent sourcing
   - performance tracking
```

---

## System Philosophy

NATA Today is not a job board.

It is:

```txt
A controlled hiring pipeline
```

Principles:

- Dealers do not write jobs manually; Solace structures them
- Candidates are screened before dealer interaction
- Recruiters control progression
- Assignment respects dealer relationship first
- Automation exists to protect throughput, not replace judgment
- Availability controls scheduling
- Every decision must be documented
- No candidate reaches a manager without sufficient state
- Communication is system-driven and auditable
- The dealer sees action-ready candidates, not recruiting noise

---

## Bottom Line

NATA Today turns hiring from:

```txt
manual, reactive, fragmented
```

into:

```txt
structured, controlled, recruiter-assisted, load-aware, and scalable
```

The system now has the foundation for a true hiring operating system:

```txt
State controls progression.
Assignment controls visibility.
Availability controls scheduling.
Packets control dealer handoff.
Automation protects flow only when the system is under pressure.
```

---

## Internal Operations

- [Recruiter & Agent Playbook](./docs/ops/RECRUITER_PLAYBOOK.md)

---

## Contact

Built and operated under:

```txt
NATA Today / Moral Clarity AI
```
