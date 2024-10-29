/* global $,jQuery */
const githubToken = ''; // https://github.com/settings/tokens
const test = false;

const toGet = 'checkError2';
const toSet = 'checkError';
const checkOkCheck = true;

const issueTitle = 'Think about to fix the issues found by adapter checker';

const adapterTestLink = 'https://e7tj1cpjna.execute-api.eu-west-1.amazonaws.com/?url=';

let adapterList/* , dicoveryList */;

const start = async function () {
    console.log('Adapter Liste wird geladen...');
    adapterList = await getAdapterList();
    console.log('Adapter Liste geladen!');
    if (adapterList) {
        if (!adapterList[toSet]) adapterList[toSet] = {};
        if (!adapterList.dependVISwwwOnly) adapterList.dependVISwwwOnly = [];
        if (!adapterList.dependVIS) adapterList.dependVIS = [];
        if (!adapterList.noRestartVIS2) adapterList.noRestartVIS2 = [];

        $('#listeSuccess').append("<li style='color: blue;'>ignored: " + adapterList['ignore'].length + "/<span id='ignore'></span></li>");
        $('#listeSuccess').append("<li style='color: blue;'>noIoPackage: " + adapterList['noIoPackage'].length + "/<span id='noIoPackage'></span></li>");
        $('#listeSuccess').append("<li style='color: blue;'>checkErrorOld: " + Object.keys(adapterList['checkErrorOld']).length + "/<span id='checkErrorOld'></span></li>");
        $('#listeSuccess').append("<li style='color: blue;'>" + toGet + ': ' + Object.keys(adapterList[toGet]).length + "/<span id='" + toGet + "'></span></li>");
        $('#listeSuccess').append("<li style='color: blue;'>" + toSet + ': ' + Object.keys(adapterList[toSet]).length + "/<span id='" + toSet + "'></span></li>");
        $('#listeSuccess').append("<li style='color: blue;'>checkOk: " + adapterList.checkOk.length + "/<span id='checkOk'></span></li>");
        $('#listeSuccess').append("<li style='color: blue;'>dependVISwwwOnly: " + adapterList.dependVISwwwOnly.length + "/<span id='dependVISwwwOnly'></span></li>");
        $('#listeSuccess').append("<li style='color: blue;'>dependVIS: " + adapterList.dependVIS.length + "/<span id='dependVIS'></span></li>");
        $('#listeSuccess').append("<li style='color: blue;'>noRestartVIS2: " + adapterList.noRestartVIS2.length + "/<span id='noRestartVIS2'></span></li>");

        console.log('Die Arbeit beginnt');
        await startFunc();
        await delay(10000);
        console.log('Die Arbeit ist fertig!!');

        console.log(JSON.stringify(adapterList));
        $('#ignore').text(adapterList.ignore.length);
        $('#noIoPackage').text(adapterList.noIoPackage.length);
        $('#checkOk').text(adapterList.checkOk.length);
        $('#dependVISwwwOnly').text(adapterList.dependVISwwwOnly.length);
        $('#dependVIS').text(adapterList.dependVIS.length);
        $('#noRestartVIS2').text(adapterList.noRestartVIS2.length);
        $('#checkErrorOld').text(Object.keys(adapterList.checkErrorOld).length);
        $('#' + toSet).text(Object.keys(adapterList[toSet]).length);
        $('#' + toGet).text(Object.keys(adapterList[toGet]).length);
        $('#result').text(JSON.stringify(adapterList));
    } else {
        $('#liste').append("<li style='color: red;'>ERROR " + Object.keys(adapterList[toGet]).length + ' ' + Object.keys(adapterList[toSet]).length + '</li>');
    }
};

