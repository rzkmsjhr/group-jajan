import { drizzle } from "drizzle-orm/d1";
import { bindings } from "@/lib/data";
import * as schema from "./schema";

export function getDb() {
  return drizzle(bindings().DB, { schema });
}
