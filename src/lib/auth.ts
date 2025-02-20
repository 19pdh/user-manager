import { KJUR, b64utoutf8, KEYUTIL, RSAKey } from "jsrsasign";

export function verifyToken(token: string) {
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

function verifyJWT(jwt: string, keyId: string): object | null {
  // Verify the JWT
  const publicKey = getGoogleKey(keyId);
  const isValid = KJUR.jws.JWS.verify(jwt, publicKey, ["RS256"]);
  if (!isValid) {
    throw new Error("Invalid JWT signature");
  }
  // Parse the JWT payload
  const payload = KJUR.jws.JWS.parse(jwt).payloadObj as object;
  Logger.log("JWT is valid");
  Logger.log(JSON.stringify(payload));
  return payload;
}
