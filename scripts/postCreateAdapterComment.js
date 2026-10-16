'use strict';
/*
    Used by workflow check-create-adapter.yml (via actions/github-script).

    Builds a comment out of the repochecker output for the adapter created by create-adapter
    (same layout as the "Automated adapter checker" comments at ioBroker.repositories),
    writes it to the job summary and posts it to the pull request.
    An already existing comment of this workflow is updated instead of adding a new one.
*/
const fs = require('node:fs');
const path = require('node:path');

// identifies the comment created by this script
const COMMENT_MARKER = '<!-- ###create-adapter-check comment### -->';

function readFile(fileName) {
    try {
        return fs.readFileSync(fileName, 'utf8');
    } catch {
        return '';
    }
}

function buildComment(context) {
    const tempDir = process.env.RUNNER_TEMP;
    const adapterDir = path.join(tempDir, 'adapter', 'ioBroker.repocheckertest');
    const checkerLog = readFile(path.join(tempDir, 'repochecker.log'));
    const createAdapterLog = readFile(path.join(tempDir, 'create-adapter.log'));

    // version of create-adapter used, stored at the generated .create-adapter.json
    let creatorVersion = 'unknown';
    try {
        creatorVersion = JSON.parse(readFile(path.join(adapterDir, '.create-adapter.json'))).creatorVersion;
    } catch {
        // ignore - version stays unknown
    }

    // only evaluate the summary section of the repochecker output
    const summaryIdx = checkerLog.indexOf('########## SUMMARY of ISSUES ##########');
    const summary = summaryIdx >= 0 ? checkerLog.substring(summaryIdx) : '';
    const findings = summary.split('\n').filter(line => /^\[[EWS]\d{4}\]/.test(line));
    const errors = findings.filter(line => line.startsWith('[E'));
    const warnings = findings.filter(line => line.startsWith('[W'));
    const suggestions = findings.filter(line => line.startsWith('[S'));

    // for pull requests context.sha is a temporary merge commit - link to the head commit instead
    const headSha = context.payload.pull_request?.head?.sha || context.sha;
    const optionsUrl = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/blob/${headSha}/.github/create-adapter/maximum-options.json`;
    const runUrl = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;

    const lines = [];
    lines.push(COMMENT_MARKER);
    lines.push('## Automated adapter checker');
    lines.push('');
    lines.push(`### Adapter created by create-adapter ${creatorVersion}`);
    lines.push(`Options used: [maximum-options.json](${optionsUrl}) - checked using \`--offline\` mode`);
    lines.push('');

    if (!summary) {
        lines.push(
            `:heavy_exclamation_mark: Repochecker did not produce a result, please check the [workflow run](${runUrl}).`,
        );
    } else {
        if (errors.length) {
            lines.push('**ERRORS:**');
            errors.forEach(err => lines.push(`- [ ] :heavy_exclamation_mark: ${err}`));
        } else {
            lines.push(':thumbsup: No errors found');
        }
        lines.push(' ');

        if (warnings.length) {
            lines.push('**WARNINGS:**');
            warnings.forEach(warn => lines.push(`- [ ] :eyes: ${warn}`));
            lines.push(' ');
        }

        if (suggestions.length) {
            lines.push('**SUGGESTIONS:**');
            suggestions.forEach(sugg => lines.push(`- [ ] :pushpin: ${sugg}`));
            lines.push(' ');
        }
    }

    // errors reported by create-adapter itself (e.g. failing build of the generated adapter)
    const createAdapterErrors = createAdapterLog
        .split('\n')
        .filter(line => /^error:|^Error:|Build failed/i.test(line.trim()));
    if (createAdapterErrors.length) {
        lines.push('---');
        lines.push('**create-adapter reported errors while creating the adapter:**');
        lines.push('```');
        createAdapterErrors.forEach(line => lines.push(line.trim()));
        lines.push('```');
        lines.push('');
    }

    lines.push('---');
    lines.push(`Details are available at the [workflow run](${runUrl}).`);

    return lines.join('\n');
}

module.exports = async ({ github, context, core }) => {
    const body = buildComment(context);

    // always provide the result at the job summary
    await core.summary.addRaw(body).write();

    const issueNumber = context.payload.pull_request?.number;
    if (!issueNumber) {
        core.info('Not running for a pull request - comment not posted');
        return;
    }

    // update an existing comment of this workflow or create a new one
    const comments = await github.paginate(github.rest.issues.listComments, {
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: issueNumber,
        per_page: 100,
    });
    const existing = comments.find(comment => comment.body?.includes(COMMENT_MARKER));

    if (existing) {
        await github.rest.issues.updateComment({
            owner: context.repo.owner,
            repo: context.repo.repo,
            comment_id: existing.id,
            body,
        });
        core.info(`Updated comment ${existing.html_url}`);
    } else {
        const { data } = await github.rest.issues.createComment({
            owner: context.repo.owner,
            repo: context.repo.repo,
            issue_number: issueNumber,
            body,
        });
        core.info(`Created comment ${data.html_url}`);
    }
};
