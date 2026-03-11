import { randomUUID, randomBytes, scrypt } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const LESSON_WORD_CHUNK = 10;

const TEST_ADMIN_EMAIL = (process.env.TEST_ADMIN_EMAIL || 'qa-admin-f8n2x7r1@sonus.test')
  .trim()
  .toLowerCase();
const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'password1';
const TEST_ADMIN_FIRST_NAME = process.env.TEST_ADMIN_FIRST_NAME || 'QA';
const TEST_ADMIN_LAST_NAME = process.env.TEST_ADMIN_LAST_NAME || 'Admin';

const BAND_DATA_FILE = {
  n5: 'n5.json',
  n4: 'n4.json',
  n3: 'n3.json',
  n2: 'n2.json',
  n1: 'n1.json',
};

const SCRYPT_N = 1 << 15;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 32;

function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function scryptAsync(password, salt, keyLen, opts) {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      keyLen,
      {
        ...opts,
        maxmem: 128 * 1024 * 1024,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derivedKey);
      }
    );
  });
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return ['scrypt', SCRYPT_N, SCRYPT_R, SCRYPT_P, b64url(salt), b64url(derived)].join('$');
}

function isCoreUnit(unitId) {
  if (!unitId) return false;
  if (/listening$/i.test(unitId) || /speaking$/i.test(unitId)) return false;
  if (/^checkpoint-/i.test(unitId)) return false;
  if (/^practice/i.test(unitId)) return false;
  return true;
}

function normalizeUnits(units) {
  if (Array.isArray(units)) {
    return units
      .map((unit) => ({ id: unit?.id, words: Array.isArray(unit?.words) ? unit.words : [] }))
      .filter((unit) => typeof unit.id === 'string' && unit.id.length > 0);
  }

  if (!units || typeof units !== 'object') return [];
  return Object.entries(units)
    .map(([id, value]) => ({
      id,
      words: Array.isArray(value?.words) ? value.words : [],
    }))
    .filter((unit) => typeof unit.id === 'string' && unit.id.length > 0);
}

function countApplySentenceWords(words) {
  return words.filter(
    (word) =>
      typeof word?.example?.ja === 'string' &&
      word.example.ja.trim().length > 0 &&
      typeof word?.example?.en === 'string' &&
      word.example.en.trim().length > 0
  ).length;
}

async function loadBandJson(fileName) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const filePath = path.resolve(__dirname, '../../sonus-react/public/data/ja', fileName);
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function buildCompletionEvents() {
  const events = [];
  const now = Date.now();
  let cursor = now - 10 * 24 * 60 * 60 * 1000;

  for (const bandId of Object.keys(BAND_DATA_FILE)) {
    const fileName = BAND_DATA_FILE[bandId];
    const bandJson = await loadBandJson(fileName);
    if (!bandJson) continue;
    const units = normalizeUnits(bandJson?.units);

    for (const unit of units) {
      if (!isCoreUnit(unit.id)) continue;
      const totalWords = unit.words.length;
      const lessonsCount = Math.ceil(totalWords / LESSON_WORD_CHUNK);
      if (lessonsCount <= 0) continue;

      for (let lessonIndex = 0; lessonIndex < lessonsCount; lessonIndex += 1) {
        cursor += 30_000;
        events.push({
          eventType: 'lesson_completed',
          streakDelta: 0,
          payloadJson: {
            bandId,
            unitId: unit.id,
            lessonIndex,
            introViewed: true,
            quizScore: 100,
            speakScore: 100,
            speakAllCorrect: true,
            completed: true,
            mastered: true,
          },
          createdAt: new Date(cursor),
        });
      }

      const applySentenceCount = countApplySentenceWords(unit.words);
      if (applySentenceCount > 0) {
        cursor += 30_000;
        events.push({
          eventType: 'apply_completed',
          streakDelta: 0,
          payloadJson: {
            bandId,
            unitId: unit.id,
            lessonIndex: lessonsCount,
            introViewed: true,
            quizScore: 100,
            speakScore: 100,
            speakAllCorrect: true,
            completed: true,
            mastered: true,
          },
          createdAt: new Date(cursor),
        });
      }
    }
  }

  return events;
}

async function main() {
  const passwordHash = await hashPassword(TEST_ADMIN_PASSWORD);
  const displayName = `${TEST_ADMIN_FIRST_NAME} ${TEST_ADMIN_LAST_NAME}`.trim();
  const existing = await prisma.localAuthCredential.findUnique({
    where: { email: TEST_ADMIN_EMAIL },
    select: { userId: true },
  });
  const userId = existing?.userId || randomUUID();

  const completionEvents = await buildCompletionEvents();

  await prisma.$transaction(async (tx) => {
    await tx.profile.upsert({
      where: { userId },
      update: {
        email: TEST_ADMIN_EMAIL,
        displayName,
        targetLanguage: 'ja',
        onboardingComplete: true,
      },
      create: {
        userId,
        email: TEST_ADMIN_EMAIL,
        displayName,
        targetLanguage: 'ja',
        onboardingComplete: true,
      },
    });

    await tx.localAuthCredential.upsert({
      where: { email: TEST_ADMIN_EMAIL },
      update: {
        passwordHash,
        userId,
      },
      create: {
        userId,
        email: TEST_ADMIN_EMAIL,
        passwordHash,
      },
    });

    await tx.refreshSession.deleteMany({ where: { userId } });
    await tx.progressEvent.deleteMany({ where: { userId } });
    await tx.userProgress.deleteMany({ where: { userId } });

    await tx.userProgress.create({
      data: {
        userId,
        streak: 30,
        lastActiveDate: new Date(),
        currentBandId: 'n5',
        currentUnitId: null,
        currentLessonIdx: null,
      },
    });

    for (const event of completionEvents) {
      await tx.progressEvent.create({
        data: {
          userId,
          eventType: event.eventType,
          streakDelta: event.streakDelta,
          payloadJson: event.payloadJson,
          createdAt: event.createdAt,
        },
      });
    }
  });

  // eslint-disable-next-line no-console
  console.log('Test admin account seeded successfully.');
  // eslint-disable-next-line no-console
  console.log(`Email: ${TEST_ADMIN_EMAIL}`);
  // eslint-disable-next-line no-console
  console.log(`Password: ${TEST_ADMIN_PASSWORD}`);
  // eslint-disable-next-line no-console
  console.log(
    'This account is intended for QA only. Set TEST_ADMIN_EMAIL/TEST_ADMIN_PASSWORD to override defaults.'
  );
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
