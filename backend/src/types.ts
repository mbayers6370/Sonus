export type AuthenticatedUser = {
  id: string;
  email: string | null;
  displayName: string | null;
};

export type { SharedLexeme, SharedWord, SharedUserProgress } from '../../shared/contracts.d.ts';
