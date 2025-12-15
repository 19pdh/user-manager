import { getSheet, updateRow } from "../lib/sheet";
import { getUser, getGoogleUser, getGoogleUserSafe } from "../lib/user";
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
  console.info("[doPost] Received POST request");
  try {
    console.log(`[doPost] Payload length: ${postData.length}`);
    // Logger.log(JSON.stringify(postData)); // Avoiding logging full payload for security/privacy if it contains tokens, but maybe useful for debug.

    let { token, userMail } = parseFormData(postData.contents);
    console.log(`[doPost] Processing confirmation for userMail: ${userMail}`);

    const superiorMail = parseSuperiorToken(token);
    console.log(`[doPost] Superior identified: ${superiorMail}`);

    // Check if user exists
    const googleUser = getGoogleUserSafe(userMail);
    let confirmedEmail: string;

    if (googleUser) {
      console.log(`[doPost] User ${userMail} exists in Directory. Confirming existing user.`);
      confirmExistingUser(googleUser, superiorMail);
      console.info(`[doPost] Confirmed directory user ${userMail} by ${superiorMail}`);
      confirmedEmail = googleUser.primaryEmail!;
    } else {
      console.log(`[doPost] User ${userMail} not in Directory. Checking Sheet.`);
      const sheetUser = getUser(userMail);
      confirmNewUser(sheetUser, superiorMail);
      console.info(`[doPost] Confirmed sheet user ${userMail} by ${superiorMail}`);
      confirmedEmail = sheetUser.primaryEmail;
    }

    const template = HtmlService.createTemplateFromFile("superiorConfirmed");
    template.mail = confirmedEmail;
    return template.evaluate();
  } catch (err) {
    console.error("[doPost] Error handling request", err);
    // Needed to reference userMail for context in error handler
    // But parseFormData might have failed.
    const isOrgUnitPathError = err instanceof OrgUnitPathError;
    return htmlErrorHandler(err as Error, {
      context: {
        err,
        // userMail might be undefined here if parseFormData failed, but we can't easily access it from the try block variable without redefining scope.
        // Simplified: just pass what we have or undefined.
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

function confirmNewUser(user: { [key: string]: any }, superiorEmail: string) {
  const sheet = getSheet();
  const { rowNumber, primaryEmail } = user;
  const link = SpreadsheetApp.getActiveSpreadsheet().getUrl();

  console.log(`[confirmNewUser] Updating sheet row ${rowNumber} for ${primaryEmail}`);
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

function confirmExistingUser(
  googleUser: GoogleAppsScript.AdminDirectory.Schema.User,
  superiorMail: string
) {
  const now = new Date();

  const currentRelations = googleUser.relations || [];

  // Remove deactivation schedule and update confirmation date
  const updatedRelations = currentRelations.filter(
    (r: GoogleAppsScript.AdminDirectory.Schema.UserRelation) =>
      r.customType !== "scheduled_for_deactivation" &&
      r.customType !== "confirmation_date" &&
      r.type !== "manager"
  );

  updatedRelations.push({
    type: "custom",
    customType: "confirmation_date",
    value: now.toISOString(),
  });
  updatedRelations.push({
    type: "manager",
    value: superiorMail,
  });

  console.log(`[confirmExistingUser] Updating relations for ${googleUser.primaryEmail}`);
  AdminDirectory.Users!.patch(
    { relations: updatedRelations },
    googleUser.primaryEmail!
  );

  const template = HtmlService.createTemplateFromFile("deactivationCancelled");
  template.mail = googleUser.primaryEmail;

  sendEmail(
    [googleUser.primaryEmail, googleUser.recoveryEmail].join(","),
    "Konto @zhr.pl zostało potwierdzone",
    "",
    { htmlBody: template.evaluate().getContent() }
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
  console.error(`[errorHandler] Error in function '${func}'`, err);
  const msg = `Error message:
  
  ${err.stack}
  
  Additional data:
  
  ${JSON.stringify(context)}`;

  // Using sendEmail which now logs as well
  sendEmail(
    `${MANAGER_MAIL}, ${ADMIN_MAIL}`,
    `Error in function '${func}'`,
    msg
  );
}
