import { sendEmail, renderTemplate, errorHandler } from "../lib/utils";
import { ADMIN_MAIL, NONLEADERS_GROUP, PROXY_URL } from "../config";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEACTIVATION_OFFSET_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Worker function that checks if user should be deactivated and notifies beforehand
 */
export function oldCleanup(): void {
  console.info("[oldCleanup] Starting deactivation cleanup job");
  if (!AdminDirectory || !AdminDirectory.Users) {
    throw new Error("AdminDirectory.Users is undefined");
  }
  let page: GoogleAppsScript.AdminDirectory.Schema.Users;
  let pageToken: string | undefined;
  const deactivatedUsers: string[] = [];
  const failedUsers: string[] = [];
  const notifiedUsers: { email: string; deadline: string; daysLeft: number }[] =
    [];

  do {
    // Get users from NONLEADERS_GROUP
    page = AdminDirectory.Users.list({
      domain: "zhr.pl",
      query: `orgUnitPath='${NONLEADERS_GROUP}' isSuspended=false`, // only active users
      projection: "full", // Needed for custom schemas and creationTime
      maxResults: 100,
      pageToken: pageToken,
    });

    const users = page.users || [];

    for (let user of users) {
      try {
        const deadlineString = getRelation(
          user.relations,
          "scheduled_for_deactivation"
        );

        if (deadlineString) {
          const deadline = new Date(deadlineString);
          const timeDiff = deadline.getTime() - new Date().getTime();
          const daysLeft = Math.ceil(timeDiff / MS_PER_DAY);

          // Notify if 14, 7 or 1 days are left
          if (daysLeft === 14 || daysLeft === 7 || daysLeft === 1) {
            notifyForDeactivation(user, deadline);
            notifiedUsers.push({
              email: user.primaryEmail!,
              deadline: deadline.toISOString(),
              daysLeft,
            });
            Utilities.sleep(2000); // Wait 2s to avoid hitting rate limits
          }

          if (timeDiff <= 0) {
            // Suspend and remove scheduled_for_deactivation relation
            const currentRelations = user.relations || [];
            const updatedRelations = currentRelations.filter(
              (r: GoogleAppsScript.AdminDirectory.Schema.UserRelation) =>
                r.customType !== "scheduled_for_deactivation"
            );
            AdminDirectory.Users!.patch(
              { suspended: true, relations: updatedRelations },
              user.id!
            );
            if (user.recoveryEmail) {
              const subject = `Konto ${user.primaryEmail} zostało wyłączone`;
              const htmlBody = renderTemplate(
                "deactivationPerformed",
                { mail: user.primaryEmail },
                subject
              ).getContent();
              sendEmail(user.recoveryEmail, subject, "", {
                htmlBody,
              });
              Utilities.sleep(2000); // Wait 2s to avoid hitting rate limits
            }
            deactivatedUsers.push(user.primaryEmail!);
            console.log(
              `[oldCleanup] User ${user.primaryEmail} has been suspended.`
            );
          }
        }
      } catch (e) {
        console.error(
          `[oldCleanup] Failed to process user ${user.primaryEmail}: ${e}`
        );
        if (user.primaryEmail) {
          failedUsers.push(`${user.primaryEmail} (${e})`);
        }
      }
    }
    pageToken = page.nextPageToken;
  } while (pageToken);

  if (failedUsers.length) {
    const errorSummary = `Błędy podczas przetwarzania oldCleanup:\n\n${failedUsers.join(
      "\n"
    )}`;
    errorHandler(errorSummary, "oldCleanup", { count: failedUsers.length });
  }

  let summary = "";
  if (deactivatedUsers.length) {
    summary += `Dezaktywowano użytkowników (${
      deactivatedUsers.length
    }):\n${deactivatedUsers.join("\n")}\n\n`;
  }
  if (notifiedUsers.length) {
    summary += `Wysłano powiadomienia (${notifiedUsers.length}):\n`;
    summary += notifiedUsers
      .map(
        (u) =>
          `- ${u.email} (Dezaktywacja: ${u.deadline}, Pozostało dni: ${u.daysLeft})`
      )
      .join("\n");
    summary += "\n\n";
  }

  if (summary) {
    sendEmail(ADMIN_MAIL, "oldCleanup: raport z wykonania", summary);
  }
  console.info("[oldCleanup] Finished deactivation cleanup job");
}

