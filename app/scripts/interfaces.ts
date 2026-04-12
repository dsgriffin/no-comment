export type CommentDisplayMode = "collapse" | "hidden";

export interface UserSettings {
  blockAllComments: boolean;
  display: CommentDisplayMode;
  allowlist: string[];
  blocklist: string[];
}

export interface PageState {
  blockableContent: boolean;
  commentsLength: number;
  isBlocking: boolean;
}
