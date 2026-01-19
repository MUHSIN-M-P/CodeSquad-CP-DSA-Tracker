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
            if (i > 0) {
                await delay(Math.pow(2, i) * 1000); // 1s, 2s, 4s
            }
            const response = await fetch(url);

            // Return the response as-is; callers decide how to handle non-OK.
            // This avoids throwing noisy `HTTP 400` errors for bad handles.
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
        const safeHandle = encodeURIComponent(handle.trim());
        if (!safeHandle) return false;

        const response = await fetchWithRetry(
            `${CF_API_ENDPOINT}/user.info?handles=${safeHandle}`,
            2
        );

        if (!response.ok || response.status === 400) {
            return false;
        }

        const result = await safeJsonParse(response);
        return result.status === "OK" && result.result.length > 0;
    } catch (error) {
        if (error instanceof Error && !error.message.includes("HTTP 400")) {
            console.error("Error verifying Codeforces user:", error);
        }
        return false;
    }
}

export async function getCodeforcesUserStats(
    handle: string
): Promise<UserStats | null> {
    try {
        const safeHandle = encodeURIComponent(handle.trim());
        if (!safeHandle) return null;

        const PAGE_SIZE = 10000;
        const MAX_PAGES = 10; // safety cap to avoid excessive requests

        // Fetch sequentially to avoid rate limiting
        const userResponse = await fetchWithRetry(
            `${CF_API_ENDPOINT}/user.info?handles=${safeHandle}`,
            2
        );

        if (!userResponse.ok) {
            return null;
        }

        const userData = await safeJsonParse(userResponse);

        if (userData.status !== "OK" || userData.result.length === 0) {
            return null;
        }

        await delay(1000); // Wait between requests

        const user: CodeforcesUser = userData.result[0];

        // Count unique solved problems across *all* submissions by paging.
        // Codeforces limits `count` to 10000 per request, so users with >10k submissions
        // need multiple pages to get an accurate total.
        const solvedProblems = new Set<string>();
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayTimestamp = Math.floor(todayStart.getTime() / 1000);
        const todayProblems = new Set<string>();

        let from = 1;
        for (let page = 0; page < MAX_PAGES; page++) {
            const submissionsResponse = await fetchWithRetry(
                `${CF_API_ENDPOINT}/user.status?handle=${safeHandle}&from=${from}&count=${PAGE_SIZE}`,
                2
            );

            if (!submissionsResponse.ok) {
                break;
            }

            const submissionsData = await safeJsonParse(submissionsResponse);
            if (
                submissionsData.status !== "OK" ||
                !Array.isArray(submissionsData.result)
            ) {
                break;
            }

            const accepted = (
                submissionsData.result as CodeforcesSubmission[]
            ).filter((sub) => sub.verdict === "OK");

            accepted.forEach((sub) => {
                // Build a robust problem key that works for all problem types
                // Some problems use contestId, others use problemsetName
                const problem = sub.problem as any;
                const contestId = problem?.contestId ?? (sub as any)?.contestId;
                const problemsetName = problem?.problemsetName;
                const index = problem?.index ?? "unknown";
                const name = problem?.name ?? "";

                // Use contestId if available, otherwise problemsetName, with name as additional disambiguator
                const prefix = contestId ?? problemsetName ?? "unknown";
                const problemKey = `${prefix}-${index}-${name}`;
                solvedProblems.add(problemKey);

                // Today's solves will be in the most recent page.
                if (page === 0 && sub.creationTimeSeconds >= todayTimestamp) {
                    todayProblems.add(problemKey);
                }
            });

            if (submissionsData.result.length < PAGE_SIZE) {
                break;
            }

            from += PAGE_SIZE;
            await delay(750);
        }

        const solvedToday = todayProblems.size > 0;
        const todayCount = todayProblems.size;

        return {
            // Keep the originally requested handle so we can match back to `Friend.username`
            username: handle.trim(),
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
        // Don't log HTTP 400 errors (user doesn't exist)
        if (error instanceof Error && !error.message.includes("HTTP 400")) {
            console.error("Error fetching Codeforces user stats:", error);
        }
        return null;
    }
}

export async function getCodeforcesRecentSubmissions(
    handle: string,
    count: number = 20
): Promise<Submission[]> {
    try {
        const safeHandle = encodeURIComponent(handle.trim());
        if (!safeHandle) return [];

        const response = await fetchWithRetry(
            `${CF_API_ENDPOINT}/user.status?handle=${safeHandle}&from=1&count=${count}`
        );

        if (!response.ok || response.status === 400) {
            return [];
        }

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
        if (error instanceof Error && !error.message.includes("HTTP 400")) {
            console.error("Error fetching Codeforces submissions:", error);
        }
        return [];
    }
}

export async function getCodeforcesUserRating(
    handle: string
): Promise<number | null> {
    try {
        const safeHandle = encodeURIComponent(handle.trim());
        if (!safeHandle) return null;

        await delay(500); // Add delay to avoid rate limiting

        const response = await fetch(
            `${CF_API_ENDPOINT}/user.info?handles=${safeHandle}`
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
        if (error instanceof Error && !error.message.includes("HTTP 400")) {
            console.error("Error fetching Codeforces rating:", error);
        }
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
