# Explanation of repo checker issues
## Content
- [E001 无法解析`package.json`](#e001-packagejson)
- [E002 No `ioBroker.` found in the name of the repository](#e002-no-iobroker-found-in-the-name-of-the-repository)

## Issues
### [E001] 无法解析`package.json`
#### 解释
解析`package.json`时出现问题。有关详细信息，请参见添加的错误消息。
#### 解决问题所需的步骤
更正`package.json`文件，使其成为有效的json文件。

### [E002] No `ioBroker.` found in the name of the repository
#### 解释
The name of the repository must start with `ioBroker.` ioBroker must be written with an capital `B`.
#### 解决问题所需的步骤
Correct the name of the repository by renaming it to meet standards.

