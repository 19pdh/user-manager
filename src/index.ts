import { onFormSubmit } from "./handlers/formHandler";
import { doGet, doPost } from "./handlers/httpHandler";
import { onEdit } from "./handlers/editHandler";
import { freshCleanup } from "./handlers/cleanupHandler";

export {
  // send emails after form submit
  onFormSubmit,
  // HTTP request handler - superior confirmation
  doGet,
  doPost,
  // Google Sheets onEdit handler - user creation
  onEdit,
  // CRON job - remove non-activated users
  freshCleanup,
};
