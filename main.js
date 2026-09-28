function isOnDateSchedule(date, sched) {
    const weekday = ".MTWRF."[date.getDay()];
    if (!sched.days?.includes(weekday)) return false;
    if (new Date(sched.dateRange.from) > date) return false;
    if (new Date(sched.dateRange.to) < date) return false;
    return true;
}

function isOnDate(date, cls) {
    for (const sched of cls.schedule) {
        if (isOnDateSchedule(date, sched)) return true;
    }
    return false;
}

function parseTime(time) {
    let [, h, m, clk] = time.match(/^([0-9]{1,2}):([0-9]{1,2}) (am|pm)$/);
    h = +h;
    m = +m;
    if (clk === 'pm' && h !== 12) {
        h += 12;
    }
    return { h, m };
}

function isInTimeSlotSchedule(date, sched) {
    if (!isOnDateSchedule(date, sched)) return false;
    const hour = date.getHours();
    const from = parseTime(sched.time.from);
    const to = parseTime(sched.time.to);
    return (hour > from.h || (hour === from.h && from.m >= 40)) &&
        (hour < to.h);
}

function isInTimeSlot(date, cls) {
    for (const sched of cls.schedule) {
        if (isInTimeSlotSchedule(date, sched)) return true;
    }
    return false;
}

let classes = [];
let currentDate = null;

function loadTimeSlot(date) {
    const classesOnDate = classes.filter((cls) => isOnDate(date, cls));
    const classesInHour = classesOnDate.filter((cls) => isInTimeSlot(date, cls))
        .map((cls) => ({
            code: `${cls.subject} ${cls.code}${cls.type??""}-${cls.section??"0"}`,
            where: cls.schedule.find((sched) => isInTimeSlotSchedule(date, sched)).where,
            name: cls.name
        }))
        .filter((cls) => cls.where != null && !cls.where.startsWith("Altunizade Campus"))
        .sort((a,b) => (a.code > b.code) ? 1 : -1);
    const elem = document.getElementById("list");
    elem.innerHTML = "<tr><th style='min-width: 120px'>Code</th><th style='min-width: 120px'>Where</th><th>Name</th></tr>";
    for (const cls of classesInHour) {
        const tr = document.createElement("tr");
        let td = document.createElement("td");
        td.innerText = cls.code;
        tr.appendChild(td);
        td = document.createElement("td");
        td.innerText = cls.where;
        tr.appendChild(td);
        td = document.createElement("td");
        td.innerText = cls.name;
        tr.appendChild(td);
        elem.appendChild(tr);
    }
    const currElem = document.getElementById("current");
    currElem.innerText = `[${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2, "0")}` +
        `-${date.getDate().toString().padStart(2, "0")} ` +
        `${["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][date.getDay()]} ` +
        `${date.getHours().toString().padStart(2, "0")}:40-` +
        `${((date.getHours()+1)%24).toString().padStart(2, "0")}:30]`;
    currentDate = date;
}

function normalizeDate(date) {
    const newDate = new Date(date);
    if (newDate.getHours() >= 20) {
        newDate.setDate(newDate.getDate() + 1);
        newDate.setHours(8);
    }
    if (newDate.getDay() === 6) {
        newDate.setDate(newDate.getDate() + 2);
        newDate.setHours(8);
    }
    else if (newDate.getDay() === 0) {
        newDate.setDate(newDate.getDate() + 1);
        newDate.setHours(8);
    }
    else if (newDate.getMinutes() < 30) {
        newDate.setHours(newDate.getHours() - 1);
    }
    if (newDate.getHours() < 8) {
        newDate.setHours(8);
    }
    newDate.setMinutes(40);
    return newDate;
}

async function loadPage() {
    const res = await fetch("https://omerrifat.github.io/bannerweb-fetch/dist/202601.json",
        { cache: 'no-cache' });
    classes = await res.json();
    const date = normalizeDate(new Date());
    loadTimeSlot(date);
}

window.prevTimeslot = function(){
    if (currentDate == null) return;
    currentDate.setHours(currentDate.getHours() - 1);
    if (currentDate.getHours() === 7) {
        currentDate.setHours(currentDate.getHours() - 12);
        if (currentDate.getDay() === 0) {
            currentDate.setDate(currentDate.getDate()-2);
        }
    }
    loadTimeSlot(currentDate);
};

window.nextTimeslot = function(){
    if (currentDate == null) return;
    currentDate.setHours(currentDate.getHours() + 1);
    if (currentDate.getHours() === 20) {
        currentDate.setHours(currentDate.getHours() + 12);
        if (currentDate.getDay() === 6) {
            currentDate.setDate(currentDate.getDate()+2);
        }
    }
    loadTimeSlot(currentDate);
}

window.enableWrapChanged = function(){
    const enabled = document.getElementById("wrap").checked;
    const table = document.getElementById("list");
    if (enabled) {
        table.classList.remove("nowrap");
    }
    else {
        table.classList.add("nowrap");
    }
}

loadPage();
