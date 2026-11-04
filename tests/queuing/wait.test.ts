import { expect, it } from "vitest";
import {
  getCurrentWaitDuration,
  getWaitDuration,
  getWaitPriority,
  getWaitTime,
} from "../../app/queuing/utils";
import { Player } from "../../app/queuing/types";
const player: Player = {
  id: "p",
  name: "Player",
  level: "Beginner",
  gender: "Male",
  joinedAt: 1000,
  lastMatchEndTime: 1000,
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  firstMatchTime: null,
  partners: {},
  isActive: true,
  isPlaying: false,
  totalIdleTime: 0,
};
it("uses the original 15 and 20 minute warning boundaries", () => {
  expect([899, 900, 1199, 1200].map(getWaitPriority)).toEqual([
    "normal",
    "warning",
    "warning",
    "urgent",
  ]);
});
it("shows first-game waits while keeping accumulated idle rules intact", () => {
  expect(getCurrentWaitDuration(player, 1000, 1201000)).toBe(1200);
  expect(getWaitTime(player, 1000, 1201000)).toBe("20m 0s");
  expect(getWaitDuration(player, 1000, 1201000)).toBe(0);
});
it("does not flag playing, away, unstarted sessions or negative waits", () => {
  expect(
    getCurrentWaitDuration({ ...player, isPlaying: true }, 1000, 1201000),
  ).toBe(0);
  expect(
    getCurrentWaitDuration({ ...player, isActive: false }, 1000, 1201000),
  ).toBe(0);
  expect(getCurrentWaitDuration(player, null, 1201000)).toBe(0);
  expect(getCurrentWaitDuration(player, 2000, 1000)).toBe(0);
});

it("starts a late arrival’s wait from check-in rather than roster preparation", () => {
  const absent = { ...player, checkedInAt: null };
  expect(getCurrentWaitDuration(absent, 1000, 2000000)).toBe(0);
  expect(getWaitTime(absent, 1000, 2000000)).toBe("—");
  const arrived = {
    ...player,
    checkedInAt: 1900000,
    lastMatchEndTime: 1900000,
  };
  expect(getCurrentWaitDuration(arrived, 1000, 1960000)).toBe(60);
});

it("does not count time before a returning player checks in again", () => {
  const returning = { ...player, gamesPlayed: 1, checkedInAt: 1900000 };
  expect(getWaitDuration(returning, 1000, 1960000)).toBe(60);
});
