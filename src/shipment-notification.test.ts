import assert from "node:assert/strict";
import test from "node:test";
import { handleShipmentEvent } from "./shipment-notification.ts";

test("a hard bounce records suppression and does not send a delivery notice", async () => {
  const calls: string[] = [];
  const client = {
    email: {
      suppression: {
        add: async (email: string) => { calls.push(`add:${email}`); },
        check: async () => ({ suppressed: false }),
      },
      send: async () => { calls.push("send"); return { message_id: "unused" }; },
    },
  } as never;

  const decision = await handleShipmentEvent(client, {
    shipmentId: "S-17",
    recipient: "driver@example.com",
    event: "exception",
    exceptionReason: "hard bounce",
  });

  assert.deepEqual(decision, { kind: "suppression-recorded", shipmentId: "S-17" });
  assert.deepEqual(calls, ["add:driver@example.com"]);
});
