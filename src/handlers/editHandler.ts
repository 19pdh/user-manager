import { getSheet, updateRow, getRow } from "../lib/sheet";
import { createUser, generatePassword } from "../lib/user";
import { sendEmail, renderTemplate } from "../lib/utils";
import {
  MANAGER_MAIL,
  NONLEADERS_GROUP,
  UNIT_GROUP,
  ADMIN_MAIL,
} from "../config";

export function onEdit({
  user,
  value,
  range,
}: GoogleAppsScript.Events.SheetsOnEdit) {
  if (value != "Zatwierdzono") {
    return;
  }

  console.info("[onEdit] Processing edit event 'Zatwierdzono'");

  const column = range.getColumn();
  const row = range.getRow();
  if (column != 1) {
    return;
  }

  const email = user.getEmail();
  if (email != MANAGER_MAIL && email != ADMIN_MAIL) {
    return;
  }

  const sheet = getSheet();
  const userToCreate = getRow(sheet, row);

  if (userToCreate.exists) {
    console.log("[onEdit] User already exists, skipping creation");
    return;
  }

  let orgUnitPath = NONLEADERS_GROUP;
  if (userToCreate.isUnit) {
    orgUnitPath = UNIT_GROUP;
    // Split troupName into name and surname
    // Last word used as surname, rest as (first) name

    const parts = userToCreate.troupName
      .trim() // remove trailing/leading spaces
      .split(/\s+/); // split by one or more spaces

    if (parts < 2) {
      parts.push(parts[0]);
    }
    userToCreate.surname = parts.pop();
    userToCreate.name = parts.join(" ");
  }

  const password = generatePassword(10);

  createUser(
    userToCreate.name,
    userToCreate.surname,
    userToCreate.primaryEmail,
    userToCreate.recoveryEmail,
    userToCreate.recoveryPhone,
    orgUnitPath,
    password,
    userToCreate.superiorEmail
  );
  updateRow(sheet, row, { timestamp: new Date(), exists: true });
  const subject = "⚜️ Twój mail @zhr.pl jest już gotowy!";
  const htmlBody = renderTemplate(
    "created",
    { mail: userToCreate.primaryEmail, password: password },
    subject
  ).getContent();
  sendEmail(userToCreate.recoveryEmail, subject, "", {
    htmlBody,
  });
}
