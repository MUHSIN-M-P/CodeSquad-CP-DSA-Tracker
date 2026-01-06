import type {
    CodeforcesUser,
    CodeforcesSubmission,
    UserStats,
    Submission,
} from "../types";

const CF_API_ENDPOINT = "https://codeforces.com/api";

export async function verifyCodeforcesUser(handle: string): Promise<boolean> {
    try {
        const response = await fetch(
            `${CF_API_ENDPOINT}/user.info?handles=${handle}`
        );
        const result = await response.json();
        return result.status === "OK" && result.result.length > 0;
    } catch (error) {
        console.error("Error verifying Codeforces user:", error);
        return false;
    }
}

export async function getCodeforcesUserStats(
    handle: string
): Promise<UserStats | null> {
    try {
        const [userResponse, submissionsResponse] = await Promise.all([
            fetch(`${CF_API_ENDPOINT}/user.info?handles=${handle}`),
            fetch(
                `${CF_API_ENDPOINT}/user.status?handle=${handle}&from=1&count=10000`
            ),
        ]);

        const userData = await userResponse.json();
        const submissionsData = await submissionsResponse.json();

        if (userData.status !== "OK" || userData.result.length === 0) {
            return null;
        }

        const user: CodeforcesUser = userData.result[0];

        // Count unique solved problems
        const solvedProblems = new Set<string>();
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayTimestamp = Math.floor(todayStart.getTime() / 1000);
        const todayProblems = new Set<string>();

        if (submissionsData.status === "OK") {
            submissionsData.result
                .filter((sub: CodeforcesSubmission) => sub.verdict === "OK")
                .forEach((sub: CodeforcesSubmission) => {
                    const problemKey = `${sub.problem.contestId}-${sub.problem.index}`;
                    solvedProblems.add(problemKey);

                    // Check if solved today
                    if (sub.creationTimeSeconds >= todayTimestamp) {
                        todayProblems.add(problemKey);
                    }
                });
        }

        const solvedToday = todayProblems.size > 0;
        const todayCount = todayProblems.size;

        return {
            username: user.handle,
            platform: "codeforces" as const,
            avatar:
                user.titlePhoto ||
                `https://userpic.codeforces.org/no-title.jpg`,
            rating: user.rating,
            maxRating: user.maxRating,
            ranking: user.rating, // Use rating as ranking for sorting
            total: solvedProblems.size,
            country: user.country,
            solvedToday,
            todayCount,
        };
    } catch (error) {
        console.error("Error fetching Codeforces user stats:", error);
        return null;
    }
}

export async function getCodeforcesRecentSubmissions(
    handle: string,
    count: number = 20
): Promise<Submission[]> {
    try {
        const response = await fetch(
            `${CF_API_ENDPOINT}/user.status?handle=${handle}&from=1&count=${count}`
        );
        const result = await response.json();

        if (result.status !== "OK") {
            return [];
        }

        // Filter for accepted submissions and convert to our format
        return result.result
            .filter((sub: CodeforcesSubmission) => sub.verdict === "OK")
            .map((sub: CodeforcesSubmission) => ({
                title: sub.problem.name,
                titleSlug: `${sub.problem.contestId}-${sub.problem.index}`,
                timestamp: sub.creationTimeSeconds,
                username: handle,
            }));
    } catch (error) {
        console.error("Error fetching Codeforces submissions:", error);
        return [];
    }
}

export async function getCodeforcesUserRating(
    handle: string
): Promise<number | null> {
    try {
        const response = await fetch(
            `${CF_API_ENDPOINT}/user.info?handles=${handle}`
        );
        const result = await response.json();

        if (result.status === "OK" && result.result.length > 0) {
            return result.result[0].rating || 0;
        }
        return null;
    } catch (error) {
        console.error("Error fetching Codeforces rating:", error);
        return null;
    }
}

export function getCodeforcesRankColor(rating: number): string {
    if (rating >= 3000) return "#ff0000"; // Legendary Grandmaster
    if (rating >= 2600) return "#ff0000"; // International Grandmaster
    if (rating >= 2400) return "#ff8c00"; // Grandmaster
    if (rating >= 2300) return "#ff8c00"; // International Master
    if (rating >= 2100) return "#a0a"; // Master
    if (rating >= 1900) return "#a0a"; // Candidate Master
    if (rating >= 1600) return "#0000ff"; // Expert
    if (rating >= 1400) return "#03a89e"; // Specialist
    if (rating >= 1200) return "#008000"; // Pupil
    return "#808080"; // Newbie
}
