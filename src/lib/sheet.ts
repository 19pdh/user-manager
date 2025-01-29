import { RESPONSE_SHEET } from "../config";

export function getSheet(): GoogleAppsScript.Spreadsheet.Sheet {
  const sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(RESPONSE_SHEET);
  if (!sheet) {
    throw new Error(`Couldn't get the current sheet`);
  }
  return sheet;
}

export function labelToColumnLetter(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  label: string
): string {
  const [headers] = sheet.getDataRange().getDisplayValues();
  const columnIndex = headers.indexOf(label);
  if (columnIndex == -1) {
    throw new Error(`The label ${label} was not found in document`);
  }
  return String.fromCharCode(65 + columnIndex);
}

export function getField(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  rowNumber: number,
  label: string
): any {
  const [headers] = sheet.getDataRange().getDisplayValues();
  const columnIndex = headers.indexOf(label);
  if (columnIndex == -1) {
    throw new Error(`The label ${label} was not found in document`);
  }
  return sheet.getRange(rowNumber, columnIndex + 1).getValue();
}

export function getRow(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  rowNumber: number
) {
  const [headers] = sheet.getDataRange().getDisplayValues();
  let row: { [key: string]: any } = {};
  for (let i = 0; i < headers.length; i++) {
    row[headers[i]] = sheet.getRange(rowNumber, i + 1).getValue();
  }
  return row;
}

export function updateRow(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  rowNumber: number,
  entry: { [key: string]: any }
) {
  const [headers] = sheet.getDataRange().getDisplayValues();
  for (let key of Object.keys(entry)) {
    const columnIndex = headers.indexOf(key);
    if (columnIndex == -1) {
      throw new Error(`The label ${key} was not found in document`);
    }
    sheet.getRange(rowNumber, columnIndex + 1).setValue(entry[key]);
  }
}
