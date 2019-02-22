const githubToken = ""; //https://github.com/settings/tokens
const test = true;
const setCheckOkBack = false;
const oldChecked = "checkError2";
const newChecked = "checkError";

const issueTitle = "Think about to fix the issues found by adapter checker";

const adapterTestLink = "https://3jjxddo33l.execute-api.eu-west-1.amazonaws.com/default/checkAdapter?url=";

let adapterList;

const start = async function () {
    adapterList = await getAdapterList();
    if (adapterList) {
        $('#listeSuccess').append("<li style='color: blue;'>ignored: " + adapterList["ignore"].length + "/<span id='ignore'></span></li>");
        $('#listeSuccess').append("<li style='color: blue;'>noIoPackage: " + adapterList["noIoPackage"].length + "/<span id='noIoPackage'></span></li>");
        $('#listeSuccess').append("<li style='color: blue;'>checkErrorOld: " + Object.keys(adapterList["checkErrorOld"]).length + "/<span id='checkErrorOld'></span></li>");
        $('#listeSuccess').append("<li style='color: blue;'>" + oldChecked + ": " + Object.keys(adapterList[oldChecked]).length + "/<span id='" + oldChecked + "'></span></li>");
        $('#listeSuccess').append("<li style='color: blue;'>" + newChecked + ": " + Object.keys(adapterList[newChecked]).length + "/<span id='" + newChecked + "'></span></li>");
        $('#listeSuccess').append("<li style='color: blue;'>checkOk: " + adapterList["checkOk"].length + "/<span id='checkOk'></span></li>");
        await startFunc();
        await delay(10000);
        console.log(JSON.stringify(adapterList));
        $('#ignore').text(adapterList.ignore.length);
        $('#noIoPackage').text(adapterList.noIoPackage.length);
        $('#checkOk').text(adapterList.checkOk.length);
        $('#checkErrorOld').text(Object.keys(adapterList.checkErrorOld).length);
        $('#' + oldChecked).text(Object.keys(adapterList[oldChecked]).length);
        $('#' + newChecked).text(Object.keys(adapterList[newChecked]).length);
        $('#result').text(JSON.stringify(adapterList));
    } else {
        $('#liste').append("<li style='color: red;'>ERROR OLD - " + Object.keys(adapterList[oldChecked]).length + " && NEW - " + Object.keys(adapterList[newChecked]).length + "</li>");
    }
}

const delay = ms => new Promise(res => setTimeout(res, ms));

const startFunc = async function () {

    if (adapterList) {

        for (i = 1; i < 8; i++) {
            const adapters = await (await fetch("https://api.github.com/search/repositories?q=iobroker+in:name&sort=updated&page=" + i + "&per_page=100")).json();
            if (adapters && adapters.items) {
                if (adapters.total_count < i * 100) {
                    i = 10;
                }

                adapters.items.forEach(async function (val) {
                    const full_name = val.full_name;
                    if (!val.has_issues || val.archived || checkIgnores(full_name)) {
                        return true;
                    }
                    await checkIoPackage("https://raw.githubusercontent.com/" + full_name + "/master/io-package.json", full_name);

                    if ($.inArray(full_name, adapterList.noIoPackage) === -1) {

                        const testLink = "https://raw.githubusercontent.com/" + full_name;
                        const testResult = await doTheTest(testLink);

                        if (testResult && testResult.errors && testResult.errors.length > 0) {
                            adapterList[newChecked][full_name] = {};
                            adapterList[newChecked][full_name].errorList = [];
                            adapterList[newChecked][full_name].warningList = [];
                            let issueBody = "I am an automatic service that looks for possible errors in ioBroker and creates an issue for it. The link below leads directly to the test:\r\n\r\n";
                            issueBody += "https://adapter-check.iobroker.in/?q=" + testLink + "\r\n\r\n";
                            testResult.errors.forEach(function (issue) {
                                issueBody += "- [ ] " + issue + "\r\n";
                                try {
                                    adapterList[newChecked][full_name].errorList.push(issue.substring(1, 5));
                                } catch (e) {
                                    adapterList[newChecked][full_name].errorList.push(issue);
                                }
                            });
                            if (testResult.warnings && testResult.warnings.length > 0) {
                                issueBody += "\r\nI have also found a few warnings that may be fixed, if possible.\r\n\r\n";
                                testResult.errors.forEach(function (issue) {
                                    issueBody += "- [ ] " + issue + "\r\n";
                                    try {
                                        adapterList[newChecked][full_name].warningList.push(issue.substring(1, 5));
                                    } catch (e) {
                                        adapterList[newChecked][full_name].warningList.push(issue);
                                    }
                                });
                            }

                            issueBody += "\r\nThanks,\r\nyour automatic adapter checker.";
                            issueBody += addComminityText(full_name);

                            if (test) {
                                testIssueCreation(full_name, testResult.errors.length);
                            } else if (githubToken) {
                                createIssue(full_name, issueBody, testResult.errors.length);
                            } else {
                                testIssueCreation("NO TOKEN - " + full_name, testResult.errors.length);
                            }
                        } else if (testResult && testResult.errors && testResult.errors.length === 0) {
                            adapterList.checkOk.push(full_name);
                            $('#liste').append("<li style='color: green;'>" + full_name + " - checked but no error found</li>");
                        }
                    }
                });
            }
            await delay(5000);
        }
    }
}

