export type SeRow = {
    seName: string;
    tsName: string;
    count: number;
    osaMtd: number;
    targetOsa: number;
    osaPct: number;
    sellinMtd: number;
    targetSellin: number;
    sellinPct: number;
    bioGt1: number;
    biometrikPct: number;
    incremental: number;
    visitedRetailers: number;
    transactedRetailers: number;
    untransactedRetailers: number;
};

export type Retailer = {
    retailerName: string;
    seName: string;
    tsName: string;
    type: string;
    qr: string;
    sellinLmtd: number;
    osaLmtd: number;
    sellinMtd: number;
    osaMtd: number;
    bioLmtd: number;
    bioMtd: number;
    incremental: number;
    visit: number;
};

export type Totals = {
    osaMtd: number;
    targetOsa: number;
    osaPct: number;
    sellinMtd: number;
    targetSellin: number;
    sellinPct: number;
    biometrikCount: number;
    biometrikPct: number;
    incremental: number;
    totalRetailers: number;
    visitedRetailers: number;
    transactedRetailers: number;
    untransactedRetailers: number;
};

export type DashboardData = {
    generatedAt?: string;
    source?: string;
    totals: Totals;
    seList: SeRow[];
    retailers: Retailer[];
};
