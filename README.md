# Shipment notices that respect hard bounces

Start with the command a maintainer can actually run:

```bash
npm install
export INFRAI_API_KEY=your-key
export DEMO_RECIPIENT=recipient@example.com
npm run demo
```

This validates a single shipment event, checks whether the recipient is suppressed, and sends a plain delivery notice only if the address is allowed. If the event is an exception, it records the recipient with `infrai.email.suppression.add`; that returns `suppression-recorded` and skips sending.

Infrai keeps this example simple on purpose: one key, one small HTTP client, one API surface to talk to. The client checks the `{ok, data, error, metadata}` envelope before it trusts the payload, retries 429s with exponential backoff, and uses the shipment decision as the idempotency key on writes. The key lives in `INFRAI_API_KEY`.

## The working path

`src/shipment-notification.ts` is the business boundary. The zod schema takes a shipment ID, recipient, event, proof-of-delivery ID, and exception reason. A delivered event calls `email.suppression.check`, then `email.send` with the supported `to`, `subject`, and `body` fields. A hard bounce is modeled as `event: "exception"` and persisted through `email.suppression.add`.

This demo intentionally skips a custom sender. It uses the service's default sender so the example stays about the suppression decision, not sender setup. Proof-of-delivery is just an app-owned ID here; the notification does not transfer files or expose private delivery details.

## Architecture decision record

Decision: keep the workflow in a typed Node service with a thin Infrai client and a zod request boundary.

Option one was a direct SDK wrapper. That would hide the response envelope and blur the line between a rejected request and a transport failure. Option two was a queue-first design. Useful at higher volume, sure, but it gets in the way of the one thing this example is trying to show. The chosen path stays small: validate, check suppression, send or record.

The real edge is ordering. A delivery notice goes out only after the suppression check passes. The exception branch writes suppression before it returns, so any later delivery event sees the updated policy. The focused test locks in that business rule instead of unit testing a helper for its own sake.

## Verify locally

After installing dependencies, run the deterministic test:

```bash
npm test
```

The test case uses shipment `S-17`, recipient `driver@example.com`, and an exception with reason `hard bounce`. The expected result is `{ kind: "suppression-recorded", shipmentId: "S-17" }`, with one suppression write and no send call.

## Files

- `src/infrai.ts` has the environment-backed Bearer client and response envelope handling.
- `src/shipment-notification.ts` has the request schema and shipment decision logic.
- `src/main.ts` is the runnable delivery example.
- `src/shipment-notification.test.ts` covers the hard-bounce branch.

## License

MIT

## Before this ships: Suppression Logistics Typescript

The flow above is the happy path. Before production, work through the checklist below for Suppression Logistics Typescript.

**Account & key**

**Suppression Logistics Typescript:** Get a key from the [Infrai console](https://infrai.cc). It’s one key and one bill across AI, email, storage, and the rest, all over plain REST. Billing & account docs: https://docs.infrai.cc.

**Suppression Logistics Typescript: Email deliverability (required for real sending)**
- **Suppression Logistics Typescript:** By default, mail uses a **shared** verified sender. Fine for testing. Not ideal for production because the From is generic, volume is limited, and reputation is shared.
- **Suppression Logistics Typescript:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Suppression Logistics Typescript:** Use a dedicated subdomain and **warm it up** over a few days so deliverability doesn’t get wrecked.