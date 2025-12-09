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
        const response = await fetch(GRAPHQL_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                query,
                variables: { username },
            }),
        });

        const result = await response.json();
        return result.data?.matchedUser !== null;
    } catch (error) {
        console.error("Error verifying user:", error);
        return false;
    }
}

export async function getUserStats(
    username: string
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
        const response = await fetch(GRAPHQL_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                query,
                variables: { username },
            }),
        });

        const result: { data: GraphQLUserResponse } = await response.json();
        const userData = result.data?.matchedUser;

        if (!userData) return null;

        const acStats = userData.submitStats.acSubmissionNum;
        const total = acStats.find((s) => s.difficulty === "All")?.count || 0;

        return {
            username: userData.username,
            avatar: userData.profile.userAvatar,
            ranking: userData.profile.ranking,
            total,
            easy: acStats.find((s) => s.difficulty === "Easy")?.count || 0,
            medium: acStats.find((s) => s.difficulty === "Medium")?.count || 0,
            hard: acStats.find((s) => s.difficulty === "Hard")?.count || 0,
        };
    } catch (error) {
        console.error("Error fetching user stats:", error);
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
        console.error("Error fetching submissions:", error);
        return [];
    }
}
