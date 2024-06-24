# Adapter repository checker
This is a code for frontend and back-end of the service https://adapter-check.iobroker.in/

If you want to add your adapter to the public ioBroker repository, all tests on this page must be OK.

## How to test via cli
You can pass your repository as a parameter to test

``npx @iobroker/repochecker <repo> [branch]``

```
npx @iobroker/repochecker https://github.com/ioBroker/ioBroker.javascript master
```

Branch (`master/main/dev`) is optional.

<!--
	Placeholder for the next version (at the beginning of the line):
	### **WORK IN PROGRESS**
-->

## Changelog
### **WORK IN PROGRESS**
* (mcm1957) Check has been aded to ensure keywords and common.keywords are present. [#200]
* (mcm1957) Detection of react has been added, gulpfile.js is accepted for react based UIs now. [#223]

### 2.5.1 (2024-06-24)
* (mcm1957) Suggestion to update dependencies to recommended version added.
* (mcm1957) Adapter-core recommended set to 3.1.6 [#220]

### 2.5.0 (2024-05-30)
* (mcm1957) Check to ensure that dependency revisions are available at repository added. [#180]

### 2.4.0 (2024-05-30)
* (mcm1957) Add check to protect sensitive data. [#195]
* (mcm1957) Add check to verify that dependencies and globalDepencies are of type array. [#90]

### 2.3.1 (2024-05-07)
* (mcm1957) Reduce number of missing translation warnings.
* (mcm1957) Seperate between required and recommended translations.
* (mcm1957) Log missing translations in detail.

### 2.3.0 (2024-05-07)
* (mcm1957) Elements marked as deprectaed added to blacklist.
* (mcm1957) Blacklist added to block elements at package.json and io-package.json.
* (mcm1957) Error [E000] will be raised now if repository cannot be accessed at all [#194].
* (mcm1957) Reading of package.json and io-package.json has been moved to head of tests.
* (mcm1957) Check minimum and recommended node version at package.json (#160)
* (mcm1957) Raise an error if version at package.json is lower than latest release at npmjs [#192]

### 2.2.3 (2024-03-29)
* (mcm1957) Checking of license has been improved

### 2.2.2 (2024-03-29) 
* (mcm1957) Checking of adapter-core has been fixed
* (mcm1957) Load all potential interesting files, fixes [#149]

### 2.2.1 (2024-03-26)
* (mcm1957) Added check that own adapter is not listed at common.restartAdapters
* (mcm1957) Added check of version strings at common.news
* (mcm1957) Added check for recommended node version (node 18 for now)
* (mcm1957) Disallow common.mode == subscribe
* (mcm1957) Deprecate common.wakeup
* (mcm1957) Added check for adapter-core version (>= 3.0.6)

### 2.2.0 (2024-03-24)
* (klein0r) Added check for licenseInformation
* (klein0r) Added check for deprecated license
* (klein0r) Added check for required attribute common.tier
* (klein0r) Added check for disallowed attribute common.automaticUpgrade

### 2.1.13 (2024-01-02)
* (bluefox) Corrected rule W156: adminUI.config === 'none' is allowed

### 2.1.12 (2023-09-21)
* (bluefox) Added check of using '_' in adapter name

### 2.1.11 (2023-09-05)
* (bluefox) Added check of iobroker.js-controller in dependencies

### 2.1.7 (2023-08-14)
* (mcm57) Update index.js - fix typo in error message (packet.json)
* (mcm57) Update index.js - renumber E504/1 to 519 - fixes #112

### 2.1.6 (2022-12-08)
* (bluefox) added better error logging

### 2.1.5 (2022-12-07)
* (bluefox) added check of `.releaseconfig.json` file

### 2.1.4 (2022-08-19)
* (bluefox) Added check for adapter name: it may not start with '_'

### 2.1.2 (2022-07-14)
* (bluefox) Fixed some errors

### 2.1.0 (2022-05-26)
* (bluefox) Added support for jsonConfig.json5 and jsonCustom.json5

### 2.0.5 (2022-05-22)
* (bluefox) Made it possible to run with npx

## License
The MIT License (MIT)

Copyright (c) 2014-2024 Denis Haev <dogafox@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
