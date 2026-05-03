# user manager

Those scripts combine Google Forms, Sheets, Gmail and Admin panel together, to enable user creation
automatization. User registers using Forms, the data is passed to Sheets and mail is being
sent to the superior (passed in form field). After the supierior confirms the validity of request, the
admin is notified via email and can click to approve new user creation request.

## Build

The app is written with typescript modules for good ✨developer experience✨

But Google App Script doesn't handle modules, so we need to bundle the app:

```sh
npm run build
```

> ⚠️ `sed` is used for postprocessing build file, yeah, I'm a rollup noob

## Deploy

For deployment I've written script in `/utils`, which uses [clasp](https://github.com/google/clasp)

```
cd build
../utils/updateSheets.sh ../utils/sheets.json
```

What's in the `sheets.json`? You need to pass id to the compliant Google Sheet document.
Send mail request for template at: patryk.niedzwiedzinski at zhr.pl

## Automatic Deployment (GitHub Actions)

The project includes a GitHub Actions workflow to automate deployment upon pushing a new tag (e.g., `v1.0.0`).

### Prerequisities

You need to set up the following secrets in your GitHub repository settings:

1.  **`CLASPRS_JSON`**:

    - Login to Clasp locally: `npx clasp login`
    - This will create a `~/.clasprc.json` file.
    - Copy the content of this file and paste it as the secret value.

2.  **`ENV_FILE`**:

    - Content of your `.env` file (see `example.env`).

3.  **`SCRIPT_ID`**:
    - ID of script in script.google.com to deploy to (Sheets > Addons > Apps Script > id in url)
## Processes

### 1. User Creation

This sequence diagram illustrates the workflow of creating a new user account from a business perspective.

```mermaid
sequenceDiagram
    autonumber
    actor Applicant
    actor Superior
    actor Admin

    Applicant->>Admin: Submits registration form
    Admin->>Superior: Sends email asking to verify the applicant
    Superior->>Admin: Confirms applicant's identity via email link
    Admin->>Admin: Reviews the confirmed request
    Admin->>Applicant: Creates account and sends welcome email with credentials
```

### 2. Applications Cleanup (`freshCleanup`)

This flowchart details the cleanup process, which ensures the organization is not cluttered with abandoned requests or inactive accounts.

```mermaid
flowchart TD
    Start([Scheduled Cleanup]) --> CheckRequests[Check Unconfirmed Requests]

    CheckRequests --> RequestLoop{For each request}
    RequestLoop -->|Exactly 7 days old?| Reject[Reject request]
    Reject --> EmailApplicant[Send rejection email to Applicant]
    RequestLoop -->|Other| CheckAccounts[Check Fresh Accounts]

    EmailApplicant --> CheckAccounts

    CheckAccounts --> AccountLoop{For each 7-21 days old account}
    AccountLoop -->|Never logged in?| Delete[Delete account]
    AccountLoop -->|Logged in| Next[Skip]

    Delete --> End([End])
    Next --> End
```

### 3. Cyclic Account Deactivation (`scheduleForDeactivation` & `oldCleanup`)

This sequence diagram explains the periodic cleanup of inactive accounts. Users must revalidate their active status every 2 years.

**Important distinction:** Unlike new account creation where the superior is known, older accounts might have a new superior. Therefore, the Admin sends the verification link to the User, who must forward it to their current Superior to confirm their status.

```mermaid
sequenceDiagram
    autonumber
    actor Admin
    actor User
    actor Superior

    %% Scheduling Phase
    Admin->>User: Sends warning: "Account requires reconfirmation" (30 days deadline)

    %% Reconfirmation Phase (User Action)
    User->>Superior: Forwards the verification link to current Superior
    Superior->>Admin: Clicks link & confirms User's active status
    Admin->>User: Sends success email: "Account Reconfirmed"

    %% Periodic Cleanup Phase (If not reconfirmed)
    loop Every few days
        alt 14, 7, or 1 days left
            Admin->>User: Sends reminder email
        else Deadline passed
            Admin->>User: Suspends account and sends suspension email
        end
    end
```
