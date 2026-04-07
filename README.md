# chosoApp

Choso (home in canary islands) is a smart household management app designed to
eliminate resentment by balancing the "Mental Load" and physical labor between
partners or roommates.

## Features

- Weekly rotating assignment of home tasks.
- One-click completion tracking by assignee.
- Completion history with timestamps.
- Workload analytics for the last 8 weeks (points and percentages).
- Weekly heatmap to visualize cumulative load per person.

## Run locally

Requirements: Node.js 20+ and Python 3.

1. Run tests:
   - `npm test`
2. Start the local web server:
   - `npm start`
   - If port `4173` is busy, use a different one:
     - `PORT=4174 npm start`
3. Open:
   - `http://localhost:4173` (or the port you selected)
