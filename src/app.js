import {
  loadState,
  saveState,
  getWeekId,
  getWeekLabel,
  generateWeekAssignments,
  markAssignmentDone,
  getWeekCompletions,
  calculateLoadSummary,
  buildHeatmapData,
  formatDateTime,
} from "./choso-core.js";

const state = loadState();
let selectedWeekOffset = 0;
let selectedAssignee = "all";

const weekTitleEl = document.getElementById("week-title");
const weekTaskCountEl = document.getElementById("week-task-count");
const assignmentListEl = document.getElementById("assignment-list");
const loadSummaryEl = document.getElementById("load-summary");
const heatmapEl = document.getElementById("heatmap");
const historyBodyEl = document.getElementById("history-body");
const previousWeekButton = document.getElementById("previous-week");
const nextWeekButton = document.getElementById("next-week");
const resetDataButton = document.getElementById("reset-data");
const assigneeFilterEl = document.getElementById("assignee-filter");

function initializeAssigneeFilter() {
  assigneeFilterEl.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "Todas";
  assigneeFilterEl.appendChild(allOption);

  state.members.forEach((member) => {
    const option = document.createElement("option");
    option.value = member.id;
    option.textContent = member.name;
    assigneeFilterEl.appendChild(option);
  });

  assigneeFilterEl.value = selectedAssignee;
}

function getCompletedAssignmentKeys(weekId) {
  const completions = getWeekCompletions(state, weekId);
  return new Set(completions.map((item) => `${item.assignmentId}::${item.completedBy}`));
}

function renderAssignments() {
  const weekId = getWeekId(selectedWeekOffset);
  const weekLabel = getWeekLabel(weekId);
  const allAssignments = generateWeekAssignments(selectedWeekOffset, state);
  const assignments =
    selectedAssignee === "all"
      ? allAssignments
      : allAssignments.filter((assignment) => assignment.assignedTo === selectedAssignee);
  const doneKeys = getCompletedAssignmentKeys(weekId);

  weekTitleEl.textContent = `Semana ${weekLabel}`;
  weekTaskCountEl.textContent =
    selectedAssignee === "all"
      ? `${assignments.length} tareas programadas`
      : `${assignments.length} tareas para ${
          state.members.find((member) => member.id === selectedAssignee)?.name ?? "persona"
        }`;
  assignmentListEl.innerHTML = "";

  if (!assignments.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No hay tareas para esta semana.";
    assignmentListEl.appendChild(empty);
    return;
  }

  assignments.forEach((assignment) => {
    const isDone = doneKeys.has(`${assignment.assignmentId}::${assignment.assignedTo}`);
    const item = document.createElement("article");
    item.className = `card ${isDone ? "done" : ""}`;

    const title = document.createElement("h3");
    title.textContent = assignment.taskName;

    const details = document.createElement("p");
    details.className = "card-description";
    details.textContent = assignment.taskDescription;

    const meta = document.createElement("p");
    meta.className = "card-meta";
    meta.textContent = `Le toca: ${assignment.assignedToName} · Peso: ${assignment.points}`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn-primary";
    button.disabled = isDone;
    button.textContent = isDone ? "Completada" : "Marcar como hecha";
    button.addEventListener("click", () => {
      const updated = markAssignmentDone(state, {
        weekId,
        assignmentId: assignment.assignmentId,
        taskId: assignment.taskId,
        taskName: assignment.taskName,
        points: assignment.points,
        completedBy: assignment.assignedTo,
        completedByName: assignment.assignedToName,
      });
      if (updated !== state) {
        state.history = updated.history;
        saveState(state);
        renderAll();
      }
    });

    item.append(title, details, meta, button);
    assignmentListEl.appendChild(item);
  });
}

function renderLoadSummary() {
  const summary = calculateLoadSummary(state, 8);
  loadSummaryEl.innerHTML = "";
  if (summary.totalPoints === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Sin actividad en las últimas 8 semanas.";
    loadSummaryEl.appendChild(empty);
    return;
  }
  summary.byMember.forEach((item) => {
    const row = document.createElement("div");
    row.className = "summary-row";
    row.innerHTML = `
      <span>${item.memberName}</span>
      <span>${item.points} pts · ${item.percentage}%</span>
    `;
    loadSummaryEl.appendChild(row);
  });
}

function renderHeatmap() {
  const data = buildHeatmapData(state, 8);
  const maxPoints = Math.max(
    1,
    ...data.flatMap((member) => member.pointsByWeek.map((point) => point.points)),
  );
  heatmapEl.innerHTML = "";
  data.forEach((member) => {
    const memberRow = document.createElement("div");
    memberRow.className = "heatmap-row";

    const label = document.createElement("span");
    label.className = "heatmap-label";
    label.textContent = member.memberName;

    const cells = document.createElement("div");
    cells.className = "heatmap-cells";

    member.pointsByWeek.forEach((weekPoint) => {
      const cell = document.createElement("div");
      const intensity = weekPoint.points / maxPoints;
      const alpha = weekPoint.points === 0 ? 0.08 : 0.2 + intensity * 0.8;
      cell.className = "heatmap-cell";
      cell.style.backgroundColor = `rgba(13, 110, 253, ${alpha.toFixed(2)})`;
      cell.title = `${member.memberName} · ${weekPoint.weekId} · ${weekPoint.points} pts`;
      cells.appendChild(cell);
    });

    memberRow.append(label, cells);
    heatmapEl.appendChild(memberRow);
  });
}

function renderHistory() {
  historyBodyEl.innerHTML = "";
  const ordered = [...state.history].sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  if (!ordered.length) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="4" class="empty-state">Aún no hay tareas completadas.</td>`;
    historyBodyEl.appendChild(row);
    return;
  }

  ordered.slice(0, 40).forEach((entry) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${entry.weekId}</td>
      <td>${entry.taskName}</td>
      <td>${entry.completedByName}</td>
      <td>${formatDateTime(entry.completedAt)}</td>
    `;
    historyBodyEl.appendChild(row);
  });
}

function renderAll() {
  renderAssignments();
  renderLoadSummary();
  renderHeatmap();
  renderHistory();
}

previousWeekButton.addEventListener("click", () => {
  selectedWeekOffset -= 1;
  renderAssignments();
});

nextWeekButton.addEventListener("click", () => {
  selectedWeekOffset += 1;
  renderAssignments();
});

assigneeFilterEl.addEventListener("change", () => {
  selectedAssignee = assigneeFilterEl.value;
  renderAssignments();
});

resetDataButton.addEventListener("click", () => {
  const answer = window.confirm("¿Seguro que quieres borrar el histórico?");
  if (!answer) {
    return;
  }
  state.history = [];
  saveState(state);
  renderAll();
});

initializeAssigneeFilter();
renderAll();
