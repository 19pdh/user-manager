import { onFormSubmit } from "./handlers/formHandler";
import { doGet } from "./handlers/httpHandler";
import { onEdit } from "./handlers/editHandler";
import { freshCleanup } from "./handlers/cleanupHandler";

export {
  // send emails after form submit
  onFormSubmit,
  // HTTP GET request handler - superior confirmation
  doGet,
  // Google Sheets onEdit handler - user creation
  onEdit,
  // CRON job - remove non-activated users
  freshCleanup,
};
