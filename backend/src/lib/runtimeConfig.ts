export interface RuntimeConfigIssues {
    missing: string[];
    invalid: string[];
}

export function getRuntimeConfigIssues(environment: NodeJS.ProcessEnv = process.env): RuntimeConfigIssues {
    const missing = ['DATABASE_URL', 'JWT_SECRET'].filter((key) => !environment[key]);
    const invalid =
        environment.NODE_ENV === 'production' &&
        environment.JWT_SECRET &&
        environment.JWT_SECRET.trim().length < 32
            ? ['JWT_SECRET']
            : [];

    return { missing, invalid };
}
