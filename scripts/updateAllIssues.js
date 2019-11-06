const githubToken = ''; //https://github.com/settings/tokens
const test = true;

const toGet = 'checkError';
const toSet = 'checkError2';
const checkOkCheck = true;

const issueTitle = 'Think about to fix the issues found by adapter checker';

const adapterTestLink = 'https://3jjxddo33l.execute-api.eu-west-1.amazonaws.com/default/checkAdapter?url=';

let adapterList;

const start = async function () {
    adapterList = await getAdapterList();
    if (adapterList) {
        if (!adapterList[toSet]) {
            adapterList[toSet] = {};
        }
        $listeSuccess = $('#listeSuccess');
        $listeSuccess.append(`<li style='color: blue;'>ignored: ${adapterList.ignore.length}/<span id='ignore'></span></li>`);
        $listeSuccess.append(`<li style='color: blue;'>noIoPackage: ${adapterList.noIoPackage.length}/<span id='noIoPackage'></span></li>`);
        $listeSuccess.append(`<li style='color: blue;'>checkErrorOld:${Object.keys(adapterList.checkErrorOld).length}/<span id='checkErrorOld'></span></li>`);
        $listeSuccess.append(`<li style='color: blue;'>${toGet}: ${Object.keys(adapterList[toGet]).length}/<span id='${toGet}'></span></li>`);
        $listeSuccess.append(`<li style='color: blue;'>${toSet}: ${Object.keys(adapterList[toSet]).length}/<span id='${toSet}'></span></li>`);
        $listeSuccess.append(`<li style='color: blue;'>checkOk: ${adapterList.checkOk.length}/<span id='checkOk'></span></li>`);
        await startFunc();
        await delay(10000);
        console.log(JSON.stringify(adapterList));
        $('#ignore').text(adapterList.ignore.length);
        $('#noIoPackage').text(adapterList.noIoPackage.length);
        $('#checkOk').text(adapterList.checkOk.length);
        $('#checkErrorOld').text(Object.keys(adapterList.checkErrorOld).length);
        $('#' + toSet).text(Object.keys(adapterList[toSet]).length);
        $('#' + toGet).text(Object.keys(adapterList[toGet]).length);
        $('#result').text(JSON.stringify(adapterList));
    } else {
        $('#liste').append(`<li style='color: red;'>ERROR ${Object.keys(adapterList[toGet]).length} ${Object.keys(adapterList[toSet]).length}</li>`);
    }
};

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
                    if (i in arr && arr[i].toLowerCase() === elem) {
                        return i;
                    }
                }
            }
            // stick with inArray/indexOf and return -1 on no match
            return -1;
        }
    });
})(jQuery);

const delay = ms => new Promise(res => setTimeout(res, ms));

const startFunc = async function () {

    if (adapterList) {

        let result = await findAllAdapters(adapterList);

		if (checkOkCheck) {
          adapterList.checkOk.forEach(function (full_name) {
              adapterList[toGet][full_name] = {};
              adapterList[toGet][full_name].issue = null;
          });
          adapterList.checkOk = [];
        }

        for (const full_name in adapterList[toGet]) {
            const testLink = 'https://raw.githubusercontent.com/' + full_name;
            const testResult = await doTheTest(testLink);

            let issueNr = adapterList[toGet][full_name].issue;
            let issuesList = [];
            if (issueNr) {
                issuesList = adapterList[toGet][full_name].errorList;
                if (adapterList[toGet][full_name].status !== 'open') {
                    issueNr = null;
                }
            }

            if (testResult && testResult.errors && testResult.errors.length > 0) {
                try {
                    let issueBody = 'I am an automatic service that looks for possible errors in ioBroker and creates an issue for it. The link below leads directly to the test:\r\n\r\n';
                    issueBody += `https://adapter-check.iobroker.in/?q=${testLink}\r\n\r\n`;
                    const errorList = [];
                    const warningList = [];
                    testResult.errors.forEach(function (issue) {
                        issueBody += `- [ ] ${issue}\r\n`;
                        errorList.push(issue.substring(1, 5));
                    });
                    if (testResult.warnings && testResult.warnings.length > 0) {
                        issueBody += '\r\nI have also found warnings that may be fixed if possible.\r\n\r\n';
                        testResult.warnings.forEach(function (issue) {
                            issueBody += `- [ ] ${issue}\r\n`;
                            warningList.push(issue.substring(1, 5));
                        });
                    }

                    issueBody += '\r\nThanks,\r\nyour automatic adapter checker.';
                    issueBody += addComminityText(full_name);

                    const errorNotChanged = issueNr !== null && (errorList.length === issuesList.length && errorList.sort().every(function (value, index) {
                        return value === issuesList.sort()[index];
                    }));

                    if (test) {
                        testIssueCreation(full_name, testResult.errors.length, errorNotChanged, testResult.warnings);
                    } else if (githubToken && !errorNotChanged) {
                        createIssue(full_name, issueBody, testResult.errors.length, issueNr, errorList, warningList);
                    } else if (githubToken && errorNotChanged) {
                        adapterList[toSet][full_name] = adapterList[toGet][full_name];
                        delete adapterList[toGet][full_name];
                        $('#liste').append(`<li style='color: blue;'>${full_name} no error changes</li>`);
                    } else {
                        testIssueCreation('NO TOKEN - ' + full_name, testResult.errors.length);
                    }
                } catch (e) {
                    console.error(full_name + ' - ' + e);
                }
            } else if (testResult && testResult.errors && testResult.errors.length === 0) {
                if (!test && githubToken) {
                    closeIssue(full_name, issueNr);
                }
                $('#liste').append(`<li style='color: green;'>${full_name} fixed - checked but no error found</li>`);
            }
        }

    }
};

