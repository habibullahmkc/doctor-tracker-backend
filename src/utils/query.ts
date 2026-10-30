import type { Model } from "mongoose";

/**
 * Total for a list query. With no filter, `estimatedDocumentCount` reads the
 * collection metadata (O(1)) instead of walking an index like `countDocuments`.
 */
export function countMatching<T>(model: Model<T>, filter: Record<string, unknown>) {
  return Object.keys(filter).length === 0 ? model.estimatedDocumentCount() : model.countDocuments(filter);
}