/**
 * Yearly cleanup of users who left the organization
 * During the cleanup process, all users in NONLEADERS_GROUP that were confirmed more than 2 years ago
 * will be asked for reconfirmation from their superior. If no confirmation is received within 30 days,
 * the account will be deactivated.
 *
 * 1. Query all users in NONLEADERS_GROUP that are not suspended
 * 2. Filter only users that:
 *      - have relation of type "confirmation_date" and with value date older than 2 years
 *      - if no relation present, check if user was created more than 2 years ago
 * 3. Check if they have empty (or not present) "scheduled_for_deactivation" relation (meaning not scheduled yet)
 * 4. Empty the superior relation
 * 5. Set the "scheduled_for_deactivation" relation
 * 6. Notify the user
 */
export function scheduleForDeactivation(): void {
  console.info("[scheduleForDeactivation] Starting scheduling job");
  if (!AdminDirectory || !AdminDirectory.Users) {
    throw new Error("AdminDirectory.Users is undefined");
  }

  const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;
  const now = new Date();

  let page: GoogleAppsScript.AdminDirectory.Schema.Users;
  let pageToken: string | undefined;
  const scheduledUsers: string[] = [];
  const failedUsers: string[] = [];
  const notifiedUsers: { email: string; deadline: string }[] = [];

  do {
    // Get users from NONLEADERS_GROUP
    page = AdminDirectory.Users.list({
      domain: "zhr.pl",
      query: `orgUnitPath='${NONLEADERS_GROUP}' isSuspended=false`, // only active users
      projection: "full", // Needed for custom schemas and creationTime
      maxResults: 100,
      pageToken: pageToken,
    });

    const users = page.users;

    const usersForReconfirmation =
      users?.filter((user: GoogleAppsScript.AdminDirectory.Schema.User) => {
        const customConfirmation = user.relations
          ? getRelation(user.relations, "confirmation_date")
          : null;

        // Use creationTime if confirmation_date is not present
        const confirmationDate = customConfirmation || user.creationTime;

        if (!confirmationDate) return false; // API error

        const timeSinceCreation =
          now.getTime() - new Date(confirmationDate).getTime();
        return timeSinceCreation > TWO_YEARS_MS;
      }) || [];

    for (const user of usersForReconfirmation) {
      if (!user.id || !user.primaryEmail) {
        console.log(
          `[scheduleForDeactivation] Skipping user due to missing id: ${JSON.stringify(
            user
          )}`
        );
        continue;
      }

      try {
        // Check if account was already scheduled for deactivation
        const warningRelation = getRelation(
          user.relations,
          "scheduled_for_deactivation"
        );

        // Schedule only if account wasn't already scheduled for deactivation
        if (!warningRelation) {
          const deadline = new Date(now.getTime() + DEACTIVATION_OFFSET_MS);
          scheduleUserForDeactivation(user, deadline);
          notifyForDeactivation(user, deadline);
          Utilities.sleep(2000); // Wait 2s to avoid hitting rate limits
          scheduledUsers.push(user.primaryEmail);
          notifiedUsers.push({
            email: user.primaryEmail,
            deadline: deadline.toISOString(),
          });
        }
      } catch (e) {
        console.error(
          `[scheduleForDeactivation] Failed to process user ${user.primaryEmail}: ${e}`
        );
        failedUsers.push(`${user.primaryEmail} (${e})`);
      }
    }

    pageToken = page.nextPageToken;
  } while (pageToken);

  if (failedUsers.length) {
    const errorSummary = `Błędy podczas przetwarzania scheduleForDeactivation:\n\n${failedUsers.join(
      "\n"
    )}`;
    errorHandler(errorSummary, "scheduleForDeactivation", {
      count: failedUsers.length,
    });
  }

  let summary = "";
  if (scheduledUsers.length) {
    summary += `scheduleForDeactivation: użytkownicy zaplanowani do dezaktywacji (${
      scheduledUsers.length
    })\n${scheduledUsers.join("\n")}\n\n`;
  }
  if (notifiedUsers.length) {
    summary += `Wysłano powiadomienia (${notifiedUsers.length}):\n`;
    summary += notifiedUsers
      .map((u) => `- ${u.email} (Zaplanowano na: ${u.deadline})`)
      .join("\n");
    summary += "\n\n";
  }

  if (summary) {
    sendEmail(
      ADMIN_MAIL,
      `scheduleForDeactivation: raport wykonania`,
      summary
    );
  }
  console.info("[scheduleForDeactivation] Finished scheduling job");
}

