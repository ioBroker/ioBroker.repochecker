# Adapter repository checker

This is a code for frontend and back-end of the service https://adapter-check.iobroker.in/

If you want to add your adapter to the public ioBroker repository, all tests on this page must be OK.

## How to test via cli

You can pass your repository as a parameter to test

```
npm i
npm run start https://github.com/ioBroker/ioBroker.javascript
```

## Todo

- check if not onlyWWW, then show warnings if www, widgets directories are found
- Adapters, that have only widgets, should start with vis-
- Check, that README.md has Changelog with date