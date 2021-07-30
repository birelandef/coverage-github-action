import * as core from "@actions/core";
import * as github from "@actions/github";

import simpleGit from 'simple-git';
import {ClassCoverage, Color, Coverage, SummaryReport} from './model';

const fs = require("fs");


function createCoverageComment(changedClass, currentCov: SummaryReport, masterCov: Map<string, ClassCoverage>): string {
    const regex = /.*\/src\//s;
    let message = "## Coverage report\n";
    /**
     *         green       80-100
     *         yellowgreen 60-80
     *         yellow      40-60
     *         orange      20-40
     *         red         <20
     * @param percent
     */
    function defineColor(percent: number): Color {
        if (percent == 100)
            return Color.BRIGHTGREEN;
        if (percent >= 80)
            return Color.GREEN;
        if (percent >= 60)
            return Color.YELLOWGREEN;
        if (percent >= 40)
            return Color.YELLOW;
        if (percent >= 20)
            return Color.ORANGE;
        return Color.RED
    }
    const percent = currentCov.overall.linePercent
    const color = defineColor(currentCov.overall.linePercent)

    message += `![coverage](https://img.shields.io/badge/coverage-${percent}%25-${color})\n`

    message += "| Key | Current PR | Default Branch |\n";
    message += "| :--- | :---: | :---: |\n";

    changedClass.forEach(clazz => {

        const cutPath = clazz.replace(regex, ``);
        const inCurrent = currentCov.classes.get(cutPath)
        if (inCurrent) {
            message += `| ${inCurrent.className}`;
            message += `| ${inCurrent.coverage.linePercent.toFixed(2)}`;
            const inMaster = masterCov.get(cutPath)
            if (inMaster) {
                if (inCurrent.coverage.linePercent < inMaster.coverage.linePercent)
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

async function parseReport(reportPath: string): Promise<SummaryReport> {
    const xml2js = require('xml2js');
    const xmlParser = new xml2js.Parser();
    const jp = require('jsonpath');

    const coverageMap = new Map();
    const coverageData = fs.readFileSync(reportPath, "utf8")

    function parseCoverage(n): Coverage {
        return new Coverage(Math.round(n['line-rate'] * 100), Math.round(n['branch-rate'] * 100))
    }

    const overall = await xmlParser.parseStringPromise(coverageData)
        .then(function (result) {
            jp.nodes(result, '$.coverage..class')
                .flatMap(p => p.value)
                .map(n => {
                    coverageMap.set(n.$.filename,
                        new ClassCoverage(
                            n.$.name,
                            parseCoverage(n.$)
                        ))
                });
            return parseCoverage(jp.value(result, '$.coverage').$)
        }).catch(function (err) {
            console.error(err)
        });
    return new SummaryReport(overall, coverageMap);
}

async function run() {
    const context = github.context;
    // if (github.context.eventName !== "pull_request") {
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
    const master = await parseReport(masterReportPath);

    const message = await createCoverageComment(
        await changedInPRFiles(langs),
        // ["project/ModulePlugin.scala", "services/vasgen/core/src/vasgen/core/saas/FieldMappingReader.scala"],
        current,
        master.classes)
    console.log(message);

    // const {data: comments} = await octokit.issues.listComments({
    //     ...repo,
    //     issue_number: pullRequestNumber,
    // });
    //
    // const comment = comments.find((comment) => {
    //     return (
    //         comment.user != null &&
    //         comment.user.login === "github-actions[bot]" &&
    //         comment.body != null &&
    //         comment.body.startsWith("## Coverage report\n")
    //     );
    // });
    //
    // if (comment) {
    //     await octokit.issues.updateComment({
    //         ...repo,
    //         comment_id: comment.id,
    //         body: message,
    //     });
    // } else {
    //     await octokit.issues.createComment({
    //         ...repo,
    //         issue_number: pullRequestNumber,
    //         body: message,
    //     });
    // }
}

run().catch((error) => core.setFailed("Workflow failed! " + error.message));
