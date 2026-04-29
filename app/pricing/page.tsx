import Link from "next/link";
import Nav from "../components/Nav";

const dealershipRoles = [
  "Dealer Principal",
  "General Manager",
  "Service Director",
  "Fixed Ops Director",
  "Sales Manager",
  "HR / Recruiting",
];

const priorityNeeds = [
  "Service Technicians",
  "Service Advisors",
  "Sales Consultants",
  "BDC Representatives",
  "Parts Advisors",
  "Multiple roles",
];

const certificationNeeds = [
  "ASE certification visibility",
  "OEM certification tracking",
  "Master Certified technician priority",
  "Entry-level training pathway",
  "Interview scheduling support",
  "Candidate pre-screening",
];

const volumeOptions = [
  "1 dealership",
  "2–5 dealerships",
  "6–15 dealerships",
  "16+ dealerships / group",
];

export default function PricingIntakePage() {
  return (
    <main className="shell">
      <Nav />

      <section className="wrap" style={{ padding: "54px 0 90px" }}>
        
        {/* HEADER */}
        <div style={{ maxWidth: 780 }}>
          <div className="eyebrow">Dealer enrollment</div>

          <h1 style={{ fontSize: "clamp(44px,6vw,72px)", lineHeight: 0.95 }}>
            Tell us what your store needs. <br />
            We set up the pipeline.
          </h1>

          <p className="lede">
            No pricing yet. First we understand your hiring needs — especially technicians —
            then we build the system around your store.
          </p>
        </div>

        {/* FORM */}
        <form
          style={{
            marginTop: 32,
            padding: 28,
            borderRadius: 24,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <div className="grid-2" style={{ gap: 16 }}>
            <FormField label="Dealership name" name="dealershipName" />
            <FormField label="Website" name="website" required={false} />
            <FormField label="City" name="city" />
            <FormField label="State" name="state" />
            <FormField label="Contact name" name="contact" />
            <FormField label="Email" name="email" type="email" />
            <FormField label="Phone" name="phone" />
          </div>

          <div style={{ marginTop: 24 }}>
            <SelectField label="Your role" name="role" options={dealershipRoles} />
          </div>

          <div style={{ marginTop: 16 }}>
            <SelectField label="Dealer group size" name="size" options={volumeOptions} />
          </div>

          <div style={{ marginTop: 24 }}>
            <ChoiceGroup title="Priority roles" name="priorityRoles" options={priorityNeeds} />
          </div>

          <div style={{ marginTop: 16 }}>
            <ChoiceGroup title="Important signals" name="signals" options={certificationNeeds} />
          </div>

          <div style={{ marginTop: 20 }}>
            <label>
              <strong>What matters most?</strong>
              <textarea
                style={inputStyle}
                rows={4}
                placeholder="Example: We need master-certified techs and fewer wasted interviews."
              />
            </label>
          </div>

          <div style={{ marginTop: 28 }}>
            <button className="btn btn-primary">
              Start enrollment
            </button>
          </div>
        </form>

        {/* CLOSE */}
        <p style={{ marginTop: 20, color: "#9fb4d6" }}>
          You’re not buying software — you’re removing the work before hiring.
        </p>

      </section>
    </main>
  );
}

/* COMPONENTS */

function FormField({
  label,
  name,
  type = "text",
  required = true,
}: any) {
  return (
    <label>
      <span>{label}</span>
      <input name={name} type={type} required={required} style={inputStyle} />
    </label>
  );
}

function SelectField({ label, name, options }: any) {
  return (
    <label>
      <span>{label}</span>
      <select name={name} style={inputStyle}>
        <option>Select</option>
        {options.map((o: string) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function ChoiceGroup({ title, name, options }: any) {
  return (
    <div>
      <strong>{title}</strong>
      <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
        {options.map((o: string) => (
          <label key={o}>
            <input type="checkbox" name={name} value={o} /> {o}
          </label>
        ))}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "#111",
  color: "#fff",
};
