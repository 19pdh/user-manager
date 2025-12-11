import { getSheet, updateRow, getRow } from "../lib/sheet";
import { createUser, generatePassword } from "../lib/user";
import { sendEmail } from "../lib/utils";
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
    userToCreate.superior
  );
  updateRow(sheet, row, { timestamp: new Date(), exists: true });
  const template = HtmlService.createTemplateFromFile("created");
  template.mail = userToCreate.primaryEmail;
  template.password = password;
  sendEmail(
    userToCreate.recoveryEmail,
    "⚜️ Twój mail @zhr.pl jest już gotowy!",
    "",
    { htmlBody: template.evaluate().getContent() }
  );
}
