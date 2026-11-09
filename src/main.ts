import { clientFromEnvironment } from "./infrai.ts";
import { handleShipmentEvent } from "./shipment-notification.ts";

const recipient = process.env.DEMO_RECIPIENT;
if (!recipient) throw new Error("DEMO_RECIPIENT is required");

const decision = await handleShipmentEvent(clientFromEnvironment(), {
  shipmentId: process.env.DEMO_SHIPMENT_ID ?? "shipment-demo-42",
  recipient,
  event: "delivered",
  proofOfDeliveryId: "pod-demo-42",
});
console.log(JSON.stringify(decision));
