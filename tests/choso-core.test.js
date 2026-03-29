import test from "node:test";
import assert from "node:assert/strict";
import {
  getDefaultState,
  getWeekId,
  generateWeekAssignments,
  markAssignmentDone,
  calculateLoadSummary,
  buildHeatmapData,
} from "../src/choso-core.js";

test("generateWeekAssignments rotates who starts each week", () => {
  const state = getDefaultState();
  const week0 = generateWeekAssignments(0, state);
  const week1 = generateWeekAssignments(1, state);

  assert.ok(week0.length > 0);
  assert.ok(week1.length > 0);
  assert.equal(week0[0].assignedTo, "helena");
  assert.equal(week1[0].assignedTo, "abri");
});

test("markAssignmentDone avoids duplicate completion for same assignee", () => {
  const state = getDefaultState();
  const weekId = getWeekId(0, new Date("2026-01-05T12:00:00Z"));
  const assignment = generateWeekAssignments(0, state)[0];

  const withOne = markAssignmentDone(state, {
    weekId,
    assignmentId: assignment.assignmentId,
    taskId: assignment.taskId,
    taskName: assignment.taskName,
    points: assignment.points,
    completedBy: assignment.assignedTo,
    completedByName: assignment.assignedToName,
  });
  const withTwo = markAssignmentDone(withOne, {
    weekId,
    assignmentId: assignment.assignmentId,
    taskId: assignment.taskId,
    taskName: assignment.taskName,
    points: assignment.points,
    completedBy: assignment.assignedTo,
    completedByName: assignment.assignedToName,
  });

  assert.equal(withOne.history.length, 1);
  assert.equal(withTwo.history.length, 1);
});

test("calculateLoadSummary aggregates points and percentages", () => {
  const state = getDefaultState();
  const weekId = getWeekId(0, new Date("2026-01-05T12:00:00Z"));
  const assignments = generateWeekAssignments(0, state);
  const helenaAssignment = assignments.find((item) => item.assignedTo === "helena");
  const abriAssignment = assignments.find((item) => item.assignedTo === "abri");

  let next = markAssignmentDone(state, {
    weekId,
    assignmentId: helenaAssignment.assignmentId,
    taskId: helenaAssignment.taskId,
    taskName: helenaAssignment.taskName,
    points: helenaAssignment.points,
    completedBy: helenaAssignment.assignedTo,
    completedByName: helenaAssignment.assignedToName,
  });
  next = markAssignmentDone(next, {
    weekId,
    assignmentId: abriAssignment.assignmentId,
    taskId: abriAssignment.taskId,
    taskName: abriAssignment.taskName,
    points: abriAssignment.points,
    completedBy: abriAssignment.assignedTo,
    completedByName: abriAssignment.assignedToName,
  });

  const summary = calculateLoadSummary(next, 8, new Date("2026-01-08T12:00:00Z"));
  assert.equal(summary.totalPoints, helenaAssignment.points + abriAssignment.points);
  assert.equal(summary.byMember.length, 2);
  assert.equal(summary.byMember.reduce((acc, item) => acc + item.percentage, 0), 100);
});

test("buildHeatmapData returns one cell per week", () => {
  const state = getDefaultState();
  const heatmap = buildHeatmapData(state, 8, new Date("2026-01-08T12:00:00Z"));

  assert.equal(heatmap.length, 2);
  assert.equal(heatmap[0].pointsByWeek.length, 8);
  assert.equal(heatmap[1].pointsByWeek.length, 8);
});
