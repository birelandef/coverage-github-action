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