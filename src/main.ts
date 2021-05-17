// import the fs module, which allows us to do filesystem operations
// fs comes from nodejs, this is impossible with normal javascript
// running in a browser.
// You do not need to install this dependency, it is part of the
// standard library.
const fs = require("fs");
import * as core from "@actions/core";
import * as github from "@actions/github";

import simpleGit from 'simple-git';
import {ClassCoverage, Coverage} from './model';

function createCoverageComment(changedClass, currentCov: Map<string, ClassCoverage>, masterCov: Map<string, ClassCoverage>): string {
    const regex = /.*\/src\//s;
    let message = "## Coverage report\n";

    message += "| Key | Current PR | Default Branch |\n";
    message += "| :--- | :---: | :---: |\n";

    changedClass.forEach(clazz => {

        const cutPath = clazz.replace(regex, ``);
        const inCurrent = currentCov.get(cutPath)
        if (inCurrent) {
            message += `| ${inCurrent.className}`;
            message += `| ${inCurrent.coverage.linePercent.toFixed(2)}`;
            const inMaster = masterCov.get(cutPath)
            if (inMaster) {
                if (inCurrent.coverage.linePercent < inMaster.coverage.linePercent )
                    message += `:small_red_triangle_down:`
                message += `| ${inMaster.coverage.linePercent.toFixed(2)}`;
            } else {
                message += "| ";
            }
            message += "| \n";
        }
    });
    return message;
}

async function changedInPRFiles(extensions: Array<string>) {
    const git = simpleGit();
    const args = [
        "origin/master",
        "--name-only", //todo протащить фильтр по расширению в нативную команду git
    ]
    const allFiles = (await git.diff(args)).trim().split('\n');
    if (extensions.length == 0)
        return allFiles;
    else
        return allFiles.filter(file => extensions.find(ext => file.endsWith(ext)))
}

async function parseReport(reportPath: string): Promise<Map<string, ClassCoverage>> {
    const coverageMap = new Map();
    const coverageData = fs.readFileSync(reportPath, "utf8")

    const xml2js = require('xml2js');
    const xmlParser = new xml2js.Parser();
    const jp = require('jsonpath');

    await xmlParser.parseStringPromise(coverageData)
        .then(function (result) {
            return jp
                .nodes(result, '$.coverage..class')
                .flatMap(p => p.value)
                .map(n => {
                    coverageMap.set(n.$.filename,
                        new ClassCoverage(
                            n.$.name,
                            new Coverage(Math.round(n.$['line-rate'] * 100), Math.round(n.$['branch-rate'] * 100))
                        ))
                });
        }).catch(function (err) {
            console.error(err)
        });
    return coverageMap;
}

async function run() {
    const context = github.context;
    // if (github.context.eventName !== "pull_request") {
    //     // The core module on the other hand let's you get
    //     // inputs or create outputs or control the action flow
    //     // e.g. by producing a fatal error
    //     core.setFailed("Can only run on pull requests!");
    //     return;
    // } else {
    //  console.error(`Can't apply action to ${github.context.eventName}: only for PR`)
    // }

    const githubToken = core.getInput("token");
    const currentReportPath = core.getInput("current_coverage", {required: true});
    const masterReportPath = core.getInput("master_coverage", {required: true});
    const langs = core.getInput("langs").split(",").map(ext => ext.trim()).filter(y => y.length != 0)

    const repo = context.repo;
    const pullRequestNumber = context.payload.pull_request?.number as number;

    const octokit = github.getOctokit(githubToken);

    const current = await parseReport(currentReportPath);
    console.log(current)
    const master = await parseReport(masterReportPath);
    console.log(master)

    const message = await createCoverageComment(
        await changedInPRFiles(langs),
        // ["project/ModulePlugin.scala", "services/vasgen/core/src/vasgen/core/saas/FieldMappingReader.scala"],
        current,
        master);
    console.log(message);

    // Get all comments we currently have...
    // (this is an asynchronous function)
    const {data: comments} = await octokit.issues.listComments({
        ...repo,
        issue_number: pullRequestNumber,
    });

    // ... and check if there is already a comment by us
    const comment = comments.find((comment) => {
        return (
            comment.user != null &&
            comment.user.login === "github-actions[bot]" &&
            comment.body != null &&
            comment.body.startsWith("## Coverage report\n")
        );
    });

    // If yes, update that
    if (comment) {
        await octokit.issues.updateComment({
            ...repo,
            comment_id: comment.id,
            body: message,
        });
        // if not, create a new comment
    } else {
        await octokit.issues.createComment({
            ...repo,
            issue_number: pullRequestNumber,
            body: message,
        });
    }


    await octokit.request('PATCH /repos/{owner}/{repo}/pulls/{pull_number}', {
        owner: repo.owner,
        repo: repo.repo,
        pull_number:pullRequestNumber,
        body: "![coverage](https://img.shields.io/badge/coverage-56%25-blue)"
    })
}

run().catch((error) => core.setFailed("Workflow failed! " + error.message));
