import { isDemoRecordExpired } from "./lifecycle";
import { hiringCycleRecordSchema, type HiringCycleRecord } from "./schema";

export const DEMO_RECORD_STORAGE_KEY = "screening-substitution-tracker:demo-record:v1";

type DemoStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function saveDemoRecord(storage: DemoStorage, record: HiringCycleRecord): HiringCycleRecord {
  const validatedRecord = hiringCycleRecordSchema.parse(record);
  storage.setItem(DEMO_RECORD_STORAGE_KEY, JSON.stringify(validatedRecord));
  return validatedRecord;
}

export function loadDemoRecord(
  storage: DemoStorage,
  now: Date = new Date(),
): HiringCycleRecord | null {
  const storedValue = storage.getItem(DEMO_RECORD_STORAGE_KEY);

  if (storedValue === null) {
    return null;
  }

  try {
    const parsedRecord = hiringCycleRecordSchema.parse(JSON.parse(storedValue));

    if (isDemoRecordExpired(parsedRecord, now)) {
      storage.removeItem(DEMO_RECORD_STORAGE_KEY);
      return null;
    }

    return parsedRecord;
  } catch {
    storage.removeItem(DEMO_RECORD_STORAGE_KEY);
    return null;
  }
}

export function deleteDemoRecord(storage: DemoStorage): void {
  storage.removeItem(DEMO_RECORD_STORAGE_KEY);
}