$('button').on('click', function () {
    start();
});

function addComminityText(full_name) {
    if (!full_name.startsWith('ioBroker/') && !full_name.startsWith('iobroker-community-adapters/')) {
        return '\r\n\r\nP.S.: There is a community in Github, which supports the maintenance and further development of adapters. There you will find many experienced developers who are always ready to assist anyone. New developers are always welcome there. For more informations visit: https://github.com/iobroker-community-adapters/info';
    } else {
        return '';
    }
}

function GithubInteractor(token) {
    this.token = token;
}

const interactor = new GithubInteractor(githubToken);

function createIssue(repo, issueBody, count, issueNr, errorList, warningList) {

    if (issueNr) {
        const url = 'https://api.github.com/repos/' + repo + '/issues/' + issueNr;
        $.ajax({
            url: url,
            type: 'PATCH',
            beforeSend: function (xhr) {
                xhr.setRequestHeader('Authorization', 'token ' + interactor.token);
            },
            error: function (xhr, status, error) {
                var err = JSON.parse(xhr.responseText);
                $('#liste').append(`<li style='color: red;'>${repo} - issue failed (${status}: ${error})</li>`);
            },
            success: function (issue) {
                adapterList[toSet][repo] = {};
                adapterList[toSet][repo].errorList = errorList;
                adapterList[toSet][repo].warningList = warningList;
                adapterList[toSet][repo].issue = issue.number;
                adapterList[toSet][repo].errorCount = count;
                adapterList[toSet][repo].status = issue.state;
                adapterList[toSet][repo].createdDate = issue.created_at;
                delete adapterList[toGet][repo];
                $('#listeSuccess').append(`<li>${repo} (${count} errors) - issue updated</li>`);
            },
            data: JSON.stringify({
                body: issueBody
            })
        });
    } else {
        const url = 'https://api.github.com/repos/' + repo + '/issues';
        $.ajax({
            url: url,
            type: 'POST',
            beforeSend: function (xhr) {
                xhr.setRequestHeader('Authorization', 'token ' + interactor.token);
            },
            error: function (xhr, status, error) {
                var err = JSON.parse(xhr.responseText);
                $('#liste').append(`<li style="color: red;">${repo} - issue failed (${status}: ${error})</li>`);
            },
            success: function (issue) {
                adapterList[toSet][repo] = {};
                adapterList[toSet][repo].errorList = errorList;
                adapterList[toSet][repo].warningList = warningList;
                adapterList[toSet][repo].issue = issue.number;
                adapterList[toSet][repo].errorCount = count;
                adapterList[toSet][repo].status = issue.state;
                adapterList[toSet][repo].createdDate = issue.created_at;
                delete adapterList[toGet][repo];
                $('#listeSuccess').append(`<li>${repo} (${count} errors) - new issue created</li>`);
            },
            data: JSON.stringify({
                title: issueTitle,
                body: issueBody
            })
        });
    }
}

function closeIssue(repo, issueNr) {

    if (issueNr) {
        var urlComment = 'https://api.github.com/repos/' + repo + '/issues/' + issueNr + '/comments';
        const issueBody = 'Thanks, that all bugs have been fixed.';
        $.ajax({
            url: urlComment,
            type: 'POST',
            beforeSend: function (xhr) {
                xhr.setRequestHeader('Authorization', 'token ' + interactor.token);
            },
            error: function (xhr, status, error) {
                var err = JSON.parse(xhr.responseText);
                $('#liste').append(`<li style="color: red;">${repo} - issue failed (${status}: ${error})</li>`);
            },
            success: function (issue) {
                adapterList.checkOk.push(repo);
                delete adapterList[toGet][repo];
            },
            data: JSON.stringify({
                body: issueBody
            })
        });
        
        var urlIssue = 'https://api.github.com/repos/' + repo + '/issues/' + issueNr;
        $.ajax({
            url: urlIssue,
            type: 'PATCH',
            beforeSend: function (xhr) {
                xhr.setRequestHeader('Authorization', 'token ' + interactor.token);
            },
            data: JSON.stringify({
                state: 'closed'
            })
        });
        
    } else {
        adapterList.checkOk.push(repo);
        delete adapterList[toGet][repo];
    }
}

