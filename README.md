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

This sequence diagram illustrates the workflow of creating a new user account. It involves the applicant filling out a Google Form, the system notifying the requested superior, the superior verifying the request, and finally, the administrator approving it manually in Google Sheets.

```mermaid
sequenceDiagram
    autonumber
    actor Applicant
    participant System as System (GAS)
    actor Superior
    participant Sheet as Google Sheets
    actor Admin
    participant Workspace as Google Workspace

    Applicant->>System: Submits Google Form
    System->>Sheet: Saves initial request (Status: "Oczekiwanie na opiekuna")
    System->>Superior: Sends email with verification link
    Superior->>System: Clicks link & authenticates to confirm user
    System->>Sheet: Updates request (Status: "Oczekiwanie na admina")
    System->>Admin: Sends email notification about superior's approval
    Admin->>Sheet: Manually reviews and changes status to "Zatwierdzono"
    Sheet-->>System: Triggers onEdit event
    System->>Workspace: Provisions new Google Workspace account
    System->>Applicant: Sends email with account credentials
```

### 2. Applications Cleanup (`freshCleanup`)

This flowchart details the `freshCleanup` process, which is responsible for keeping the system clean of abandoned requests and inactive accounts. It performs two main checks:
1. Rejects unconfirmed applications residing in Google Sheets that are exactly 7 days old.
2. Deletes freshly created Google Workspace accounts (7 to 21 days old) that have never been logged into.

```mermaid
flowchart TD
    Start([Cron Trigger: freshCleanup]) --> CleanSheet[Check Pending Requests in Sheets]

    subgraph cleanupPendingRequests [Google Sheets Cleanup]
        CleanSheet --> SheetLoop{For each unconfirmed row}
        SheetLoop -->|Is exactly 7 days old?| RejectReq[Change status to 'Odmówiono']
        RejectReq --> NotifyApplicant[Send rejection email to applicant]
        SheetLoop -->|Not 7 days old| NextRow1[Skip row]
    end

    NotifyApplicant --> FetchAccounts
    NextRow1 --> FetchAccounts

    FetchAccounts[Fetch accounts created 7-21 days ago] --> AccountLoop

    subgraph Fresh Accounts Cleanup [Google Workspace Cleanup]
        AccountLoop{For each fresh account}
        AccountLoop -->|Never logged in?| DeleteAcc[Delete from Google Workspace]
        DeleteAcc --> AddToSummary[Add to summary report]
        AccountLoop -->|Logged in| NextRow2[Skip account]
    end

    AddToSummary --> EndCheck
    NextRow2 --> EndCheck

    EndCheck{Were any accounts deleted?}
    EndCheck -->|Yes| SendReport[Send summary email to Admin]
    SendReport --> End([End])
    EndCheck -->|No| End
```

### 3. Cyclic Account Deactivation (`scheduleForDeactivation` & `oldCleanup`)

This sequence diagram explains the periodic cleanup of inactive accounts. Users belonging to `NONLEADERS_GROUP` must revalidate their active status every 2 years.

**Important distinction:** Unlike new account creation where the superior is known, older accounts might have a new superior. Therefore, the user receives the verification link directly and must forward it to their current superior to confirm their status. The confirmation mechanism (`/confirm-zhr.html`) functions identically to new user creation.

```mermaid
sequenceDiagram
    autonumber
    participant Cron1 as Cron: scheduleForDeactivation
    participant Cron2 as Cron: oldCleanup
    participant Workspace as Google Workspace
    actor User
    actor Superior
    participant System as System (GAS)

    %% Scheduling Phase
    Cron1->>Workspace: Find active users confirmed > 2 years ago
    loop For each old user
        Cron1->>Workspace: Set 'scheduled_for_deactivation' (deadline: +30 days)
        Cron1->>User: Send warning email with verification link
    end

    %% Reconfirmation Phase (User Action)
    User->>Superior: Forwards verification link
    Superior->>System: Clicks link & authenticates to reconfirm user
    System->>Workspace: Removes 'scheduled_for_deactivation' tag
    System->>Workspace: Updates 'confirmation_date' to now
    System->>User: Sends "Account Reconfirmed" success email

    %% Periodic Cleanup Phase
    note over Cron2, Workspace: Runs periodically to check deadlines
    Cron2->>Workspace: Find users with 'scheduled_for_deactivation' tag
    loop For each scheduled user
        alt 14, 7, or 1 days left
            Cron2->>User: Send reminder email
        else Deadline passed
            Cron2->>Workspace: Suspend user account
            Cron2->>Workspace: Remove 'scheduled_for_deactivation' tag
            Cron2->>User: Send account suspension email
        end
    end
```
