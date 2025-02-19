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
