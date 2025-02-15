# Debugging

## Local Debugging

To test the adapter-checker and debug into the script under vscode:

1. Clone the repository to your local machine.\
   Best is that the directory is on the same level as your adapter repository.

2. run npm install in the adapter-checker directory.

3. switch to your adapter repository and create a new launch configuration:

```json5
    {
        "name": "Launch Program",
        "program": "../iobroker.repochecker/index.js", // path to the adapter checker repo
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

To test the adapter checker under vscode:

1. Clone the repository to your local machine.\
   Best is that the directory is on the same level as your adapter repository.

2. run npm install in the adapter checker directory.

3. switch to your adapter repository and enter the following commandline in a new terminal

```bash
node ..\ioBroker.repochecker\index.js https://github.com/klein0r/ioBroker.luftdaten --local
```

## Testing without installing

The following command should be entered in the root of your repository:

```bash
npx github:oweitman/iobroker.repochecker https://github.com/oweitman/ioBroker.luftdaten --local
```