$("button").on("click", function () {
    start();
});

function addComminityText(full_name) {
    if (!full_name.startsWith("ioBroker/") && !full_name.startsWith("iobroker-community-adapters/")) {
        return "\r\n\r\nP.S.: There is a community in Github, which supports the maintenance and further development of adapters. There you will find many experienced developers who are always ready to assist anyone. New developers are always welcome there. For more informations visit: https://github.com/iobroker-community-adapters/info";
    } else {
        return "";
    }
}

(function ($) {
    $.extend({
        // Case insensative $.inArray (http://api.jquery.com/jquery.inarray/)
        // $.inArrayIn(value, array [, fromIndex])
        //  value (type: String)
        //    The value to search for
        //  array (type: Array)
        //    An array through which to search.
        //  fromIndex (type: Number)
        //    The index of the array at which to begin the search.
        //    The default is 0, which will search the whole array.
        inArrayIn: function (elem, arr, i) {
            // not looking for a string anyways, use default method
            if (typeof elem !== 'string') {
                return $.inArray.apply(this, arguments);
            }
            // confirm array is populated
            if (arr) {
                var len = arr.length;
                i = i ? (i < 0 ? Math.max(0, len + i) : i) : 0;
                elem = elem.toLowerCase();
                for (; i < len; i++) {
                    if (i in arr && arr[i].toLowerCase() == elem) {
                        return i;
                    }
                }
            }
            // stick with inArray/indexOf and return -1 on no match
            return -1;
        }
    });
})(jQuery);

function GithubInteractor(token) {
    this.token = token;
}

const interactor = new GithubInteractor(githubToken);

function checkIgnores(full_name) {
    return $.inArrayIn(full_name, adapterList.ignore) !== -1 || $.inArrayIn(full_name, Object.keys(adapterList[oldChecked])) !== -1 || $.inArrayIn(full_name, adapterList.checkOk) !== -1 || $.inArrayIn(full_name, Object.keys(adapterList.checkErrorOld)) !== -1 || $.inArrayIn(full_name, Object.keys(adapterList[newChecked])) !== -1 || $.inArrayIn(full_name, adapterList.noIoPackage) !== -1
}

function createIssue(repo, issueBody, count) {

    var url = "https://api.github.com/repos/" + repo + "/issues";
    $.ajax({
        url: url,
        type: "POST",
        beforeSend: function (xhr) {
            xhr.setRequestHeader("Authorization", "token " + interactor.token);
        },
        error: function (xhr, status, error) {
            var err = JSON.parse(xhr.responseText);
            $('#liste').append("<li style='color: red;'>" + repo + " - issue failed (" + status + ": " + error + ")</li>");
        },
        success: function (issue) {
            adapterList[newChecked][repo].issue = issue.number;
            adapterList[newChecked][repo].errorCount = count;
            adapterList[newChecked][repo].status = issue.state;
            adapterList[newChecked][repo].createdDate = issue.created_at;
            $('#listeSuccess').append("<li>\"" + repo + " (" + count + " errors) - issue created</li>");
        },
        data: JSON.stringify({
            title: issueTitle,
            body: issueBody
        })
    });
}

async function getAdapterList() {
    const link = "https://raw.githubusercontent.com/ioBrokerChecker/testData/master/data.json";
    try {
        const list = await (await fetch(link, {cache: "no-cache"})).json();
        if (setCheckOkBack) {
            list["checkOk"] = [];
        }
        return list;
    } catch (e) {
        return null;
    }
}

async function checkIoPackage(ioPackageLink, adapter) {
    try {
        const ioPackage = await (await fetch(ioPackageLink)).json();
        const isAdapter = ioPackage && ioPackage.common;
        if (!isAdapter) {
            adapterList.noIoPackage.push(adapter);
        }
    } catch (e) {
        adapterList.noIoPackage.push(adapter);
    }
}

async function doTheTest(testLink) {
    try {
        return await (await fetch(adapterTestLink + testLink)).json();
    } catch (e) {
        return {};
    }
}

function testIssueCreation(repo, count) {
    $('#liste').append("<li>" + repo + " (" + count + " errors) - issue will be created</li>");
}