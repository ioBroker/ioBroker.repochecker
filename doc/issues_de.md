# Explanation of repo checker issues
## Content
- [E001 Kann `package.json` nicht parsen](#e001-kann-packagejson-nicht-parsen)
- [E002 No `ioBroker.` found in the name of the repository](#e002-no-iobroker-found-in-the-name-of-the-repository)

## Issues
### [E001] Kann `package.json` nicht parsen
#### Erklärung
Beim Parsen der `package.json` ist ein Fehler aufgetreten. Details sind in den Fehlermeldungen zu finden.
#### Erforderlicher Schritt zur Behebung des Problems
Korrigiere die Datei `package.json`, sodass sie eine valide json-Datei wird.

### [E002] No `ioBroker.` found in the name of the repository
#### Erklärung
The name of the repository must start with `ioBroker.` ioBroker must be written with an capital `B`.
#### Erforderlicher Schritt zur Behebung des Problems
Correct the name of the repository by renaming it to meet standards.

