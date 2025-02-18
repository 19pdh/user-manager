import { SURVEY_LINK } from "../config";
import { getSheet, labelToColumnLetter, getRow, updateRow } from "./sheet";
import { sendEmail } from "./utils";

export function getUser(mail: string): { [key: string]: any } {
  const sheet = getSheet();
  const columnA1Notation = labelToColumnLetter(sheet, "primaryEmail");
  const range = sheet.getRange(`${columnA1Notation}:${columnA1Notation}`);
  const values = range.getValues().map((el) => el[0]);
  const rowReversed = values.reverse().indexOf(mail);
  if (rowReversed == -1) {
    throw new Error(
      `Couldn't find mail '${mail}' in sheet in column ${columnA1Notation}`
    );
  }
  const rowNumber = values.length - rowReversed;
  return { rowNumber, ...getRow(sheet, rowNumber) };
}

export function deleteUser(mail: string) {
  const user = getUser(mail);
  const googleUser = getGoogleUser(mail);
  if (!googleUser.changePasswordAtNextLogin) {
    throw new Error(
      `User ${mail} has 'changePasswordAtNextLogin' set to false, will not delete it`
    );
  }
  const sheet = getSheet();
  Logger.log(`Removing stale user ${mail}`);
  if (AdminDirectory && AdminDirectory.Users) {
    AdminDirectory.Users.remove(mail);
  } else {
    throw new Error("AdminDirectory.Users is undefined");
  }
  const template = HtmlService.createTemplateFromFile("deleted");
  template.mail = mail;
  template.surveyLink = SURVEY_LINK;
  if (googleUser.recoveryEmail) {
    sendEmail(
      googleUser.recoveryEmail,
      `Twoje konto ${mail} zostało usunięte`,
      "",
      { htmlBody: template.evaluate().getContent() }
    );
  }
  updateRow(sheet, user.rowNumber, {
    status: "Usunięto",
    exists: false,
  });
}

export function getGoogleUser(
  mail: string
): GoogleAppsScript.AdminDirectory.Schema.User {
  if (AdminDirectory && AdminDirectory.Users) {
    const user = AdminDirectory.Users.get(mail);
    if (!user) {
      throw new Error("Coulnd't fetch google user");
    }
    return user;
  } else {
    throw new Error("AdminDirectory.Users is undefined");
  }
}

function userExists(mail: string) {
  try {
    if (AdminDirectory && AdminDirectory.Users) {
      AdminDirectory.Users.get(mail);
    } else {
      throw new Error("AdminDirectory.Users is undefined");
    }
  } catch (err) {
    return false;
  }
  return true;
}

export function createUser(
  name: string,
  surname: string,
  primaryEmail: string,
  recoveryEmail: string,
  recoveryPhone: string,
  orgUnitPath: string,
  password: string
) {
  const exists = userExists(primaryEmail);
  if (exists) {
    throw new Error(`User ${primaryEmail} already exists!`);
  }
  const user = {
    name: {
      fullName: `${name} ${surname}`,
      familyName: surname,
      givenName: name,
    },
    primaryEmail,
    recoveryEmail,
    recoveryPhone: `+48${recoveryPhone}`,
    orgUnitPath,
    changePasswordAtNextLogin: true,
    password,
    mails: [
      {
        type: "work",
        address: recoveryEmail,
      },
    ],
    phones: [
      {
        type: "work",
        value: recoveryPhone,
      },
    ],
  };
  if (AdminDirectory && AdminDirectory.Users) {
    AdminDirectory.Users.insert(user);
  } else {
    throw new Error("AdminDirectory.Users is undefined");
  }
}

export function generatePassword(length: number) {
  let chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";

  let password = "";
  for (let i = 0; i < length; i++) {
    let index = Math.floor(Math.random() * chars.length);
    password += chars[index];
  }

  return password;
}
