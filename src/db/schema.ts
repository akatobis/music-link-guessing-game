import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const players = pgTable("players", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#FF2E88"),
  pin: text("pin"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
});

export const songs = pgTable("songs", {
  id: uuid("id").defaultRandom().primaryKey(),
  playerId: uuid("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(), // youtube | spotify | yandex
  providerId: text("provider_id").notNull(),
  albumId: text("album_id"),
  url: text("url").notNull(),
  embedUrl: text("embed_url").notNull(),
  title: text("title").notNull().default("Без названия"),
  artist: text("artist").notNull().default(""),
  thumbnail: text("thumbnail"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
});

/** Single-row table holding the shared online room state. */
export const gameState = pgTable("game_state", {
  id: text("id").primaryKey(), // always "main"
  status: text("status").notNull().default("lobby"), // lobby | countdown | playing | reveal | finished
  roundIndex: integer("round_index").notNull().default(0),
  totalRounds: integer("total_rounds").notNull().default(0),
  roundOrder: jsonb("round_order").$type<string[]>().notNull().default([]),
  phaseEndsAt: timestamp("phase_ends_at", { withTimezone: true, mode: "date" }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
});

export const liveAnswers = pgTable(
  "live_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    songId: uuid("song_id").notNull(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    guessedPlayerId: uuid("guessed_player_id"),
    correct: boolean("correct").notNull().default(false),
    points: integer("points").notNull().default(0),
    elapsedMs: integer("elapsed_ms").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("live_answers_song_player").on(t.songId, t.playerId)],
);

export const games = pgTable("games", {
  id: uuid("id").defaultRandom().primaryKey(),
  totalRounds: integer("total_rounds").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
});

export const gameRounds = pgTable("game_rounds", {
  id: uuid("id").defaultRandom().primaryKey(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  songId: uuid("song_id"),
  songTitle: text("song_title").notNull().default(""),
  songArtist: text("song_artist").notNull().default(""),
  provider: text("provider").notNull().default("youtube"),
  ownerId: uuid("owner_id"),
  ownerName: text("owner_name").notNull().default(""),
  ownerColor: text("owner_color").notNull().default("#FF2E88"),
  guesserId: uuid("guesser_id"),
  guesserName: text("guesser_name").notNull().default(""),
  guesserColor: text("guesser_color").notNull().default("#22D3EE"),
  guessedId: uuid("guessed_id"),
  guessedName: text("guessed_name").notNull().default(""),
  points: integer("points").notNull().default(0),
  correct: boolean("correct").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
});

export type PlayerRow = typeof players.$inferSelect;
export type SongRow = typeof songs.$inferSelect;
export type GameStateRow = typeof gameState.$inferSelect;
export type LiveAnswerRow = typeof liveAnswers.$inferSelect;
export type GameRow = typeof games.$inferSelect;
export type GameRoundRow = typeof gameRounds.$inferSelect;
