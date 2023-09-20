# Explanation of repo checker issues
## Content
- [E001 Cannot parse `package.json`](#e001-cannot-parse-packagejson)
- [E002 No `ioBroker.` found in the name of the repository](#e002-no-iobroker-found-in-the-name-of-the-repository)

## Issues
### [E001] Cannot parse `package.json`
#### Explanation
Some problem parsing the `package.json` occurred. See error messages added for details.
#### Required step to resolve the problem
Correct the file `package.json` so that it becomes a valid json file.

### [E002] No `ioBroker.` found in the name of the repository
#### Explanation
The name of the repository must start with `ioBroker.` ioBroker must be written with an capital `B`.
#### Required step to resolve the problem
Correct the name of the repository by renaming it to meet standards.

