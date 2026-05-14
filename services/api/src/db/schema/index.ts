// Drizzle schema barrel. drizzle-kit reads this file's exports to compute the
// schema diff — keep the default export shape stable.

export * from "./schema-version";

import { roamPoc, schemaVersion } from "./schema-version";

export const schema = { roamPoc, schemaVersion } as const;
export default schema;
