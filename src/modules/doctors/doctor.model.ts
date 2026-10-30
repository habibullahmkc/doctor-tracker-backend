import { Schema, model, type InferSchemaType } from "mongoose";
import { SPECIALIZATIONS } from "../../constants/enums";
import { toTokens } from "../../utils/searchTokens";

const doctorSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    specialization: { type: String, required: true, enum: [...SPECIALIZATIONS] },
    hospital: { type: String, required: true, trim: true, maxlength: 150 },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Derived from name/hospital/specialization/email for index-backed prefix search.
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

doctorSchema.pre("save", function () {
  this.set("searchTokens", toTokens(this.name, this.hospital, this.specialization, this.email));
});

// Equality → Sort → Range (ESR) ordering for every list query shape.
doctorSchema.index({ searchTokens: 1 }); // search (multikey)
doctorSchema.index({ createdAt: -1 }); // default sort + joined-date filter
doctorSchema.index({ specialization: 1, createdAt: -1 }); // specialization filter + sort
doctorSchema.index({ hospital: 1, createdAt: -1 }); // hospital filter + sort, distinct("hospital")
// email: unique index declared on the field

export type Doctor = InferSchemaType<typeof doctorSchema>;
export const DoctorModel = model("Doctor", doctorSchema);
