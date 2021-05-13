export class ClassCoverage {
    className: string;
    currentPR: Coverage;
    master: Coverage;

    constructor(className: string, currentPR: Coverage, master: Coverage) {
        this.className = className;
        this.currentPR = currentPR;
        this.master = master;
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