async function getAdapterList() {
    const link = 'https://raw.githubusercontent.com/ioBrokerChecker/testData/master/data.json';
    try {
        return await (await fetch(link, {cache: 'no-cache'})).json();
    } catch (e) {
        return null;
    }
}

function checkIgnores(full_name) {
    return $.inArrayIn(full_name, adapterList.ignore) !== -1 || $.inArrayIn(full_name, Object.keys(adapterList[toGet])) !== -1 || $.inArrayIn(full_name, adapterList.checkOk) !== -1 || $.inArrayIn(full_name, Object.keys(adapterList.checkErrorOld)) !== -1 || $.inArrayIn(full_name, Object.keys(adapterList[toSet])) !== -1 || $.inArrayIn(full_name, adapterList.noIoPackage) !== -1;
}

async function findAllAdapters() {
    const firstQL = getQueryForRepos();

    let repos = await getDataV4(firstQL);
    if (repos && repos.data && repos.data.search) {
        repos.data.search.edges.forEach(async function (repoNode) {
            const full_name = repoNode.node.nameWithOwner;
            if (!repoNode.node.hasIssuesEnabled || repoNode.node.isArchived || checkIgnores(full_name)) {
                return true;
            }
            const check = await checkIoPackage('https://raw.githubusercontent.com/' + full_name + '/master/io-package.json', full_name);
            if (check) {
                adapterList[toGet][full_name] = {};
                adapterList[toGet][full_name].issue = null;
            }
        });

        let hasNext = repos.data.search.pageInfo.hasNextPage;
        let cursor = repos.data.search.pageInfo.endCursor;
        while (hasNext) {
            const nextQL = getQueryForRepos(cursor);
            repos = await getDataV4(nextQL);
            if (repos && repos.data && repos.data.search) {
                repos.data.search.edges.forEach(async function (repoNode) {
                    const full_name = repoNode.node.nameWithOwner;
                    if (!repoNode.node.hasIssuesEnabled || repoNode.node.isArchived || checkIgnores(full_name)) {
                        return true;
                    }
                    const check = await checkIoPackage('https://raw.githubusercontent.com/' + full_name + '/master/io-package.json', full_name);
                    if (check) {
                        adapterList[toGet][full_name] = {};
                        adapterList[toGet][full_name].issue = null;
                    }
                });
                hasNext = repos.data.search.pageInfo.hasNextPage;
                cursor = repos.data.search.pageInfo.endCursor;
            } else {
                hasNext = false;
                cursor = "";
            }
        }
    }
}

async function checkIoPackage(ioPackageLink, adapter) {
    try {
        const ioPackage = await (await fetch(ioPackageLink)).json();
        const isAdapter = ioPackage && ioPackage.common;
        if (!isAdapter) {
            adapterList.noIoPackage.push(adapter);
            return false;
        }
    } catch (e) {
        adapterList.noIoPackage.push(adapter);
        return false;
    }
    return true;
}

async function doTheTest(testLink) {
    try {
        return await (await fetch(adapterTestLink + testLink, {mode: 'cors'})).json();
    } catch (e) {
        return {};
    }
}

function testIssueCreation(repo, count, notChanged, warnings, closed) {
    let countW = 0;
    if (warnings) {
        countW = warnings.length;
    }
    $('#liste').append(`<li style="color: ${notChanged ? 'red' : 'blue'}">${repo} (${count} err & ${countW} war) - issue ${notChanged ? 'is the same' : 'has been changed (UPDATE)'} </li>`);
}

async function getDataV4(query) {
    return await (await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: new Headers({
            'Content-Type': 'application/json',
            'Authorization': 'bearer ' + interactor.token
        }),
        body: JSON.stringify({query: query})
    })).json();
}

function getQueryForRepos(cursor) {
    let query = getRepoSearchQL;

    if (cursor) {
        query = query.replace('$cursor', ', after: "' + cursor + '"');
    } else {
        query = query.replace('$cursor', '');
    }
    return query;
}

const getRepoSearchQL = `
query {
    search(first: 100, type: REPOSITORY, query: "iobroker"$cursor) {
        repositoryCount
        edges {
            node {
            	... on Repository{
                    nameWithOwner
                    hasIssuesEnabled
                    isArchived
                }
            }
            cursor
        }
        pageInfo {
            hasNextPage
            endCursor
        }
    }
}`;
