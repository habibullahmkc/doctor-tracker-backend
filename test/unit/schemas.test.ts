import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { doctorBodySchema, doctorQuerySchema, doctorUpdateSchema } from "../../src/modules/doctors/doctor.schema";
import {
  patientCreateForDoctorSchema,
  patientQuerySchema,
  patientUpdateSchema,
} from "../../src/modules/patients/patient.schema";

const validDoctor = {
  name: "Dr. Sarah Ahmed",
  specialization: "Cardiology",
  hospital: "Square Hospital",
  phone: "+8801711223344",
  email: "  Sarah.Ahmed@Example.com ",
};

describe("doctor schemas", () => {
  it("normalises email and accepts a valid doctor", () => {
    const parsed = doctorBodySchema.parse(validDoctor);
    assert.equal(parsed.email, "sarah.ahmed@example.com");
  });

  it("reports one error per invalid field", () => {
    const result = doctorBodySchema.safeParse({
      name: "D",
      specialization: "Magic",
      hospital: "",
      phone: "abc",
      email: "no",
    });
    assert.equal(result.success, false);
    const fields = new Set(result.error?.issues.map((i) => i.path[0]));
    assert.deepEqual([...fields].sort(), ["email", "hospital", "name", "phone", "specialization"]);
  });

  it("rejects an empty update", () => {
    assert.equal(doctorUpdateSchema.safeParse({}).success, false);
  });

  it("rejects a reversed date range in list queries", () => {
    assert.equal(doctorQuerySchema.safeParse({ from: "2026-10-30", to: "2026-10-01" }).success, false);
    assert.equal(doctorQuerySchema.safeParse({ from: "2026-10-01", to: "2026-10-30" }).success, true);
  });
});

describe("patient schemas", () => {
  const validPatient = {
    name: "Rahim Akter",
    age: "42",
    gender: "Male",
    phone: "+8801812345678",
    condition: "Migraine",
  };

  it("coerces age and applies create defaults", () => {
    const parsed = patientCreateForDoctorSchema.parse(validPatient);
    assert.equal(parsed.age, 42);
    assert.equal(parsed.status, "Admitted");
  });

  it("never injects defaults into a PATCH body", () => {
    const parsed = patientUpdateSchema.parse({ status: "Recovered" });
    assert.deepEqual(parsed, { status: "Recovered" }, "fields not sent must stay untouched");
  });

  it("rejects admission dates in the future", () => {
    const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    assert.equal(patientUpdateSchema.safeParse({ admissionDate: nextYear }).success, false);
  });

  it("validates the doctor filter as an ObjectId", () => {
    assert.equal(patientQuerySchema.safeParse({ doctor: "nope" }).success, false);
    assert.equal(patientQuerySchema.safeParse({ doctor: "64b7f0000000000000000000" }).success, true);
  });
});
