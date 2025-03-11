import { getSheet, getRow, updateRow } from "../lib/sheet";
import { proposeEmail } from "../lib/utils";
import { sendEmail } from "../lib/utils";
import { PROXY_URL } from "../config";

/**
 * Handles the event
 */
export function onFormSubmit(e: GoogleAppsScript.Events.SheetsOnFormSubmit) {
  const row = e.range.getRow();
  const sheet = getSheet();
  let { name, surname, troupName, superiorEmail, primaryEmail } = getRow(
    sheet,
    row
  );
  if (troupName) {
    notifySuperior(superiorEmail, troupName, "", primaryEmail);
  } else {
    primaryEmail = `${proposeEmail(name, surname)}@zhr.pl`;
    notifySuperior(superiorEmail, name, surname, primaryEmail);
  }
  updateRow(sheet, row, {
    status: "Oczekiwanie na opiekuna",
    primaryEmail,
    isUnit: !!troupName,
  });
}

/**
 * Send email with superior confirmation link
 */
function notifySuperior(
  superiorEmail: string,
  name: string,
  surname: string,
  mail: string
) {
  const verificationLink = `${PROXY_URL}/confirm-zhr.html?id=${mail}`;
  const template = HtmlService.createTemplateFromFile("superior");
  template.mail = mail;
  template.verificationLink = verificationLink;
  template.name = name;
  template.surname = surname;
  sendEmail(superiorEmail, `Założenia konta ${mail}`, "", {
    htmlBody: template.evaluate().getContent(),
  });
}
