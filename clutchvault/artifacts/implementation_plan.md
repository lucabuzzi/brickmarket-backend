# Automated Stress Test - Auction Sniping & Notifications

This plan outlines the procedure to verify the "Anti-Sniping" 2-minute extension and the "Outbid Notification" system.

## User Action Required
> [!IMPORTANT]
> To receive the notification, you must be the **previous highest bidder**. 
> Please ensure you have placed a bid on the target listing: **"Il Signore degli Anelli: Elmo di Sauron"** (or any other active auction you prefer) and that you are currently the leader.

## Proposed Strategy

### 1. Preparation
- **Target Listing**: "Il Signore degli Anelli: Elmo di Sauron" (ID: `49e08c15-cb43-4f56-8d38-a625e59270a3`).
- **Database Modification**: I will execute a query to set the `auction_end` for this listing to **exactly 3 minutes from now**.

### 2. The Test Script (`auction_test.js`)
I will create a script in the `scratch/` directory that performs the following steps:
1. **Authentication**: Uses the `JWT_SECRET` to sign a valid token for `testuser` (acting as the "Sniper").
2. **Monitoring**: Polls the listing's end time.
3. **The Strike**: When the countdown reaches **1 minute and 30 seconds**, it will send a `POST /api/listings/:id/bid` request with an amount 1€ higher than the current bid.

### 3. Expectations
- **Time Extension**: The UI should immediately show the auction end time pushed forward by 2 minutes from the moment of the bid.
- **Notification**: Since you were outbid, your UI should trigger:
    - A **Toast Alert** ("Attention! You have been outbid on...").
    - A **Red Dot** on the Notification Bell (within the 10s polling window).
- **Profile Status**: The "Le Mie Offerte" tab should show the listing with a red border and "Offerta superata!".

## Open Questions
- What is your current **Username** in the app? I need to verify that you are the current leader before I trigger the test.
- Are you ready to watch the `ListingDetail` page for the target auction?

## Verification Plan

### Manual Verification
1. I will notify you when I set the timer to 3 minutes.
2. I will notify you when the script starts its countdown.
3. I will notify you the exact second the "TestUser" strikes.
4. You will confirm the visual changes in your browser.
