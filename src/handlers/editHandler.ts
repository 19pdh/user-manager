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
  // We can't log every edit, only when value is "Zatwierdzono"
  if (value != "Zatwierdzono") {
    return;
  }

  console.info("[onEdit] Edit event 'Zatwierdzono' detected.");

  const column = range.getColumn();
  const row = range.getRow();
  if (column != 1) {
    console.log("[onEdit] Ignored: Edit not in column 1.");
    return;
  }

  const email = user.getEmail();
  if (email != MANAGER_MAIL && email != ADMIN_MAIL) {
    console.log(`[onEdit] Ignored: User ${email} is not authorized.`);
    return;
  }

  try {
    const sheet = getSheet();
    const userToCreate = getRow(sheet, row);

    if (userToCreate.exists) {
        console.log(`[onEdit] User at row ${row} already exists.`);
        return;
    }

    console.log(`[onEdit] Creating user for row ${row}. Data: ${JSON.stringify(userToCreate)}`);

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

    console.info(`[onEdit] User ${userToCreate.primaryEmail} created.`);

    const template = HtmlService.createTemplateFromFile("created");
    template.mail = userToCreate.primaryEmail;
    template.password = password;

    sendEmail(
        userToCreate.recoveryEmail,
        "⚜️ Twój mail @zhr.pl jest już gotowy!",
        "",
        { htmlBody: template.evaluate().getContent() }
    );
  } catch (err) {
      console.error("[onEdit] Error processing edit", err);
      throw err;
  }
}
