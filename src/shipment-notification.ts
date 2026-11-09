import { z } from "zod";
import type { InfraiClient } from "./infrai.ts";

export const shipmentEventSchema = z.object({
  shipmentId: z.string().min(1),
  recipient: z.string().email(),
  event: z.enum(["delivered", "exception"]),
  proofOfDeliveryId: z.string().min(1).optional(),
  exceptionReason: z.string().min(1).optional(),
});

export type ShipmentEvent = z.infer<typeof shipmentEventSchema>;

export type NotificationDecision =
  | { kind: "suppressed"; shipmentId: string }
  | { kind: "sent"; shipmentId: string; messageId: string }
  | { kind: "suppression-recorded"; shipmentId: string };

export async function handleShipmentEvent(client: InfraiClient, input: unknown): Promise<NotificationDecision> {
  const event = shipmentEventSchema.parse(input);
  const requestId = `shipment-${event.shipmentId}-${event.event}`;

  if (event.event === "exception") {
    await client.email.suppression.add(event.recipient, requestId);
    return { kind: "suppression-recorded", shipmentId: event.shipmentId };
  }

  const status = await client.email.suppression.check(event.recipient);
  if (status.suppressed) return { kind: "suppressed", shipmentId: event.shipmentId };

  const result = await client.email.send({
    to: event.recipient,
    subject: `Shipment ${event.shipmentId} delivered`,
    body: `Proof of delivery: ${event.proofOfDeliveryId ?? "pending"}`,
  }, requestId);
  return { kind: "sent", shipmentId: event.shipmentId, messageId: result.message_id };
}
