# Chick Tracker — Google Sheets Live Data

The dashboard now uses **one Google Sheet** as the source for both shipment/DOA data and hatchability data.

You no longer need:

- `data/hatch.js`
- `data/hatch_weekly.js`
- a static shipments data file

## Files

- `index.html` — dashboard layout
- `styles.css` — dashboard styling
- `app.js` — fetches all live data from Google Apps Script
- `Code.gs` — paste this into the Google Sheet's Apps Script project

## 1. Google Sheet tabs

The Apps Script uses these tabs:

### Shipments

Use these exact headers:

| Hatch Date | Customer Name | City | State | Region | Breed | Orig Qty | DOA | Week | Phone | Notes |
|---|---|---|---|---|---|---:|---:|---:|---|---|

### Hatch Weekly

Use these exact headers:

| Hatch Date | Eggs Set | Hatched | Hatchability % | Shipped | Delivery/Pickup | Cornish Shipped | Cornish Del/PU | Ranger Shipped | Ranger Del/PU |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|

`Hatchability %` may be left blank. If blank, the API automatically calculates:

`Hatched / Eggs Set * 100`

### Settings (optional)

| Setting | Value |
|---|---:|
| Hatch Benchmark | 75 |
| DOA Target | 5 |

You can also run `setupChickTrackerSheets()` once in Apps Script to create all three tabs and their headers automatically.

## 2. Install the Apps Script

1. Open the Google Sheet.
2. Go to **Extensions → Apps Script**.
3. Replace the existing script with the contents of `Code.gs`.
4. Save.
5. If you need the tabs created automatically, run `setupChickTrackerSheets()` once and authorize it.

## 3. Deploy as a Web App

1. In Apps Script select **Deploy → Manage deployments**.
2. Edit your existing Web App deployment, or create a new Web App deployment.
3. Execute as: **Me**.
4. Who has access: **Anyone**.
5. Deploy.
6. Copy the `/exec` URL.

If you update the same deployment you are already using, the URL can stay the same.

## 4. Put the Web App URL in app.js

At the top of `app.js`:

```js
const API_URL = "YOUR_APPS_SCRIPT_EXEC_URL";
```

The supplied `app.js` currently contains the URL that was already in your original dashboard.

## 5. Updating the dashboard

From now on, edit only the Google Sheet.

The website fetches fresh data on page load and then checks the Sheet again every 5 minutes.

To change the refresh frequency, edit:

```js
const AUTO_REFRESH_MS = 5 * 60 * 1000;
```

For example, one minute:

```js
const AUTO_REFRESH_MS = 60 * 1000;
```

## Data returned by Apps Script

The API returns a single JSON object:

```json
{
  "shipments": [],
  "hatchWeekly": [],
  "settings": {},
  "updatedAt": "..."
}
```

All dashboard KPIs, shipment charts, hatchability charts, weekly tables, and breed/channel charts are generated from that response.
