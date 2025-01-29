import { getSheet, updateRow } from "../lib/sheet";
import { getUser, getGoogleUser } from "../lib/user";
import { sendEmail } from "../lib/utils";
import { ADMIN_MAIL, MANAGER_MAIL, LEADERS_GROUP } from "../config";

function acceptUser(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  user: { [key: string]: any },
  superiorEmail: string
) {
  const { rowNumber, primaryEmail } = user;
  const link = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  updateRow(sheet, rowNumber, {
    timestamp: new Date(),
    superiorResponse: "Potwierdzone",
    status: "Oczekiwanie na admina",
    superiorEmail,
  });
  sendEmail(
    ADMIN_MAIL,
    `Odpowiedź przełożonego ${primaryEmail}`,
    `Opiekun ${superiorEmail} potwierdził założenie konta ${primaryEmail}

Wiersz: ${rowNumber}
Zobacz: ${link}`
  );
}

class OrgUnitPathError extends Error {
  constructor(userEmail: string, orgUnitPath: string) {
    super(`User '${userEmail}' was not found in ${orgUnitPath}`);
    this.name = "OrgUnitPathError";
  }
}

export function doGet(e: GoogleAppsScript.Events.DoGet) {
  try {
    const id = e.parameter.id;
    if (!id) {
      throw new Error("URL parameter 'id' should be passed");
    }

    const superiorEmail = Session.getActiveUser().getEmail();
    if (!superiorEmail) {
      throw new Error(
        `Got unexpected value of superiorEmail: '${superiorEmail}'`
      );
    }

    const superiorUser = getGoogleUser(superiorEmail);
    if (!superiorUser) {
      throw new Error(`Cannot access user '${superiorEmail}' in domain`);
    }

    if (superiorUser.orgUnitPath != LEADERS_GROUP) {
      throw new OrgUnitPathError(superiorEmail, LEADERS_GROUP);
    }

    const sheet = getSheet();
    const user = getUser(id + "@zhr.pl");

    acceptUser(sheet, user, superiorEmail);

    const template = HtmlService.createTemplateFromFile("superiorConfirmed");
    template.mail = user.primaryEmail;
    return template.evaluate();
  } catch (err) {
    const isOrgUnitPathError = err instanceof OrgUnitPathError;
    return htmlErrorHandler(err as Error, {
      context: {
        e,
        superiorEmail: Session.getActiveUser().getEmail(),
      },
      func: "superiorConfirm",
      isOrgUnitPathError,
    });
  }
}

function htmlErrorHandler(
  err: Error,
  {
    context,
    func = "unknown",
    isOrgUnitPathError,
  }: { context: any; func?: string; isOrgUnitPathError?: boolean }
) {
  errorHandler(err, func, context);
  const template = HtmlService.createTemplateFromFile("superiorError");
  template.error = err.message;
  template.superiorEmail = context.superiorEmail;
  template.isOrgUnitPathError = isOrgUnitPathError;
  return template.evaluate();
}

function errorHandler(err: Error, func = "unknown", context = undefined) {
  console.error(err);
  const msg = `Error message:
  
  ${err.stack}
  
  Additional data:
  
  ${JSON.stringify(context)}`;
  sendEmail(
    `${MANAGER_MAIL}, ${ADMIN_MAIL}`,
    `Error in function '${func}'`,
    msg
  );
}
