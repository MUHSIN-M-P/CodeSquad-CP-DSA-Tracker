import type {
    CodeforcesUser,
    CodeforcesSubmission,
    UserStats,
    Submission,
} from "../types";

const CF_API_ENDPOINT = "https://codeforces.com/api";

// Helper function to safely parse JSON response
async function safeJsonParse(response: Response) {
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch (error) {
        // Check if it's an HTML error response (rate limiting)
        if (text.includes("<html>") || text.includes("<!DOCTYPE")) {
            throw new Error("RATE_LIMIT");
        }
        console.error(
            "Failed to parse JSON. Response:",
            text.substring(0, 200)
        );
        throw new Error(
            "Codeforces API returned invalid response. Please try again later."
        );
    }
}

// Add delay between requests to avoid rate limiting
function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retry with exponential backoff
async function fetchWithRetry(
    url: string,
    maxRetries: number = 3
): Promise<Response> {
    for (let i = 0; i < maxRetries; i++) {
        try {
            await delay(Math.pow(2, i) * 1000); // 1s, 2s, 4s
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response;
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            console.log(`Retry ${i + 1}/${maxRetries} for ${url}`);
        }
    }
    throw new Error("Max retries exceeded");
}

export async function verifyCodeforcesUser(handle: string): Promise<boolean> {
    try {
        const response = await fetchWithRetry(
            `${CF_API_ENDPOINT}/user.info?handles=${handle}`,
            2
        );

        const result = await safeJsonParse(response);
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
        // Fetch sequentially to avoid rate limiting
        const userResponse = await fetchWithRetry(
            `${CF_API_ENDPOINT}/user.info?handles=${handle}`
        );
        const userData = await safeJsonParse(userResponse);

        await delay(1000); // Wait between requests

        const submissionsResponse = await fetchWithRetry(
            `${CF_API_ENDPOINT}/user.status?handle=${handle}&from=1&count=10000`
        );
        const submissionsData = await safeJsonParse(submissionsResponse);

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
        const response = await fetchWithRetry(
            `${CF_API_ENDPOINT}/user.status?handle=${handle}&from=1&count=${count}`
        );

        const result = await safeJsonParse(response);

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
        await delay(500); // Add delay to avoid rate limiting

        const response = await fetch(
            `${CF_API_ENDPOINT}/user.info?handles=${handle}`
        );

        if (!response.ok) {
            return null;
        }

        const result = await safeJsonParse(response);

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
