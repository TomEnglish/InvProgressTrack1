import { assertEquals, assertThrows } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { validatePayload } from "./parser.ts";

Deno.test("validatePayload successfully parses valid dataset", () => {
  const payload = {
    projectId: "proj-123",
    items: [
      { dwg: "ISO-001", budget_hrs: 100, actual_hrs: 20, percent_complete: 25 },
      { dwg: "ISO-002", budget_hrs: "50", actual_hrs: "10", percent_complete: "50" } // string digits
    ]
  };
  
  const result = validatePayload(payload);
  assertEquals(result.items.length, 2);
  assertEquals(result.items[1].budget_hrs, 50); // should cast to number
});

Deno.test("validatePayload rejects missing projectId", () => {
  const payload = {
    items: [{ dwg: "ISO-001", budget_hrs: 100 }]
  };
  
  assertThrows(() => validatePayload(payload), Error, "Missing projectId");
});

Deno.test("validatePayload rejects negative bounds", () => {
  const payload = {
    projectId: "proj-123",
    items: [{ dwg: "ISO-NEG", budget_hrs: -50, actual_hrs: 10, percent_complete: 10 }]
  };
  
  assertThrows(() => validatePayload(payload), Error, "negative budget hours");
});

Deno.test("validatePayload rejects percent_complete over 100", () => {
  const payload = {
    projectId: "proj-123",
    items: [{ dwg: "ISO-MAX", budget_hrs: 100, actual_hrs: 100, percent_complete: 150 }]
  };
  
  assertThrows(() => validatePayload(payload), Error, "Invalid percent complete");
});
