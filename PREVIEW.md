# Preview only. Checkout is not open.

This branch prepares the member pages on top of the live Wyoming release. It does not open sales.

- Nothing here takes a payment. Pricing, packages, the home page, FAQ, login, account, the package form and the Boots form still say checkout is not open.
- "Get the Full Pass" and "Pick your unit" open those preview pages. The button asks the member API, and it only continues when that API says checkout is open and returns a `checkout.stripe.com` page. Until then the button stops and nothing is charged.
- Login is a 6-digit email code. Asking again is the recovery step. Log out clears the session. Account and package files stay behind login.
- Exact odds, if a Full Pass is ever on, are Colorado, Utah and Arizona only. Wyoming stays the free verdict bands already on the live site. The Wyoming page does not ask for an exact-odds file.
- Boots-on-the-Ground requests are Colorado only. Utah and Arizona stay disabled until licensed. Asking does not charge anyone.
- The server sets the price and the quantity. The package form cannot name a different amount.
- Legal pages (`terms.html`, `refund.html`, `privacy.html`) are unchanged. The FAQ repeats the rules already in those pages: Founding Hunter stays $19.99 a year only while renewal continues, a failed renewal has 7 days, the Full Pass refund is 7 days once per person, package problems are 30 days, each order gets a delivery date, Boots refunds are 72 hours and only before travel or scouting, and a closure after travel is a new date or the report, not cash back.
- Canceling a Full Pass stops the next renewal and keeps the year already paid. The Founding price ends at that cancel. A failed renewal has 7 days, and that deadline does not move. The site does not change a Stripe subscription and does not refund a card by itself. A Full Pass refund is an email to support@rokwilder.com, once per person, within 7 days.
- The public contact stays support@rokwilder.com. Do not publish a personal address.
- Do not merge this while checkout should stay closed. Live `main` keeps the Wyoming release and its checkout-closed warnings.

Not in this repository: the member API. It stays private. Launch still needs the bank account, Stripe test then live keys, price confirmation, the webhook endpoint, the api subdomain, and your OK before `CHECKOUT_OPEN` is turned on.
