import { SURVEY_LINK, LEADERS_GROUP } from "../config";
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
  password: string,
  superiorEmail: string
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
    relations: [
      {
        type: "manager",
        value: superiorEmail,
      },
      {
        type: "custom",
        customType: "confirmation_date",
        value: new Date().toISOString(),
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

export function updateGroup(mailList: string[]): {
  added: string[];
  removed: string[];
  notFound: string[];
} {
  if (AdminDirectory && AdminDirectory.Users) {
    const userList = [];
    const notFound = [];
    const added = [];

    // Add every email to the group and save the sub id to the userList array
    for (const mail of mailList) {
      try {
        const user = AdminDirectory.Users.get(mail);
        if (user.id) {
          userList.push(user.id);
          if (user.orgUnitPath !== LEADERS_GROUP) {
            AdminDirectory.Users.patch({ orgUnitPath: LEADERS_GROUP }, user.id);
            added.push(user.primaryEmail as string);
            Logger.log(`User ${user.primaryEmail} has been added to the group`);
          }
        } else {
          throw new Error(`User not found: ${mail}`);
        }
      } catch (error) {
        notFound.push(mail);
      }
    }

    // Remove users that were in the group before, but are not in the mailList
    const removed = [];
    let page;
    let pageToken;
    do {
      page = AdminDirectory.Users.list({
        domain: "zhr.pl",
        query: `orgUnitPath='${LEADERS_GROUP}'`,
        orderBy: "givenName",
        maxResults: 100,
        pageToken: pageToken,
      });
      const users = page.users;

      if (users) {
        for (const user of users) {
          if (
            user.id &&
            user.orgUnitPath &&
            user.orgUnitPath === LEADERS_GROUP
          ) {
            if (!userList.includes(user.id)) {
              try {
                AdminDirectory.Users.patch(
                  {
                    orgUnitPath:
                      LEADERS_GROUP + "/Instruktorzy w rezerwie (wlp)",
                  },
                  user.id
                );
                Logger.log(
                  `User ${user.primaryEmail} has been removed from the group`
                );
                removed.push(user.primaryEmail as string);
              } catch (error) {
                Logger.log(`Couldn't reassign user ${user.primaryEmail}`);
              }
            }
          }
        }
      } else {
        Logger.log("No users found.");
      }

      pageToken = page.nextPageToken;
    } while (pageToken);

    return { added, removed, notFound };
  } else {
    throw new Error("AdminDirectory.Users is undefined");
  }
}
