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
  console.log(`[deleteUser] Attempting to delete user ${mail}`);
  const user = getUser(mail);
  const googleUser = getGoogleUser(mail);
  if (!googleUser.changePasswordAtNextLogin) {
    console.warn(`[deleteUser] User ${mail} has 'changePasswordAtNextLogin' set to false. Skipping deletion.`);
    throw new Error(
      `User ${mail} has 'changePasswordAtNextLogin' set to false, will not delete it`
    );
  }
  const sheet = getSheet();
  console.log(`[deleteUser] Removing stale user ${mail} from Directory.`);
  if (AdminDirectory && AdminDirectory.Users) {
    AdminDirectory.Users.remove(mail);
  } else {
    throw new Error("AdminDirectory.Users is undefined");
  }
  const template = HtmlService.createTemplateFromFile("deleted");
  template.mail = mail;
  template.surveyLink = SURVEY_LINK;
  if (googleUser.recoveryEmail) {
    console.log(`[deleteUser] Sending deletion notification to ${googleUser.recoveryEmail}`);
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
  console.info(`[deleteUser] User ${mail} deleted and sheet updated.`);
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

export function getGoogleUserSafe(
  email: string
): GoogleAppsScript.AdminDirectory.Schema.User | null {
  try {
    return getGoogleUser(email);
  } catch (e) {
    return null;
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
  console.log(`[createUser] Creating user ${primaryEmail} (OrgUnit: ${orgUnitPath}, Manager: ${superiorEmail})`);
  const exists = userExists(primaryEmail);
  if (exists) {
    console.error(`[createUser] User ${primaryEmail} already exists.`);
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
    console.info(`[createUser] User ${primaryEmail} created successfully.`);
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
  console.info(`[updateGroup] Starting group update with ${mailList.length} emails.`);
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
            console.log(`[updateGroup] Added ${user.primaryEmail} to group.`);
          }
        } else {
          throw new Error(`User not found: ${mail}`);
        }
      } catch (error) {
        console.warn(`[updateGroup] User ${mail} not found or error accessing: ${error}`);
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
                console.log(
                  `[updateGroup] Removed ${user.primaryEmail} from group (moved to reserve).`
                );
                removed.push(user.primaryEmail as string);
              } catch (error) {
                console.error(`[updateGroup] Failed to reassign user ${user.primaryEmail}`, error);
              }
            }
          }
        }
      } else {
        console.log("[updateGroup] No existing users found in group to check for removal.");
      }

      pageToken = page.nextPageToken;
    } while (pageToken);

    return { added, removed, notFound };
  } else {
    throw new Error("AdminDirectory.Users is undefined");
  }
}
