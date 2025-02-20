import { getSheet, getRow, updateRow } from "../lib/sheet";
import { proposeEmail } from "../lib/utils";
import { sendEmail } from "../lib/utils";
import { ADMIN_MAIL, PROXY_URL } from "../config";

/**
 * Handles the event
 */
export function onFormSubmit(e: GoogleAppsScript.Events.SheetsOnFormSubmit) {
  const row = e.range.getRow();
  const sheet = getSheet();
  const { superiorEmail, name, surname } = getRow(sheet, row);
  const primaryEmail = `${proposeEmail(name, surname)}@zhr.pl`;
  const options = handleFormSubmit(name, surname, primaryEmail, superiorEmail);

  updateRow(sheet, row, {
    ...options,
    primaryEmail,
  });
}

/**
 * Handle form submit logic, returns values to be updated in sheet
 */
function handleFormSubmit(
  name: string,
  surname: string,
  primaryEmail: string,
  superiorEmail: string
) {
  if (superiorEmail) {
    notifySuperior(superiorEmail, name, surname);
    return { status: "Oczekiwanie na opiekuna" };
  }
  sendEmail(
    ADMIN_MAIL,
    `Prośba o założenie konta ${primaryEmail}`,
    `Zatwierdź: ${SpreadsheetApp.getActiveSpreadsheet().getUrl()}`
  );
  return { status: "Oczekiwanie na admina", isLeader: true };
}

/**
 * Send email with superior confirmation link
 */
function notifySuperior(superiorEmail: string, name: string, surname: string) {
  const id = proposeEmail(name, surname);
  const mail = `${id}@zhr.pl`;
  const verificationLink = `${PROXY_URL}/confirm-zhr.html?id=${id}`;
  const template = HtmlService.createTemplateFromFile("superior");
  template.mail = mail;
  template.verificationLink = verificationLink;
  template.name = name;
  template.surname = surname;
  sendEmail(superiorEmail, `Założenia konta ${mail}`, "", {
    htmlBody: template.evaluate().getContent(),
  });
}
