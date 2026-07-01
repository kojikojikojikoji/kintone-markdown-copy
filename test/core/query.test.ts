import { describe, expect, it } from "vitest";
import { buildFetchQuery, stripLimitOffset } from "../../src/core/query";

describe("query", () => {
  it("TC-28: removes trailing limit and offset", () => {
    expect(stripLimitOffset('Status = "open" order by f desc limit 100 offset 200')).toBe(
      'Status = "open" order by f desc',
    );
  });

  it("TC-28: removes a trailing limit with no offset", () => {
    expect(stripLimitOffset("order by $id asc limit 500")).toBe("order by $id asc");
  });

  it("keeps an existing order by clause", () => {
    expect(buildFetchQuery('Status = "open" order by f desc limit 100 offset 200')).toBe(
      'Status = "open" order by f desc',
    );
  });

  it("TC-29: appends order by $id asc when no order is present", () => {
    expect(buildFetchQuery('Status = "open" limit 20')).toBe('Status = "open" order by $id asc');
  });

  it("TC-29: empty query still gets a stable order", () => {
    expect(buildFetchQuery("")).toBe("order by $id asc");
    expect(buildFetchQuery("limit 500 offset 0")).toBe("order by $id asc");
  });

  it("ignores order by inside a quoted literal", () => {
    expect(buildFetchQuery(String.raw`memo like "order by"`)).toBe(
      String.raw`memo like "order by" order by $id asc`,
    );
  });
});
