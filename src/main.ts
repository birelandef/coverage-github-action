// import the fs module, which allows us to do filesystem operations
// fs comes from nodejs, this is impossible with normal javascript
// running in a browser.
// You do not need to install this dependency, it is part of the
// standard library.
const fs = require("fs");
import * as core from "@actions/core";
import * as github from "@actions/github";

// Function to read and parse a JSON
function readJSON(filename: string) {
    // read in the file
    const rawdata = fs.readFileSync(filename);
    // parse the JSON into a mapping
    const benchmarkJSON = JSON.parse(rawdata);
    // return it
    return benchmarkJSON;
}

// Create a markdown message from the two JSON.
function createMessage(benchmark, comparisonBenchmark): string {
    let message = "## Coverage report\n";

    // Table Title
    message += "| Key | Current PR | Default Branch |\n";

    // Table Column Definitions
    message += "| :--- | :---: | :---: |\n";

    for (const key in benchmark) {
        // First Column: The key
        // Please note the ` instead of ". This is TypeScripts
        // format string. Everything in ${ } will be replaced.
        message += `| ${key}`;

        // Second column: the value with 2 digits
        const value = benchmark[key];
        message += `| ${value.toFixed(2)}`;

        // Third column: the comparison value.
        // If this does not work out (e.g. because the key is not defined),
        // just output nothing
        try {
            const oldValue = comparisonBenchmark[key];
            message += `| ${oldValue.toFixed(2)}`;
        } catch (error) {
            console.log("Can not read key", key, "from the comparison file.");
            message += "| ";
        }
        message += "| \n";
    }

    return message;
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

    let base: string
    let head: string

    const context = github.context;
    // if (github.context.eventName !== "pull_request") {
    //     // The core module on the other hand let's you get
    //     // inputs or create outputs or control the action flow
    //     // e.g. by producing a fatal error
    //     core.setFailed("Can only run on pull requests!");
    //     return;
    // } else {
    base = context.payload.pull_request?.base?.sha
    head = context.payload.pull_request?.head?.sha
    // }

    // get the inputs of the action. The "token" input
    // is not defined so far - we will come to it later.
    const githubToken = core.getInput("token");
    const benchmarkFileName = core.getInput("json_file", {required: true});
    const oldBenchmarkFileName = core.getInput("comparison_json_file", {required: true});

    // Now read in the changedClasses with the function defined above
    const benchmarks = readJSON(benchmarkFileName);
    let oldBenchmarks = undefined;
    if (oldBenchmarkFileName) {
        try {
            oldBenchmarks = readJSON(oldBenchmarkFileName);
        } catch (error) {
            console.log("Can not read comparison file. Continue without it.");
        }
    }
    // and create the message
    const message = createMessage(benchmarks, oldBenchmarks);
    // output it to the console for logging and debugging
    console.log(message);
    // the context does for example also include information
    // in the pull request or repository we are issued from

    const repo = context.repo;
    const pullRequestNumber = context.payload.pull_request?.number as number;
    // The Octokit is a helper, to interact with
    // the github REST interface.
    // You can look up the REST interface
    // here: https://octokit.github.io/rest.js/v18
    const octokit = github.getOctokit(githubToken);

    const response = await octokit.repos.compareCommits({
        base,
        head,
        owner: context.repo.owner,
        repo: context.repo.repo
    })
    // @ts-ignore
    const changedClasses = response.data.files.map(y => y.filename)
    console.log(changedClasses)
    const xml2js = require('xml2js');

    const xmlParser = new xml2js.Parser();
    const jp = require('jsonpath');

    class ClassCoverage {
        className: string;
        linePercent: number;
        branchPercent: number;

        constructor(className: string, linePercent: number, branchPercent: number) {
            this.className = className;
            this.linePercent = linePercent;
            this.branchPercent = branchPercent;
        }
    }

    fs.readFile("target/scala-2.13/coverage-report/cobertura.xml", "utf8", (readError, coverageData) => {
        xmlParser.parseStringPromise(coverageData)
            .then(function (result) {
                return jp
                    .nodes(result, '$.coverage..class', 7)
                    .flatMap(p => p.value)
                    .map(n => new ClassCoverage(n.$.name, Math.round(n.$['line-rate'] * 100), Math.round(n.$['branch-rate'] * 100)));
            })
            // .then(function (coverage) {
            //     console.dir(coverage)
            // })
            .catch(function (err) {
                // Failed
            });
    });

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

// Our main method: call the run() function and report any errors
run().catch((error) => core.setFailed("Workflow failed! " + error.message));
