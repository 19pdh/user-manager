import { ADMIN_MAIL, ADMIN_NAME } from "../config";

function sanitize(string: string) {
  return (
    string
      .replace(/[Łł]/g, "l") // NFD normalization cannot handle Ł
      .normalize("NFD") // Normalize to decompose accented characters
      .replace(/[\u0300-\u036f]/g, "") // Remove the combining diacritical marks
      .toLowerCase() // Convert to lowercase
      .replace(/['"]/g, "") // Remove single and double quotes
      .replace(/[^\w\s-]/g, "") // Remove special characters (except spaces and hyphens)
      .trim() // Trim whitespace from the beginning and end
      //.replace(/\s+/g, '-')              // Replace spaces with hyphens
      .replace(/\s+/g, "") // Remove spaces
      .replace(/--+/g, "-") // Replace multiple hyphens with a single hyphen
      .replace(/^-|-$/g, "")
  ); // Remove leading or trailing hyphens
}

export function proposeEmail(name: string, surname: string) {
  return `${sanitize(name)}.${sanitize(surname)}`;
}

export function sendEmail(
  to: string,
  title: string,
  body: string,
  options?: {}
) {
  GmailApp.sendEmail(to, title, body, {
    ...(options || {}),
    from: ADMIN_MAIL,
    name: ADMIN_NAME,
  });
}

/**
 * Parse an application/x-www-form-urlencoded string into an object
 */
export function parseFormUrlEncoded(encodedString: string) {
  // Split the string by '&' to get key-value pairs
  var pairs = encodedString.split("&");
  var result: any = {};

  // Iterate over each pair
  pairs.forEach(function (pair) {
    // Split the pair by '=' to separate key and value
    var parts = pair.split("=");
    // Decode and assign key and value to the result object
    var key = decodeURIComponent(parts[0].replace(/\+/g, " "));
    var value = decodeURIComponent(parts[1].replace(/\+/g, " "));
    result[key] = value;
  });

  return result;
}
