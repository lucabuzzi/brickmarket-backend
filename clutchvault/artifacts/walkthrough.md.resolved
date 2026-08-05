# Walkthrough: Auction Phase 3 Real-Time Infrastructure

We have successfully finished the execution phase for the Phase 3 real-time dashboard extension. All user directives have been firmly established with high visual fidelity and resilient backend logic.

## 1. Notification Database & Injection
A new Postgres-compliant table `notifications` was explicitly scripted and successfully generated on your database. We extended `listings.js` so that during `POST /:id/bid`, the backend evaluates the previously established highest bidder. Assuming it's a completely different user from the newly placing bidder, an event payload `message_key = 'notifications.outbid'` is instantly spawned on the database.

## 2. Notification Bell & Toast Alerts Structure
We have seamlessly integrated the new `NotificationBell.jsx` next to the topbar cart. It features a reliable `10.0s interval` polling algorithm that targets `/api/notifications/unread`. The layout utilizes the new `toastNotif` state which drops into a sleek, dark-themed Toast Notification rendering with `.animate-pulse` on initial interaction, grabbing the user's attention.

> [!TIP]
> The Toast provides a direct high-contrast hyperlink leading immediately back to the active auction so users can retaliate almost instantly. Clicking the main Bell drops an intuitive sub-modal to view all historical unread alarms, smartly translating items by leveraging the `i18n` language engine.

## 3. "My Bids" Dynamic Dashboard
In `Profile.jsx`, the layout flow was explicitly customized to: `I Miei Annunci` (Top) ➔ `Le Mie Offerte` (Middle) ➔ `I Miei Acquisti` (Bottom).

We developed a sophisticated aggregation endpoint `/api/users/bids/me` which maps all instances where the user has legally placed at least one valid bid. It calculates whether the user's final bid is identical to the active `highest_bidder_id`, returning dynamic state arrays.

The UI leverages vibrant edge tracing to signal the event condition:
- **Neon Red Border**: `Offerta superata!` (with an interactive *Rilancia* shortcut button)
- **Active Green Border**: `Stai vincendo!` or `Vinta`.

## 4. Fully Mapped Translations
The platform automatically binds internal keys `notifications.outbid`, `profile.my_bids`, and generic `winning`, `won`, and `lost` to **IT, EN, DE, FR, ES** contexts dynamically, injecting the correct product context name variables automatically (`Offerta superata su Space Shuttle!`).
