import { getSheet, getRow, updateRow } from "../lib/sheet";
import { proposeEmail } from "../lib/utils";
import { sendEmail, renderTemplate } from "../lib/utils";
import { PROXY_URL, SURVEY_LINK } from "../config";
import { userExists } from "../lib/user";

/**
 * Handles the event
 */
export function onFormSubmit(e: GoogleAppsScript.Events.SheetsOnFormSubmit) {
  console.info("[onFormSubmit] Started handling form submission");
  const row = e.range.getRow();
  const sheet = getSheet();
  let {
    name,
    surname,
    troupName,
    superiorEmail,
    primaryEmail,
    recoveryEmail,
  } = getRow(sheet, row);

  if (!troupName) {
    primaryEmail = `${proposeEmail(name, surname)}@zhr.pl`;
  }

  if (userExists(primaryEmail)) {
    console.info(
      `[onFormSubmit] Email ${primaryEmail} is already taken. Rejecting request.`
    );
    const subject = `Wybrany adres ${primaryEmail} jest już zajęty`;
    const htmlBody = renderTemplate(
      "emailTaken",
      { mail: primaryEmail, surveyLink: SURVEY_LINK },
      subject
    ).getContent();
    sendEmail(recoveryEmail, subject, "", {
      htmlBody,
    });

    updateRow(sheet, row, {
      status: "Odmówiono",
      primaryEmail,
      isUnit: !!troupName,
    });
    return;
  }

  if (troupName) {
    notifySuperior(superiorEmail, troupName, "", primaryEmail);
  } else {
    notifySuperior(superiorEmail, name, surname, primaryEmail);
  }
  updateRow(sheet, row, {
    status: "Oczekiwanie na opiekuna",
    primaryEmail,
    isUnit: !!troupName,
  });
  console.info("[onFormSubmit] Finished handling form submission");
}

/**
 * Send email with superior confirmation link
 */
export function notifySuperior(
  superiorEmail: string,
  name: string,
  surname: string,
  mail: string
) {
  const verificationLink = `${PROXY_URL}/confirm-zhr.html?id=${mail}`;
  const subject = `Założenia konta ${mail}`;
  const htmlBody = renderTemplate(
    "superior",
    { mail, verificationLink, name, surname },
    subject
  ).getContent();
  sendEmail(superiorEmail, subject, "", {
    htmlBody,
  });
}
