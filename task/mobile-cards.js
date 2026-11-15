(function initTaskMobileCards() {
  "use strict";

  const MOBILE_QUERY = "(max-width: 760px)";
  const DEFAULT_LABELS = [
    "Complaint",
    "Window",
    "User ID",
    "Mobile",
    "Problem / Task",
    "Power",
    "SLA time",
    "Complaint time",
    "Task status",
    "Assigned team",
    "Remark",
    "Action",
    "Created"
  ];
  const SUMMARY_COLUMNS = new Set([1, 2, 4, 6]);
  const INTERACTIVE_SELECTOR = "button, input, select, textarea, label, a, .team-menu";

  function statusDetails(value) {
    const status = String(value || "Pending").trim().toLowerCase();
    if (status === "pick" || status === "running") {
      return { key: "running", label: "In progress" };
    }
    if (status === "unpick") {
      return { key: "attention", label: "Needs attention" };
    }
    return { key: "waiting", label: "Waiting" };
  }

  function allocationDetails(value) {
    const names = String(value || "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
    if (!names.length) {
      return { key: "unallocated", label: "Unallocated", title: "No team allocated" };
    }
    const label = names.length === 1 ? `Team: ${names[0]}` : `Team: ${names[0]} +${names.length - 1}`;
    return { key: "allocated", label, title: `Team: ${names.join(", ")}` };
  }

  function decorate(row, options = {}) {
    if (!row || row.classList.contains("mobile-complaint-card")) {
      return;
    }

    const cells = Array.from(row.children);
    if (!cells.length) {
      return;
    }

    const details = statusDetails(options.status);
    const allocation = allocationDetails(options.team);
    row.classList.add("mobile-complaint-card");
    row.dataset.mobileStatus = details.key;
    row.dataset.mobileAllocation = allocation.key;

    cells.forEach((cell, cellIndex) => {
      cell.dataset.mobileLabel = DEFAULT_LABELS[cellIndex] || "Detail";
      if (SUMMARY_COLUMNS.has(cellIndex)) {
        cell.classList.add("mobile-card-summary");
      } else if (cellIndex > 0) {
        cell.classList.add("mobile-card-detail");
      }
    });

    const numberCell = cells[0];
    const rowNumber = String(options.index ?? numberCell.textContent ?? "").trim();
    numberCell.textContent = "";

    const desktopNumber = document.createElement("span");
    desktopNumber.className = "desktop-row-number";
    desktopNumber.textContent = rowNumber;

    const toggle = document.createElement("button");
    toggle.className = "mobile-card-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", `View complaint ${rowNumber} details`);

    const heading = document.createElement("span");
    heading.className = "mobile-card-heading";
    heading.textContent = `Complaint ${rowNumber}`;

    const status = document.createElement("span");
    status.className = "mobile-card-status";
    status.textContent = allocation.label;
    status.title = allocation.title;

    const action = document.createElement("span");
    action.className = "mobile-card-expand-action";
    const actionText = document.createElement("span");
    actionText.textContent = "Details";
    const arrow = document.createElement("span");
    arrow.className = "mobile-card-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "⌄";
    action.appendChild(actionText);
    action.appendChild(arrow);

    toggle.appendChild(heading);
    toggle.appendChild(status);
    toggle.appendChild(action);
    numberCell.appendChild(desktopNumber);
    numberCell.appendChild(toggle);

    function setExpanded(expanded) {
      row.classList.toggle("mobile-expanded", expanded);
      toggle.setAttribute("aria-expanded", String(expanded));
      toggle.setAttribute("aria-label", `${expanded ? "Hide" : "View"} complaint ${rowNumber} details`);
      actionText.textContent = expanded ? "Hide" : "Details";
      arrow.textContent = expanded ? "⌃" : "⌄";
    }

    function toggleExpanded() {
      const expand = !row.classList.contains("mobile-expanded");
      if (expand && window.matchMedia(MOBILE_QUERY).matches) {
        row.parentElement?.querySelectorAll(".mobile-complaint-card.mobile-expanded").forEach((otherRow) => {
          if (otherRow !== row && typeof otherRow.setMobileCardExpanded === "function") {
            otherRow.setMobileCardExpanded(false);
          }
        });
      }
      setExpanded(expand);
    }

    row.setMobileCardExpanded = setExpanded;
    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleExpanded();
    });
    row.addEventListener("click", (event) => {
      if (!window.matchMedia(MOBILE_QUERY).matches || event.target.closest(INTERACTIVE_SELECTOR)) {
        return;
      }
      toggleExpanded();
    });
  }

  window.TaskMobileCards = { decorate };
})();
