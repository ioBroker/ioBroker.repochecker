# Adapter repository checker

This is a code for frontend and back-end of the service <https://adapter-check.iobroker.in/>

If you want to add your adapter to the public ioBroker repository, all tests on this page must be OK.

## How to test via cli (standard tests accessing repository data)

When running the repository checker via the command line, you **need** to add the repository as parameter, while the branch parameter (`master/main/dev`) is optional. If this parameter is omitted, the `default` branch (typically master / main) will be checked.

```
npx @iobroker/repochecker <repo> [branch]`
```

## How to test via cli using local mode

> [!NOTE]  
> local mode feature is experimental and untested. 

For extra debugging outputs you can pass the `--debug` parameter.

For a local test you can pass the `--local` parameter. Most of the files are read locally.
The link to the GitHub repository is still necessary because data from the project settings on GitHub is also checked.

Example:

`npx @iobroker/repochecker https://github.com/ioBroker/ioBroker.repochecker --local`

## Using a GitHub token

Unauthenticated requests to the GitHub API are rate limited. To raise the limit you can provide a
[GitHub personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
located in a file via the `--env <file>` parameter. The file must exist and use the standard environment file format
(e.g. `.env`). Only the `GITHUB_TOKEN` variable is read from it - all other content is ignored and the
file is **never** loaded into the process environment.

```
npx @iobroker/repochecker <repo> [branch] --env <file>
npx @iobroker/repochecker <repo> [branch] --env=<file>
```

Behavior:

* If the file does not exist or cannot be parsed, an error is logged and the checker exits with a non-zero status.
* If `GITHUB_TOKEN` is missing or empty, a warning is logged and processing continues as if `--env` had not been specified.
* If `GITHUB_TOKEN` does not match the expected token format, a warning is logged but the token is used anyway.

Example `.env` file:

```
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Changelog
<!--
	Placeholder for the next version (at the beginning of the line):
	### **WORK IN PROGRESS**
-->
### **WORK IN PROGRESS**
* (@typhosj) New adapters that only provide vis-2 widgets must be named `vis-2-widgets-xxx` [E4008]. Adapters that also provide vis-1 widgets are not affected.

### 5.23.2 (2026-10-17)
* (@mcm1957) src-shared directory added to src list.

### 5.23.1 (2026-10-16)
* (@mcm1957) More pecial handling of some core adapters added.

### 5.23.0 (2026-10-14)

* (@mcm1957) Fixed: failed workflow runs now correctly show as [E3032] instead of [W3032] (see [#1196](https://github.com/ioBroker/ioBroker.repochecker/issues/1196)).
* (@mcm1957) Special handling of some core adapters added.
* (@mcm1957) Fixed: githubToken and axios instance are now isolated per check; concurrent checks no longer share authorization state or redaction context (see [#1193](https://github.com/ioBroker/ioBroker.repochecker/issues/1193)).

### 5.22.16 (2026-10-13)

* (@mcm1957) Fixed false positive [E6025] when README.md contains `#` headings inside fenced code blocks.

### 5.22.15 (2026-10-12)
* (mcm1957) src-blockly added to source directories excluded from E9507 / E9506 (missing i18n files) check

[Older changelogs can be found there](CHANGELOG_OLD.md)

## License

The MIT License (MIT)

Copyright (c) 2014-2025 Denis Haev <dogafox@gmail.com>

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
