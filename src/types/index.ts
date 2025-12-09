// Chrome Extension API Types

export interface UserStats {
    username: string;
    avatar?: string;
    ranking?: number;
    total: number;
    easy: number;
    medium: number;
    hard: number;
}

export interface FoundUser {
    page: number;
    actualName: string;
    profileUrl: string;
}

export interface SearchRequest {
    action: "startSearch";
    startPage: number;
    endPage?: number;
    startRank: number;
    endRank?: number;
    usernames: string;
    pageSize: number;
}

export interface SearchResponse {
    status: "started" | "error";
    message?: string;
}

export interface SearchState {
    usernames: string[];
    foundUsers: Record<string, FoundUser>;
    startRank: number;
    endRank?: number;
    startPage: number;
    endPage: number;
    targetPage: number;
    pageSize: number;
    resumeSearch: boolean;
}

export interface Submission {
    title: string;
    titleSlug: string;
    timestamp: number;
    username?: string;
}

export interface DailyStats {
    username: string;
    count: number;
    submissions: Submission[];
}

export interface GraphQLUserResponse {
    matchedUser: {
        username: string;
        profile: {
            realName?: string;
            userAvatar: string;
            ranking?: number;
        };
        submitStats: {
            acSubmissionNum: {
                difficulty: string;
                count: number;
            }[];
        };
    } | null;
}

export interface GraphQLSubmissionsResponse {
    recentAcSubmissionList: {
        title: string;
        titleSlug: string;
        timestamp: number;
    }[];
}
