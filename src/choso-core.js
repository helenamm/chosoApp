const TASK_DEFINITIONS = [
  {
    id: "bano_personal",
    name: "Limpiar baño personal",
    description: "Cada uno limpia su baño.",
    icon: "🛁",
    frequencyWeeks: 2,
    points: 2,
  },
  {
    id: "cuarto_personal",
    name: "Limpiar cuarto personal",
    description: "Cuarto, despacho y cuarto de invitados de cada uno.",
    icon: "🧹",
    frequencyWeeks: 2,
    points: 2,
  },
  {
    id: "dormitorio_fondo",
    name: "Dormitorio a fondo + ropa de cama",
    description: "Polvo, barrer, fregar y cambiar ropa de cama.",
    icon: "🛏️",
    frequencyWeeks: 1,
    points: 3,
  },
  {
    id: "colada",
    name: "Colada completa",
    description: "Lavadora, tender/recoger, doblar y guardar.",
    icon: "🧺",
    frequencyWeeks: 1,
    occurrencesPerCycle: 2,
    points: 2,
  },
  {
    id: "cocina_fondo",
    name: "Cocina a fondo",
    description: "Fuegos, encimeras, electrodomésticos pequeños, barrer y fregar.",
    icon: "🍳",
    frequencyWeeks: 2,
    points: 3,
  },
  {
    id: "salon_fondo",
    name: "Salón a fondo",
    description: "Recoger, polvo, barrer y fregar.",
    icon: "🛋️",
    frequencyWeeks: 1,
    points: 2,
  },
  {
    id: "pasillo_fondo",
    name: "Pasillo a fondo",
    description: "Polvo, barrer y fregar.",
    icon: "🚪",
    frequencyWeeks: 1,
    points: 1,
  },
];

const DEFAULT_MEMBERS = [
  { id: "helena", name: "Helena" },
  { id: "abri", name: "Abri" },
];

const STORAGE_KEY = "choso_state_v1";

function getMonday(date) {
  const value = new Date(date);
  const day = value.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  value.setDate(value.getDate() + diff);
  value.setHours(0, 0, 0, 0);
  return value;
}

function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function getWeekStartDate(weekOffset = 0, fromDate = new Date()) {
  const monday = getMonday(fromDate);
  return addDays(monday, weekOffset * 7);
}

function getWeekId(weekOffset = 0, fromDate = new Date()) {
  return toDateString(getWeekStartDate(weekOffset, fromDate));
}

function getWeekLabel(weekId) {
  const start = new Date(weekId);
  const end = addDays(start, 6);
  return `${start.toLocaleDateString("es-ES")} - ${end.toLocaleDateString("es-ES")}`;
}

function getDefaultState() {
  return {
    members: DEFAULT_MEMBERS,
    history: [],
  };
}

function loadState(storage = globalThis.localStorage) {
  if (!storage) {
    return getDefaultState();
  }
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    return getDefaultState();
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.history) || !Array.isArray(parsed.members)) {
      return getDefaultState();
    }
    return parsed;
  } catch {
    return getDefaultState();
  }
}

function saveState(state, storage = globalThis.localStorage) {
  if (!storage) {
    return;
  }
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function shouldTaskAppear(task, weekOffset) {
  return weekOffset % task.frequencyWeeks === 0;
}

function getAssignee(members, baseIndex, taskIndex, occurrenceIndex = 0) {
  const targetIndex = (baseIndex + taskIndex + occurrenceIndex) % members.length;
  return members[targetIndex];
}

function generateWeekAssignments(weekOffset = 0, state = getDefaultState()) {
  const members = state.members.length ? state.members : DEFAULT_MEMBERS;
  const baseIndex = ((weekOffset % members.length) + members.length) % members.length;

  const assignments = [];
  TASK_DEFINITIONS.forEach((task, taskIndex) => {
    if (!shouldTaskAppear(task, weekOffset)) {
      return;
    }
    const repeat = task.occurrencesPerCycle || 1;
    for (let occurrenceIndex = 0; occurrenceIndex < repeat; occurrenceIndex += 1) {
      const assignee = getAssignee(members, baseIndex, taskIndex, occurrenceIndex);
      assignments.push({
        assignmentId: `${task.id}_${weekOffset}_${occurrenceIndex}`,
        taskId: task.id,
        taskName: task.name,
        taskDescription: task.description,
        taskIcon: task.icon,
        points: task.points,
        occurrenceIndex,
        assignedTo: assignee.id,
        assignedToName: assignee.name,
      });
    }
  });
  return assignments;
}

function markAssignmentDone(state, payload) {
  const nextState = {
    ...state,
    history: [...state.history],
  };
  const weekId = payload.weekId;
  const existing = nextState.history.findIndex(
    (item) =>
      item.weekId === weekId &&
      item.assignmentId === payload.assignmentId &&
      item.completedBy === payload.completedBy,
  );
  if (existing >= 0) {
    return state;
  }
  nextState.history.push({
    weekId,
    assignmentId: payload.assignmentId,
    taskId: payload.taskId,
    taskName: payload.taskName,
    points: payload.points,
    completedBy: payload.completedBy,
    completedByName: payload.completedByName,
    completedAt: new Date().toISOString(),
  });
  return nextState;
}

function getWeekCompletions(state, weekId) {
  return state.history.filter((item) => item.weekId === weekId);
}

function getRecentWeekIds(weeks, fromDate = new Date()) {
  const ids = [];
  for (let i = 0; i < weeks; i += 1) {
    ids.push(getWeekId(-i, fromDate));
  }
  return ids;
}

function calculateLoadSummary(state, weeks = 8, fromDate = new Date()) {
  const weekIds = getRecentWeekIds(weeks, fromDate);
  const windowHistory = state.history.filter((item) => weekIds.includes(item.weekId));
  const total = windowHistory.reduce((acc, item) => acc + item.points, 0);
  const byMember = state.members.map((member) => {
    const points = windowHistory
      .filter((item) => item.completedBy === member.id)
      .reduce((acc, item) => acc + item.points, 0);
    const percentage = total === 0 ? 0 : Math.round((points / total) * 100);
    return {
      memberId: member.id,
      memberName: member.name,
      points,
      percentage,
    };
  });
  return {
    totalPoints: total,
    weeks,
    byMember,
  };
}

function buildHeatmapData(state, weeks = 8, fromDate = new Date()) {
  const weekIds = getRecentWeekIds(weeks, fromDate).reverse();
  return state.members.map((member) => {
    const pointsByWeek = weekIds.map((weekId) => {
      const points = state.history
        .filter((entry) => entry.weekId === weekId && entry.completedBy === member.id)
        .reduce((acc, item) => acc + item.points, 0);
      return { weekId, points };
    });
    return {
      memberId: member.id,
      memberName: member.name,
      pointsByWeek,
    };
  });
}

function formatDateTime(isoString) {
  return new Date(isoString).toLocaleString("es-ES");
}

export {
  TASK_DEFINITIONS,
  DEFAULT_MEMBERS,
  STORAGE_KEY,
  getWeekId,
  getWeekLabel,
  getDefaultState,
  loadState,
  saveState,
  generateWeekAssignments,
  markAssignmentDone,
  getWeekCompletions,
  calculateLoadSummary,
  buildHeatmapData,
  formatDateTime,
};
