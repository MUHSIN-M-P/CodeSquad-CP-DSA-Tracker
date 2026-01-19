import type {
  GraphQLUserResponse,
  GraphQLSubmissionsResponse,
  UserStats,
  Submission,
} from "../types";

const GRAPHQL_ENDPOINT = "https://leetcode.com/graphql";

export async function verifyLeetCodeUser(username: string): Promise<boolean> {
  const query = `
    query getUserProfile($username: String!) {
      matchedUser(username: $username) {
        username
        profile {
          realName
          userAvatar
        }
      }
    }
  `;

  try {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) return false;

    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { username: trimmedUsername },
      }),
    });

    const result = await response.json();
    return result.data?.matchedUser !== null;
  } catch (error) {
    if (error instanceof Error && !error.message.includes("NetworkError")) {
      console.error("Error verifying user:", error);
    }
    return false;
  }
}

export async function getUserStats(
  username: string,
  cachedStats?: UserStats | null
): Promise<UserStats | null> {
  const query = `
    query getUserProfile($username: String!) {
      matchedUser(username: $username) {
        username
        profile {
          realName
          userAvatar
          ranking
        }
        submitStats {
          acSubmissionNum {
            difficulty
            count
          }
        }
      }
    }
  `;

  try {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) return null;

    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { username: trimmedUsername },
      }),
    });

    const result: { data: GraphQLUserResponse } = await response.json();
    const userData = result.data?.matchedUser;

    if (!userData) return null;

    const acStats = userData.submitStats.acSubmissionNum;
    const total = acStats.find((s) => s.difficulty === "All")?.count || 0;

    // Check if user solved any problem today
    const recentSubmissions = await getRecentSubmissions(username, 20);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayTimestamp = Math.floor(todayStart.getTime() / 1000);
    const todayDateMidnight = todayStart.getTime();

    let solvedToday = false;
    let todayCount = 0;
    let yesterdayTotal: number | undefined;
    let yesterdayDate: number | undefined;

    // Calculate midnights
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayDateMidnight = yesterdayStart.getTime();

    // Determine the baseline for "Total count at end of yesterday"
    if (cachedStats) {
      const lastFetchedDate = new Date(cachedStats.lastFetched || 0);
      lastFetchedDate.setHours(0, 0, 0, 0);
      const lastFetchedMidnight = lastFetchedDate.getTime();

      if (lastFetchedMidnight === todayDateMidnight) {
        // Case 1: Cache is already from Today (e.g., 2nd fetch today)
        // Reuse the previously established baseline
        if (cachedStats.yesterdayDate === yesterdayDateMidnight) {
          yesterdayTotal = cachedStats.yesterdayTotal;
          yesterdayDate = cachedStats.yesterdayDate;
        }
      } else if (lastFetchedMidnight === yesterdayDateMidnight) {
        // Case 2: Cache is from Yesterday (first fetch today)
        // The total from yesterday IS our baseline
        yesterdayTotal = cachedStats.total;
        yesterdayDate = yesterdayDateMidnight;
      }
      // Case 3: Cache is older than yesterday -> No valid baseline for privacy check
    }

    if (recentSubmissions.length > 0) {
      // Normal case: submissions are public
      const todaySubmissions = recentSubmissions.filter(
        (sub) => sub.timestamp >= todayTimestamp
      );
      solvedToday = todaySubmissions.length > 0;
      todayCount = todaySubmissions.length;
    } else if (yesterdayTotal !== undefined) {
      // Privacy fallback: submissions are hidden
      // Compare current total against established yesterday baseline
      if (total > yesterdayTotal) {
        solvedToday = true;
        todayCount = total - yesterdayTotal;
      }
    }

    return {
      // Use the originally requested username to match with Friend.username
      username: username.trim(),
      avatar: userData.profile.userAvatar,
      ranking: userData.profile.ranking,
      total,
      easy: acStats.find((s) => s.difficulty === "Easy")?.count || 0,
      medium: acStats.find((s) => s.difficulty === "Medium")?.count || 0,
      hard: acStats.find((s) => s.difficulty === "Hard")?.count || 0,
      platform: "leetcode" as const,
      solvedToday,
      todayCount,
      yesterdayTotal,
      yesterdayDate,
    };
  } catch (error) {
    // Don't spam console for every failed fetch
    if (error instanceof Error && !error.message.includes("NetworkError")) {
      console.error("Error fetching user stats:", error);
    }
    return null;
  }
}

export async function getRecentSubmissions(
  username: string,
  limit: number = 20
): Promise<Submission[]> {
  const query = `
    query recentSubmissions($username: String!, $limit: Int!) {
      recentAcSubmissionList(username: $username, limit: $limit) {
        title
        titleSlug
        timestamp
      }
    }
  `;

  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { username, limit },
      }),
    });

    const result: { data: GraphQLSubmissionsResponse } =
      await response.json();
    const submissions = result.data?.recentAcSubmissionList || [];
    return submissions.map((s) => ({ ...s, username }));
  } catch (error) {
    // Don't spam console for every failed fetch
    if (error instanceof Error && !error.message.includes("NetworkError")) {
      console.error("Error fetching submissions:", error);
    }
    return [];
  }
}
