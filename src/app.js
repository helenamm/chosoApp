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
  getHeatmapColor,
  formatDateTime,
} from "./choso-core.js";

const state = loadState();
let selectedWeekOffset = 0;
let selectedAssignee = "all";
const selectedCompleterByAssignment = {};

const weekTitleEl = document.getElementById("week-title");
const weekTaskCountEl = document.getElementById("week-task-count");
const assignmentListEl = document.getElementById("assignment-list");
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
  const completions = getWeekCompletions(state, weekId);
  const membersById = new Map(state.members.map((member) => [member.id, member]));

  weekTitleEl.textContent = `Semana ${weekLabel}`;
  weekTaskCountEl.textContent =
    selectedAssignee === "all"
      ? `${assignments.length} tareas programadas para esta semana`
      : `${assignments.length} tareas para ${
          state.members.find((member) => member.id === selectedAssignee)?.name ?? "persona"
        } esta semana`;
  assignmentListEl.innerHTML = "";

  if (!assignments.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No hay tareas para esta semana.";
    assignmentListEl.appendChild(empty);
    return;
  }

  assignments.forEach((assignment) => {
    const assignmentCompletions = completions.filter(
      (entry) => entry.assignmentId === assignment.assignmentId,
    );
    const selectedCompleter =
      selectedCompleterByAssignment[assignment.assignmentId] || assignment.assignedTo;
    const isDoneForSelectedCompleter = doneKeys.has(
      `${assignment.assignmentId}::${selectedCompleter}`,
    );
    const item = document.createElement("article");
    item.className = `card ${assignmentCompletions.length > 0 ? "done" : ""}`;

    const title = document.createElement("h3");
    title.className = "card-title";
    title.textContent = `${assignment.taskIcon || "🧼"} ${assignment.taskName}`;

    const details = document.createElement("p");
    details.className = "card-description";
    details.textContent = assignment.taskDescription;

    const meta = document.createElement("p");
    meta.className = "card-meta";
    meta.textContent = `Le toca: ${assignment.assignedToName} · Peso: ${assignment.points}`;

    const actionRow = document.createElement("div");
    actionRow.className = "card-actions";

    const completerSelect = document.createElement("select");
    completerSelect.className = "card-completer";
    completerSelect.setAttribute("aria-label", "Persona que completó la tarea");

    state.members.forEach((member) => {
      const option = document.createElement("option");
      option.value = member.id;
      option.textContent = member.name;
      completerSelect.appendChild(option);
    });
    completerSelect.value = selectedCompleter;
    completerSelect.addEventListener("change", () => {
      selectedCompleterByAssignment[assignment.assignmentId] = completerSelect.value;
      renderAssignments();
    });

    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn-primary";
    button.disabled = isDoneForSelectedCompleter;
    button.textContent = isDoneForSelectedCompleter
      ? "Completada"
      : `Marcar (${membersById.get(selectedCompleter)?.name || "persona"})`;
    button.addEventListener("click", () => {
      const completerId = completerSelect.value;
      const completer = membersById.get(completerId);
      const updated = markAssignmentDone(state, {
        weekId,
        assignmentId: assignment.assignmentId,
        taskId: assignment.taskId,
        taskName: assignment.taskName,
        points: assignment.points,
        completedBy: completerId,
        completedByName: completer?.name || "Persona",
      });
      if (updated !== state) {
        state.history = updated.history;
        saveState(state);
        renderAll();
      }
    });

    actionRow.append(completerSelect, button);

    const completionInfo = document.createElement("p");
    completionInfo.className = "card-completion-info";
    completionInfo.textContent = assignmentCompletions.length
      ? `Registrada por: ${assignmentCompletions
          .map((entry) => entry.completedByName)
          .filter((value, index, array) => array.indexOf(value) === index)
          .join(", ")}`
      : "Sin registro aún.";

    item.append(title, details, meta, actionRow, completionInfo);
    assignmentListEl.appendChild(item);
  });
}

function renderHeatmap() {
  const data = buildHeatmapData(state, 8);
  const summary = calculateLoadSummary(state, 8);
  const summaryByMemberId = new Map(summary.byMember.map((item) => [item.memberId, item]));
  const allPoints = data.flatMap((member) => member.pointsByWeek.map((point) => point.points));
  const nonZeroPoints = allPoints.filter((value) => value > 0);
  const minNonZero = nonZeroPoints.length ? Math.min(...nonZeroPoints) : 1;
  const maxPoints = nonZeroPoints.length ? Math.max(...nonZeroPoints) : 1;
  heatmapEl.innerHTML = "";
  data.forEach((member) => {
    const memberRow = document.createElement("div");
    memberRow.className = "heatmap-row";

    const label = document.createElement("span");
    label.className = "heatmap-label";
    const memberSummary = summaryByMemberId.get(member.memberId);
    const labelName = document.createElement("span");
    labelName.className = "heatmap-name";
    labelName.textContent = member.memberName;
    const labelStats = document.createElement("span");
    labelStats.className = "heatmap-stats";
    labelStats.textContent = `${memberSummary?.points || 0} pts · ${memberSummary?.percentage || 0}%`;
    label.append(labelName, labelStats);

    const cells = document.createElement("div");
    cells.className = "heatmap-cells";

    member.pointsByWeek.forEach((weekPoint) => {
      const cell = document.createElement("div");
      cell.className = "heatmap-cell";
      cell.style.backgroundColor = getHeatmapColor(weekPoint.points, minNonZero, maxPoints);
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
