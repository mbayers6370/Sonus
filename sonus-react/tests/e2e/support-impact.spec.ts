import { expect, test } from '@playwright/test';

test('renders support impact outcomes metrics when admin session is valid', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sonus.support_admin.token', 'test-support-token');
  });

  await page.route('**/v1/admin/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ username: 'qa-admin-f8n2x7r1@sonus.test' }),
    });
  });

  await page.route('**/v1/admin/metrics/impact-outcomes?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        generatedAt: new Date().toISOString(),
        windowDays: 7,
        sessionWindowMinutes: 30,
        definitions: {
          cohorts: 'Signup cohorts grouped by week.',
          timeToValue: 'Median days from signup to first lesson completion.',
          learningGain: 'Compares first vs second half.',
          consistency: 'Active-day frequency.',
          mastery: 'Mastery adoption among active users.',
          needsWorkBurden: 'Needs-work burden trend.',
          needsReview: 'Needs-review reset behavior.',
          perUserDistribution: 'Anonymized distribution.',
          riskCohorts: 'At-risk cohort view.',
        },
        cohorts: [
          {
            cohortWeek: '2026-03-09',
            signups: 8,
            eligibleD1: 8,
            retainedD1: 6,
            d1Pct: 75,
            eligibleD7: 5,
            retainedD7: 3,
            d7Pct: 60,
            eligibleD30: 2,
            retainedD30: 1,
            d30Pct: 50,
          },
        ],
        timeToValue: {
          sampleSize: 8,
          reachedLessonComplete: 4,
          reachedSpeakPass: 3,
          reachedMastery: 1,
          medianDaysToLessonComplete: 2.5,
          medianDaysToSpeakPass: 3.4,
          medianDaysToMastery: 8.8,
        },
        learningGain: {
          sample: {
            firstActiveUsers: 4,
            secondActiveUsers: 5,
          },
          firstHalf: {
            quizAttempts: 10,
            quizSessions: 5,
            quizSessionsCompleted: 3,
            quizAccuracyPct: 70,
            speakAttempts: 5,
            speakSessions: 3,
            speakSessionsCompleted: 2,
            speakPassPct: 40,
            lessonsCompleted: 4,
            lessonsPerActiveUser: 1,
          },
          secondHalf: {
            quizAttempts: 20,
            quizSessions: 8,
            quizSessionsCompleted: 6,
            quizAccuracyPct: 80,
            speakAttempts: 10,
            speakSessions: 5,
            speakSessionsCompleted: 4,
            speakPassPct: 80,
            lessonsCompleted: 9,
            lessonsPerActiveUser: 1.8,
          },
          deltaPct: {
            quizAccuracyPct: 14.29,
            speakPassPct: 100,
            lessonsPerActiveUser: 80,
          },
        },
        consistency: {
          activeUsers: 6,
          active3PlusDays: 4,
          active7PlusDays: 1,
          avgActiveDays: 3.9,
          streakDistribution: [{ bucket: '3-6', users: 3 }],
        },
        mastery: {
          activeUsers: 6,
          usersWithMastery: 2,
          usersWithMasteryInWindow: 1,
          masteryRatePct: 33.33,
          medianDaysToFirstMastery: 12,
        },
        needsWorkBurden: {
          activeUsers: 6,
          avgNeedsWorkPerActiveUser: 2.5,
          medianNeedsWorkPerActiveUser: 2,
          firstHalfMissesPerActiveUser: 1.2,
          secondHalfMissesPerActiveUser: 0.8,
          missesPerActiveUserDeltaPct: -33.33,
        },
        needsReview: {
          activeUsers: 6,
          usersWithNeedsReview: 2,
          totalNeedsReviewEvents: 4,
          totalLessonCompletions: 20,
          needsReviewEventsPer100Completions: 20,
          avgNeedsReviewEventsPerActiveUser: 0.67,
          medianNeedsReviewEventsPerActiveUser: 0,
          firstHalfNeedsReviewEventsPerActiveUser: 0.5,
          secondHalfNeedsReviewEventsPerActiveUser: 0.3,
          needsReviewEventsPerActiveUserDeltaPct: -40,
        },
        segmentation: {
          activeUsersByLanguage: [{ languageId: 'ja', activeUsers: 6 }],
        },
        perUserDistribution: {
          sampleSize: 6,
          metrics: {
            activeDays: { avg: 3.9, p50: 4, p75: 5, p90: 6 },
            lessonsCompleted: { avg: 4.2, p50: 4, p75: 5, p90: 7 },
            quizAccuracyPct: { avg: 78.5, p50: 80, p75: 90, p90: 95 },
            speakPassPct: { avg: 70, p50: 75, p75: 90, p90: 95 },
            needsWorkCount: { avg: 2.5, p50: 2, p75: 3, p90: 4 },
            needsReviewResets: { avg: 0.7, p50: 0, p75: 1, p90: 2 },
          },
        },
        riskCohorts: [],
      }),
    });
  });

  await page.goto('/internal/support/metrics/impact-outcomes', {
    waitUntil: 'networkidle',
  });

  await expect(page.getByRole('heading', { name: /impact & outcomes/i })).toBeVisible();
  const d7Card = page.locator('article', { hasText: 'Weighted D7 Retention' });
  await expect(d7Card).toBeVisible();
  await expect(d7Card.getByText('60%', { exact: true })).toBeVisible();
  await expect(page.getByText('Learning Gain (Window Half Comparison)')).toBeVisible();
});
