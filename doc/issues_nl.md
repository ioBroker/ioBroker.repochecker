# Explanation of repo checker issues
## Content
- [E001 Kan `package.json` niet parsen](#e001-kan-packagejson-niet-parsen)
- [E002 No `ioBroker.` found in the name of the repository](#e002-no-iobroker-found-in-the-name-of-the-repository)

## Issues
### [E001] Kan `package.json` niet parsen
#### Uitleg
Er is een probleem opgetreden bij het parsen van `package.json`. Zie foutberichten voor details.
#### Vereiste stap om het probleem op te lossen
Corrigeer het bestand `package.json` zodat het een geldig json-bestand wordt.

### [E002] No `ioBroker.` found in the name of the repository
#### Uitleg
The name of the repository must start with `ioBroker.` ioBroker must be written with an capital `B`.
#### Vereiste stap om het probleem op te lossen
Correct the name of the repository by renaming it to meet standards.

