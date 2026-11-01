import { describe, expect, it } from "vitest";

import { isLocalRequest } from "@/lib/local-request";

describe("isLocalRequest", () => {
  it("accepts the app opened on this machine", () => {
    for (const host of ["localhost:3000", "127.0.0.1:3000", "[::1]:3000", "localhost"]) {
      expect(isLocalRequest("DELETE", host, null)).toBe(true);
      expect(isLocalRequest("DELETE", host, `http://${host}`)).toBe(true);
    }
  });

  it("refuses a foreign host, even for a read", () => {
    expect(isLocalRequest("GET", "evil.example", null)).toBe(false);
    expect(isLocalRequest("GET", "localhost.evil.example:3000", null)).toBe(false);
    expect(isLocalRequest("GET", null, null)).toBe(false);
    expect(isLocalRequest("GET", "[bad", null)).toBe(false);
  });

  it("refuses writes sent from another site", () => {
    for (const origin of ["https://evil.example", "https://localhost.evil.example", "null"]) {
      expect(isLocalRequest("POST", "localhost:3000", origin)).toBe(false);
      expect(isLocalRequest("DELETE", "localhost:3000", origin)).toBe(false);
    }
  });

  it("does not block a read whose origin is foreign: the browser hides the answer", () => {
    expect(isLocalRequest("GET", "localhost:3000", "https://evil.example")).toBe(true);
  });
});