(function ($) {
    $.extend({
        // Case insensative $.inArray (http://api.jquery.com/jquery.inarray/)
        // $.inArrayIn(value, array [, fromIndex])
        // value (type: String)
        // The value to search for
        // array (type: Array)
        // An array through which to search.
        // fromIndex (type: Number)
        // The index of the array at which to begin the search.
        // The default is 0, which will search the whole array.
        inArrayIn: function (elem, arr, i) {
            // not looking for a string anyways, use default method
            if (typeof elem !== 'string') {
                return $.inArray.apply(this, arguments);
            }
            // confirm array is populated
            if (arr) {
                const len = arr.length;
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

const delay = ms => new Promise(res => setTimeout(res, ms));

const startFunc = async function () {

    if (adapterList) {

        console.log('Suche neue Adapter');
        const oldGet = Object.keys(adapterList[toGet]).length;
        await findAllAdapters('asc');
        await findAllAdapters('desc');
        console.log('Suche neuer Adapter beendet - ' + (Object.keys(adapterList[toGet]).length - oldGet) + ' Adapter gefunden');

        if (checkOkCheck) {
            adapterList.checkOk.forEach(function (full_name) {
                adapterList[toGet][full_name] = {};
                adapterList[toGet][full_name].issue = null;
            });
            adapterList.checkOk = [];
        }
        adapterList.noIoPackage = [];
        adapterList.noRestartVIS2 = [];
        adapterList.dependVIS = [];
        adapterList.dependVISwwwOnly = [];

        for (const origfullname in adapterList[toGet]) {
            const full_name = await getFullname(origfullname);
            if (full_name) {
                console.log('Teste ' + full_name + ' ...');
                const testLink = 'https://raw.githubusercontent.com/' + full_name;
                const testResult = await doTheTest(testLink);

                console.log('Teste io-Package vis' + full_name + ' ...');
                const check = await checkVis('https://raw.githubusercontent.com/' + full_name + '/master/io-package.json', full_name);
                if (!check) {
                    await checkVis('https://raw.githubusercontent.com/' + full_name + '/main/io-package.json', full_name);
                }

                const issueNr = adapterList[toGet][origfullname].issue;
                let issuesList = [];
                if (issueNr) {
                    issuesList = adapterList[toGet][origfullname].errorList;
                }

                if ((testResult && testResult.errors && testResult.errors.length > 0) || adapterList.noRestartVIS2.includes(full_name) || adapterList.dependVIS.includes(full_name) || adapterList.dependVISwwwOnly.includes(full_name)) {
                    try {
                        console.log('Issue wird angelegt ' + full_name + ' ...');
                        let issueBody = 'I am an automatic service that looks for possible errors in ioBroker and creates an issue for it. The link below leads directly to the test:\r\n\r\n';
                        issueBody += 'https://adapter-check.iobroker.in/?q=' + testLink + '\r\n\r\n';
                        const errorList = [];
                        const warningList = [];

                        if (testResult) {
                            testResult.errors.forEach(function (issue) {
                                issueBody += '- [ ] ' + issue + '\r\n';
                                errorList.push(issue.substring(1, 5));
                            });
                            if (testResult.warnings && testResult.warnings.length > 0) {
                                issueBody += '\r\nI have also found warnings that may be fixed if possible.\r\n\r\n';
                                testResult.warnings.forEach(function (issue) {
                                    issueBody += '- [ ] ' + issue + '\r\n';
                                    warningList.push(issue.substring(1, 5));
                                });
                            }
                        }

                        if (adapterList.noRestartVIS2.includes(full_name)) {
                            issueBody += '\r\nI noticed that in the io-package under “restartAdapters” only vis is available. If your widget also runs with vis-2, you might want to add “vis-2” to the list too.\r\n\r\n';
                        }

                        if (adapterList.dependVIS.includes(full_name)) {
                            issueBody += '\r\nI found vis as “dependencies” in the io package. Please remove this dependency.\r\n\r\n';
                        }
                        if (adapterList.dependVISwwwOnly.includes(full_name)) {
                            issueBody += '\r\nI found vis as “dependencies” in the io package. If your widget also runs with vis-2, then remove that.\r\n\r\n';
                        }

                        issueBody += '\r\nThanks,\r\nyour automatic adapter checker.';
                        issueBody += addComminityText(full_name);

                        const errorNotChanged = issueNr !== null && (errorList.length === issuesList.length && errorList.sort().every(function (value, index) {
                            return value === issuesList.sort()[index];
                        }));

                        if (test) {
                            testIssueCreation(origfullname, full_name, testResult.errors.length, errorNotChanged, testResult.warnings);
                        } else if (githubToken && !errorNotChanged) {
                            createIssue(origfullname, full_name, issueBody, testResult.errors.length, issueNr, errorList, warningList);
                        } else if (githubToken && errorNotChanged) {
                            let dateIssue = adapterList[toGet][origfullname].createdDate;
                            if (!dateIssue) {
                                dateIssue = '2019-02-01T15:08:12Z';
                                adapterList[toGet][origfullname].createdDate = dateIssue;
                            }

                            if ((new Date() - new Date(dateIssue)) > 15768000000) {
                                createHelpComment(origfullname, full_name, issueNr);
                            } else {
                                adapterList[toSet][full_name] = adapterList[toGet][origfullname];
                                delete adapterList[toGet][origfullname];
                            }
                            $('#liste').append("<li style='color: blue;'>" + (full_name === origfullname ? full_name : origfullname + ' => ' + full_name) + ' no error changes</li>');
                        } else {
                            testIssueCreation('NO TOKEN - ' + full_name, 'NO TOKEN - ' + full_name, testResult.errors.length);
                        }
                    } catch (e) {
                        console.error(full_name + ' - ' + e);
                    }
                } else if (testResult && testResult.errors && testResult.errors.length === 0) {
                    if (!test && githubToken) {
                        closeIssue(origfullname, full_name, issueNr);
                    }
                    $('#liste').append("<li style='color: green;'>" + (full_name === origfullname ? full_name : origfullname + ' => ' + full_name) + ' fixed - checked but no error found</li>');
                }
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

function createIssue(orgRepo, repo, issueBody, count, issueNr, errorList, warningList) {

    if (issueNr) {
        const url = 'https://api.github.com/repos/' + repo + '/issues/' + issueNr;
        $.ajax({
            url: url,
            type: 'PATCH',
            beforeSend: function (xhr) {
                xhr.setRequestHeader('Authorization', 'token ' + interactor.token);
            },
            error: function (/* xhr, status, error */) {
                createIssue(orgRepo, repo, issueBody, count, null, errorList, warningList);
            },
            success: function (issue) {
                adapterList[toSet][repo] = {};
                adapterList[toSet][repo].errorList = errorList;
                adapterList[toSet][repo].warningList = warningList;
                adapterList[toSet][repo].issue = issue.number;
                adapterList[toSet][repo].errorCount = count;
                adapterList[toSet][repo].status = issue.state;
                adapterList[toSet][repo].createdDate = (adapterList[toGet][orgRepo].createdDate ? adapterList[toGet][orgRepo].createdDate : issue.created_at);
                adapterList[toSet][repo].help = adapterList[toGet][orgRepo].help === true;
                delete adapterList[toGet][orgRepo];
                $('#listeSuccess').append('<li>' + (repo === orgRepo ? repo : orgRepo + ' => ' + repo) + ' (' + count + ' errors) - issue updated</li>');
            },
            data: JSON.stringify({
                body: issueBody,
                state: 'open'
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
                const err = JSON.parse(xhr.responseText);
                $('#liste').append("<li style='color: red;'>" + (repo === orgRepo ? repo : orgRepo + ' => ' + repo) + ' - issue failed (' + status + ': ' + error + ') ' + err + '</li>');
            },
            success: function (issue) {
                adapterList[toSet][repo] = {};
                adapterList[toSet][repo].errorList = errorList;
                adapterList[toSet][repo].warningList = warningList;
                adapterList[toSet][repo].issue = issue.number;
                adapterList[toSet][repo].errorCount = count;
                adapterList[toSet][repo].status = issue.state;
                adapterList[toSet][repo].createdDate = issue.created_at;
                adapterList[toSet][repo].help = false;
                delete adapterList[toGet][orgRepo];
                $('#listeSuccess').append('<li>' + (repo === orgRepo ? repo : orgRepo + ' => ' + repo) + ' (' + count + ' errors) - new issue created</li>');
            },
            data: JSON.stringify({
                title: issueTitle,
                body: issueBody
            })
        });
    }
}

function closeIssue(orgRepo, repo, issueNr) {

    if (issueNr) {
        const urlComment = 'https://api.github.com/repos/' + repo + '/issues/' + issueNr + '/comments';
        const issueBody = 'Thanks, that all bugs have been fixed.';
        $.ajax({
            url: urlComment,
            type: 'POST',
            beforeSend: function (xhr) {
                xhr.setRequestHeader('Authorization', 'token ' + interactor.token);
            },
            error: function (xhr, status, error) {
                const err = JSON.parse(xhr.responseText);
                $('#liste').append("<li style='color: red;'>" + (repo === orgRepo ? repo : orgRepo + ' => ' + repo) + ' - issue failed (' + status + ': ' + error + ') ' + err + '</li>');
            },
            success: function (/* issue */) {
                adapterList.checkOk.push(repo);
                delete adapterList[toGet][orgRepo];
            },
            data: JSON.stringify({
                body: issueBody
            })
        });

        const urlIssue = 'https://api.github.com/repos/' + repo + '/issues/' + issueNr;
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
        delete adapterList[toGet][orgRepo];
    }
}

function createHelpComment(orgRepo, repo, issueNr) {

    if (issueNr && !adapterList[toGet][repo].help) {
        const urlComment = 'https://api.github.com/repos/' + repo + '/issues/' + issueNr + '/comments';
        const issueBody = 'Do you need help fixing the bugs?';
        $.ajax({
            url: urlComment,
            type: 'POST',
            beforeSend: function (xhr) {
                xhr.setRequestHeader('Authorization', 'token ' + interactor.token);
            },
            error: function (xhr, status, error) {
                const err = JSON.parse(xhr.responseText);
                $('#liste').append("<li style='color: red;'>" + (repo === orgRepo ? repo : orgRepo + ' => ' + repo) + ' - issue failed (' + status + ': ' + error + ') - ' + err + '</li>');
            },
            success: function (/* issue */) {
                adapterList[toSet][repo] = adapterList[toGet][orgRepo];
                adapterList[toSet][repo].status = 'open';
                adapterList[toSet][repo].createdDate = new Date().toISOString();
                adapterList[toSet][repo].help = true;
                delete adapterList[toGet][orgRepo];
            },
            data: JSON.stringify({
                body: issueBody
            })
        });

        const urlIssue = 'https://api.github.com/repos/' + repo + '/issues/' + issueNr;
        $.ajax({
            url: urlIssue,
            type: 'PATCH',
            beforeSend: function (xhr) {
                xhr.setRequestHeader('Authorization', 'token ' + interactor.token);
            },
            data: JSON.stringify({
                state: 'open'
            })
        });
    }
}

async function getAdapterList() {
    const link = 'https://raw.githubusercontent.com/ioBrokerChecker/testData/master/data.json';
    try {
        return await (await fetch(link, { cache: 'no-cache' })).json();
    } catch (e) {
        console.log(e);
        return null;
    }
}

function checkIgnores(full_name) {
    return $.inArrayIn(full_name, adapterList.ignore) !== -1 || $.inArrayIn(full_name, Object.keys(adapterList[toGet])) !== -1 || $.inArrayIn(full_name, adapterList.checkOk) !== -1 || $.inArrayIn(full_name, Object.keys(adapterList.checkErrorOld)) !== -1 || $.inArrayIn(full_name, Object.keys(adapterList[toSet])) !== -1 || $.inArrayIn(full_name, adapterList.noIoPackage) !== -1;
}

async function findAllAdapters(sort) {
    const firstQL = getQueryForRepos(sort);

    let repos = await getDataV4(firstQL);
    if (repos && repos.data && repos.data.search) {
        repos.data.search.edges.forEach(async function (repoNode) {
            const full_name = repoNode.node.nameWithOwner;
            if (!repoNode.node.hasIssuesEnabled || repoNode.node.isArchived || checkIgnores(full_name)) {
                return true;
            }
            console.log('Check ' + full_name);
            let check = await checkIoPackage('https://raw.githubusercontent.com/' + full_name + '/master/io-package.json', full_name);
            if (!check) {
                check = await checkIoPackage('https://raw.githubusercontent.com/' + full_name + '/main/io-package.json', full_name);
            }

            if (check) {
                console.log(full_name + ' als Adapter erkannt');
                adapterList[toGet][full_name] = {};
                adapterList[toGet][full_name].issue = null;
            } else {
                console.log(full_name + ' ist kein Adapter');
                adapterList.noIoPackage.push(full_name);
            }
        });

        let hasNext = repos.data.search.pageInfo.hasNextPage;
        let cursor = repos.data.search.pageInfo.endCursor;
        while (hasNext) {
            const nextQL = getQueryForRepos(sort, cursor);
            repos = await getDataV4(nextQL);
            if (repos && repos.data && repos.data.search) {
                repos.data.search.edges.forEach(async function (repoNode) {
                    const full_name = repoNode.node.nameWithOwner;
                    if (!repoNode.node.hasIssuesEnabled || repoNode.node.isArchived || checkIgnores(full_name)) {
                        return true;
                    }
                    let check = await checkIoPackage('https://raw.githubusercontent.com/' + full_name + '/master/io-package.json', full_name);
                    if (!check) {
                        check = await checkIoPackage('https://raw.githubusercontent.com/' + full_name + '/main/io-package.json', full_name);
                    }
                    if (check) {
                        console.log(full_name + ' als Adapter erkannt');
                        adapterList[toGet][full_name] = {};
                        adapterList[toGet][full_name].issue = null;
                    } else {
                        console.log(full_name + ' ist kein Adapter');
                        adapterList.noIoPackage.push(full_name);
                    }
                });
                hasNext = repos.data.search.pageInfo.hasNextPage;
                cursor = repos.data.search.pageInfo.endCursor;
            } else {
                hasNext = false;
                cursor = '';
            }
        }
    }
}

async function checkIoPackage(ioPackageLink/* , adapter */) {
    try {
        const ioPackage = await (await fetch(ioPackageLink)).json();
        const isAdapter = ioPackage && ioPackage.common;
        if (!isAdapter) {
            return false;
        }
    } catch (e) {
        return false;
    }
    return true;
}

async function checkVis(ioPackageLink, adapter) {
    try {
        const ioPackage = await (await fetch(ioPackageLink)).json();
        const isAdapter = ioPackage && ioPackage.common;
        if (!isAdapter) {
            return false;
        }
        if (ioPackage.common.restartAdapters && ioPackage.common.restartAdapters.includes('vis') && !ioPackage.common.restartAdapters.includes('vis-2')) {
            adapterList.noRestartVIS2.push(adapter);
        }
        if (ioPackage.common.dependencies && ioPackage.common.dependencies.includes('vis')) {
            if (ioPackage.common.onlyWWW) {
                adapterList.dependVISwwwOnly.push(adapter);
            } else {
                adapterList.dependVIS.push(adapter);
            }
        }
        if (ioPackage.common.globalDependencies && ioPackage.common.globalDependencies.includes('vis')) {
            if (ioPackage.common.onlyWWW) {
                adapterList.dependVISwwwOnly.push(adapter);
            } else {
                adapterList.dependVIS.push(adapter);
            }
        }
    } catch (e) {
        return false;
    }
    return true;
}

async function doTheTest(testLink) {
    try {
        return await (await fetch(adapterTestLink + testLink, { mode: 'cors' })).json();
    } catch (e) {
        return {};
    }
}

function testIssueCreation(orgRepo, repo, count, notChanged, warnings) {
    let countW = 0;
    if (warnings) {
        countW = warnings.length;
    }
    $('#liste').append("<li style='color: " + (notChanged ? 'red' : 'blue') + "'>" + (repo === orgRepo ? repo : orgRepo + ' => ' + repo) + ' (' + count + ' err & ' + countW + ' war) - issue ' + (notChanged ? 'is the same' : 'has been changed (UPDATE)') + ' </li>');
}

async function getDataV4(query) {
    return await (await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: new Headers({
            'Content-Type': 'application/json',
            'Authorization': 'bearer ' + interactor.token
        }),
        body: JSON.stringify({ query: query })
    })).json();
}

function getQueryForRepos(sort, cursor) {
    let query = getRepoSearchQL;

    if (cursor) {
        query = query.replace('$cursor', ', after: "' + cursor + '"');
    } else {
        query = query.replace('$cursor', '');
    }
    query = query.replace('$dings', sort);
    return query;
}

async function getFullname(fullname) {
    let query = checkRepoNameQL;
    const names = fullname.split('/');
    query = query.replace('$name', names[1]).replace('$owner', names[0]);
    const repo = await getDataV4(query);
    if (repo && repo['data'] && repo['data']['repository']) {
        return repo['data']['repository']['nameWithOwner'];
    }

    return null;
}

const getRepoSearchQL = `
query {
    search(first: 100, type: REPOSITORY, query: "iobroker sort:updated-$dings"$cursor) {
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

const checkRepoNameQL = `
query {
	repository(name: "$name", owner: "$owner") {
		nameWithOwner
	}
}`;
