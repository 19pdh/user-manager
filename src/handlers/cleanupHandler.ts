import { ADMIN_MAIL } from "../config";
import { labelToColumnLetter, getField, getSheet } from "../lib/sheet";
import { getGoogleUser, deleteUser } from "../lib/user";
import { sendEmail } from "../lib/utils";

/**
 * @param {Date} date1 The date
 * @param {Date} date2 The date
 */
function dayDiff(date1: Date, date2: Date): number {
  if (!(date1 instanceof Date && date2 instanceof Date)) {
    throw new Error(
      `Function dayDiff expected arguments to be of type Date, got: ${typeof date1}, ${typeof date2}`
    );
  }
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

function getOldUsers(
  sheet: GoogleAppsScript.Spreadsheet.Sheet
): Array<GoogleAppsScript.AdminDirectory.Schema.User> {
  const columnA1Notation = labelToColumnLetter(sheet, "exists");
  const range = sheet.getRange(`${columnA1Notation}:${columnA1Notation}`);
  const today = new Date();
  const users = Array.from(
    range
      .getValues()
      .map(([v]: any[]) => v)
      .entries()
      .filter(([row, exists]) => row > 1 && exists)
      .map(([row, _]) => [row, getField(sheet, row + 1, "timestamp")])
      .filter(([_, timestamp]) => dayDiff(timestamp, today) > 7)
      .map(([row, _]) => getField(sheet, row + 1, "primaryEmail"))
      .map((primaryEmail) => getGoogleUser(primaryEmail))
  );
  return users;
}

/**
 * Returns a list of freshly created users (older than a week, but younger than 3 weeks)
 * @param {SpreadsheetApp.Sheet} sheet - sheet with users
 */
function getFreshUsers(
  sheet: GoogleAppsScript.Spreadsheet.Sheet
): Array<GoogleAppsScript.AdminDirectory.Schema.User> {
  const columnA1Notation = labelToColumnLetter(sheet, "timestamp");
  const range = sheet.getRange(`${columnA1Notation}:${columnA1Notation}`);
  const today = new Date();
  const users = Array.from(
    range
      .getValues()
      .map(([v]: any[]) => v)
      .entries()
      .filter(([_, timestamp]) => {
        const date = new Date(timestamp);
        const diff = dayDiff(date, today);
        return diff > 7 && diff < 21;
      })
      .map(([row, _]) => [row, getField(sheet, row + 1, "exists")])
      .filter(([row, exists]) => row > 1 && exists)
      .map(([row, _]) => getField(sheet, row + 1, "primaryEmail"))
      .map((primaryEmail) => getGoogleUser(primaryEmail))
  );
  return users;
}

/**
 * Cleanup of stale accounts that haven't been activated
 * @param {AdminDirectory.Schema.User} user User fetched with Google API
 */
export function freshCleanup(): void {
  console.info("[freshCleanup] Started stale account cleanup");
  const sheet = getSheet();
  const users = getFreshUsers(sheet);
  let msg = "Usunięto użytkowników:\n\n";
  let removed = false;

  console.log(`[freshCleanup] Found ${users.length} fresh users to check.`);

  for (const user of users) {
    if (isAccountInactive(user) && user.primaryEmail) {
      console.log(`[freshCleanup] Deleting inactive user: ${user.primaryEmail}`);
      deleteUser(user.primaryEmail);
      msg += `- ${user.primaryEmail}\n`;
      removed = true;
    }
  }

  if (removed) {
    console.info("[freshCleanup] Users removed, sending summary email.");
    sendEmail(
      ADMIN_MAIL,
      "freshCleanup: usunięto nieaktywnych użytkowników",
      msg
    );
  } else {
    console.info("[freshCleanup] No users removed.");
  }
  console.info("[freshCleanup] Cleanup completed.");
}

/**
 * Check if Google User was never activated (the user hasn't logged in)
 * @param {AdminDirectory.Schema.User} user User fetched with Google API
 */
function isAccountInactive(
  user: GoogleAppsScript.AdminDirectory.Schema.User
): boolean {
  if (!user.lastLoginTime) {
    return false;
  }
  const inactive = user.lastLoginTime === "1970-01-01T00:00:00.000Z";
  if (inactive) {
      console.log(`[isAccountInactive] User ${user.primaryEmail} is inactive (lastLoginTime: ${user.lastLoginTime})`);
  }
  return inactive;
}
