import { z } from "zod";
import { DAY_MS, TIMEZONE, startOfDhakaDay, startOfDhakaMonth, toDhakaYMD } from "../../utils/dates";
import { DoctorModel } from "../doctors/doctor.model";
import { PatientModel } from "../patients/patient.model";

export const statsQuerySchema = z.object({
  range: z.enum(["7d", "30d", "12m"]).default("30d"),
});
export type StatsRange = z.infer<typeof statsQuerySchema>["range"];

type Bucket = { _id: string; count: number };
type NameValue = { _id: string; count: number };

/** Ordered bucket keys covering the whole range, so empty days/months render as 0. */
function buildBuckets(range: StatsRange) {
  if (range === "12m") {
    const months = Array.from({ length: 12 }, (_, i) => startOfDhakaMonth(11 - i));
    return { start: months[0].start, keys: months.map((m) => m.key), format: "%Y-%m" };
  }
  const days = range === "7d" ? 7 : 30;
  const start = new Date(startOfDhakaDay(toDhakaYMD(new Date())).getTime() - (days - 1) * DAY_MS);
  const keys = Array.from({ length: days }, (_, i) => toDhakaYMD(new Date(start.getTime() + i * DAY_MS)));
  return { start, keys, format: "%Y-%m-%d" };
}

const TREND_MONTHS = 8;

/**
 * Month-by-month totals for the stat-card sparklines: new doctors/patients per
 * month plus running totals (and patients-per-doctor) at the end of each month.
 */
async function getMonthlyTrends() {
  const months = Array.from({ length: TREND_MONTHS }, (_, i) => startOfDhakaMonth(TREND_MONTHS - 1 - i));
  const windowStart = months[0].start;
  const byMonth = (field: string) => ({
    $group: { _id: { $dateToString: { date: `$${field}`, format: "%Y-%m", timezone: TIMEZONE } }, count: { $sum: 1 } },
  });

  const [doctorsBefore, patientsBefore, doctorRows, patientRows] = await Promise.all([
    DoctorModel.countDocuments({ createdAt: { $lt: windowStart } }),
    PatientModel.countDocuments({ admissionDate: { $lt: windowStart } }),
    DoctorModel.aggregate<Bucket>([{ $match: { createdAt: { $gte: windowStart } } }, byMonth("createdAt")]),
    PatientModel.aggregate<Bucket>([{ $match: { admissionDate: { $gte: windowStart } } }, byMonth("admissionDate")]),
  ]);

  const newDoctorsByMonth = new Map(doctorRows.map((row) => [row._id, row.count]));
  const newPatientsByMonth = new Map(patientRows.map((row) => [row._id, row.count]));
  let doctors = doctorsBefore;
  let patients = patientsBefore;

  return months.map(({ key }) => {
    const newDoctors = newDoctorsByMonth.get(key) ?? 0;
    const newPatients = newPatientsByMonth.get(key) ?? 0;
    doctors += newDoctors;
    patients += newPatients;
    return {
      month: key,
      newDoctors,
      newPatients,
      doctors,
      patients,
      avgPerDoctor: doctors ? Number((patients / doctors).toFixed(1)) : 0,
    };
  });
}

const toNameValue = (rows: NameValue[]) => rows.map((row) => ({ name: row._id, value: row.count }));

export async function getDashboardStats(range: StatsRange) {
  const { start, keys, format } = buildBuckets(range);
  const monthStart = startOfDhakaMonth(0).start;
  const previousMonthStart = startOfDhakaMonth(1).start;

  // Independent aggregations run in parallel; each $match/$group hits an index.
  const [
    totalDoctors,
    totalPatients,
    newThisMonth,
    newLastMonth,
    activePatients,
    perDoctor,
    admissions,
    byCondition,
    byStatus,
    bySpecialization,
    recentPatients,
    trends,
  ] = await Promise.all([
    DoctorModel.estimatedDocumentCount(), // O(1) collection metadata
    PatientModel.estimatedDocumentCount(),
    PatientModel.countDocuments({ admissionDate: { $gte: monthStart } }),
    PatientModel.countDocuments({ admissionDate: { $gte: previousMonthStart, $lt: monthStart } }),
    PatientModel.countDocuments({ status: { $in: ["Admitted", "Under Treatment"] } }),
    PatientModel.aggregate<{ doctorId: string; name: string; specialization: string; patients: number }>([
      { $group: { _id: "$doctor", patients: { $sum: 1 } } },
      { $sort: { patients: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "doctors",
          localField: "_id",
          foreignField: "_id",
          as: "doctor",
          pipeline: [{ $project: { name: 1, specialization: 1 } }],
        },
      },
      { $unwind: "$doctor" },
      {
        $project: {
          _id: 0,
          doctorId: "$_id",
          name: "$doctor.name",
          specialization: "$doctor.specialization",
          patients: 1,
        },
      },
    ]),
    PatientModel.aggregate<Bucket>([
      { $match: { admissionDate: { $gte: start } } },
      {
        $group: {
          _id: { $dateToString: { date: "$admissionDate", format, timezone: TIMEZONE } },
          count: { $sum: 1 },
        },
      },
    ]),
    PatientModel.aggregate<NameValue>([
      { $group: { _id: "$condition", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    PatientModel.aggregate<NameValue>([
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    DoctorModel.aggregate<NameValue>([
      { $group: { _id: "$specialization", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    PatientModel.find({}, { name: 1, condition: 1, status: 1, admissionDate: 1, doctor: 1 })
      .sort({ admissionDate: -1 })
      .limit(5)
      .populate("doctor", "name")
      .lean(),
    getMonthlyTrends(),
  ]);

  const admissionsByKey = new Map(admissions.map((row) => [row._id, row.count]));

  return {
    range,
    totals: {
      doctors: totalDoctors,
      patients: totalPatients,
      activePatients,
      avgPatientsPerDoctor: totalDoctors ? Number((totalPatients / totalDoctors).toFixed(1)) : 0,
      newThisMonth,
      newLastMonth,
    },
    admissions: keys.map((key) => ({ date: key, count: admissionsByKey.get(key) ?? 0 })),
    patientsPerDoctor: perDoctor,
    byCondition: toNameValue(byCondition),
    byStatus: toNameValue(byStatus),
    bySpecialization: toNameValue(bySpecialization),
    recentPatients,
    trends,
  };
}
