import { updateRow } from "../lib/sheet";
import { getGoogleUser } from "../lib/user";
import { parseFormUrlEncoded, sendEmail } from "../lib/utils";
import { verifyToken } from "../lib/auth";
import {
  ADMIN_MAIL,
  MANAGER_MAIL,
  LEADERS_GROUP,
  APP_URL,
  GOOGLE_CLIENT_ID,
} from "../config";

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

export function doGet(e: GoogleAppsScript.Events.DoGet) {
  const id = e.parameter.id;
  const template = HtmlService.createTemplateFromFile("confirm");
  template.redirectUrl = APP_URL;
  template.googleClientId = GOOGLE_CLIENT_ID;
  template.mail = `${id}@zhr.pl`;
  return template.evaluate();
}

export function doPost({ postData }: GoogleAppsScript.Events.DoPost) {
  Logger.log(JSON.stringify(postData));
  try {
    const form = parseFormUrlEncoded(postData.contents);
    const token = form.credential;
    if (!token) {
      throw new Error("No token provided");
    }
    const payload: any = verifyToken(token);
    if (payload) {
      const superiorUserId = payload["sub"];
      const superiorUser = getGoogleUser(superiorUserId);
      if (superiorUser.orgUnitPath != LEADERS_GROUP) {
        throw new Error("Użytkownik nie znajduje się na liście instruktorów");
      }
    } else {
      throw new Error("Niepoprawny token uwierzytelniający");
    }
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
