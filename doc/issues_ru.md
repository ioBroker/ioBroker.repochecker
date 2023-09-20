# Explanation of repo checker issues
## Content
- [E001 Не удается разобрать `package.json`](#e001----packagejson)
- [E002 No `ioBroker.` found in the name of the repository](#e002-no-iobroker-found-in-the-name-of-the-repository)

## Issues
### [E001] Не удается разобрать `package.json`
#### Объяснение
При разборе `package.json` произошла ошибка. См. Добавленные сообщения об ошибках для получения дополнительной информации.
#### Необходимый шаг для устранения проблемы
Исправьте файл `package.json`, чтобы он стал допустимым файлом json.

### [E002] No `ioBroker.` found in the name of the repository
#### Объяснение
The name of the repository must start with `ioBroker.` ioBroker must be written with an capital `B`.
#### Необходимый шаг для устранения проблемы
Correct the name of the repository by renaming it to meet standards.

