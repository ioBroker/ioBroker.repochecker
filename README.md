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
* (bluefox) added check of `.releaseconfig.json` file

### 2.1.4 (2022-08-19)
* (bluefox) Added check for adapter name: it may not start with '_'

### 2.1.2 (2022-07-14)
* (bluefox) Fixed some errors

### 2.1.0 (2022-05-26)
* (bluefox) Added support of jsonConfig.json5 and jsonCustom.json5

### 2.0.5 (2022-05-22)
* (bluefox) Made it possible to run with npx

## License
The MIT License (MIT)

Copyright (c) 2014-2022 Bluefox <dogafox@gmail.com>

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
