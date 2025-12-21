import { onFormSubmit } from "./handlers/formHandler";
import { doPost } from "./handlers/httpHandler";
import { onEdit } from "./handlers/editHandler";
import { freshCleanup } from "./handlers/cleanupHandler";
import { onOpen, groupUpdateHandler } from "./handlers/groupUpdateHandler";

// tslint:disable-next-line:no-unused-variable
const userManagerHandlers = {
  // send emails after form submit
  onFormSubmit,
  // HTTP request handler - superior confirmation
  doPost,
  // Google Sheets onEdit handler - user creation
  onEdit,
  // CRON job - remove non-activated users
  freshCleanup,
  // Google Sheets onOpen handler - update leaders group
  onOpen,
  groupUpdateHandler,
};
