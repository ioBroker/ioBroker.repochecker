# Adapter repository checker

This is a code for frontend and back-end of the service https://adapter-check.iobroker.in/

If you want to add your adapter to the public ioBroker repository, all tests on this page must be OK.

## How to test via cli

You can pass your repository as a parameter to test

``npm run start <repo> [branch]``

```
npm i
npm run start https://github.com/ioBroker/ioBroker.javascript main
```
