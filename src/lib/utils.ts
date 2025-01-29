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
