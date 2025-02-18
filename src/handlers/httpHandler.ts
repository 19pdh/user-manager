import { getSheet, updateRow } from "../lib/sheet";
import { getUser, getGoogleUser } from "../lib/user";
import { parseFormUrlEncoded, sendEmail } from "../lib/utils";
import {
  ADMIN_MAIL,
  MANAGER_MAIL,
  LEADERS_GROUP,
  APP_URL,
  GOOGLE_CLIENT_ID,
} from "../config";
import { KJUR, b64utoutf8, KEYUTIL, RSAKey } from "jsrsasign";

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

function verifyToken(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT structure");
  }

  // Find the key with the matching kid
  const header: any | null = KJUR.jws.JWS.readSafeJSONString(
    b64utoutf8(parts[0])
  );
  if (!header) {
    throw new Error("Invalid JWT header");
  }

  return verifyJWT(token, header.kid);
}

function getGoogleKey(keyId: string) {
  // Fetch Google's public keys
  const response = UrlFetchApp.fetch(
    "https://www.googleapis.com/oauth2/v3/certs"
  );
  const keys = JSON.parse(response.getContentText());
  const key = keys.keys.find((k: { kid: string }) => k.kid === keyId);
  if (!key) {
    throw new Error("No matching key found");
  }
  return KEYUTIL.getKey(key) as RSAKey;
}

export function verifyJWT(jwt: string, keyId: string) {
  try {
    // Verify the JWT
    const publicKey = getGoogleKey(keyId);
    const isValid = KJUR.jws.JWS.verify(jwt, publicKey, ["RS256"]);
    if (isValid) {
      // Parse the JWT payload
      const payload = KJUR.jws.JWS.parse(jwt).payloadObj;
      Logger.log("JWT is valid");
      Logger.log(JSON.stringify(payload));
      return payload;
    } else {
      Logger.log("JWT verification failed.");
      return null;
    }
  } catch (e) {
    console.error(e);
    return null;
  }
}

function htmlErrorHandler(
  err: Error,
  {
    context,
    func = "unknown",
  }: { context: any; func?: string; isOrgUnitPathError?: boolean }
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
