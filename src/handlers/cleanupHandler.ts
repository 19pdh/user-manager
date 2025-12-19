import { ADMIN_MAIL, SURVEY_LINK } from "../config";
import { labelToColumnLetter, getField, getSheet, updateRow, getRow } from "../lib/sheet";
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

function isSevenDaysAgo(dateToCheck: Date): boolean {
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);

  return (
    dateToCheck.getFullYear() === sevenDaysAgo.getFullYear() &&
    dateToCheck.getMonth() === sevenDaysAgo.getMonth() &&
    dateToCheck.getDate() === sevenDaysAgo.getDate()
  );
}

function cleanupPendingRequests(): void {
  const sheet = getSheet();
  const columnA1Notation = labelToColumnLetter(sheet, "timestamp");
  const range = sheet.getRange(`${columnA1Notation}:${columnA1Notation}`);
  const values = range.getValues().map(([v]: any[]) => v);

  for (let i = 1; i < values.length; i++) {
    const timestamp = values[i];
    if (!timestamp) continue;
    const date = new Date(timestamp);

    if (isSevenDaysAgo(date)) {
      const row = i + 1;
      const status = getField(sheet, row, "status");
      if (status === "Oczekiwanie na opiekuna") {
        const { recoveryEmail, primaryEmail } = getRow(sheet, row);
        console.log(`Rejecting request for ${primaryEmail}`);

        const template = HtmlService.createTemplateFromFile("requestRefused");
        template.mail = primaryEmail;
        template.surveyLink = SURVEY_LINK;

        if (recoveryEmail) {
          sendEmail(
            recoveryEmail,
            `Twój wniosek o konto @zhr.pl został odrzucony`,
            "",
            { htmlBody: template.evaluate().getContent() }
          );
        }

        updateRow(sheet, row, { status: "Odmówiono" });
      }
    }
  }
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
  cleanupPendingRequests();
  const sheet = getSheet();
  const users = getFreshUsers(sheet);
  let msg = "Usunięto użytkowników:\n\n";
  let removed = false;

  for (const user of users) {
    if (isAccountInactive(user) && user.primaryEmail) {
      console.log(`To delete ${user.primaryEmail}`);
      deleteUser(user.primaryEmail);
      msg += `- ${user.primaryEmail}\n`;
      removed = true;
    }
  }

  if (removed) {
    sendEmail(
      ADMIN_MAIL,
      "freshCleanup: usunięto nieaktywnych użytkowników",
      msg
    );
  }
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
  return user.lastLoginTime === "1970-01-01T00:00:00.000Z";
}
