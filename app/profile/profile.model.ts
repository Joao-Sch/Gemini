export type UserProfileType = "user" | "admin";

export interface UserProfile {
  type: UserProfileType;
  displayName: string;
  avatarUrl: string;
}