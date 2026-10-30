import { type InferSchemaType, model, Schema } from "mongoose";
import { CONDITIONS, GENDERS, PATIENT_STATUSES } from "../../constants/enums";
import { toTokens } from "../../utils/searchTokens";

const patientSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    age: { type: Number, required: true, min: 0, max: 120 },
    gender: { type: String, required: true, enum: [...GENDERS] },
    phone: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true, default: "" },
    condition: { type: String, required: true, enum: [...CONDITIONS] },
    status: { type: String, required: true, enum: [...PATIENT_STATUSES], default: "Admitted" },
    // Business date used for date filters and admission trends (createdAt stays a system timestamp).
    admissionDate: { type: Date, required: true, default: Date.now },
    notes: { type: String, trim: true, maxlength: 500, default: "" },
    doctor: { type: Schema.Types.ObjectId, ref: "Doctor", required: true },
    searchTokens: { type: [String], select: false },
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.searchTokens;
        return ret;
      },
    },
  },
);

patientSchema.pre("save", function () {
  this.set("searchTokens", toTokens(this.name, this.phone, this.email));
});

patientSchema.index({ doctor: 1, admissionDate: -1 }); // doctor's patient list + per-doctor counts
patientSchema.index({ condition: 1, admissionDate: -1 }); // condition filter + sort
patientSchema.index({ status: 1, admissionDate: -1 }); // status filter + sort
patientSchema.index({ admissionDate: -1 }); // default sort, date filter, admissions trend
patientSchema.index({ searchTokens: 1 }); // search (multikey)

export type Patient = InferSchemaType<typeof patientSchema>;
export const PatientModel = model("Patient", patientSchema);
