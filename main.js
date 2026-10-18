let classes = [];
let currentDate = null;

const WEEKDAYS = ".MTWRF.";
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Converts a time string to minutes from start of day (e.g., "1:40 pm" -> 820)
function parseTimeToMinutes(timeStr) {
    if (!timeStr) return null;
    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
    if (!match) return null;
    
    let [, h, m, clk] = match;
    h = Number(h);
    m = Number(m);
    if (clk.toLowerCase() === "pm" && h !== 12) h += 12;
    if (clk.toLowerCase() === "am" && h === 12) h = 0;
    return h * 60 + m;
}

// Checks if the given class has an active scheduled session at the specified time slot
function getActiveSchedule(cls, date) {
    if (!Array.isArray(cls.schedule)) return null;
    const weekday = WEEKDAYS[date.getDay()];
    const slotStartMinutes = date.getHours() * 60 + 40; // xx:40 slot start

    return cls.schedule.find((sched) => {
        if (!sched?.days?.includes(weekday) || !sched?.where || !sched?.time?.from || !sched?.time?.to) {
            return false;
        }
        if (sched.where.startsWith("Altunizade Campus")) return false;

        const fromDate = new Date(sched.dateRange.from);
        const toDate = new Date(sched.dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        if (date < fromDate || date > toDate) return false;

        const fromMin = parseTimeToMinutes(sched.time.from);
        const toMin = parseTimeToMinutes(sched.time.to);
        return fromMin <= slotStartMinutes && toMin > slotStartMinutes;
    });
}

const BUILDING_FLOORS = {
    "": ["L", "G", "1", "2", "0"],
    "FENS": ["L", "G", "1", "2"],
    "FASS": ["G", "1", "2"],
    "FMAN": ["L", "G", "0"],
    "UC": ["G"]
};

// Determines the floor identifier(s) for a given room location string
function getFloorsForLocation(where) {
    if (!where) return [];
    const parts = where.trim().split(/\s+/);
    const building = parts[0];
    const room = parts.slice(1).join(" ");
    if (!room) return [];

    // FMAN room aliases: G077 is also known as 1099, matching G, 0, or 1
    if (building === "FMAN" && (room.includes("G077") || room.includes("1099"))) {
        return ["G", "0", "1"];
    }

    const firstChar = room.charAt(0).toUpperCase();
    if (["L", "G", "0", "1", "2"].includes(firstChar)) {
        return [firstChar];
    }
    return [];
}

// Checks if a class is an English Route preparatory course (keeps AL and higher ENG intact)
function isEnglishRouteCourse(cls) {
    if (cls.subject !== "ENG") return false;
    const codeStr = String(cls.code ?? "").trim();
    if (/^(0|1|2|3|4|01|02|03|04|001|002|003|004|0001|0002|0003|0004)$/.test(codeStr)) {
        return true;
    }
    if (cls.name && cls.name.toLowerCase().includes("route")) {
        return true;
    }
    return false;
}

// Renders the table applying current active filters
function renderList() {
    if (!currentDate) return;

    const building = document.getElementById("building-filter")?.value || "";
    const selectedFloor = document.getElementById("floor-filter")?.value || "";
    const rawQuery = (document.getElementById("code-filter")?.value || "").trim().toUpperCase();
    const queryNormalized = rawQuery.replace(/\s+/g, "");
    const hideRoute = document.getElementById("hide-route")?.checked ?? false;

    const activeClasses = [];
    for (const cls of classes) {
        // Hide English Route preparatory courses only (AL is not hidden)
        if (hideRoute && isEnglishRouteCourse(cls)) {
            continue;
        }

        // Subject / course code query filter (e.g., "CS", "300", "CS 300", "CS300")
        if (rawQuery) {
            const subject = (cls.subject || "").toUpperCase();
            const code = String(cls.code ?? "").toUpperCase();
            const fullCode = `${subject} ${code}`;
            const fullCodeNoSpace = `${subject}${code}`;
            const name = (cls.name || "").toUpperCase();

            const matchesQuery = fullCode.includes(rawQuery) ||
                fullCodeNoSpace.includes(queryNormalized) ||
                code.includes(rawQuery) ||
                subject.includes(rawQuery) ||
                name.includes(rawQuery);

            if (!matchesQuery) {
                continue;
            }
        }

        const sched = getActiveSchedule(cls, currentDate);
        if (sched) {
            // Building filter (FENS, FASS, FMAN, UC)
            if (building && !sched.where.startsWith(building)) {
                continue;
            }

            // Floor filter (L, G, 1, 2, 0)
            if (selectedFloor) {
                const roomFloors = getFloorsForLocation(sched.where);
                if (!roomFloors.includes(selectedFloor)) {
                    continue;
                }
            }

            activeClasses.push({
                code: `${cls.subject} ${cls.code}${cls.type ?? ""}-${cls.section ?? "0"}`,
                where: sched.where,
                name: cls.name
            });
        }
    }

    activeClasses.sort((a, b) => a.code.localeCompare(b.code));

    const listElem = document.getElementById("list");
    if (activeClasses.length === 0) {
        listElem.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 24px; color: #6b7280;">No active classes found for this time slot or matching the filters.</td></tr>`;
        return;
    }

    const rowsHtml = activeClasses.map((cls) => 
        `<tr>
            <td class="col-code">${cls.code}</td>
            <td class="col-where">${cls.where}</td>
            <td class="col-name">${cls.name}</td>
        </tr>`
    ).join("");

    listElem.innerHTML = `
        <thead>
            <tr>
                <th class="col-code">Code</th>
                <th class="col-where">Where</th>
                <th class="col-name">Name</th>
            </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
    `;
}

function updateFloorOptions(building) {
    const floorSelect = document.getElementById("floor-filter");
    if (!floorSelect) return;

    const currentVal = floorSelect.value;
    const availableFloors = BUILDING_FLOORS[building] || BUILDING_FLOORS[""];

    let optionsHtml = `<option value="">All Floors</option>`;
    for (const f of availableFloors) {
        optionsHtml += `<option value="${f}">${f}</option>`;
    }
    floorSelect.innerHTML = optionsHtml;

    if (availableFloors.includes(currentVal)) {
        floorSelect.value = currentVal;
    } else {
        floorSelect.value = "";
    }
}

function loadTimeSlot(date) {
    currentDate = date;
    const pad = (n) => n.toString().padStart(2, "0");
    const h = date.getHours();
    
    document.getElementById("current").innerText = 
        `[${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
        `${DAY_NAMES[date.getDay()]} ${pad(h)}:40-${pad((h + 1) % 24)}:30]`;

    renderList();
}

function normalizeDate(date) {
    const d = new Date(date);
    if (d.getHours() >= 20) {
        d.setDate(d.getDate() + 1);
        d.setHours(8);
    }
    if (d.getDay() === 6) { // Saturday -> Monday
        d.setDate(d.getDate() + 2);
        d.setHours(8);
    } else if (d.getDay() === 0) { // Sunday -> Monday
        d.setDate(d.getDate() + 1);
        d.setHours(8);
    } else if (d.getMinutes() < 30) {
        d.setHours(d.getHours() - 1);
    }

    if (d.getHours() < 8) d.setHours(8);
    d.setMinutes(40, 0, 0);
    return d;
}

async function loadPage() {
    const currentElem = document.getElementById("current");
    try {
        // Original live data source
        const res = await fetch("https://omerrifat.github.io/bannerweb-fetch/dist/202601.json", { cache: "no-cache" });
        if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
        classes = await res.json();
        loadTimeSlot(normalizeDate(new Date()));
    } catch (err) {
        console.error("Failed to load course data:", err);
        currentElem.innerText = "Error loading course data.";
    }
}

// Button and input event handlers (bound to window)
window.buildingChanged = function() {
    const building = document.getElementById("building-filter")?.value || "";
    updateFloorOptions(building);
    renderList();
};

window.filterChanged = function() {
    renderList();
};

window.enableWrapChanged = function() {
    const enabled = document.getElementById("wrap")?.checked;
    document.getElementById("list").classList.toggle("nowrap", !enabled);
};

window.prevTimeslot = function() {
    if (!currentDate) return;
    currentDate.setHours(currentDate.getHours() - 1);
    if (currentDate.getHours() === 7) {
        currentDate.setHours(currentDate.getHours() - 12);
        if (currentDate.getDay() === 0) currentDate.setDate(currentDate.getDate() - 2);
    }
    loadTimeSlot(currentDate);
};

window.nextTimeslot = function() {
    if (!currentDate) return;
    currentDate.setHours(currentDate.getHours() + 1);
    if (currentDate.getHours() === 20) {
        currentDate.setHours(currentDate.getHours() + 12);
        if (currentDate.getDay() === 6) currentDate.setDate(currentDate.getDate() + 2);
    }
    loadTimeSlot(currentDate);
};

loadPage();
