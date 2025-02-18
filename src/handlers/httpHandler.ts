import { getSheet, updateRow } from "../lib/sheet";
import { getUser, getGoogleUser } from "../lib/user";
import { returnJSON, sendEmail } from "../lib/utils";
import { verifyToken } from "../lib/auth";
import { ADMIN_MAIL, MANAGER_MAIL, LEADERS_GROUP } from "../config";

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

export function doPost({
  parameter,
  postData,
}: GoogleAppsScript.Events.DoPost) {
  Logger.log(JSON.stringify(postData));
  Logger.log(parameter.id);
  try {
    if (!parameter.id) {
      throw new Error("No id provided");
    }
    const body = JSON.parse(postData.contents);
    const token = body.credential;
    if (!token) {
      throw new Error("No token provided");
    }
    const payload: any = verifyToken(token);
    if (!payload) {
      throw new Error("Niepoprawny token uwierzytelniający");
    }
    const superiorUserId = payload["sub"];
    const superiorUser = getGoogleUser(superiorUserId);
    if (superiorUser.orgUnitPath != LEADERS_GROUP) {
      throw new Error("Użytkownik nie znajduje się na liście instruktorów");
    }

    const user = getUser(`${parameter.id}@zhr.pl`);
    if (!superiorUser.primaryEmail) {
      throw new Error("superiorUser primaryEmail is undefined");
    }
    acceptUser(user, superiorUser.primaryEmail);
    return returnJSON({ status: "success" });
  } catch (err) {
    return jsonErrorHandler(err as Error, {
      context: {
        err,
        superiorEmail: Session.getActiveUser().getEmail(),
      },
      func: "superiorConfirm",
    });
  }
}

function jsonErrorHandler(
  err: Error,
  { context, func = "unknown" }: { context: any; func?: string }
) {
  errorHandler(err, func, context);
  return returnJSON({ error: err.message });
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
