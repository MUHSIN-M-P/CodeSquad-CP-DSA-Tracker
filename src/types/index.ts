// Chrome Extension API Types

export type Platform = "leetcode" | "codeforces";

export interface UserStats {
    username: string;
    platform: Platform;
    avatar?: string;
    ranking?: number;
    rating?: number; // For Codeforces
    total: number;
    easy?: number; // LeetCode specific
    medium?: number; // LeetCode specific
    hard?: number; // LeetCode specific
    maxRating?: number; // Codeforces specific
    country?: string; // Codeforces specific
    solvedToday?: boolean; // Whether user solved any problem today
    todayCount?: number; // Number of problems solved today
    cachedAt?: number; // Timestamp when data was cached
    lastFetched?: number; // Timestamp of last successful fetch
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
    platform: Platform;
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

// Codeforces API Types
export interface CodeforcesUser {
    handle: string;
    rating?: number;
    maxRating?: number;
    rank?: string;
    maxRank?: string;
    avatar: string;
    titlePhoto: string;
    country?: string;
}

export interface CodeforcesSubmission {
    id: number;
    contestId: number;
    creationTimeSeconds: number;
    problem: {
        contestId: number;
        index: string;
        name: string;
        rating?: number;
    };
    verdict: string;
}

export interface CodeforcesUserStatus {
    result: CodeforcesSubmission[];
}

export interface Friend {
    username: string;
    platform: Platform;
}
