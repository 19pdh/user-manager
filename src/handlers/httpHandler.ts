import { getSheet, updateRow } from "../lib/sheet";
import { getUser, getGoogleUser } from "../lib/user";
import { parseFormUrlEncoded, sendEmail } from "../lib/utils";
import { verifyToken } from "../lib/auth";
import { ADMIN_MAIL, MANAGER_MAIL, LEADERS_GROUP } from "../config";

/**
 * Handles the POST request
 */
export function doPost({ postData }: GoogleAppsScript.Events.DoPost) {
  Logger.log(JSON.stringify(postData));
  try {
    const { token, userMail } = parseFormData(postData.contents);

    const user = getUser(userMail);
    const superiorMail = parseSuperiorToken(token);

    Logger.log(`Confirming user ${userMail} by ${superiorMail}`);

    acceptUser(user, superiorMail);
    const template = HtmlService.createTemplateFromFile("superiorConfirmed");
    template.mail = user.primaryEmail;
    return template.evaluate();
  } catch (err) {
    return htmlErrorHandler(err as Error, {
      context: {
        err,
        superiorEmail: Session.getActiveUser().getEmail(),
      },
      func: "superiorConfirm",
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
  const userMail = `${form.state}@zhr.pl`;
  return { token, userMail };
}

function parseSuperiorToken(token: string) {
  const payload: any = verifyToken(token);
  if (!payload) {
    throw new Error("Niepoprawny token uwierzytelniający");
  }
  const superiorUserId = payload["sub"];
  const superiorUser = getGoogleUser(superiorUserId);
  if (superiorUser.orgUnitPath != LEADERS_GROUP) {
    throw new Error("Użytkownik nie znajduje się na liście instruktorów");
  }
  if (!superiorUser.primaryEmail) {
    throw new Error("superiorUser primaryEmail is undefined");
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
  { context, func = "unknown" }: { context: any; func?: string }
) {
  errorHandler(err, func, context);
  const template = HtmlService.createTemplateFromFile("superiorError");
  template.error = err.message;
  template.superiorEmail = context.superiorEmail;
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
