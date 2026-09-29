/**
 * Chick Tracker Google Apps Script API
 *
 * REQUIRED SHEET TABS:
 *   Shipments
 *   Hatch Weekly
 *
 * OPTIONAL TAB:
 *   Settings
 */

const SHEET_NAMES = {
  SHIPMENTS: 'Shipments',
  HATCH: 'Hatch Weekly',
  SETTINGS: 'Settings',
};

function doGet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const shipments = readSheetObjects_(ss.getSheetByName(SHEET_NAMES.SHIPMENTS));
    const hatchRows = readSheetObjects_(ss.getSheetByName(SHEET_NAMES.HATCH));
    const settings = readSettings_(ss.getSheetByName(SHEET_NAMES.SETTINGS));

    const hatchWeekly = hatchRows
      .filter(row => row['Hatch Date'])
      .map(row => normalizeHatchRow_(row));

    return json_({
      ok: true,
      updatedAt: new Date().toISOString(),
      shipments: shipments.map(normalizeShipmentRow_),
      hatchWeekly,
      settings,
    });
  } catch (error) {
    return json_({ ok: false, error: error.message });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    const action = payload.action || 'addShipment';

    if (action === 'addShipment') {
      addShipment_(payload);
      return json_({ ok: true, message: 'Shipment added' });
    }

    return json_({ ok: false, error: 'Unknown action' });
  } catch (error) {
    return json_({ ok: false, error: error.message });
  }
}

function addShipment_(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.SHIPMENTS);
  if (!sheet) throw new Error('Missing sheet: ' + SHEET_NAMES.SHIPMENTS);

  const lastColumn = sheet.getLastColumn();
  if (lastColumn === 0) throw new Error('Shipments sheet needs a header row.');

  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const row = headers.map(header => {
    if (header === 'Hatch Date' && payload[header]) {
      return new Date(payload[header] + 'T12:00:00');
    }
    return payload[header] ?? '';
  });

  sheet.appendRow(row);
}

function readSheetObjects_(sheet) {
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(String);

  return values.slice(1)
    .filter(row => row.some(value => value !== '' && value !== null))
    .map(row => {
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = serializeValue_(row[i]);
      });
      return obj;
    });
}

function serializeValue_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return value;
}

function normalizeShipmentRow_(row) {
  const qty = number_(row['Orig Qty'] || row['Original Qty']);
  const doa = number_(row['DOA']);

  return {
    'Hatch Date': row['Hatch Date'] || '',
    'Customer Name': row['Customer Name'] || '',
    City: row['City'] || '',
    State: row['State'] || '',
    Region: row['Region'] || '',
    Breed: row['Breed'] || '',
    'Orig Qty': qty,
    DOA: doa,
    Week: number_(row['Week']),
    Phone: row['Phone'] || '',
    Notes: row['Notes'] || '',
  };
}

function normalizeHatchRow_(row) {
  const eggsSet = number_(row['Eggs Set']);
  const hatched = number_(row['Hatched']);
  const explicitPct = numberOrBlank_(row['Hatchability %']);
  const calculatedPct = eggsSet > 0 ? (hatched / eggsSet) * 100 : 0;

  return {
    date: row['Hatch Date'] || '',
    eggsSet,
    hatched,
    hpct: explicitPct === '' ? round_(calculatedPct, 1) : normalizePercent_(explicitPct),
    ship: number_(row['Shipped']),
    delpu: number_(row['Delivery/Pickup']),
    breeds: {
      Cornish: {
        ship: number_(row['Cornish Shipped']),
        del: number_(row['Cornish Del/PU']),
      },
      Ranger: {
        ship: number_(row['Ranger Shipped']),
        del: number_(row['Ranger Del/PU']),
      },
    },
  };
}

function readSettings_(sheet) {
  const defaults = {
    hatchBenchmark: 75,
    doaTarget: 5,
  };

  if (!sheet) return defaults;

  const values = sheet.getDataRange().getValues();
  values.forEach(row => {
    const key = String(row[0] || '').trim();
    const value = row[1];
    if (!key) return;

    if (key === 'Hatch Benchmark') defaults.hatchBenchmark = normalizePercent_(value);
    if (key === 'DOA Target') defaults.doaTarget = normalizePercent_(value);
  });

  return defaults;
}

function normalizePercent_(value) {
  const n = Number(value);
  if (!isFinite(n)) return 0;
  return n > 0 && n <= 1 ? round_(n * 100, 2) : round_(n, 2);
}

function number_(value) {
  const n = Number(value);
  return isFinite(n) ? n : 0;
}

function numberOrBlank_(value) {
  if (value === '' || value === null || typeof value === 'undefined') return '';
  const n = Number(value);
  return isFinite(n) ? n : '';
}

function round_(value, places) {
  const factor = Math.pow(10, places || 0);
  return Math.round(value * factor) / factor;
}

function json_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Run this ONCE from the Apps Script editor if you want the script to create
 * the required tabs and header rows for you.
 */
function setupChickTrackerSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  ensureSheet_(ss, SHEET_NAMES.SHIPMENTS, [
    'Hatch Date',
    'Customer Name',
    'City',
    'State',
    'Region',
    'Breed',
    'Orig Qty',
    'DOA',
    'Week',
    'Phone',
    'Notes',
  ]);

  ensureSheet_(ss, SHEET_NAMES.HATCH, [
    'Hatch Date',
    'Eggs Set',
    'Hatched',
    'Hatchability %',
    'Shipped',
    'Delivery/Pickup',
    'Cornish Shipped',
    'Cornish Del/PU',
    'Ranger Shipped',
    'Ranger Del/PU',
  ]);

  const settings = ensureSheet_(ss, SHEET_NAMES.SETTINGS, ['Setting', 'Value']);
  if (settings.getLastRow() === 1) {
    settings.getRange(2, 1, 2, 2).setValues([
      ['Hatch Benchmark', 75],
      ['DOA Target', 5],
    ]);
  }
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  return sheet;
}
