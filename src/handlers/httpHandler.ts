import { getSheet, updateRow } from "../lib/sheet";
import { getUser, getGoogleUser } from "../lib/user";
import { parseFormUrlEncoded, sendEmail } from "../lib/utils";
import { verifyToken } from "../lib/auth";
import { ADMIN_MAIL, MANAGER_MAIL, LEADERS_GROUP } from "../config";

class OrgUnitPathError extends Error {
  constructor(userEmail: string, orgUnitPath: string) {
    super(`Użytkownik '${userEmail}' nie jest w jednostce ${orgUnitPath}`);
    this.name = "OrgUnitPathError";
  }
}

/**
 * Handles the POST request
 */
export function doPost({ postData }: GoogleAppsScript.Events.DoPost) {
  Logger.log(JSON.stringify(postData));
  let token, userMail;
  try {
    let { token, userMail } = parseFormData(postData.contents);
    const superiorMail = parseSuperiorToken(token);
    const user = getUser(userMail);

    Logger.log(`Confirming user ${userMail} by ${superiorMail}`);

    acceptUser(user, superiorMail);
    const template = HtmlService.createTemplateFromFile("superiorConfirmed");
    template.mail = user.primaryEmail;
    return template.evaluate();
  } catch (err) {
    const isOrgUnitPathError = err instanceof OrgUnitPathError;
    return htmlErrorHandler(err as Error, {
      context: {
        err,
        userMail,
      },
      func: "superiorConfirm",
      isOrgUnitPathError,
    });
  }
}

function parseFormData(data: string) {
  const form = parseFormUrlEncoded(data);
  const token = form.credential;
  if (!token) {
    throw new Error("No token provided");
  }
  if (!form.state) {
    throw new Error("No state provided");
  }
  const userMail = form.state;
  return { token, userMail };
}

function parseSuperiorToken(token: string) {
  const payload: any = verifyToken(token);
  if (!payload) {
    throw new Error("Niepoprawny token uwierzytelniający");
  }
  const superiorUserId = payload["sub"];
  const superiorUser = getGoogleUser(superiorUserId);
  if (!superiorUser.primaryEmail) {
    throw new Error("superiorUser primaryEmail is undefined");
  }
  if (superiorUser.orgUnitPath != LEADERS_GROUP) {
    throw new OrgUnitPathError(superiorUser.primaryEmail, LEADERS_GROUP);
  }
  return superiorUser.primaryEmail;
}

function acceptUser(user: { [key: string]: any }, superiorEmail: string) {
  const sheet = getSheet();
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

function htmlErrorHandler(
  err: Error,
  {
    context,
    func = "unknown",
    isOrgUnitPathError = false,
  }: { context: any; func?: string; isOrgUnitPathError?: boolean }
) {
  errorHandler(err, func, context);
  const template = HtmlService.createTemplateFromFile("superiorError");
  template.error = err.message;
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
