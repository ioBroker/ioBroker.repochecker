# Debugging

## Local Debugging

To test the repochecker and debug into the script under vscode:

1. Clone the repository to your local machine.\
Best is that the directory is on the same level than your adapter repository.

2. run npm install in the repochecker directory.

3. switch to your adapter repository and create a new launch configuration:

```json5
    {
        "name": "Launch Program", 
        "program": "../iobroker.repochecker/index.js", // path to the repochecker repo
        // args as entered on the commandline, arguments as a array
        "args": ["https://github.com/klein0r/ioBroker.luftdaten","--local"], 
        "request": "launch",
        "stopOnEntry": true,
        "runtimeExecutable": "<path to node/node.exe>", //optional if needed
        "skipFiles": [
            "<node_internals>/**"
        ],
        "type": "node"
    },
```

## Local Testing without debugging

To test the repochecker under vscode:

1. Clone the repository to your local machine.\
Best is that the directory is on the same level than your adapter repository.

2. run npm install in the repochecker directory.

3. switch to your adapter repository and enter the following commandline in a new terminal

```bash
node ..\ioBroker.repochecker\index.js https://github.com/klein0r/ioBroker.luftdaten --local
```
