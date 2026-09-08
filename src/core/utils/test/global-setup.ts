import { resetDatabase } from "./test-db.js";

export default async function globalSetup(): Promise<void> {
  await resetDatabase();
}

export const teardown = undefined;