function notifyForDeactivation(
  user: GoogleAppsScript.AdminDirectory.Schema.User,
  deadline: Date
): void {
  if (!user.primaryEmail) {
    console.log(
      `[notifyForDeactivation] Skipping user due to missing email: ${JSON.stringify(
        user
      )}`
    );
    return;
  }

  const timeDiff = deadline.getTime() - new Date().getTime();
  const days = Math.ceil(timeDiff / MS_PER_DAY);

  if (days < 1) {
    console.log(
      `[notifyForDeactivation] Skipping notification for user ${user.primaryEmail} as deadline has passed`
    );
    return;
  }

  const verificationLink = `${PROXY_URL}/confirm-zhr.html?id=${user.primaryEmail}`;
  const subject = `[WYMAGANA AKCJA] Weryfikacja konta ${user.primaryEmail}`;
  const htmlBody = renderTemplate(
    "deactivationNotice",
    {
      mail: user.primaryEmail,
      days: days === 1 ? "1 dzień" : `${days} dni`,
      verificationLink,
    },
    subject
  ).getContent();

  sendEmail(
    [user.primaryEmail, user.recoveryEmail].join(","),
    subject,
    "",
    {
      htmlBody,
    }
  );
}

function getRelation(
  relations: object[] | undefined,
  key: string
): string | undefined {
  const relation = relations?.find(
    (r: GoogleAppsScript.AdminDirectory.Schema.UserRelation) =>
      r.customType === key
  ) as GoogleAppsScript.AdminDirectory.Schema.UserRelation | undefined;
  return relation?.value;
}

function scheduleUserForDeactivation(
  user: GoogleAppsScript.AdminDirectory.Schema.User,
  deadline: Date
): void {
  const currentRelations =
    user.relations?.filter(
      (r: GoogleAppsScript.AdminDirectory.Schema.UserRelation) =>
        r.customType !== "scheduled_for_deactivation"
    ) || [];
  const newRelations = [
    ...currentRelations,
    {
      type: "custom",
      customType: "scheduled_for_deactivation",
      value: deadline.toISOString(),
    },
  ];

  try {
    if (!AdminDirectory || !AdminDirectory.Users) {
      throw new Error("AdminDirectory.Users is undefined");
    }
    if (!user.id) {
      throw new Error(`User has no ID: ${JSON.stringify(user)}`);
    }
    AdminDirectory.Users.patch({ relations: newRelations }, user.id);

    console.log(
      `[scheduleUserForDeactivation] User ${
        user.primaryEmail
      } marked for deactivation on ${deadline.toISOString()}`
    );
  } catch (error) {
    console.error(
      `[scheduleUserForDeactivation] Failed to schedule ${user.primaryEmail}: ${error}`
    );
  }
}
