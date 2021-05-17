export class SummaryReport{
    overall: Coverage;
    classes: Map<string, ClassCoverage>;

    constructor(overall: Coverage, classes: Map<string, ClassCoverage>){
        this.classes = classes;
        this.overall = overall;
    }
}

export class ClassCoverage {
    className: string;
    coverage: Coverage;

    constructor(className: string, currentPR: Coverage) {
        this.className = className;
        this.coverage = currentPR;
    }
}

export class Coverage {
    linePercent: number;
    branchPercent: number;

    constructor(linePercent: number, branchPercent: number) {
        this.linePercent = linePercent;
        this.branchPercent = branchPercent;
    }
}