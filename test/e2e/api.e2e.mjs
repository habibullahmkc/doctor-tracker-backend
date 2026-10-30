/**
 * End-to-end API suite (70 checks) against a running backend with seeded data.
 *   npm run seed && npm run dev
 *   npm run test:e2e                         # http://localhost:5000
 *   BASE_URL=https://doctor-tracker-psi.vercel.app npm run test:e2e
 * Creates its own test doctor/patients and deletes them again.
 */
const BASE = process.argv[2] ?? process.env.BASE_URL ?? "http://localhost:5000";
let cookie = "";
let passed = 0;
let failed = 0;

async function call(method, path, body, { auth = true } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(auth && cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json, headers: res.headers };
}

function check(name, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ✔ ${name}`);
  } else {
    failed++;
    console.log(`  ✘ ${name} ${detail}`);
  }
}

const section = (title) => console.log(`\n■ ${title}`);

// ---------------- AUTH ----------------
section("Auth");
let r = await call("GET", "/doctors", undefined, { auth: false });
check("no cookie → 401", r.status === 401, JSON.stringify(r.json));
r = await call("POST", "/auth/login", { email: "bad", password: "1" });
check("invalid body → 400 with field errors", r.status === 400 && r.json.errors?.length === 2, JSON.stringify(r.json));
r = await call("POST", "/auth/login", { email: "admin@doctortracker.com", password: "wrong-pass" });
check("wrong password → 401 generic message", r.status === 401 && r.json.message === "Invalid email or password");
r = await call("POST", "/auth/login", { email: "nobody@x.com", password: "whatever1" });
check("unknown email → same 401 message", r.status === 401 && r.json.message === "Invalid email or password");
r = await call("POST", "/auth/login", { email: "  ADMIN@doctortracker.com ", password: "Admin@123" });
const setCookie = r.headers.get("set-cookie") ?? "";
check(
  "login (case/space-insensitive email) → 200",
  r.status === 200 && r.json.data?.email === "admin@doctortracker.com",
  JSON.stringify(r.json),
);
check(
  "cookie is HttpOnly + SameSite=Lax + Expires",
  /HttpOnly/i.test(setCookie) && /SameSite=Lax/i.test(setCookie) && /Expires=/i.test(setCookie),
  setCookie,
);
cookie = setCookie.split(";")[0];
r = await call("GET", "/auth/me");
check(
  "GET /auth/me → admin profile, no password",
  r.status === 200 && r.json.data.name === "Admin User" && !("password" in r.json.data),
);
r = await call("GET", "/doctors", undefined, { auth: false });
const savedCookie = cookie;
cookie = "token=garbage";
r = await call("GET", "/doctors");
check("forged token → 401", r.status === 401);
cookie = savedCookie;

// ---------------- DOCTORS ----------------
section("Doctors – list, search, filter, sort, pagination");
r = await call("GET", "/doctors");
check(
  "default list → 10 items, total 25, 3 pages",
  r.json.data.length === 10 && r.json.pagination.total === 25 && r.json.pagination.totalPages === 3,
  JSON.stringify(r.json.pagination),
);
check(
  "items include patientCount, no searchTokens/__v",
  typeof r.json.data[0].patientCount === "number" && !("searchTokens" in r.json.data[0]),
);
const newestFirst = r.json.data.every((d, i, a) => i === 0 || new Date(a[i - 1].createdAt) >= new Date(d.createdAt));
check("default sort newest first", newestFirst);
r = await call("GET", "/doctors?page=3");
check("page 3 → 5 items", r.json.data.length === 5);
r = await call("GET", "/doctors?search=sar");
check(
  "search 'sar' (prefix) finds Dr. Sarah Ahmed",
  r.json.data.some((d) => d.name === "Dr. Sarah Ahmed"),
  JSON.stringify(r.json.data.map((d) => d.name)),
);
r = await call("GET", "/doctors?search=ahmed");
check(
  "search by last name 'ahmed'",
  r.json.data.some((d) => d.name === "Dr. Sarah Ahmed"),
);
r = await call("GET", "/doctors?search=card");
check(
  "search 'card' matches Cardiology doctors only",
  r.json.data.length > 0 && r.json.data.every((d) => d.specialization === "Cardiology"),
);
r = await call("GET", "/doctors?search=sarah%20card");
check(
  "multi-term 'sarah card' → AND match",
  r.json.data.length === 1 && r.json.data[0].name === "Dr. Sarah Ahmed",
  JSON.stringify(r.json.data.map((d) => d.name)),
);
r = await call("GET", `/doctors?search=${encodeURIComponent("(.*")}`);
check("regex chars are escaped (no 500)", r.status === 200 && r.json.data.length === 0, r.status);
r = await call("GET", "/doctors?specialization=Pediatrics&limit=50");
check("specialization filter", r.json.data.length === 3 && r.json.data.every((d) => d.specialization === "Pediatrics"));
r = await call("GET", "/doctors/filters");
check(
  "GET /doctors/filters → specializations + hospitals",
  r.json.data.specializations.length === 10 && r.json.data.hospitals.length > 0,
);
const hospital = r.json.data.hospitals[0];
r = await call("GET", `/doctors?hospital=${encodeURIComponent(hospital)}&limit=50`);
check(`hospital filter (${hospital})`, r.json.data.length > 0 && r.json.data.every((d) => d.hospital === hospital));
r = await call("GET", "/doctors?sort=name&limit=50");
const names = r.json.data.map((d) => d.name);
check("sort=name ascending", names.join() === [...names].sort((a, b) => a.localeCompare(b)).join());
const today = new Date().toISOString().slice(0, 10);
const ninetyAgo = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
r = await call("GET", `/doctors?from=${ninetyAgo}&to=${today}&limit=50`);
check(
  "joined date range filter",
  r.json.data.length > 0 &&
    r.json.data.length < 25 &&
    r.json.data.every((d) => new Date(d.createdAt) >= new Date(`${ninetyAgo}T00:00:00+06:00`)),
  `got ${r.json.data?.length}`,
);
r = await call("GET", `/doctors?from=${today}&to=${ninetyAgo}`);
check("from > to → 400", r.status === 400);
r = await call("GET", "/doctors?limit=500");
check("limit > 100 → 400", r.status === 400);
r = await call("GET", "/doctors?specialization=Magic");
check("invalid enum filter → 400", r.status === 400);
r = await call("GET", "/doctors/options");
check("GET /doctors/options → 25 lightweight rows", r.json.data.length === 25 && !("phone" in r.json.data[0]));

section("Doctors – CRUD");
r = await call("POST", "/doctors", { name: "D", specialization: "X", hospital: "", phone: "abc", email: "no" });
check(
  "invalid create → 400 with 5 field errors",
  r.status === 400 && r.json.errors.length === 5,
  JSON.stringify(r.json.errors),
);
r = await call("POST", "/doctors", {
  name: "Dr. Test Zubair",
  specialization: "Neurology",
  hospital: "Test Hospital",
  phone: "+8801711000000",
  email: "Zubair.Test@Example.com",
});
check(
  "create → 201, email lowercased",
  r.status === 201 && r.json.data.email === "zubair.test@example.com",
  JSON.stringify(r.json),
);
const doctorId = r.json.data._id;
r = await call("POST", "/doctors", {
  name: "Dr. Dup",
  specialization: "Neurology",
  hospital: "X Hospital",
  phone: "+8801711000001",
  email: "zubair.test@example.com",
});
check("duplicate email → 409", r.status === 409, JSON.stringify(r.json));
r = await call("GET", `/doctors/${doctorId}`);
check("get one → patientCount 0", r.status === 200 && r.json.data.patientCount === 0);
r = await call("GET", "/doctors/not-an-id");
check("invalid ObjectId → 400", r.status === 400 && r.json.errors?.[0]?.field === "id", JSON.stringify(r.json));
r = await call("GET", "/doctors/64b7f0000000000000000000");
check("unknown id → 404", r.status === 404);
r = await call("PATCH", `/doctors/${doctorId}`, {});
check("empty PATCH → 400", r.status === 400);
r = await call("PATCH", `/doctors/${doctorId}`, { name: "Dr. Quentin Renamed" });
check("PATCH name → 200", r.status === 200 && r.json.data.name === "Dr. Quentin Renamed");
r = await call("GET", "/doctors?search=quentin");
check("search tokens rebuilt after update", r.json.data.length === 1 && r.json.data[0]._id === doctorId);

section("Doctor → patients");
r = await call("POST", `/doctors/${doctorId}/patients`, {
  name: "Test Patient",
  age: "42",
  gender: "Male",
  phone: "+8801812345678",
  condition: "Migraine",
});
check(
  "add patient under doctor → 201, age coerced, defaults applied",
  r.status === 201 &&
    r.json.data.age === 42 &&
    r.json.data.status === "Admitted" &&
    r.json.data.doctor.name === "Dr. Quentin Renamed",
  JSON.stringify(r.json),
);
const patientId = r.json.data._id;
r = await call("POST", `/doctors/${doctorId}/patients`, {
  name: "Second Patient",
  age: 30,
  gender: "Female",
  phone: "+8801812345679",
  condition: "Depression",
  status: "Recovered",
});
const patient2 = r.json.data._id;
r = await call("POST", `/doctors/${doctorId}/patients`, {
  name: "X",
  age: 300,
  gender: "?",
  phone: "1",
  condition: "Flu",
});
check("invalid patient → 400", r.status === 400 && r.json.errors.length >= 4);
r = await call("POST", `/doctors/64b7f0000000000000000000/patients`, {
  name: "Ghost",
  age: 30,
  gender: "Male",
  phone: "+8801812345670",
  condition: "Fever",
});
check("add patient to unknown doctor → 404", r.status === 404);
r = await call("GET", `/doctors/${doctorId}/patients`);
check("doctor's patients list → 2", r.json.pagination.total === 2);
r = await call("GET", `/doctors/${doctorId}`);
check(
  "doctor detail patientsByStatus",
  r.json.data.patientCount === 2 &&
    r.json.data.patientsByStatus.Admitted === 1 &&
    r.json.data.patientsByStatus.Recovered === 1,
  JSON.stringify(r.json.data.patientsByStatus),
);

// ---------------- PATIENTS ----------------
section("Patients – list, search, filter");
r = await call("GET", "/patients");
check(
  "list → total 452, populated doctor",
  r.json.pagination.total === 452 && typeof r.json.data[0].doctor?.name === "string",
  JSON.stringify(r.json.pagination),
);
const sortedByAdmission = r.json.data.every(
  (p, i, a) => i === 0 || new Date(a[i - 1].admissionDate) >= new Date(p.admissionDate),
);
check("default sort newest admission first", sortedByAdmission);
r = await call("GET", "/patients?condition=Diabetes&limit=100");
check("condition filter", r.json.data.length > 0 && r.json.data.every((p) => p.condition === "Diabetes"));
r = await call("GET", "/patients?status=Discharged&gender=Female&limit=100");
check(
  "status + gender filter",
  r.json.data.length > 0 && r.json.data.every((p) => p.status === "Discharged" && p.gender === "Female"),
);
r = await call("GET", "/patients?search=test%20pat");
check("search 'test pat'", r.json.data.length === 1 && r.json.data[0]._id === patientId);
r = await call("GET", "/patients?search=8801812345678");
check(
  "search by phone",
  r.json.data.some((p) => p._id === patientId),
);
const sevenAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
r = await call("GET", `/patients?from=${sevenAgo}&to=${today}&limit=100`);
check(
  "admission date range",
  r.json.data.length > 0 &&
    r.json.data.every((p) => new Date(p.admissionDate) >= new Date(`${sevenAgo}T00:00:00+06:00`)),
);
r = await call("GET", `/patients?doctor=${doctorId}`);
check("doctor filter", r.json.pagination.total === 2);
r = await call("GET", "/patients?doctor=nope");
check("invalid doctor filter → 400", r.status === 400);

section("Patients – CRUD");
r = await call("GET", `/patients/${patientId}`);
check("get one", r.status === 200 && r.json.data.name === "Test Patient");
r = await call("PATCH", `/patients/${patientId}`, { status: "Under Treatment" });
check(
  "PATCH status only (no defaults injected)",
  r.status === 200 &&
    r.json.data.status === "Under Treatment" &&
    r.json.data.condition === "Migraine" &&
    r.json.data.age === 42,
);
r = await call("PATCH", `/patients/${patientId}`, { doctor: "64b7f0000000000000000000" });
check("reassign to unknown doctor → 404", r.status === 404);
r = await call("PATCH", `/patients/${patientId}`, { admissionDate: "2099-01-01" });
check("future admission date → 400", r.status === 400);
r = await call("POST", "/patients", "{bad json");
check("malformed JSON → 400", r.status === 400 && r.json.message === "Malformed JSON body");
r = await call("DELETE", `/patients/${patient2}`);
check("delete patient → 200", r.status === 200);
r = await call("DELETE", `/patients/${patient2}`);
check("delete again → 404", r.status === 404);

section("Doctor delete cascades");
r = await call("DELETE", `/doctors/${doctorId}`);
check(
  "delete doctor → deletedPatients 1",
  r.status === 200 && r.json.data.deletedPatients === 1,
  JSON.stringify(r.json),
);
r = await call("GET", `/patients/${patientId}`);
check("their patient is gone", r.status === 404);
r = await call("GET", "/patients");
check("patient total back to 450", r.json.pagination.total === 450);

// ---------------- DASHBOARD ----------------
section("Dashboard");
for (const [range, n] of [
  ["7d", 7],
  ["30d", 30],
  ["12m", 12],
]) {
  r = await call("GET", `/dashboard/stats?range=${range}`);
  check(
    `range=${range} → ${n} buckets, zero-filled`,
    r.status === 200 && r.json.data.admissions.length === n,
    `got ${r.json.data?.admissions?.length}`,
  );
}
const d = r.json.data;
check(
  "totals",
  d.totals.doctors === 25 && d.totals.patients === 450 && d.totals.avgPatientsPerDoctor === 18,
  JSON.stringify(d.totals),
);
check(
  "12m buckets sum = patients admitted in last 12 months (≤450)",
  d.admissions.reduce((s, b) => s + b.count, 0) <= 450,
);
check(
  "patientsPerDoctor top 10 sorted desc",
  d.patientsPerDoctor.length === 10 &&
    d.patientsPerDoctor.every((x, i, a) => i === 0 || a[i - 1].patients >= x.patients),
);
check("byCondition sums to 450", d.byCondition.reduce((s, x) => s + x.value, 0) === 450);
check("bySpecialization sums to 25", d.bySpecialization.reduce((s, x) => s + x.value, 0) === 25);
check(
  "recentPatients → 5 with doctor name",
  d.recentPatients.length === 5 && typeof d.recentPatients[0].doctor.name === "string",
);
r = await call("GET", "/dashboard/stats?range=5y");
check("invalid range → 400", r.status === 400);
console.log(
  "    sample:",
  JSON.stringify({ totals: d.totals, last3Months: d.admissions.slice(-3), top: d.patientsPerDoctor[0] }),
);

// ---------------- LOGOUT ----------------
section("Logout");
r = await call("POST", "/auth/logout");
check("logout clears cookie", r.status === 200 && /token=;/.test(r.headers.get("set-cookie") ?? ""));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
