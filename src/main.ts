// import the fs module, which allows us to do filesystem operations
// fs comes from nodejs, this is impossible with normal javascript
// running in a browser.
// You do not need to install this dependency, it is part of the
// standard library.
const fs = require("fs");
import * as core from "@actions/core";
import * as github from "@actions/github";

import simpleGit from 'simple-git';

// Function to read and parse a JSON
function readJSON(filename: string) {
    const rawdata = fs.readFileSync(filename);
    const benchmarkJSON = JSON.parse(rawdata);
    return benchmarkJSON;
}

function createMessage(changedClass, covReport): string {
    const regex = /.*\/src\//s;
    let message = "## Coverage report\n";

    message += "| Key | Current PR | Default Branch |\n";
    message += "| :--- | :---: | :---: |\n";

    changedClass.forEach(clazz => {

        const cutPath = clazz.replace(regex, ``);
        const found = covReport.get(cutPath)
        if (found) {
            message += `| ${found.className}`;
            const current = found.currentPR.linePercent;//todo real value
            const master = 80;//todo real value

            message += `| ${current.toFixed(2)} `;
            if (current < master )
                message += `:small_red_triangle_down:`
            message += `| ${master.toFixed(2)}`;
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

// Main function of this action: read in the files and produce the comment.
// The async keyword makes the run function controlled via
// an event loop - which is beyond the scope of the blog.
// Just remember: we will use a library which has asynchronous
// functions, so we also need to call them asynchronously.

async function run() {
    // The github module has a member called "context",
    // which always includes information on the action workflow
    // we are currently running in.
    // For example, it let's us check the event that triggered the workflow.

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
    const benchmarkFileName = core.getInput("json_file", {required: true});
    const oldBenchmarkFileName = core.getInput("comparison_json_file", {required: true});
    const langs = core.getInput("langs").split(",").map(ext => ext.trim()).filter(y => y.length != 0)

    const benchmarks = readJSON(benchmarkFileName);

    let oldBenchmarks = undefined;
    if (oldBenchmarkFileName) {
        try {
            oldBenchmarks = readJSON(oldBenchmarkFileName);
        } catch (error) {
            console.log("Can not read comparison file. Continue without it.");
        }
    }

    const repo = context.repo;
    const pullRequestNumber = context.payload.pull_request?.number as number;

    const octokit = github.getOctokit(githubToken);

    const xml2js = require('xml2js');

    const xmlParser = new xml2js.Parser();
    const jp = require('jsonpath');

    class ClassCoverage {
        className: string;
        currentPR: Coverage;
        master: Coverage;

        constructor(className: string, currentPR: Coverage, master: Coverage) {
            this.className = className;
            this.currentPR = currentPR;
            this.master = master;
        }
    }

    class Coverage {
        linePercent: number;
        branchPercent: number;

        constructor(linePercent: number, branchPercent: number) {
            this.linePercent = linePercent;
            this.branchPercent = branchPercent;
        }
    }

    const currentCov = new Map();
    const coverageData = fs.readFileSync("target/scala-2.13/coverage-report/cobertura.xml", "utf8")

    await xmlParser.parseStringPromise(coverageData)
        .then(function (result) {
            return jp
                .nodes(result, '$.coverage..class')
                .flatMap(p => p.value)
                .map(n => {
                    currentCov.set(n.$.filename,
                        new ClassCoverage(
                            n.$.name,
                            new Coverage(Math.round(n.$['line-rate'] * 100), Math.round(n.$['branch-rate'] * 100)),
                            new Coverage(100, 100)),
                    )
                });
        }).catch(function (err) {
            console.error(err)
        });

    console.log(currentCov)

    const message = createMessage(
        // await changedInPRFiles(langs),
        ["project/ModulePlugin.scala", "services/vasgen/core/src/vasgen/core/saas/FieldMappingReader.scala"],
        currentCov);
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
}

run().catch((error) => core.setFailed("Workflow failed! " + error.message));
