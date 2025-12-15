import { getSheet, getRow, updateRow } from "../lib/sheet";
import { proposeEmail } from "../lib/utils";
import { sendEmail } from "../lib/utils";
import { PROXY_URL } from "../config";

/**
 * Handles the event
 */
export function onFormSubmit(e: GoogleAppsScript.Events.SheetsOnFormSubmit) {
  console.info("[onFormSubmit] Started handling form submission");
  try {
    const row = e.range.getRow();
    const sheet = getSheet();
    console.log(`[onFormSubmit] Processing row: ${row}`);

    let { name, surname, troupName, superiorEmail, primaryEmail } = getRow(
      sheet,
      row
    );

    console.log(`[onFormSubmit] Data extracted: name='${name}', surname='${surname}', troup='${troupName}', superior='${superiorEmail}'`);

    if (troupName) {
      console.log(`[onFormSubmit] Detected unit account request for: ${troupName}`);
      notifySuperior(superiorEmail, troupName, "", primaryEmail);
    } else {
      primaryEmail = `${proposeEmail(name, surname)}@zhr.pl`;
      console.log(`[onFormSubmit] Detected personal account request. Proposed email: ${primaryEmail}`);
      notifySuperior(superiorEmail, name, surname, primaryEmail);
    }
    updateRow(sheet, row, {
      status: "Oczekiwanie na opiekuna",
      primaryEmail,
      isUnit: !!troupName,
    });
    console.info(`[onFormSubmit] Completed handling row ${row}. Status updated.`);
  } catch (err) {
    console.error("[onFormSubmit] Error processing form submission", err);
    throw err;
  }
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

  console.log(`[notifySuperior] Sending notification to superior ${superiorEmail} for account ${mail}`);
  sendEmail(superiorEmail, `Założenia konta ${mail}`, "", {
    htmlBody: template.evaluate().getContent(),
  });
}
